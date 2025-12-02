# Deployment Script Fixes

## Changes Made to `deploy-workers-azure-aci.sh`

### 1. Updated Script Description
**Before:**
```bash
# This script deploys a 3-container setup to Azure Container Instances:
# 1. API Container (WORKER_MODE=api) - Handles HTTP requests only
# 2. Crawler Worker Container - Processes crawl jobs
# 3. Document Worker Container - Generates embeddings/chunks
```

**After:**
```bash
# This script deploys a 2-container setup to Azure Container Instances:
# 1. Crawler Worker Container - Processes crawl jobs
# 2. Document Worker Container - Generates embeddings/chunks
#
# Note: API continues to run on Azure App Service (not part of this deployment)
```

### 2. Fixed Build Comments
**Before:**
```bash
# Note: All containers (API, crawler, doc worker) use the same image
#       but with different entry points defined in the ARM template:
#       - API: Uses default CMD from Dockerfile (uvicorn)
#       - Crawler: Overrides command to run workers/crawler_worker.py
#       - Doc Worker: Overrides command to run workers/doc_worker.py
```

**After:**
```bash
# Note: Worker containers (crawler, doc worker) use the same image
#       but with different entry points defined in the ARM template:
#       - Crawler: Runs workers/crawler_worker.py
#       - Doc Worker: Runs workers/doc_worker.py
```

### 3. Updated Echo Messages
**Before:**
```bash
echo "Building unified worker image..." >&2
echo "Building unified worker image in Azure..." >&2
```

**After:**
```bash
echo "Building worker image..." >&2  # For local build
echo "Building worker image in Azure..." >&2  # For ACR build
```

## New Tool Created: Pre-Deployment Check Script

Created `scripts/pre-deploy-check.sh` to validate everything before deployment.

### What It Checks

1. ✅ Azure CLI installed and version
2. ✅ Azure login status
3. ✅ Resource group exists
4. ✅ Azure Container Registry exists
5. ✅ ARM template file exists and is valid JSON
6. ✅ All required environment variables set:
   - DATABASE_URL
   - AZURE_STORAGE_CONNECTION_STRING
   - AZURE_STORAGE_CONTAINER_NAME
   - OPENAI_API_KEY
7. ✅ Database URL format and DNS resolution
8. ✅ Storage account connection string format
9. ✅ Docker status (optional)
10. ✅ Existing deployments

### Usage

```bash
# Run validation before deploying
./scripts/pre-deploy-check.sh
```

### Example Output (Success)

```
Pre-Deployment Validation

[1/10] Checking Azure CLI...
✓ Azure CLI installed (version: 2.80.0)

[2/10] Checking Azure login...
✓ Logged in to Azure (account: My Subscription)

[3/10] Checking resource group...
✓ Resource group 'powernova' exists

[4/10] Checking Azure Container Registry...
✓ ACR 'powernovaapiacr' exists

[5/10] Checking ARM template...
✓ Template file exists: /path/to/templates/aci-deployment.json
✓ Template JSON is valid

[6/10] Checking environment variables...
✓ All required environment variables are set
  - DATABASE_URL: postgresql://user:...
  - AZURE_STORAGE_CONNECTION_STRING: DefaultEndpointsProto...
  - AZURE_STORAGE_CONTAINER_NAME: documents
  - OPENAI_API_KEY: sk-proj-...

[7/10] Checking database URL format...
✓ Database URL format is valid
  Host: myserver.postgres.database.azure.com
✓ Database host is reachable (DNS)

[8/10] Checking Azure Storage connection...
✓ Storage connection string format is valid
  Account: mystorageaccount

[9/10] Checking Docker...
✓ Docker is running (version: 24.0.2)
  Will build image locally

[10/10] Checking for existing deployment...
✓ No existing test deployment
✓ No existing production deployment

Pre-Deployment Validation Complete

You can now deploy using:
  ./scripts/deploy-workers-azure-aci.sh --test    # For test environment
  ./scripts/deploy-workers-azure-aci.sh           # For production
```

### Example Output (Issues Found)

