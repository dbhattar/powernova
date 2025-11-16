# Azure Deployment Error Fix: "Invalid language type node for OS windows"

## Problem
When running `./azure-deploy-api.sh`, you got this error:
```
Invalid language type node for OS windows
```

## Root Cause
This error occurs when:
1. The App Service Plan exists but is configured for **Windows** instead of Linux
2. Azure tries to create a Web App on Windows, but your API is a Docker container that requires Linux
3. There's a mismatch between the OS type of the App Service Plan and the deployment type

## Solutions Applied

### Fix 1: Updated App Service Creation
Changed the `az webapp create` command to explicitly use a Docker container image:

**Before:**
```bash
az webapp create \
    --deployment-container-image-name "nginx:alpine"
```

**After:**
```bash
az webapp create \
    --deployment-container-image-name "$ACR_LOGIN_SERVER/powernova-api:latest"
```

This ensures Azure knows it's a Linux container app from the start.

### Fix 2: Added App Service Plan Validation
Added a check to verify the App Service Plan is Linux-based before creating the App Service:

```bash
PLAN_KIND=$(az appservice plan show --name "$APP_SERVICE_PLAN" --query kind -o tsv)
if [[ ! "$PLAN_KIND" =~ "linux" ]]; then
    echo "Error: App Service Plan is not Linux-based"
    exit 1
fi
```

## How to Resolve

### Option 1: Use the Updated Script (Recommended)
Simply re-run the deployment script:
```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
./scripts/azure-deploy-api.sh
```

The script now validates the App Service Plan is Linux and creates the App Service correctly.

### Option 2: If You Have an Existing Windows App Service Plan

If your App Service Plan was created for Windows, you have two options:

**A. Delete and recreate (Clean slate):**
```bash
# Delete the Windows App Service Plan
az appservice plan delete \
    --name powernova-plan \
    --resource-group powernova-rg

# Re-run the deployment (will create Linux plan)
./scripts/azure-deploy-api.sh
```

**B. Create a separate Linux App Service Plan:**
```bash
# Create a new Linux plan
az appservice plan create \
    --name powernova-plan-linux \
    --resource-group powernova-rg \
    --location eastus \
    --is-linux \
    --sku B1

# Update your config to use the new plan
# Edit .azure-api-deployment.conf:
# APP_SERVICE_PLAN="powernova-plan-linux"

# Re-run deployment
./scripts/azure-deploy-api.sh
```

### Option 3: Manual Fix (If App Service Already Created)

If the API App Service was already created on Windows by mistake:

```bash
# Delete the incorrectly created App Service
az webapp delete \
    --name powernova-api \
    --resource-group powernova-rg

# Re-run the deployment script
./scripts/azure-deploy-api.sh
```

## Verification

After running the updated script, verify everything is correct:

### 1. Check App Service Plan is Linux
```bash
az appservice plan show \
    --name powernova-plan \
    --resource-group powernova-rg \
    --query "{name:name, kind:kind, sku:sku.name}" \
    --output table
```

Expected output:
```
Name            Kind    Sku
--------------  ------  ----
powernova-plan  linux   B1
```

### 2. Check App Service is Linux Container
```bash
az webapp show \
    --name powernova-api \
    --resource-group powernova-rg \
    --query "{name:name, kind:kind, state:state}" \
    --output table
```

Expected output:
```
Name           Kind            State
-------------  --------------  --------
powernova-api  app,linux       Running
```

### 3. Test the API
```bash
# Get the default hostname
API_URL=$(az webapp show \
    --name powernova-api \
    --resource-group powernova-rg \
    --query defaultHostName -o tsv)

# Test health endpoint
curl https://$API_URL/health

# Expected: {"status":"healthy","timestamp":"..."}
```

## Why This Happens

### Common Scenarios:

1. **Reusing existing infrastructure:**
   - You had a Windows-based App Service Plan from another project
   - The script tried to add a Linux container app to a Windows plan
   - Azure rejected it with "Invalid language type"

2. **App Service Plan not explicitly set:**
   - Azure defaults to Windows in some regions
   - Without `--is-linux` flag, creates Windows plan
   - Subsequent container deployment fails

3. **Mixed deployments:**
   - Landing page might be on Windows (static site)
   - API needs Linux (Docker container)
   - Can't share the same App Service Plan

## Best Practices Going Forward

### 1. Always specify `--is-linux` for container apps
```bash
az appservice plan create --is-linux --sku B1
```

### 2. Use separate App Service Plans if mixing OS types
```
powernova-plan-windows  → Landing page (if static)
powernova-plan-linux    → API (Docker containers)
```

### 3. Validate before deployment
The updated script now checks:
- ✅ App Service Plan exists
- ✅ App Service Plan is Linux
- ✅ ACR is accessible
- ✅ Docker image can be pulled

## Cost Implications

**Q: Do I need multiple App Service Plans?**

**A:** Not necessarily. You can run multiple Linux container apps on one B1 plan:
- Landing page (nginx container) → powernova-plan-linux
- Chat app (nginx container) → powernova-plan-linux  
- API (Python/FastAPI container) → powernova-plan-linux

**Total cost:** Still just $13/month for one B1 plan

**However**, if you already have a Windows plan for other apps, you'll need a separate Linux plan for Docker containers.

## Related Resources

- [Azure App Service on Linux](https://docs.microsoft.com/azure/app-service/overview#app-service-on-linux)
- [Deploy Docker containers to Azure](https://docs.microsoft.com/azure/app-service/quickstart-custom-container)
- [Azure App Service Plans](https://docs.microsoft.com/azure/app-service/overview-hosting-plans)

## Quick Reference

### Check what you have:
```bash
# List all App Service Plans
az appservice plan list \
    --resource-group powernova-rg \
    --output table

# List all Web Apps
az webapp list \
    --resource-group powernova-rg \
    --output table
```

### Start fresh (if needed):
```bash
# Delete everything in resource group
az group delete --name powernova-rg --yes

# Re-run deployment
./scripts/azure-deploy-api.sh
```

## Summary

✅ **Updated script now:**
- Validates App Service Plan is Linux
- Creates App Service with correct container image
- Provides clear error messages if Windows plan detected
- Automatically configures ACR credentials

✅ **To deploy:**
```bash
./scripts/azure-deploy-api.sh
```

🔧 **If issues persist:**
1. Check your App Service Plan kind: `az appservice plan show ...`
2. Delete and recreate if it's Windows
3. Ensure using the updated script
