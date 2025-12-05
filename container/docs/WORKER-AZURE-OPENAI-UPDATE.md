# Azure OpenAI Migration - Worker Deployment Update

**Date**: December 4, 2025  
**Status**: Complete ✅

## Summary

Updated the worker deployment script and ARM template to support Azure OpenAI environment variables, allowing the worker containers to use the same Azure OpenAI configuration as the API server.

## Changes Made

### 1. Deployment Script (`scripts/deploy-workers-azure-aci.sh`)

**Added Azure OpenAI Configuration Validation:**
- Checks for `USE_AZURE_OPENAI` flag (defaults to `true`)
- Validates Azure OpenAI environment variables when enabled:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_CHAT_DEPLOYMENT`
  - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
  - `AZURE_OPENAI_API_VERSION` (optional, defaults to `2024-02-15-preview`)
- Falls back to standard OpenAI validation when `USE_AZURE_OPENAI=false`

**Updated Parameters Generation:**
- Generates different parameter sets based on `USE_AZURE_OPENAI` flag
- Includes all Azure OpenAI parameters when using Azure
- Includes only `openaiApiKey` when using standard OpenAI

### 2. ARM Template (`templates/aci-deployment.json`)

**Added New Parameters:**
- `useAzureOpenAI` (default: "true")
- `azureOpenAIEndpoint`
- `azureOpenAIApiKey` (secure)
- `azureOpenAIApiVersion` (default: "2024-02-15-preview")
- `azureOpenAIChatDeployment`
- `azureOpenAIEmbeddingDeployment`
- `openaiApiKey` (secure, now optional)

**Updated Environment Variables for Both Containers:**

**Crawler Worker:**
- Added `USE_AZURE_OPENAI`
- Added `AZURE_OPENAI_ENDPOINT`
- Added `AZURE_OPENAI_API_KEY`
- Added `AZURE_OPENAI_API_VERSION`
- Added `AZURE_OPENAI_CHAT_DEPLOYMENT`
- Added `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- Kept `OPENAI_API_KEY` for backward compatibility

**Document Worker:**
- Added `USE_AZURE_OPENAI`
- Added `AZURE_OPENAI_ENDPOINT`
- Added `AZURE_OPENAI_API_KEY`
- Added `AZURE_OPENAI_API_VERSION`
- Added `AZURE_OPENAI_CHAT_DEPLOYMENT`
- Added `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- Kept `OPENAI_API_KEY` for backward compatibility

### 3. Documentation (`docs/WORKER-DEPLOYMENT-AZURE-OPENAI.md`)

Created comprehensive deployment guide covering:
- Environment variable requirements
- Deployment steps for both Azure OpenAI and standard OpenAI
- Monitoring and troubleshooting commands
- Architecture diagram
- Update procedures

## How It Works

1. **Deploy Script** checks environment variables and generates appropriate parameters
2. **ARM Template** receives parameters and creates container instances
3. **Worker Containers** use the `azure_openai_client.py` helper to automatically select the correct OpenAI client based on `USE_AZURE_OPENAI` flag
4. **Both workers** (crawler and document processor) now support Azure OpenAI for any LLM operations

## Testing

To test the deployment:

```bash
# Set Azure OpenAI environment variables
export USE_AZURE_OPENAI="true"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_CHAT_DEPLOYMENT="gpt-4o-mini"
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small-powernova"

# Deploy to test environment
./scripts/deploy-workers-azure-aci.sh --test

# Monitor deployment
az container logs -g powernova -n powernova-workers-test --container-name doc-worker --follow
```

## Backward Compatibility

✅ The changes are backward compatible:
- If `USE_AZURE_OPENAI=false`, workers use standard OpenAI
- All existing environment variables (`OPENAI_API_KEY`) still work
- The `azure_openai_client.py` helper handles both configurations transparently

## Files Modified

1. `scripts/deploy-workers-azure-aci.sh` - Environment validation and parameter generation
2. `templates/aci-deployment.json` - Parameters and environment variables
3. `docs/WORKER-DEPLOYMENT-AZURE-OPENAI.md` - New deployment guide

## Next Steps

1. ✅ Update deployment script - **DONE**
2. ✅ Update ARM template - **DONE**
3. ✅ Create documentation - **DONE**
4. ⏳ Test deployment to Azure (when ready to deploy)
5. ⏳ Update production workers with new environment variables

## Related Changes

This update complements the earlier Azure OpenAI migration:
- Backend API already migrated to use `azure_openai_client.py`
- React frontend already working with Azure OpenAI streaming
- Workers now use the same configuration pattern

## Environment Variable Summary

**Azure OpenAI (Recommended):**
```bash
USE_AZURE_OPENAI=true
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small-powernova
```

**Standard OpenAI:**
```bash
USE_AZURE_OPENAI=false
OPENAI_API_KEY=sk-...
```

**Always Required:**
```bash
DATABASE_URL=postgresql://...
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER_NAME=powernova-documents
```
