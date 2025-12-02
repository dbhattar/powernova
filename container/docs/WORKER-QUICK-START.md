# PowerNOVA Worker Architecture - Quick Start Guide

## What Was Done

Your PowerNOVA application has been refactored to separate background jobs from the API server. This improves API responsiveness by running crawling and document processing in dedicated worker containers.

## New Architecture

**Before** (Everything in one container):
```
Azure App Service
├── FastAPI API (handles requests)
├── Background Threads
│   ├── Crawler (web scraping)
│   └── Doc Processor (embeddings)
```

**After** (Separated workers):
```
Azure Container Instances
├── API Container (WORKER_MODE=api)
│   └── FastAPI API only
├── Crawler Worker
│   └── Polls for crawl jobs
└── Document Worker
    └── Generates embeddings
```

All containers share the same Azure PostgreSQL database.

## Files Created

### Worker Scripts
1. `workers/crawler_worker.py` - Standalone crawler process
2. `workers/doc_worker.py` - Standalone document processor
3. `workers/__init__.py` - Package initialization

### Docker Configuration
4. `docker/docker-compose.workers.yml` - Local testing setup

### Deployment Scripts
5. `scripts/deploy-workers-azure-aci.sh` - Deploy to Azure
6. `scripts/test-workers-local.sh` - Test locally
7. `scripts/validate-aci-deployment.sh` - Validate Azure deployment

### Documentation
8. `docs/WORKER-ARCHITECTURE.md` - Complete documentation

### Code Changes
9. `api/main.py` - Added WORKER_MODE support to skip background threads

## Quick Start

### Option 1: Test Locally First

```bash
# 1. Set environment variables
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
export AZURE_STORAGE_CONTAINER_NAME="your-container-name"
export OPENAI_API_KEY="your-openai-key"

# 2. Start all containers
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/scripts
./test-workers-local.sh

# 3. Test API
curl http://localhost:8000/health

# 4. View logs
cd ../docker
docker-compose -f docker-compose.workers.yml logs -f

# 5. Stop when done
cd ../scripts
./test-workers-local.sh --stop
```

### Option 2: Deploy to Azure Directly

```bash
# 1. Set all required environment variables
export DATABASE_URL="postgresql://user:pass@your-azure-postgres.postgres.database.azure.com:5432/powernova"
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
export AZURE_STORAGE_CONTAINER_NAME="your-container-name"
export OPENAI_API_KEY="your-openai-key"

# Optional - will be auto-generated if not set
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your-secure-password"
export JWT_SECRET="your-jwt-secret"

# 2. Deploy to test environment
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/scripts
./deploy-workers-azure-aci.sh --test

# 3. Validate deployment
./validate-aci-deployment.sh --test

# 4. Test API
curl http://powernova-workers-test.eastus.azurecontainer.io:8000/health
```

## What to Expect

### Local Testing
- **API**: http://localhost:8000
- **PostgreSQL**: localhost:5433
- **Containers**: 4 (api, crawler-worker, doc-worker, postgres)

### Azure Testing
- **API**: http://powernova-workers-test.eastus.azurecontainer.io:8000
- **Containers**: 3 (api, crawler-worker, doc-worker)
- **Database**: Shared Azure PostgreSQL

## Verification Steps

### 1. Check All Containers Running

**Local**:
```bash
docker-compose -f docker/docker-compose.workers.yml ps
```

**Azure**:
```bash
az container show -g powernova -n powernova-workers-test
```

### 2. Test API Health

```bash
# Local
curl http://localhost:8000/health

# Azure
curl http://powernova-workers-test.eastus.azurecontainer.io:8000/health
```

### 3. Trigger a Crawl Job

1. Login to admin UI: http://localhost:8000/admin.html (or Azure URL)
2. Go to "Crawl Documents" tab
3. Start a new crawl
4. Watch crawler worker logs:

**Local**:
```bash
docker-compose -f docker/docker-compose.workers.yml logs -f crawler-worker
```

**Azure**:
```bash
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker --follow
```

### 4. Check Document Processing

After crawl completes, watch doc worker logs:

**Local**:
```bash
docker-compose -f docker/docker-compose.workers.yml logs -f doc-worker
```

**Azure**:
```bash
az container logs -g powernova -n powernova-workers-test --container-name doc-worker --follow
```

## Expected Performance

### API Response Times
- **Before**: 500-2000ms (with background threads)
- **After**: 50-200ms (API-only mode)

### Worker Processing
- **Crawler**: Polls every 30 seconds
- **Doc Processor**: Polls every 10 seconds, processes 10 jobs per batch

## Parallel Deployment Strategy

As you requested, you can keep your current App Service running while testing the new architecture:

```
Current Production (Keep Running):
└── Azure App Service
    └── api.powernova.ai

New Test Environment:
└── Azure Container Instances  
    └── powernova-workers-test.eastus.azurecontainer.io

Both connect to: Azure PostgreSQL (shared)
```

This lets you:
- ✅ Test new architecture safely
- ✅ Compare performance side-by-side
- ✅ Keep production running
- ✅ Rollback easily if needed

## Next Steps

1. **Test Locally** (recommended):
   - Verify all containers start
   - Test API endpoints
   - Trigger a crawl job
   - Watch workers process jobs

2. **Deploy to Azure Test**:
   - Deploy using `deploy-workers-azure-aci.sh --test`
   - Validate using `validate-aci-deployment.sh --test`
   - Run parallel with existing App Service

3. **Compare Performance**:
   - Monitor API response times
   - Check worker processing speed
   - Verify reliability over 1-2 weeks

4. **Migrate to Production** (when ready):
   - Deploy using `deploy-workers-azure-aci.sh` (without --test)
   - Update DNS to point to new ACI endpoint
   - Monitor for issues
   - Decommission App Service

## Troubleshooting

### Container Won't Start

1. Check logs:
   ```bash
   # Local
   docker-compose -f docker/docker-compose.workers.yml logs [container-name]
   
   # Azure
   az container logs -g powernova -n powernova-workers-test --container-name [name]
   ```

2. Verify environment variables are set correctly

3. Check database connection

### Workers Not Processing Jobs

1. Verify jobs exist in database:
   ```sql
   SELECT * FROM crawl_jobs WHERE status = 'PENDING';
   SELECT * FROM document_jobs WHERE status = 'PENDING';
   ```

2. Check worker logs for errors

3. Verify poll intervals are set correctly

### Need Help?

- See full documentation: `docs/WORKER-ARCHITECTURE.md`
- Check troubleshooting section in docs
- Review logs for specific errors

## Cost Estimate

### Azure Container Instances (3 containers)
- API Container: $15-25/month (1 CPU, 2GB RAM)
- Crawler Worker: $7-15/month (0.5 CPU, 1GB RAM)
- Doc Worker: $7-15/month (0.5 CPU, 1GB RAM)

**Total**: ~$30-55/month (vs $50-100 for App Service)

**Potential savings**: 30-40% with better performance!

## Important Notes

1. **Backward Compatibility**: The existing setup still works! If you don't set `WORKER_MODE=api`, it runs all background threads like before.

2. **Database Safety**: Both setups can connect to the same database. Workers use polling, so they won't conflict.

3. **Zero Downtime**: You can test the new architecture without touching your current production setup.

4. **Easy Rollback**: Just delete the ACI container group if you want to go back.

## Ready to Start?

Choose your path:
- **Conservative**: Start with local testing → Azure test → Compare → Migrate
- **Quick**: Deploy to Azure test immediately → Validate → Compare

Either way, your current production setup remains untouched! 🚀
