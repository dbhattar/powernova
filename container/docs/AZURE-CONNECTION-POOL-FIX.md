# Azure PostgreSQL Connection Pool Exhaustion - Fix Guide

## Error

```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 0 reached, 
connection timed out, timeout 30.00
```

## Problem

The application is running out of available database connections. This happens when:

1. **Pool size too small** - Default was 5 connections for Supabase, but Azure can handle more
2. **Connections not being released** - Code not properly closing database sessions
3. **Long-running operations** - Background tasks holding connections too long
4. **Connection leaks** - Sessions created but never closed

## Solution

### ✅ 1. Increase Connection Pool Size (Applied)

**File Updated**: `api/database/session.py`

**Changes**:
```python
# OLD (Supabase conservative settings)
DB_POOL_SIZE = 3
DB_MAX_OVERFLOW = 5
# Total: 3 + 5 = 8 max connections

# NEW (Azure optimized settings)
DB_POOL_SIZE = 10
DB_MAX_OVERFLOW = 20
# Total: 10 + 20 = 30 max connections
```

**Why This Helps**:
- Azure PostgreSQL Flexible Server has much higher connection limits than Supabase
- Default `max_connections` on Azure is typically 50-100+ depending on SKU
- More connections available for concurrent requests and background tasks

### ✅ 2. Configure Azure PostgreSQL for Higher Connections

**Option A: Update via Azure Portal**

1. Go to Azure Portal → Your PostgreSQL server
2. Navigate to **Settings** → **Server parameters**
3. Find `max_connections`
4. Set to appropriate value based on your SKU:
   - **Burstable (B2s)**: 100-150
   - **General Purpose (D2s_v3)**: 200-400
5. Click **Save** and restart if required

**Option B: Update via Azure CLI**

```bash
# Check current max_connections
az postgres flexible-server parameter show \
  --resource-group powernova-rg \
  --server-name powernova-db \
  --name max_connections

# Update max_connections
az postgres flexible-server parameter set \
  --resource-group powernova-rg \
  --server-name powernova-db \
  --name max_connections \
  --value 150

# Verify
az postgres flexible-server parameter show \
  --resource-group powernova-rg \
  --server-name powernova-db \
  --name max_connections
```

### ✅ 3. Set Environment Variables (Recommended)

**For Azure Container Apps**:

```bash
# Update environment variables
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars \
    DB_POOL_SIZE=10 \
    DB_MAX_OVERFLOW=20 \
    DB_POOL_TIMEOUT=30 \
    DB_POOL_RECYCLE=1800
```

**For Docker Compose (local/dev)**:

```yaml
# docker-compose.yml
services:
  api:
    environment:
      - DB_POOL_SIZE=10
      - DB_MAX_OVERFLOW=20
      - DB_POOL_TIMEOUT=30
      - DB_POOL_RECYCLE=1800
```

**For .env file**:

```bash
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
```

### ⚠️ 4. Fix Connection Leaks

**Problem Locations Identified**:

**File**: `api/main.py` (line ~51)
```python
# ❌ PROBLEM: Direct SessionLocal() usage
db = SessionLocal()
try:
    # ... database operations
finally:
    db.close()

# ✅ SOLUTION: Use context manager
from database.session import SessionLocal

with SessionLocal() as db:
    # ... database operations
    # Automatically closes when exiting with block
```

**File**: `api/services/crawler.py` (line ~858)
```python
# ❌ PROBLEM: Direct SessionLocal() usage in background thread
db = SessionLocal()
# ... long-running crawler operations

# ✅ SOLUTION: Use context manager or ensure cleanup
from database.session import SessionLocal

def run_crawler(job_id: int):
    db = SessionLocal()
    try:
        # ... crawler operations
    except Exception as e:
        db.rollback()
        raise
    finally:
        # CRITICAL: Always close the session
        db.close()
```

### 📊 5. Monitor Connection Usage

**Add Connection Pool Monitoring**:

Create `api/monitoring/db_pool.py`:

```python
from database.session import engine
from fastapi import APIRouter

router = APIRouter()

@router.get("/api/admin/db-pool-status")
async def get_db_pool_status():
    """
    Get current database connection pool status
    Useful for monitoring and debugging
    """
    pool = engine.pool
    
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "total_connections": pool.checkedin() + pool.checkedout(),
        "max_connections": pool.size() + pool._max_overflow,
        "timeout": pool._timeout,
    }
```

**Add to `main.py`**:

```python
from monitoring import db_pool

app.include_router(db_pool.router, tags=["Monitoring"])
```

**Check pool status**:

```bash
curl https://api.powernova.ai/api/admin/db-pool-status

# Example response:
{
  "pool_size": 10,
  "checked_in": 8,
  "checked_out": 2,
  "overflow": 0,
  "total_connections": 10,
  "max_connections": 30,
  "timeout": 30
}
```

### 🔍 6. Debugging Connection Issues

**Check Active Connections on Azure**:

```sql
-- Connect to Azure PostgreSQL
psql "$AZURE_DATABASE_URL"

-- Check current connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    state,
    query
FROM pg_stat_activity
WHERE datname = 'postgres'
ORDER BY backend_start;

-- Check connection count by state
SELECT state, count(*) 
FROM pg_stat_activity 
WHERE datname = 'postgres'
GROUP BY state;

-- Check max_connections setting
SHOW max_connections;

-- Check current connection count
SELECT count(*) FROM pg_stat_activity;
```

