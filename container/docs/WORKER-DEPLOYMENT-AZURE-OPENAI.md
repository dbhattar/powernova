# Worker Deployment with Azure OpenAI

This guide explains how to deploy PowerNOVA workers (crawler and document processor) to Azure Container Instances with Azure OpenAI support.

## Overview

The worker containers use the same `api` codebase and now support both standard OpenAI and Azure OpenAI through the `azure_openai_client.py` helper utility.

## Environment Variables Required

### Common Variables (Always Required)

- `DATABASE_URL` - PostgreSQL connection string
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Storage connection string
- `AZURE_STORAGE_CONTAINER_NAME` - Container name for document storage

### Azure OpenAI Configuration (Default)

Set `USE_AZURE_OPENAI=true` (default) and provide:

- `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com/`)
- `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_API_VERSION` - API version (default: `2024-02-15-preview`)
- `AZURE_OPENAI_CHAT_DEPLOYMENT` - Chat model deployment name (e.g., `gpt-4o-mini`)
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` - Embedding model deployment name (e.g., `text-embedding-3-small-powernova`)

### Standard OpenAI Configuration (Alternative)

Set `USE_AZURE_OPENAI=false` and provide:

- `OPENAI_API_KEY` - Your OpenAI API key

## Deployment Steps

### 1. Set Environment Variables

**Option A: Use the api/.env file (Recommended)**

The deployment script automatically loads configuration from `api/.env` if it exists. Simply ensure your `api/.env` file contains the required variables:

```properties
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=powernova-documents

# Azure OpenAI
USE_AZURE_OPENAI=true
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small-powernova
```

**Option B: Export environment variables manually**

If the `.env` file doesn't exist or you want to override specific values, export them manually.

For Azure OpenAI:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
export AZURE_STORAGE_CONTAINER_NAME="powernova-documents"

# Azure OpenAI settings
export USE_AZURE_OPENAI="true"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_API_KEY="your-azure-openai-api-key"
export AZURE_OPENAI_API_VERSION="2024-02-15-preview"
export AZURE_OPENAI_CHAT_DEPLOYMENT="gpt-4o-mini"
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small-powernova"
```

For standard OpenAI:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
export AZURE_STORAGE_CONTAINER_NAME="powernova-documents"

# OpenAI settings
export USE_AZURE_OPENAI="false"
export OPENAI_API_KEY="your-openai-api-key"
```

**How it works:**
1. The script first checks for `api/.env` and loads all variables from it
2. Environment variables already set take precedence over `.env` values
3. If a required variable is missing from both sources, the script exits with an error

### 2. Run Deployment Script

For production:

```bash
./scripts/deploy-workers-azure-aci.sh
```

For test environment:

```bash
./scripts/deploy-workers-azure-aci.sh --test
```

## What Gets Deployed

The script deploys a container group with two containers:

1. **Crawler Worker** (`crawler-worker`)
   - Processes web crawl jobs
   - Polls for new crawl jobs every 30 seconds
   - Downloads and stores documents to Azure Storage

2. **Document Worker** (`doc-worker`)
   - Processes documents for embeddings
   - Generates text chunks and embeddings
   - Polls for pending documents every 10 seconds
   - Uses Azure OpenAI embeddings API

## Monitoring

### View Logs

Crawler worker:
```bash
az container logs -g powernova -n powernova-workers-prod --container-name crawler-worker --follow
```

Document worker:
```bash
az container logs -g powernova -n powernova-workers-prod --container-name doc-worker --follow
```

### Check Status

```bash
az container show -g powernova -n powernova-workers-prod
```

### View Container Details

```bash
az container show -g powernova -n powernova-workers-prod \
  --query "containers[].{name:name, state:instanceView.currentState.state, cpu:resources.requests.cpu, memory:resources.requests.memoryInGb}" \
  -o table
```

## Updating Workers

To update the workers with new code:

1. Update environment variables if needed
2. Run the deployment script again - it will:
   - Build a new Docker image
   - Push to Azure Container Registry
   - Delete the old container group
   - Deploy the new container group

## Troubleshooting

### Workers Not Starting

Check logs for both containers:
```bash
az container logs -g powernova -n powernova-workers-prod --container-name crawler-worker --tail 100
az container logs -g powernova -n powernova-workers-prod --container-name doc-worker --tail 100
```

### Azure OpenAI Connection Issues

Verify environment variables are set correctly:
```bash
az container show -g powernova -n powernova-workers-prod \
  --query "containers[].environmentVariables[?name=='USE_AZURE_OPENAI' || name=='AZURE_OPENAI_ENDPOINT']" \
  -o table
```

### Database Connection Issues

Check if DATABASE_URL is correct:
```bash
# View container events
az container show -g powernova -n powernova-workers-prod \
  --query "containers[].instanceView.events[]" \
  -o table
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Azure Container Instance (powernova-workers-prod)       │
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ Crawler Worker   │      │ Document Worker  │        │
│  │                  │      │                  │        │
│  │ - Crawl jobs     │      │ - Embeddings     │        │
│  │ - Document DL    │      │ - Text chunking  │        │
│  │ - Azure Storage  │      │ - Azure OpenAI   │        │
│  └──────────────────┘      └──────────────────┘        │
│           │                          │                  │
│           └──────────┬───────────────┘                  │
│                      │                                  │
└──────────────────────┼──────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Azure PostgreSQL│
              │   (Shared DB)   │
              └─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Azure Blob      │
              │   Storage       │
              └─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Azure OpenAI    │
              │  (Embeddings)   │
              └─────────────────┘
```

## Files Modified

- `scripts/deploy-workers-azure-aci.sh` - Added Azure OpenAI environment variable validation and conditional parameter generation
- `templates/aci-deployment.json` - Added Azure OpenAI parameters and environment variables for both worker containers

## Notes

- Both containers use the same Docker image (`powernova-workers`) but with different entry points
- The containers restart automatically on failure (`restartPolicy: Always`)
- Resources: 0.5 CPU, 1GB RAM per container
- The API server continues to run on Azure App Service (separate deployment)
