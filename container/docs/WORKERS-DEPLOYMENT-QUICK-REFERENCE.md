# Workers Deployment Quick Reference

## Overview
This guide covers deploying and managing **worker containers only** on Azure Container Instances. The API continues to run on App Service.

## Architecture

```
┌─────────────────────┐
│   App Service       │
│   ┌─────────────┐   │
│   │     API     │   │ ← Handles user requests
│   └─────────────┘   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  PostgreSQL DB      │ ← Shared database
└─────────────────────┘
         ▲
         │
┌─────────────────────┐
│   ACI (Workers)     │
│   ┌──────┬──────┐   │
│   │Crawl │ Doc  │   │ ← Process background jobs
│   │Worker│Worker│   │
│   └──────┴──────┘   │
└─────────────────────┘
```

## Prerequisites

### 1. Environment Variables
Set these in your environment before deploying:

```bash
# Database
export DATABASE_URL="postgresql://user:pass@server.postgres.database.azure.com:5432/dbname?sslmode=require"

# Azure Storage
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
export AZURE_STORAGE_CONTAINER_NAME="documents"

# OpenAI (for embeddings)
export OPENAI_API_KEY="sk-..."
```

### 2. Azure CLI
```bash
# Install if needed
brew install azure-cli

# Login
az login

# Verify subscription
az account show
```

### 3. Docker (Optional)
- If Docker Desktop is running: Builds locally
- If Docker is not running: Uses Azure ACR Build Task (automatic)

## Deployment Commands

### Deploy to Test Environment
```bash
cd /path/to/container
./scripts/deploy-workers-azure-aci.sh --test
```

**What it does:**
1. Builds image from `docker/Dockerfile.api`
2. Pushes to `powernovaapiacr.azurecr.io/powernova-workers:latest`
3. Deploys container group: `powernova-workers-test`
4. Creates 2 containers:
   - `crawler-worker` (0.5 CPU, 1GB RAM)
   - `doc-worker` (0.5 CPU, 1GB RAM)

**Expected output:**
```
✓ Configuration loaded
✓ Images built and pushed
✓ Container group deployed
✓ Deployment details retrieved

Container Statuses:
Name            State     StartTime
--------------  --------  ----------------------
crawler-worker  Running   2025-12-01T...
doc-worker      Running   2025-12-01T...

Note: API continues running on App Service
```

### Deploy to Production
```bash
./scripts/deploy-workers-azure-aci.sh
```

Same as test but creates: `powernova-workers-prod`

## Validation

### Validate Deployment
```bash
./scripts/validate-aci-deployment.sh --test  # For test environment
./scripts/validate-aci-deployment.sh --prod  # For production
```

**What it checks:**
1. ✅ Azure CLI installed and logged in
2. ✅ Container group exists
3. ✅ Containers are running
4. ✅ Logs show activity
5. ✅ No errors in recent logs

**Expected output:**
```
[1/5] Checking Azure CLI...
✓ Azure CLI found

[2/5] Checking Azure login...
✓ Logged in to Azure

[3/5] Checking container group...
✓ Container group exists

[4/5] Getting container details...
Container States:
  crawler-worker: Running (started: 2025-12-01T03:45:12.123Z)
  doc-worker: Running (started: 2025-12-01T03:45:15.456Z)
✓ Container details retrieved

[5/5] Checking worker logs...
✓ No errors in crawler worker logs
✓ No errors in doc worker logs

Validation Complete
```

## Monitoring

### Check Container Status
```bash
# Quick status
az container show -g powernova -n powernova-workers-test \
  --query "containers[].{name:name, state:instanceView.currentState.state}" -o table

# Full details
az container show -g powernova -n powernova-workers-test
```

### View Logs

**Crawler Worker:**
```bash
# Last 50 lines
az container logs -g powernova -n powernova-workers-test \
  --container-name crawler-worker --tail 50

# Follow logs (real-time)
az container logs -g powernova -n powernova-workers-test \
  --container-name crawler-worker --follow
```

**Doc Worker:**
```bash
# Last 50 lines
az container logs -g powernova -n powernova-workers-test \
  --container-name doc-worker --tail 50

# Follow logs (real-time)
az container logs -g powernova -n powernova-workers-test \
  --container-name doc-worker --follow
```

### Check for Errors
```bash
# Search crawler logs for errors
az container logs -g powernova -n powernova-workers-test \
  --container-name crawler-worker --tail 100 | grep -i "error\|exception"

# Search doc worker logs for errors
az container logs -g powernova -n powernova-workers-test \
  --container-name doc-worker --tail 100 | grep -i "error\|exception"
```

### Resource Metrics
```bash
# CPU usage
az monitor metrics list \
  --resource "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/powernova/providers/Microsoft.ContainerInstance/containerGroups/powernova-workers-test" \
  --metric "CpuUsage" \
  --start-time $(date -u -v-1H '+%Y-%m-%dT%H:%M:%SZ') \
  --interval PT1M

# Memory usage
az monitor metrics list \
  --resource "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/powernova/resourceGroups/powernova/providers/Microsoft.ContainerInstance/containerGroups/powernova-workers-test" \
  --metric "MemoryUsage" \
  --start-time $(date -u -v-1H '+%Y-%m-%dT%H:%M:%SZ') \
  --interval PT1M
```

## Troubleshooting

### Workers Not Starting

**Symptom:** Containers stuck in "Waiting" state

**Check:**
```bash
az container show -g powernova -n powernova-workers-test \
  --query "containers[].instanceView.currentState" -o json
```

**Common causes:**
1. Image pull failed (ACR credentials)
2. Environment variable missing
3. Database connection failed

