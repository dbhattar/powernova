# Separate ACR Repository for Worker Containers

## Overview
The worker containers now use a **separate repository** within the Azure Container Registry (ACR) to avoid affecting existing API deployments.

## Repository Structure

**Before:**
```
powernovaapiacr.azurecr.io/
└── powernova-api:latest  ← Used by current App Service deployment
```

**After:**
```
powernovaapiacr.azurecr.io/
├── powernova-api:latest        ← Existing API (unchanged)
└── powernova-workers:latest    ← New worker containers (ACI deployment)
```

## Changes Made

### 1. Deployment Script (`scripts/deploy-workers-azure-aci.sh`)

Added `IMAGE_REPOSITORY` variable:
```bash
# Configuration
RESOURCE_GROUP="powernova"
LOCATION="westus2"
ACR_NAME="powernovaapiacr"
IMAGE_REPOSITORY="powernova-workers"  # Separate repository
IMAGE_TAG="latest"
```

Updated build command:
```bash
# Before
docker build -f docker/Dockerfile.api -t "$ACR_NAME.azurecr.io/powernova-api:$IMAGE_TAG" .

# After
docker build -f docker/Dockerfile.api -t "$ACR_NAME.azurecr.io/$IMAGE_REPOSITORY:$IMAGE_TAG" .
```

### 2. ARM Template (`templates/aci-deployment.json`)

Added new parameter:
```json
{
  "imageRepository": {
    "type": "string",
    "defaultValue": "powernova-workers",
    "metadata": {
      "description": "Docker image repository name in ACR"
    }
  }
}
```

Updated all 3 container image references:
```json
// Before
"image": "[concat(parameters('acrName'), '.azurecr.io/powernova-api:', parameters('imageTag'))]"

// After
"image": "[concat(parameters('acrName'), '.azurecr.io/', parameters('imageRepository'), ':', parameters('imageTag'))]"
```

### 3. Parameters File (`templates/aci-deployment.parameters.json`)

Added:
```json
{
  "imageRepository": {
    "value": "powernova-workers"
  }
}
```

## Benefits

1. **Isolation**: Worker container images are separate from production API images
2. **Safety**: No risk of overwriting current App Service deployment images
3. **Parallel Testing**: Can test worker deployment while keeping current API running
4. **Clear Naming**: Easy to identify which images are for which deployment
5. **Version Control**: Can maintain different versions for workers vs API

## Image Naming Convention

| Deployment | Repository | Full Image Path |
|-----------|------------|-----------------|
| Current App Service API | `powernova-api` | `powernovaapiacr.azurecr.io/powernova-api:latest` |
| New ACI Workers | `powernova-workers` | `powernovaapiacr.azurecr.io/powernova-workers:latest` |

## Deployment Impact

When you run:
```bash
./scripts/deploy-workers-azure-aci.sh --test
```

The script will:
1. Build image from `docker/Dockerfile.api`
2. Tag as `powernovaapiacr.azurecr.io/powernova-workers:latest`
3. Push to separate `powernova-workers` repository
4. Deploy 3 containers (all using same `powernova-workers` image):
   - API container (default CMD)
   - Crawler worker (command override)
   - Doc worker (command override)

## Verification

After deployment, you can verify the separate repositories:

```bash
# List all repositories in ACR
az acr repository list --name powernovaapiacr -o table

# Expected output:
# Result
# ----------------
# powernova-api        ← Existing API
# powernova-workers    ← New workers

# List tags in each repository
az acr repository show-tags --name powernovaapiacr --repository powernova-api -o table
az acr repository show-tags --name powernovaapiacr --repository powernova-workers -o table
```

## Cleanup

If you need to remove the worker repository later:
```bash
az acr repository delete \
  --name powernovaapiacr \
  --repository powernova-workers \
  --yes
```

## Related Files
- `scripts/deploy-workers-azure-aci.sh` - Uses IMAGE_REPOSITORY variable
- `templates/aci-deployment.json` - Added imageRepository parameter
- `templates/aci-deployment.parameters.json` - Default value set
- `docs/ACR-FIX.md` - Previous ACR configuration fix

## Date
December 1, 2025
