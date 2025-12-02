# Azure Container Registry Fix

## Issue
Deployment was failing with:
```
Could not connect to the registry login server 'powernovaregistry.azurecr.io'. 
Please verify that the registry exists...
```

## Root Cause
The deployment script `scripts/deploy-workers-azure-aci.sh` was configured to use `powernovaregistry`, but this registry doesn't exist in Azure.

**Actual Registries in Azure:**
- `powernovaai.azurecr.io`
- `powernovaapiacr.azurecr.io` ✅ (Used for API)
- `powernovachatacr.azurecr.io`

## Fix Applied
Updated `scripts/deploy-workers-azure-aci.sh` line 37:

**Before:**
```bash
ACR_NAME="powernovaregistry"
```

**After:**
```bash
ACR_NAME="powernovaapiacr"  # Updated to match existing ACR
```

## Verification
Confirmed registry health:
```bash
az acr check-health -n powernovaapiacr --yes
```

**Results:**
- ✅ DNS lookup to powernovaapiacr.azurecr.io: OK
- ✅ Challenge endpoint OK
- ✅ Fetch refresh token: OK
- ✅ Fetch access token: OK

## Next Steps
The deployment script should now work correctly:

```bash
# Deploy to test environment
./scripts/deploy-workers-azure-aci.sh --test

# Deploy to production
./scripts/deploy-workers-azure-aci.sh
```

## Related Files
- `scripts/deploy-workers-azure-aci.sh` - Deployment script (updated)
- `templates/aci-deployment.json` - ARM template (uses acrName parameter)
- `templates/aci-deployment.parameters.json` - Parameters schema

## Date
December 1, 2025
