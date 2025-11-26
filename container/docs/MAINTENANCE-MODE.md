# PowerNOVA Maintenance Mode

## Overview

The maintenance mode feature allows you to gracefully put the PowerNOVA application into a maintenance state during critical operations like database migrations, system upgrades, or scheduled downtime.

When enabled:
- **Backend API**: Returns 503 Service Unavailable for all requests (except health/status endpoints)
- **Frontend**: Displays a user-friendly maintenance page with status updates
- **Auto-Recovery**: Automatically checks status and restores service when maintenance ends

## How It Works

### Backend (FastAPI)

1. **Environment Variable**: `MAINTENANCE_MODE`
   - Set to `true`, `1`, or `yes` to enable maintenance mode
   - Set to `false`, `0`, `no`, or leave unset to disable

2. **Maintenance Status Endpoint**: `/api/maintenance/status`
   - Always accessible (not blocked by middleware)
   - Returns maintenance status and message
   - Response format:
     ```json
     {
       "maintenance": true,
       "message": "PowerNOVA is currently undergoing scheduled maintenance...",
       "estimated_duration": "30-60 minutes"
     }
     ```

3. **Maintenance Middleware**:
   - Intercepts all API requests
   - Allows `/health` and `/api/maintenance/status` to pass through
   - Returns 503 for all other endpoints when maintenance mode is active

4. **Background Tasks**:
   - **IMPORTANT**: When maintenance mode is enabled, background tasks are **NOT started**
   - Auto-resume of interrupted crawl jobs is skipped during maintenance
   - This prevents background processes from interfering with database operations during migration
   - Background tasks will resume automatically when maintenance mode is disabled

### Frontend (JavaScript)

1. **Maintenance Detection**:
   - Checks `/api/maintenance/status` on page load
   - If maintenance mode detected, shows maintenance UI
   - If normal mode, initializes the chat application

2. **Maintenance UI**:
   - Full-screen overlay with gradient background
   - User-friendly message and estimated duration
   - Animated loading spinner
   - Automatic status polling every 30 seconds

3. **Auto-Recovery**:
   - Polls status endpoint every 30 seconds
   - Automatically reloads page when maintenance ends
   - No user intervention required

## Usage

### Enable Maintenance Mode

#### Local Development
```bash
# Export environment variable
export MAINTENANCE_MODE=true

# Restart the API server
docker-compose restart api
# OR if running locally:
# Kill and restart your uvicorn server
```

#### Docker Compose
```yaml
# docker/docker-compose.yml
services:
  api:
    environment:
      - MAINTENANCE_MODE=true
```

#### Azure Container Apps
```bash
# Update environment variable
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=true

# The container will restart automatically
```

### Disable Maintenance Mode

#### Local Development
```bash
# Unset or set to false
export MAINTENANCE_MODE=false

# Restart the API server
docker-compose restart api
```

#### Azure Container Apps
```bash
# Update environment variable
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=false
```

## Testing Maintenance Mode

### Test Locally

1. **Start your local environment**:
   ```bash
   cd docker
   docker-compose up
   ```

2. **Enable maintenance mode**:
   ```bash
   # In a new terminal
   docker-compose exec api sh -c "export MAINTENANCE_MODE=true && kill 1"
   # This will restart the API container with maintenance mode enabled
   ```

3. **Open the app**: Navigate to `http://localhost:8081`
   - You should see the maintenance mode UI
   - Check browser console for status check logs

4. **Test API directly**:
   ```bash
   # Status endpoint (should work)
   curl http://localhost:8000/api/maintenance/status
   
   # Any other endpoint (should return 503)
   curl -i http://localhost:8000/api/chat/conversations
   # Expected: HTTP/1.1 503 Service Unavailable
   ```

5. **Disable maintenance mode**:
   ```bash
   docker-compose exec api sh -c "export MAINTENANCE_MODE=false && kill 1"
   ```

6. **Verify auto-recovery**:
   - The frontend should automatically reload within 30 seconds
   - You should see the normal chat interface

### Test Production Flow

1. **Enable maintenance mode before migration**:
   ```bash
   az containerapp update \
     --name powernova-api \
     --resource-group powernova-rg \
     --set-env-vars MAINTENANCE_MODE=true
   ```

2. **Verify maintenance mode is active**:
   ```bash
   curl https://api.powernova.ai/api/maintenance/status
   # Should return: {"maintenance": true, ...}
   
   curl -i https://api.powernova.ai/api/chat/conversations
   # Should return: 503 Service Unavailable
   ```

3. **Check frontend**: Visit `https://app.powernova.ai`
   - Should show maintenance page

4. **Perform migration**:
   ```bash
   # Run your migration scripts
   ./scripts/dump-supabase-database.sh -c
   ./scripts/restore-to-azure.sh -i backup.sql.gz
   ```

5. **Update DATABASE_URL** (if needed)

6. **Test the migrated database**:
   ```bash
   ./scripts/validate-azure-database.sh
   ```

7. **Disable maintenance mode**:
   ```bash
   az containerapp update \
     --name powernova-api \
     --resource-group powernova-rg \
     --set-env-vars MAINTENANCE_MODE=false
   ```

