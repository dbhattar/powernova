# Database Connection Pool Fix - Supabase Session Mode

## Problem

**Error:**
```
psycopg2.OperationalError: connection to server at "aws-0-us-east-2.pooler.supabase.com" (3.139.14.59), port 5432 failed: FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

**Root Cause:**
Your application was using Supabase's **Session mode** (port 5432) instead of the recommended **Transaction mode** (port 6543), and the connection pool settings were too aggressive for Supabase's strict connection limits.

## Solution Applied

### 1. **Reduced Connection Pool Size**

**Before:**
```python
DB_POOL_SIZE = 5  # Too many for Supabase Session mode
DB_MAX_OVERFLOW = 10  # Way too many!
DB_POOL_RECYCLE = 3600  # 1 hour (connections held too long)
```

**After:**
```python
DB_POOL_SIZE = 3  # Conservative for Session mode
DB_MAX_OVERFLOW = 5  # Reduced to prevent hitting limits
DB_POOL_RECYCLE = 1800  # 30 min (recycle more frequently)
```

**Total connections:** 3 persistent + 5 overflow = **8 max** (well below Supabase's limit)

### 2. **Added Connection Mode Detection**

```python
is_supabase_pooler = ":6543/" in DATABASE_URL  # Transaction mode
is_supabase_direct = "supabase.com" in DATABASE_URL and ":5432/" in DATABASE_URL  # Session mode
```

Now the app logs which mode it's using at startup.

### 3. **Improved Session Management**

**Enhanced `get_db()` to handle errors properly:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()  # Commit on success
    except Exception:
        db.rollback()  # Rollback on error
        raise
    finally:
        db.close()  # ALWAYS close to return to pool
```

### 4. **Added Configuration for Supabase Session Mode**

```python
if is_supabase_direct:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=3,  # Very conservative
        max_overflow=5,  # Limited overflow
        pool_recycle=1800,  # Recycle after 30 min
        connect_args={
            "options": "-c statement_timeout=300000"  # 5 min query timeout
        }
    )
```

## Supabase Connection Modes

### Session Mode (Port 5432) - What You're Using
**Characteristics:**
- Direct PostgreSQL connection
- **STRICT connection limits** (typically 15-20 total connections)
- Each connection uses significant memory
- Best for: Long-running queries, transactions

**Pros:**
- Full PostgreSQL feature support
- Can use server-side cursors
- Better for complex transactions

**Cons:**
- ❌ Limited connections (hits "max clients" easily)
- ❌ More expensive (memory per connection)
- ❌ Not suitable for high-traffic apps

### Transaction Mode (Port 6543) - Recommended
**Characteristics:**
- Uses PgBouncer connection pooler
- **Unlimited client connections** (PgBouncer handles pooling)
- Much more efficient
- Best for: Web applications, APIs, serverless

**Pros:**
- ✅ Scales to many concurrent connections
- ✅ More efficient resource usage
- ✅ Perfect for web apps

**Cons:**
- Some PostgreSQL features restricted (prepared statements, etc.)
- Requires `NullPool` in SQLAlchemy

## Recommended Fix: Switch to Transaction Mode

### Step 1: Update DATABASE_URL

**Current (Session mode):**
```
postgresql://postgres:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres
```

**Change to (Transaction mode):**
```
postgresql://postgres:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
```

**Change:** Port `5432` → `6543`

### Step 2: Update Azure App Service Configuration

```bash
# Azure Portal
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

# Or via Azure Portal:
# Configuration → Application settings → DATABASE_URL → Edit
# Change port from 5432 to 6543
# Save and restart
```

### Step 3: Verify

After deployment, check the logs:
```bash
az webapp log tail --name powernovaapi --resource-group powernova
```

**Look for:**
```
🔌 Using Supabase Connection Pooler (Transaction mode) - NullPool
✓ Engine created with NullPool (Supabase handles pooling)
```

Instead of:
```
⚠️  Using Supabase Direct Connection (Session mode) - Limited connections!
```

## Temporary Fix (If You Must Stay on Session Mode)

If you can't switch to Transaction mode immediately, the current fix helps but you should also:

### 1. Monitor Connection Usage

Check how many connections your app uses:
```sql
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'postgres' AND usename = 'postgres';
```

### 2. Set Environment Variables