**Fix:**
1. Check ACR access:
   ```bash
   az acr check-health -n powernovaapiacr --yes
   ```
2. Verify environment variables in ARM template
3. Test database connection

### Workers Crashing

**Symptom:** Containers restart repeatedly

**Check logs:**
```bash
az container logs -g powernova -n powernova-workers-test \
  --container-name crawler-worker --tail 200
```

**Common causes:**
1. Database connection string incorrect
2. Missing Python dependencies
3. Storage account unreachable
4. Out of memory

**Fix:**
1. Verify DATABASE_URL is correct
2. Check Dockerfile installs all requirements
3. Test storage connection
4. Increase memory limit in ARM template

### No Jobs Processing

**Symptom:** Workers running but no activity

**Check:**
1. Are there pending jobs in database?
   ```sql
   SELECT * FROM crawl_jobs WHERE status = 'PENDING' LIMIT 10;
   SELECT * FROM document_jobs WHERE status = 'PENDING' LIMIT 10;
   ```

2. Check worker logs for polling activity:
   ```bash
   az container logs -g powernova -n powernova-workers-test \
     --container-name crawler-worker --tail 50 | grep "Polling\|Found"
   ```

3. Verify POLL_INTERVAL environment variable

**Fix:**
1. Create test crawl job via API
2. Adjust POLL_INTERVAL if needed
3. Check database permissions

### High CPU/Memory Usage

**Check current usage:**
```bash
az container show -g powernova -n powernova-workers-test \
  --query "containers[].resources" -o json
```

**Increase resources:**
Edit `templates/aci-deployment.json`:
```json
{
  "resources": {
    "requests": {
      "cpu": 1.0,        // Increase from 0.5
      "memoryInGb": 2.0  // Increase from 1.0
    }
  }
}
```

Then redeploy.

## Updating Workers

### Update Code
```bash
# 1. Make code changes in api/workers/

# 2. Redeploy (builds and pushes new image automatically)
./scripts/deploy-workers-azure-aci.sh --test

# 3. Containers will restart with new image
```

### Update Configuration
```bash
# 1. Edit templates/aci-deployment.json
#    - Change environment variables
#    - Adjust resources
#    - Modify polling intervals

# 2. Redeploy
./scripts/deploy-workers-azure-aci.sh --test
```

## Cleanup

### Delete Test Environment
```bash
az container delete -g powernova -n powernova-workers-test --yes
```

### Delete Production Environment
```bash
az container delete -g powernova -n powernova-workers-prod --yes
```

**Note:** This does NOT affect your API on App Service!

### Delete Images (Optional)
```bash
# List tags
az acr repository show-tags -n powernovaapiacr --repository powernova-workers

# Delete specific tag
az acr repository delete -n powernovaapiacr \
  --image powernova-workers:latest --yes

# Delete entire repository
az acr repository delete -n powernovaapiacr \
  --repository powernova-workers --yes
```

## Cost Management

### Check Current Costs
```bash
# Get container group details
az container show -g powernova -n powernova-workers-test \
  --query "{CPU: containers[].resources.requests.cpu, Memory: containers[].resources.requests.memoryInGb}"
```

**Current allocation:**
- Crawler: 0.5 CPU, 1GB RAM
- Doc: 0.5 CPU, 1GB RAM
- **Total:** 1.0 CPU, 2GB RAM

**Estimated cost:** ~$3.80/month running 24/7

### Reduce Costs

**Option 1: Scale down resources**
```json
// In aci-deployment.json
{
  "cpu": 0.25,       // Reduce to 0.25
  "memoryInGb": 0.5  // Reduce to 0.5GB
}
```

**Option 2: Delete when not needed**
```bash
# Delete test environment when not testing
az container delete -g powernova -n powernova-workers-test --yes
```

**Option 3: Increase poll interval** (reduces CPU usage)
```json
// In aci-deployment.json
{
  "name": "POLL_INTERVAL",
  "value": "60"  // Increase from 30 to 60 seconds
}
```

## Files Reference

### Deployment
- `scripts/deploy-workers-azure-aci.sh` - Main deployment script
- `templates/aci-deployment.json` - ARM template (workers only)
- `templates/aci-deployment.parameters.json` - Parameter schema
- `docker/Dockerfile.api` - Worker image definition

### Validation
- `scripts/validate-aci-deployment.sh` - Validation script

### Workers
- `api/workers/crawler_worker.py` - Crawler worker entry point
- `api/workers/doc_worker.py` - Document worker entry point

### Documentation
- `docs/WORKERS-ONLY-ACI.md` - Detailed architecture
- `docs/SEPARATE-ACR-REPOSITORY.md` - ACR repository info
- `docs/WORKER-ARCHITECTURE.md` - Original design doc

## Common Tasks Cheatsheet

```bash
# Deploy to test
./scripts/deploy-workers-azure-aci.sh --test

# Validate test deployment
./scripts/validate-aci-deployment.sh --test

# Watch crawler logs
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker --follow

# Watch doc worker logs
az container logs -g powernova -n powernova-workers-test --container-name doc-worker --follow

# Check status
az container show -g powernova -n powernova-workers-test --query "containers[].{name:name, state:instanceView.currentState.state}" -o table

# Restart workers (redeploy)
./scripts/deploy-workers-azure-aci.sh --test

# Delete test environment
az container delete -g powernova -n powernova-workers-test --yes

# Deploy to production
./scripts/deploy-workers-azure-aci.sh

# Delete production
az container delete -g powernova -n powernova-workers-prod --yes
```

## Support

If you encounter issues:

1. Check validation script output
2. Review container logs
3. Verify environment variables
4. Check database connectivity
5. Review ARM template configuration

## Date
December 1, 2025