8. **Verify service restoration**:
   - Frontend should auto-reload within 30 seconds
   - Test chat functionality
   - Check logs for errors

## Migration Workflow Integration

### Complete Migration Process with Maintenance Mode

```bash
# 1. Enable maintenance mode
echo "Enabling maintenance mode..."
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=true

# Wait for propagation
sleep 10

# 2. Verify maintenance mode is active
curl https://api.powernova.ai/api/maintenance/status

# 3. Dump Supabase database
echo "Dumping Supabase database..."
./scripts/dump-supabase-database.sh -c

# 4. Restore to Azure
echo "Restoring to Azure PostgreSQL..."
./scripts/restore-to-azure.sh -i backup.sql.gz

# 5. Validate Azure database
echo "Validating Azure database..."
./scripts/validate-azure-database.sh

# 6. Update DATABASE_URL (if switching databases)
# az containerapp update \
#   --name powernova-api \
#   --resource-group powernova-rg \
#   --set-env-vars DATABASE_URL="postgresql://user:pass@azure-server/db"

# 7. Restart API to pick up new DATABASE_URL (if changed)
# az containerapp revision restart \
#   --name powernova-api \
#   --resource-group powernova-rg

# 8. Test the application
echo "Testing application..."
# Manual testing or automated health checks

# 9. Disable maintenance mode
echo "Disabling maintenance mode..."
az containerapp update \
  --name powernova-api \
  --resource-group powernova-rg \
  --set-env-vars MAINTENANCE_MODE=false

echo "Migration complete! Service restored."
```

## Architecture

### Backend Components

```
api/main.py
├── MaintenanceMiddleware (line ~110)
│   ├── Checks MAINTENANCE_MODE env var
│   ├── Allows /health and /api/maintenance/status
│   └── Returns 503 for other endpoints
│
└── /api/maintenance/status endpoint (line ~180)
    ├── Reads MAINTENANCE_MODE env var
    ├── Returns maintenance status
    └── Always accessible
```

### Frontend Components

```
app/
├── index.html (updated)
│   ├── Loads maintenance.js before app.js
│   ├── Wrapped content in #app-container
│   └── Maintenance UI injected dynamically
│
├── js/maintenance.js (new)
│   ├── checkStatus() - Checks /api/maintenance/status
│   ├── showMaintenanceUI() - Shows maintenance page
│   ├── hideMaintenanceUI() - Hides maintenance page
│   ├── startPolling() - Auto-check every 30 seconds
│   └── init() - Called on page load
│
├── js/app.js (updated)
│   └── DOMContentLoaded handler checks maintenance first
│
└── css/styles.css (updated)
    └── Maintenance mode styles (gradient, animation, spinner)
```

## Troubleshooting

### Maintenance mode not activating

**Check environment variable**:
```bash
# Docker
docker-compose exec api env | grep MAINTENANCE_MODE

# Azure
az containerapp show \
  --name powernova-api \
  --resource-group powernova-rg \
  --query "properties.template.containers[0].env" \
  -o table
```

**Check API logs**:
```bash
# Docker
docker-compose logs api

# Azure
az containerapp logs show \
  --name powernova-api \
  --resource-group powernova-rg \
  --tail 50
```

### Frontend not showing maintenance UI

1. **Check browser console** for JavaScript errors
2. **Verify API endpoint** is accessible:
   ```bash
   curl https://api.powernova.ai/api/maintenance/status
   ```
3. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
4. **Check CORS settings** in `api/main.py`

### Maintenance mode won't disable

1. **Verify environment variable is set to false**:
   ```bash
   az containerapp show \
     --name powernova-api \
     --resource-group powernova-rg \
     --query "properties.template.containers[0].env"
   ```

2. **Restart the container**:
   ```bash
   az containerapp revision restart \
     --name powernova-api \
     --resource-group powernova-rg
   ```

3. **Check for typos**:
   - Environment variable name: `MAINTENANCE_MODE` (case-sensitive)
   - Valid false values: `false`, `0`, `no`, or empty/unset

## Security Considerations

- The `/health` endpoint remains accessible for monitoring/load balancers
- The `/api/maintenance/status` endpoint is public (no authentication required)
- All other endpoints are blocked during maintenance (including authenticated routes)
- No sensitive information is exposed in maintenance responses

## Performance Impact

- **Minimal overhead** when maintenance mode is disabled (single env var check)
- **Negligible latency** when enabled (middleware returns 503 immediately)
- **Frontend polling** uses 30-second intervals to minimize API load

## Best Practices

1. **Notify users** before enabling maintenance mode (email, social media, etc.)
2. **Set realistic estimated duration** in the maintenance message
3. **Test in development** before using in production
4. **Monitor logs** during maintenance for any issues
5. **Keep Supabase running** as backup for 7+ days after migration
6. **Document downtime** window for compliance/SLA purposes

## See Also

- [Migration Scripts README](../scripts/MIGRATION-SCRIPTS-README.md)
- [Database Validation Reference](../scripts/VALIDATION-REFERENCE.md)
- [Azure PostgreSQL Deployment](AZURE-POSTGRESQL-DEPLOYMENT.md)