**Enable SQLAlchemy Logging**:

```python
# In session.py, temporarily enable echo
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    echo=True,  # Enable SQL logging
    echo_pool=True,  # Enable pool event logging
)
```

### 🚀 7. Apply the Fix

**Immediate Fix (No Code Changes)**:

```bash
# Update Azure environment variables
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars \
    DB_POOL_SIZE=10 \
    DB_MAX_OVERFLOW=20

# The container will restart automatically
# Monitor logs:
az containerapp logs show \
  --name powernova-api \
  --resource-group powernova-rg \
  --follow
```

**Long-term Fix (Code Changes)**:

1. **Update code** to use context managers
2. **Fix crawler.py** to properly close sessions
3. **Add monitoring** endpoint
4. **Deploy updated code**

```bash
# After code changes
git add .
git commit -m "fix: Improve database connection pool management"
git push

# Deployment will happen automatically via CI/CD
```

## Configuration Recommendations by Environment

### Development (Local)

```bash
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
# Total: 15 connections
```

### Staging

```bash
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=15
# Total: 25 connections
```

### Production

```bash
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
# Total: 30 connections

# For high-traffic production:
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
# Total: 50 connections
```

**Azure PostgreSQL Settings** (must accommodate all apps):

- **Development**: `max_connections = 50`
- **Staging**: `max_connections = 100`
- **Production**: `max_connections = 150-200`

## Verification Steps

### 1. Check Pool Configuration

```bash
# View API logs on startup
az containerapp logs show \
  --name powernova-api \
  --resource-group powernova-rg \
  --tail 50

# Look for:
# "✓ Engine created with QueuePool (10+20)"
```

### 2. Test Under Load

```bash
# Send multiple concurrent requests
for i in {1..20}; do
  curl https://api.powernova.ai/health &
done
wait

# Should all succeed without timeout errors
```

### 3. Monitor Logs for Errors

```bash
# Watch for connection errors
az containerapp logs show \
  --name powernova-api \
  --resource-group powernova-rg \
  --follow | grep -i "timeout\|pool\|connection"
```

### 4. Check Pool Status

```bash
# If you added the monitoring endpoint
curl https://api.powernova.ai/api/admin/db-pool-status

# Example healthy response:
{
  "checked_out": 2,
  "checked_in": 8,
  "overflow": 0,
  "max_connections": 30
}
```

## Troubleshooting

### Still Getting Timeouts After Increasing Pool Size?

**Possible Causes**:

1. **Connection leaks** - Code not closing sessions
   - Solution: Audit all `SessionLocal()` usage
   - Ensure all have `try/finally` with `db.close()`

2. **Long-running queries** - Blocking connections
   - Solution: Add query timeouts
   - Optimize slow queries
   - Use background tasks for long operations

3. **Azure max_connections too low**
   - Solution: Increase `max_connections` on Azure
   - Check current: `SHOW max_connections;`

4. **Too many concurrent background tasks**
   - Solution: Limit crawler concurrency
   - Use task queue (Celery, Redis Queue)
   - Throttle background operations

### High Memory Usage?

Larger connection pools use more memory:

```
Memory per connection: ~10-20 MB
30 connections: ~300-600 MB
```

**Solutions**:
- Monitor container memory
- Increase container memory limit if needed
- Balance pool size vs memory constraints

### Connections Not Being Released?

**Debug with**:

```sql
-- Find idle connections
SELECT * FROM pg_stat_activity 
WHERE state = 'idle' 
AND datname = 'postgres'
ORDER BY state_change;

-- Find long-running queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

## Best Practices

### ✅ DO

- Use `get_db()` dependency in FastAPI routes
- Always use context managers: `with SessionLocal() as db:`
- Close sessions in `finally` blocks
- Monitor connection pool usage
- Set appropriate pool size for your load
- Configure Azure `max_connections` appropriately
- Use `pool_pre_ping=True` to detect stale connections

### ❌ DON'T

- Create sessions without closing them
- Hold database connections during slow operations
- Set pool size larger than Azure `max_connections`
- Forget to commit or rollback transactions
- Use same connection across async boundaries

## Summary

**Immediate Actions**:
1. ✅ Updated `DB_POOL_SIZE=10` and `DB_MAX_OVERFLOW=20` in session.py
2. ⏳ Set environment variables in Azure Container Apps
3. ⏳ Verify Azure PostgreSQL `max_connections >= 50`

**Follow-up Actions**:
1. Audit and fix `SessionLocal()` usage in crawler.py
2. Add connection pool monitoring endpoint
3. Monitor logs for connection issues
4. Consider connection pooler (PgBouncer) for very high traffic

**Expected Result**:
- No more timeout errors
- 30 max connections available (10 pool + 20 overflow)
- Proper connection lifecycle management
- Better visibility into pool usage

## See Also

- [SQLAlchemy Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [Azure PostgreSQL Connection Limits](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-limits)
- [FastAPI Database Dependencies](https://fastapi.tiangolo.com/tutorial/sql-databases/)
