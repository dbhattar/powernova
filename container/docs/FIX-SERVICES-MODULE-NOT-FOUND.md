# Fix: ModuleNotFoundError 'services' in Production

## Issue

Production API was failing with:
```
ModuleNotFoundError: No module named 'services'
```

## Root Cause

The `services/` directory was not being copied in the production Dockerfile (`Dockerfile.api`).

The Dockerfile explicitly copies each directory:
```dockerfile
COPY api/main.py .
COPY api/routes/ ./routes/
COPY api/models/ ./models/
COPY api/database/ ./database/
# Missing: COPY api/services/ ./services/
COPY api/alembic/ ./alembic/
```

## Fix Applied

Added the missing `services/` directory copy in `docker/Dockerfile.api`:

```dockerfile
COPY api/main.py .
COPY api/routes/ ./routes/
COPY api/models/ ./models/
COPY api/database/ ./database/
COPY api/services/ ./services/     # ✅ ADDED
COPY api/alembic/ ./alembic/
COPY api/alembic.ini ./alembic.ini
```

Also added verification step:
```dockerfile
RUN echo "=== Files in /app/services ===" && ls -la /app/services
```

## Why This Happened

When the crawler services were created, the `services/` directory was new. The production Dockerfile uses explicit COPY commands (not `COPY . .` like local), so the new directory needed to be explicitly added.

## Files Affected

- ✅ `docker/Dockerfile.api` - Fixed (added services/ copy)
- ✅ `docker/Dockerfile.api.local` - No change needed (uses `COPY . .`)

## Deployment

To deploy the fix:

```bash
# Rebuild and redeploy
./scripts/azure-deploy-api.sh --update
```

Or manually:
```bash
# Build new image
docker build -f docker/Dockerfile.api -t powernova-api .

# Push to registry
docker tag powernova-api yourregistry.azurecr.io/powernova-api:latest
docker push yourregistry.azurecr.io/powernova-api:latest

# Restart Azure container
az webapp restart --resource-group your-rg --name your-app
```

## Verification

After deployment, check logs:
```bash
az webapp log tail --resource-group your-rg --name your-app
```

Should see:
```
=== Files in /app/services ===
total XX
drwxr-xr-x 2 root root  4096 Nov 19 03:45 .
drwxr-xr-x 8 root root  4096 Nov 19 03:45 ..
-rw-r--r-- 1 root root   XXX Nov 19 03:45 __init__.py
-rw-r--r-- 1 root root   XXX Nov 19 03:45 azure_storage.py
-rw-r--r-- 1 root root   XXX Nov 19 03:45 crawler.py
-rw-r--r-- 1 root root   XXX Nov 19 03:45 document_processor.py
```

## Testing

After deployment:
1. Check API health: `curl https://your-app.azurewebsites.net/health`
2. Test admin endpoint: Access `/admin.html` and login
3. Create a test crawl job
4. Verify crawler runs without import errors

## Prevention

For future new directories, remember to add them to `docker/Dockerfile.api`:
- Always add explicit COPY commands for new top-level directories
- Test production builds locally before deploying
- Check deployment logs for file listing verification

## Related Files

Services that need to be copied:
- `api/services/__init__.py`
- `api/services/crawler.py`
- `api/services/azure_storage.py`
- `api/services/document_processor.py`

All are now properly included in production builds! ✅