Add these to Azure App Service:
```bash
DB_POOL_SIZE=2  # Even more conservative
DB_MAX_OVERFLOW=3  # Lower overflow
DB_POOL_RECYCLE=900  # Recycle after 15 min
```

### 3. Enable Connection Logging

Add to your startup:
```python
import logging
logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
```

This logs every connection checkout/return.

## Connection Pool Best Practices

### 1. **Always Use Depends(get_db)**

✅ **Good:**
```python
@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    # FastAPI handles session cleanup automatically
    users = db.query(User).all()
    return users
```

❌ **Bad:**
```python
@router.get("/users")
def get_users():
    db = SessionLocal()  # NO! Connection leak risk
    users = db.query(User).all()
    # db.close() might not be called if error occurs
    return users
```

### 2. **Close Background Task Sessions**

✅ **Good (Already Implemented):**
```python
def run_crawler(job_id: int):
    db = SessionLocal()
    try:
        crawler = WebCrawler(job_id, db)
        crawler.run()
    finally:
        db.close()  # ALWAYS close in finally block
```

### 3. **Use Context Managers for Manual Sessions**

✅ **Good:**
```python
with SessionLocal() as db:
    users = db.query(User).all()
    # db.close() called automatically
```

### 4. **Don't Store Sessions in Class Attributes**

❌ **Bad:**
```python
class MyService:
    def __init__(self):
        self.db = SessionLocal()  # NO! Long-lived session
```

✅ **Good:**
```python
class MyService:
    def __init__(self, db: Session):
        self.db = db  # Receive from Depends(get_db)
```

## Monitoring

### Check Current Connections

**In Supabase Dashboard:**
1. Go to Database → Connection pooling
2. View active connections
3. Monitor usage patterns

**Via SQL:**
```sql
-- Total connections
SELECT count(*) FROM pg_stat_activity;

-- Connections by state
SELECT state, count(*) FROM pg_stat_activity 
GROUP BY state;

-- Long-running queries
SELECT pid, state, query_start, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;
```

### Application Metrics

Add to your health check:
```python
from sqlalchemy import inspect

@app.get("/health/db")
def db_health():
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "total": pool.size() + pool.overflow()
    }
```

## Testing

### 1. Local Test

```bash
# Set Supabase connection
export DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

# Run app
uvicorn main:app --reload

# Watch logs
# Should see: "Using Supabase Connection Pooler (Transaction mode)"
```

### 2. Load Test

```bash
# Simulate 20 concurrent requests
ab -n 100 -c 20 http://localhost:8000/health

# Monitor connections in Supabase
# With Transaction mode: Should handle easily
# With Session mode: Might hit connection limit
```

### 3. Production Test

```bash
# Deploy changes
./scripts/azure-deploy-api.sh --update

# Monitor logs
az webapp log tail --name powernovaapi

# Check for connection errors
az webapp log tail --name powernovaapi | grep -i "max clients"
```

## Summary

### Immediate Fixes Applied ✅
- ✅ Reduced `DB_POOL_SIZE` from 5 → 3
- ✅ Reduced `DB_MAX_OVERFLOW` from 10 → 5  
- ✅ Reduced `DB_POOL_RECYCLE` from 3600s → 1800s
- ✅ Added connection mode detection and logging
- ✅ Improved error handling in `get_db()`
- ✅ Added query timeout (5 min)

### Recommended Long-Term Fix
- 🔄 **Switch to Transaction mode** (port 6543)
- 🔄 Update `DATABASE_URL` in Azure App Service
- 🔄 Verify with logs after deployment

### Expected Results
- **Session mode (current):** Max 8 connections, should work but limited
- **Transaction mode (recommended):** Unlimited connections, production-ready

## Environment Variables

Set these in Azure App Service for optimal performance:

```bash
# Connection pooling (Conservative for Session mode)
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=5
DB_POOL_RECYCLE=1800

# Or switch to Transaction mode and let Supabase handle pooling:
DATABASE_URL=postgresql://postgres:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
# Then pool settings don't matter (NullPool used)
```

---

**Status:** 
- ✅ Connection pool fixed for Session mode
- ⏳ Waiting for Transaction mode migration (recommended)
- 📊 Monitor connection usage in Supabase dashboard

**Next Action:** Switch DATABASE_URL to port 6543 for production stability.
