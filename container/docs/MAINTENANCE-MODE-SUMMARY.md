# Maintenance Mode Implementation - Quick Summary

## What Was Implemented

✅ **Backend (FastAPI)**
- Added `MaintenanceMiddleware` that checks `MAINTENANCE_MODE` environment variable
- Created `/api/maintenance/status` endpoint (always accessible)
- Middleware blocks all API requests with 503 when maintenance mode is active
- Exceptions: `/health` and `/api/maintenance/status` always accessible

✅ **Frontend (JavaScript + HTML + CSS)**
- Created `maintenance.js` module with status checking and UI management
- Updated `index.html` to load maintenance.js and wrap content in `#app-container`
- Updated `app.js` to check maintenance mode before initializing app
- Added beautiful gradient maintenance UI with animations
- Auto-polling every 30 seconds with automatic page reload when maintenance ends

✅ **Documentation**
- Created comprehensive `MAINTENANCE-MODE.md` guide
- Created `test-maintenance-mode.sh` test script
- Includes testing instructions, troubleshooting, and migration workflow integration

## Files Modified

### Backend
- `api/main.py` - Added MaintenanceMiddleware and /api/maintenance/status endpoint

### Frontend
- `app/index.html` - Added maintenance.js script and #app-container wrapper
- `app/js/maintenance.js` - NEW: Maintenance mode detection and UI management
- `app/js/app.js` - Updated DOMContentLoaded to check maintenance first
- `app/css/styles.css` - Added maintenance mode styles (gradient, animations, spinner)

### Documentation & Scripts
- `docs/MAINTENANCE-MODE.md` - NEW: Comprehensive guide
- `scripts/test-maintenance-mode.sh` - NEW: Testing script

## How to Use

### Enable Maintenance Mode

**Local (Docker):**
```bash
export MAINTENANCE_MODE=true
docker-compose restart api
```

**Azure:**
```bash
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=true
```

### Disable Maintenance Mode

**Local:**
```bash
export MAINTENANCE_MODE=false
docker-compose restart api
```

**Azure:**
```bash
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=false
```

### Test

```bash
# Test maintenance mode status
./scripts/test-maintenance-mode.sh

# Or manually test
curl http://localhost:8000/api/maintenance/status
curl -i http://localhost:8000/api/chat/conversations  # Should return 503 if maintenance is on
```

## Migration Workflow

```bash
# 1. Enable maintenance mode
export MAINTENANCE_MODE=true
docker-compose restart api  # or use az containerapp update for Azure

# 2. Verify users see maintenance page
# Open http://localhost:8081 or https://app.powernova.ai

# 3. Perform migration
./scripts/dump-supabase-database.sh -c
./scripts/restore-to-azure.sh -i backup.sql.gz
./scripts/validate-azure-database.sh

# 4. Update DATABASE_URL (if switching databases)
# Update environment variable in docker-compose or Azure

# 5. Test migrated database
# Run application tests

# 6. Disable maintenance mode
export MAINTENANCE_MODE=false
docker-compose restart api  # or use az containerapp update for Azure

# 7. Frontend auto-reloads within 30 seconds!
```

## What Happens When Maintenance Mode is Enabled

### Backend
- All API endpoints return: `503 Service Unavailable`
- Exception endpoints:
  - `/health` - Still returns 200 or 503 based on database health
  - `/api/maintenance/status` - Returns maintenance status
- **Background tasks are suspended**:
  - ⚠️ **Auto-resume of crawl jobs is SKIPPED**
  - No background threads are started during maintenance
  - Prevents database writes from background processes
  - This is critical during database migration!
- Response body:
  ```json
  {
    "error": "Service Unavailable",
    "message": "PowerNOVA is currently undergoing scheduled maintenance...",
    "maintenance": true
  }
  ```

### Frontend
- Shows beautiful full-screen maintenance page
- Features:
  - Gradient purple background
  - Animated tools icon
  - User-friendly message
  - Estimated duration (30-60 minutes)
  - Loading spinner
  - Auto-refresh notice
- Polls `/api/maintenance/status` every 30 seconds
- Automatically reloads page when maintenance ends

## Testing Checklist

- [ ] Test with `MAINTENANCE_MODE=true`
  - [ ] API returns 503 for regular endpoints
  - [ ] `/health` still accessible
  - [ ] `/api/maintenance/status` returns `{"maintenance": true}`
  - [ ] Frontend shows maintenance UI
  - [ ] Browser console shows polling logs

- [ ] Test with `MAINTENANCE_MODE=false`
  - [ ] API returns normal responses
  - [ ] `/api/maintenance/status` returns `{"maintenance": false}`
  - [ ] Frontend shows normal chat interface
  - [ ] No maintenance UI visible

- [ ] Test auto-recovery
  - [ ] Enable maintenance mode
  - [ ] Open frontend (should show maintenance UI)
  - [ ] Disable maintenance mode
  - [ ] Wait 30 seconds
  - [ ] Frontend should auto-reload and show chat

## Next Steps

1. **Test Locally**: Run `./scripts/test-maintenance-mode.sh`
2. **Test Frontend**: Open `http://localhost:8081` with maintenance mode enabled
3. **Ready for Migration**: Use maintenance mode during database migration
4. **Monitor**: Check Azure logs during maintenance window

## See Also

- [Complete Documentation](../docs/MAINTENANCE-MODE.md)
- [Migration Scripts](MIGRATION-SCRIPTS-README.md)
- [Database Validation](VALIDATION-REFERENCE.md)
