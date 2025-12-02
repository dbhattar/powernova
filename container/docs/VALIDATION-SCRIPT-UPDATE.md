# Validation Script Updates - Workers Only

## Changes Made

Updated `scripts/validate-aci-deployment.sh` to align with the **workers-only** deployment architecture.

## What Changed

### Removed (API-specific)
- ❌ API container state check
- ❌ FQDN and IP address retrieval
- ❌ API endpoint testing (`/health`)
- ❌ API response time checks
- ❌ API log retrieval
- ❌ Health endpoint validation

### Added (Worker-specific)
- ✅ Worker container state check with start times
- ✅ Error analysis in worker logs
- ✅ Warning counts for troubleshooting
- ✅ Clear messaging that API runs on App Service

### Updated
- Script description: Now says "Workers Only"
- Step numbering: Changed from `[1/6]` to `[1/5]` (removed API test step)
- Container iteration: Now checks only `crawler-worker` and `doc-worker`
- Output summary: Removed API endpoint info, added App Service note

## New Features

### 1. Enhanced Container Status
Now shows start times for each container:
```
Container States:
  crawler-worker: Running (started: 2025-12-01T03:45:12.123Z)
  doc-worker: Running (started: 2025-12-01T03:45:15.456Z)
```

### 2. Log Error Analysis
Automatically scans recent logs for issues:
```
Analyzing logs for issues...
  ✓ No errors in crawler worker logs
  ⚠ Found 2 error/exception messages in doc worker logs
```

### 3. Better Help Text
Clear instructions for monitoring:
```
View full logs:
  Crawler Worker: az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
  Doc Worker:     az container logs -g powernova -n powernova-workers-test --container-name doc-worker

Follow logs in real-time:
  az container logs -g powernova -n powernova-workers-test --container-name crawler-worker --follow
  az container logs -g powernova -n powernova-workers-test --container-name doc-worker --follow
```

## Usage

### Validate Test Environment
```bash
./scripts/validate-aci-deployment.sh --test
```

### Validate Production Environment
```bash
./scripts/validate-aci-deployment.sh --prod
```

### What It Validates

1. **[1/5] Azure CLI Check**
   - Verifies `az` command is available
   - Checks Azure login status

2. **[2/5] Azure Login**
   - Ensures authenticated to Azure
   - Validates access to subscription

3. **[3/5] Container Group Exists**
   - Checks if deployment exists
   - Provides helpful error if not deployed

4. **[4/5] Container Details**
   - Gets provisioning state
   - Lists each container's state and start time
   - Highlights non-running containers

5. **[5/5] Worker Logs**
   - Shows recent logs from each worker
   - Analyzes logs for errors/exceptions
   - Reports error counts

## Example Output

### Successful Validation
```
Validating Azure Container Instances Deployment (Workers Only)
Container Group: powernova-workers-test

[1/5] Checking Azure CLI...
✓ Azure CLI found

[2/5] Checking Azure login...
✓ Logged in to Azure

[3/5] Checking container group...
✓ Container group exists

[4/5] Getting container details...
Provisioning State: Succeeded

Container States:
  crawler-worker: Running (started: 2025-12-01T03:45:12.123Z)
  doc-worker: Running (started: 2025-12-01T03:45:15.456Z)

✓ Container details retrieved

[5/5] Checking worker logs...

Recent crawler worker logs:
---
[2025-12-01 03:45:30] INFO: Crawler worker started
[2025-12-01 03:45:35] INFO: Polling for crawl jobs...
[2025-12-01 03:46:05] INFO: No pending jobs found
---

Recent doc worker logs:
---
[2025-12-01 03:45:35] INFO: Document worker started
[2025-12-01 03:45:40] INFO: Polling for document jobs...
[2025-12-01 03:46:10] INFO: No pending jobs found
---

✓ Log checks complete

Analyzing logs for issues...
  ✓ No errors in crawler worker logs
  ✓ No errors in doc worker logs

Validation Complete

Workers are running on Azure Container Instances
API continues to run on App Service (not part of this deployment)

View full logs:
  Crawler Worker: az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
  Doc Worker:     az container logs -g powernova -n powernova-workers-test --container-name doc-worker
```

### Failed Validation (Example)
```
[3/5] Checking container group...
✗ Container group not found
Please deploy first using deploy-workers-azure-aci.sh
```

### Container Not Running
```
[4/5] Getting container details...
Provisioning State: Succeeded

Container States:
  crawler-worker: Running (started: 2025-12-01T03:45:12.123Z)
  doc-worker: Waiting

⚠ Some containers are not running
```

### Errors Detected
```
Analyzing logs for issues...
  ✓ No errors in crawler worker logs
  ⚠ Found 3 error/exception messages in doc worker logs
```

## Comparison: Before vs After

### Before (3 containers)
```bash
# Checked 3 containers
for container in api crawler-worker doc-worker; do
    # Check state
done

# Tested API endpoints
curl http://$FQDN:8000/health
```

### After (2 containers)
```bash
# Checks only worker containers
for container in crawler-worker doc-worker; do
    # Check state with start time
done

# No API endpoint tests (API on App Service)
```

## Integration with Deployment Script

The validation script works with the updated deployment script:

```bash
# Deploy workers
./scripts/deploy-workers-azure-aci.sh --test

# Validate deployment
./scripts/validate-aci-deployment.sh --test
```

Both scripts now:
- Focus only on worker containers
- Don't try to access public IP (no longer exists)
- Don't check API endpoints (API on App Service)
- Show clear status of workers only

## Troubleshooting Tips

### "Container group not found"
**Solution:** Deploy first:
```bash
./scripts/deploy-workers-azure-aci.sh --test
```

### "Provisioning state is not 'Succeeded'"
**Wait:** Deployment may still be in progress
**Check:** `az container show -g powernova -n powernova-workers-test`

### "Container in Waiting state"
**Check logs:** May reveal startup errors
```bash
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
```

### "Found N error messages in logs"
**Review:** Check full logs for context
```bash
az container logs -g powernova -n powernova-workers-test --container-name doc-worker --tail 100 | grep -i error
```

## Related Files
- `scripts/deploy-workers-azure-aci.sh` - Deployment script
- `templates/aci-deployment.json` - ARM template (workers only)
- `docs/WORKERS-ONLY-ACI.md` - Architecture documentation
- `docs/WORKERS-DEPLOYMENT-QUICK-REFERENCE.md` - Quick reference guide

## Date
December 1, 2025
