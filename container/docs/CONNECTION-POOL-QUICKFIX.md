# Quick Fix for Connection Pool Timeout Error

## Problem
```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 0 reached
```

## Immediate Fix (No Deployment Required)

### Step 1: Update Azure Environment Variables

```bash
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars \
    DB_POOL_SIZE=10 \
    DB_MAX_OVERFLOW=20
```

The container will restart automatically with the new settings.

### Step 2: Verify the Fix

```bash
# Watch logs to confirm new pool size
az containerapp logs show \
  --name powernova-api \
  --resource-group powernova-rg \
  --tail 20

# Look for line like:
# "✓ Engine created with QueuePool (10+20)"
```

### Step 3: Test the Application

```bash
# Test health endpoint
curl https://api.powernova.ai/health

# Send multiple concurrent requests to verify no timeouts
for i in {1..20}; do
  curl https://api.powernova.ai/health &
done
wait
```

## Optional: Increase Azure PostgreSQL Max Connections

```bash
# Check current setting
az postgres flexible-server parameter show \
  --resource-group powernova-rg \
  --server-name powernova-db \
  --name max_connections

# Increase if needed (recommended: 100-150)
az postgres flexible-server parameter set \
  --resource-group powernova-rg \
  --server-name powernova-db \
  --name max_connections \
  --value 100
```

## Code Changes (For Next Deployment)

I've already made these changes in your local repository:

1. ✅ Updated default pool size: 10 (was 5)
2. ✅ Updated default overflow: 20 (was 0)  
3. ✅ Created monitoring endpoint: `/api/admin/db-pool-status`

### Deploy Code Changes

```bash
# Commit and push
git add .
git commit -m "fix: Increase database connection pool for Azure"
git push

# Your CI/CD will deploy automatically
```

### After Deployment - Monitor Pool Health

```bash
# Check pool status
curl https://api.powernova.ai/api/admin/db-pool-status

# Response example:
{
  "status": "healthy",
  "pool_size": 10,
  "checked_in": 8,
  "checked_out": 2,
  "overflow": 0,
  "total_connections": 10,
  "max_connections": 30,
  "usage_percent": 6.67
}
```

## What Changed

### Before (Supabase Settings)
- Pool size: 3-5 connections
- Max overflow: 0-5 connections
- **Total: 8 max connections**
- Optimized for Supabase's strict limits

### After (Azure Settings)
- Pool size: 10 connections
- Max overflow: 20 connections
- **Total: 30 max connections**
- Optimized for Azure PostgreSQL Flexible Server

## Monitoring

After deploying the code changes, monitor pool health:

```bash
# Quick check
curl https://api.powernova.ai/api/admin/db-pool-status | jq

# Continuous monitoring (every 10 seconds)
watch -n 10 'curl -s https://api.powernova.ai/api/admin/db-pool-status | jq'
```

## If Issues Persist

See comprehensive troubleshooting guide: `docs/AZURE-CONNECTION-POOL-FIX.md`

## Summary

✅ **Immediate**: Set env vars via Azure CLI (no code deployment needed)  
✅ **Next deployment**: Code changes will apply new defaults  
✅ **Monitoring**: New endpoint to track pool usage  
✅ **Azure DB**: Verify max_connections is adequate (100+)  

**Expected Result**: No more timeout errors! 🎉