```
[6/10] Checking environment variables...
✗ Missing required environment variables:
  - DATABASE_URL
  - OPENAI_API_KEY
```

```
[9/10] Checking Docker...
⚠ Docker is not running
  Will use Azure ACR Build Task (slower but works without Docker)
```

## Recommended Deployment Workflow

### 1. Run Pre-Deployment Check
```bash
cd /path/to/container
./scripts/pre-deploy-check.sh
```

If any issues are found, fix them before proceeding.

### 2. Deploy to Test
```bash
./scripts/deploy-workers-azure-aci.sh --test
```

### 3. Validate Test Deployment
```bash
./scripts/validate-aci-deployment.sh --test
```

### 4. Monitor Workers
```bash
# Watch logs
az container logs -g powernova -n powernova-workers-test \
  --container-name crawler-worker --follow
```

### 5. Deploy to Production (when ready)
```bash
./scripts/deploy-workers-azure-aci.sh
```

## Common Issues and Solutions

### Issue 1: "Azure CLI not found"
**Solution:**
```bash
brew install azure-cli
```

### Issue 2: "Not logged in to Azure"
**Solution:**
```bash
az login
```

### Issue 3: "Missing environment variables"
**Solution:**
```bash
export DATABASE_URL="postgresql://..."
export AZURE_STORAGE_CONNECTION_STRING="..."
export AZURE_STORAGE_CONTAINER_NAME="documents"
export OPENAI_API_KEY="sk-..."
```

### Issue 4: "Template file not found"
**Solution:**
Make sure you're running from the correct directory:
```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
```

### Issue 5: "Docker is not running"
**Not a blocker!** The script will automatically use Azure ACR Build Task.

If you want to use local Docker:
1. Open Docker Desktop
2. Wait for it to start
3. Re-run deployment

### Issue 6: "ACR login failed"
**Solution:**
```bash
# Check ACR exists
az acr list -o table

# Test login
az acr login --name powernovaapiacr

# Check health
az acr check-health -n powernovaapiacr --yes
```

### Issue 7: "Deployment template validation failed"
**Check:**
1. Template JSON is valid:
   ```bash
   jq empty templates/aci-deployment.json
   ```

2. Parameters match template:
   ```bash
   # Compare parameter names in template vs script
   grep '"parameters"' templates/aci-deployment.json
   ```

### Issue 8: "Container group deployment failed"
**Check logs:**
```bash
# Get deployment errors
az deployment group show \
  --resource-group powernova \
  --name "powernova-workers-test-..." \
  --query properties.error
```

## Script Improvements Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Container Count** | 3 (API + 2 workers) | 2 (workers only) |
| **Description** | "3-container setup" | "2-container setup, API on App Service" |
| **Comments** | Mentioned API container | Only mention workers |
| **Echo Messages** | "unified worker image" | "worker image" |
| **Pre-deployment Checks** | None | Full validation script |

## Files Modified

1. ✅ `scripts/deploy-workers-azure-aci.sh`
   - Updated description
   - Fixed comments
   - Clarified echo messages

2. ✅ `scripts/pre-deploy-check.sh` (NEW)
   - Comprehensive pre-flight checks
   - Clear error messages
   - Actionable feedback

## Testing

After making these changes:

1. ✅ Syntax check passed:
   ```bash
   bash -n scripts/deploy-workers-azure-aci.sh
   # No errors
   ```

2. ✅ Script is executable:
   ```bash
   ls -la scripts/deploy-workers-azure-aci.sh
   # -rwxr-xr-x
   ```

3. ✅ Template validation:
   ```bash
   jq empty templates/aci-deployment.json
   # No errors
   ```

## Next Steps

1. **Run pre-deployment check:**
   ```bash
   ./scripts/pre-deploy-check.sh
   ```

2. **Fix any issues** reported by the check

3. **Deploy to test:**
   ```bash
   ./scripts/deploy-workers-azure-aci.sh --test
   ```

4. **Validate deployment:**
   ```bash
   ./scripts/validate-aci-deployment.sh --test
   ```

## Date
December 1, 2025
