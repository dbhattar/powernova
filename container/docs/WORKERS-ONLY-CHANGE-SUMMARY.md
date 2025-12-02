# Workers-Only Deployment - Change Summary

## Quick Overview

Changed ACI deployment from **3 containers** (API + workers) to **2 containers** (workers only).

**Reason**: Keep API on proven App Service, deploy only workers to ACI for better separation and simplicity.

## Architecture Change

### Before
```
ACI: [API Container] + [Crawler Worker] + [Doc Worker]
     └─ Public IP, DNS, port 8000
```

### After
```
App Service: [API Container]  ← No changes
     └─ Public IP, DNS (existing)

ACI: [Crawler Worker] + [Doc Worker]
     └─ No public IP (don't need external access)
```

## Files Modified

### 1. `templates/aci-deployment.json` (ARM Template)
**Changes**:
- ❌ Removed API container definition
- ❌ Removed `ipAddress` (public IP)
- ❌ Removed `dnsLabel` parameter
- ❌ Removed admin/JWT parameters
- ✅ Kept crawler and doc worker containers
- ✅ Updated outputs (removed fqdn, ipAddress)

**Container count**: 3 → 2

### 2. `templates/aci-deployment.parameters.json`
**Changes**:
- ❌ Removed `dnsLabel`
- ❌ Removed `adminUsername`
- ❌ Removed `adminPassword`
- ❌ Removed `jwtSecret`
- ❌ Removed `jwtAlgorithm`
- ❌ Removed `jwtExpirationMinutes`

**Parameters**: 19 → 12

### 3. `scripts/deploy-workers-azure-aci.sh`
**Changes**:
- ❌ Removed `DNS_LABEL` variable
- ❌ Removed admin credential generation
- ❌ Removed JWT secret generation
- ❌ Removed health endpoint testing
- ❌ Removed FQDN/IP output display
- ✅ Updated to show container statuses instead
- ✅ Added note about API on App Service

**Environment variables checked**: Reduced from 8 to 4

## What This Means

### For Deployment
```bash
# Same command
./scripts/deploy-workers-azure-aci.sh --test

# But now deploys:
# - Only 2 containers (not 3)
# - No public IP
# - No DNS name
# - Workers only
```

### For API Access
```bash
# API remains accessible at:
https://your-app-service.azurewebsites.net

# ACI containers are NOT publicly accessible
# (they only need database access)
```

### For Monitoring
```bash
# View worker logs:
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
az container logs -g powernova -n powernova-workers-test --container-name doc-worker

# Check status:
az container show -g powernova -n powernova-workers-test
```

## Resource Changes

### Before (3 containers)
- API: 1.0 CPU, 2.0 GB RAM
- Crawler: 0.5 CPU, 1.0 GB RAM
- Doc: 0.5 CPU, 1.0 GB RAM
- **Total**: 2.0 CPU, 4.0 GB RAM
- **Cost**: ~$7.60/month

### After (2 containers)
- Crawler: 0.5 CPU, 1.0 GB RAM
- Doc: 0.5 CPU, 1.0 GB RAM
- **Total**: 1.0 CPU, 2.0 GB RAM
- **Cost**: ~$3.80/month

**Savings**: 50% reduction in ACI cost

## Migration Impact

### Zero Impact On
- ✅ Existing API (stays on App Service)
- ✅ Current user traffic
- ✅ Database schema
- ✅ Admin interface
- ✅ Authentication

### Changes Only
- Workers now run in ACI instead of background threads
- Background job processing separated from API

## Deployment Flow

1. **Build image** (same as before)
   ```bash
   docker build -f docker/Dockerfile.api -t powernova-workers:latest
   ```

2. **Push to ACR** (new repository)
   ```bash
   docker push powernovaapiacr.azurecr.io/powernova-workers:latest
   ```

3. **Deploy to ACI** (workers only)
   ```bash
   az deployment group create --template-file aci-deployment.json ...
   ```

4. **Result**
   - Crawler worker polls database for crawl jobs
   - Doc worker polls database for document jobs
   - API continues serving user requests on App Service

## Rollback Plan

If workers don't work as expected:

1. **Delete ACI deployment**:
   ```bash
   az container delete -g powernova -n powernova-workers-test --yes
   ```

2. **Re-enable background threads in App Service**:
   - Remove `WORKER_MODE=api` from App Service environment
   - Restart App Service
   - Background threads will start processing jobs again

**No downtime required** - API keeps running throughout.

## Testing Checklist

After deployment:

- [ ] Check both containers are running
  ```bash
  az container show -g powernova -n powernova-workers-test \
    --query "containers[].{name:name, state:instanceView.currentState.state}" -o table
  ```

- [ ] Verify crawler worker processes jobs
  ```bash
  # Check logs for "Processing crawl job"
  az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
  ```

- [ ] Verify doc worker processes jobs
  ```bash
  # Check logs for "Processing document job"
  az container logs -g powernova -n powernova-workers-test --container-name doc-worker
  ```

- [ ] Confirm API still works
  ```bash
  curl https://your-app-service.azurewebsites.net/health
  ```

- [ ] Monitor database for job status changes
  ```sql
  SELECT status, COUNT(*) FROM crawl_jobs GROUP BY status;
  SELECT status, COUNT(*) FROM document_jobs GROUP BY status;
  ```

## Next Steps

1. Deploy to test environment
2. Create test crawl jobs via API
3. Monitor worker logs
4. Verify jobs complete successfully
5. Deploy to production when confident

## Documentation
- Full details: `docs/WORKERS-ONLY-ACI.md`
- Architecture: `docs/WORKER-ARCHITECTURE.md`
- ACR setup: `docs/SEPARATE-ACR-REPOSITORY.md`

## Date
December 1, 2025
