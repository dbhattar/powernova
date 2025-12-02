# PowerNOVA Worker Architecture

## Overview

PowerNOVA has been refactored to separate background jobs from the API server for improved responsiveness. The architecture now consists of three independent components:

1. **API Server** - Handles HTTP requests only (no background threads)
2. **Crawler Worker** - Processes web crawl jobs
3. **Document Worker** - Generates embeddings and processes document chunks

All components share the same PostgreSQL database.

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         Azure Container Instances           │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   API    │  │ Crawler  │  │   Doc    │  │
│  │ Container│  │  Worker  │  │  Worker  │  │
│  │          │  │          │  │          │  │
│  │ FastAPI  │  │ Polling  │  │Embedding │  │
│  │ (8000)   │  │ Crawls   │  │Generator │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │             │         │
│       │             │             │         │
└───────┼─────────────┼─────────────┼─────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
           ┌──────────▼──────────┐
           │  Azure PostgreSQL   │
           │   (Shared DB)       │
           └─────────────────────┘
```

## Benefits

### Performance
- **API Responsiveness**: ~50-200ms response times (vs 500-2000ms with background threads)
- **Resource Isolation**: CPU-intensive tasks don't impact API
- **Independent Scaling**: Scale workers independently based on workload

### Reliability
- **Fault Isolation**: Worker crashes don't affect API
- **Graceful Degradation**: API remains available even if workers fail
- **Easy Debugging**: Separate logs for each component

### Cost Optimization
- **Right-Sizing**: Allocate resources based on actual needs
- **Auto-Scaling**: Scale workers during peak times (future enhancement)

## Components

### 1. API Container

**Purpose**: Handle HTTP requests only

**Configuration**:
```bash
WORKER_MODE=api  # Skips background thread startup
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
```

**Resources**:
- CPU: 1.0 core
- Memory: 2 GB

**Endpoints**:
- `/health` - Health check
- `/api/chat` - Chat endpoints
- `/api/search` - Semantic search
- `/api/admin/*` - Admin endpoints

### 2. Crawler Worker

**Purpose**: Poll for pending crawl jobs and execute them

**Configuration**:
```bash
WORKER_ID=crawler-worker-aci-prod
POLL_INTERVAL=30  # Seconds between polls
DATABASE_URL=postgresql://...
AZURE_STORAGE_CONNECTION_STRING=...
```

**Resources**:
- CPU: 0.5 core
- Memory: 1 GB

**Behavior**:
- Auto-resumes interrupted jobs on startup
- Polls database every 30 seconds
- Processes one job at a time (FIFO)
- Updates job status (PENDING → RUNNING → COMPLETED/FAILED)

### 3. Document Worker

**Purpose**: Generate embeddings and process document chunks

**Configuration**:
```bash
WORKER_ID=doc-worker-aci-prod
DOC_PROCESSOR_POLL_INTERVAL=10  # Seconds
DOC_PROCESSOR_BATCH_SIZE=10     # Jobs per batch
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
```

**Resources**:
- CPU: 0.5 core
- Memory: 1 GB

**Behavior**:
- Polls database every 10 seconds
- Processes up to 10 jobs per batch
- Generates OpenAI embeddings (1536-dim vectors)
- Chunks documents and stores in database

## Deployment

### Local Testing

Test the worker architecture locally using Docker Compose:

```bash
# Set required environment variables
export AZURE_STORAGE_CONNECTION_STRING="..."
export AZURE_STORAGE_CONTAINER_NAME="..."
export OPENAI_API_KEY="..."

# Start all containers
cd scripts
./test-workers-local.sh

# Follow logs
./test-workers-local.sh --logs

# Stop all containers
./test-workers-local.sh --stop
```

**Local Services**:
- API: http://localhost:8000
- PostgreSQL: localhost:5433
- All containers share local network

### Azure Container Instances (ACI)

Deploy to Azure Container Instances for production testing:

```bash
# Set required environment variables
export DATABASE_URL="postgresql://..."
export AZURE_STORAGE_CONNECTION_STRING="..."
export AZURE_STORAGE_CONTAINER_NAME="..."
export OPENAI_API_KEY="..."

# Deploy to test environment
cd scripts
./deploy-workers-azure-aci.sh --test

# Deploy to production
./deploy-workers-azure-aci.sh

# Validate deployment
./validate-aci-deployment.sh --test
./validate-aci-deployment.sh --prod
```

**ACI Endpoints**:
- Test: http://powernova-workers-test.eastus.azurecontainer.io:8000
- Prod: http://powernova-workers-prod.eastus.azurecontainer.io:8000

## Environment Variables

### Required for All Containers
- `DATABASE_URL` - PostgreSQL connection string

### API Container
- `WORKER_MODE=api` - Run in API-only mode
- `OPENAI_API_KEY` - For chat completions
- `ADMIN_USERNAME` - Admin login
- `ADMIN_PASSWORD` - Admin password
- `JWT_SECRET` - JWT signing key

### Crawler Worker
- `WORKER_ID` - Unique worker identifier
- `POLL_INTERVAL` - Seconds between polls (default: 30)
- `AZURE_STORAGE_CONNECTION_STRING` - For blob storage
- `AZURE_STORAGE_CONTAINER_NAME` - Blob container

### Document Worker
- `WORKER_ID` - Unique worker identifier
- `DOC_PROCESSOR_POLL_INTERVAL` - Seconds between polls (default: 10)
- `DOC_PROCESSOR_BATCH_SIZE` - Jobs per batch (default: 10)
- `OPENAI_API_KEY` - For embeddings
- `AZURE_STORAGE_CONNECTION_STRING` - For blob storage

## Monitoring

### View Logs

**Local (Docker Compose)**:
```bash
# All containers
docker-compose -f docker/docker-compose.workers.yml logs -f

# Individual containers
docker-compose -f docker/docker-compose.workers.yml logs -f api
docker-compose -f docker/docker-compose.workers.yml logs -f crawler-worker
docker-compose -f docker/docker-compose.workers.yml logs -f doc-worker
```

**Azure (ACI)**:
```bash
# API logs
az container logs -g powernova -n powernova-workers-prod --container-name api

# Crawler worker logs
az container logs -g powernova -n powernova-workers-prod --container-name crawler-worker

# Document worker logs
az container logs -g powernova -n powernova-workers-prod --container-name doc-worker

# Follow logs in real-time
az container logs -g powernova -n powernova-workers-prod --container-name api --follow
```

### Container Status

**Local**:
```bash
docker-compose -f docker/docker-compose.workers.yml ps
```

**Azure**:
```bash
az container show -g powernova -n powernova-workers-prod
```

### Health Checks

**API Health**:
```bash
# Local
curl http://localhost:8000/health

# Azure Test
curl http://powernova-workers-test.eastus.azurecontainer.io:8000/health

# Azure Prod
curl http://powernova-workers-prod.eastus.azurecontainer.io:8000/health
```

## Testing Strategy

### Parallel Deployment

The recommended testing approach is to run both architectures in parallel:

1. **Keep Existing**: Azure App Service at api.powernova.ai (current production)
2. **Deploy New**: ACI at powernova-workers-test.eastus.azurecontainer.io
3. **Share Database**: Both connect to same Azure PostgreSQL
4. **Compare**: Monitor performance, reliability, costs
5. **Migrate**: When validated, switch DNS and decommission App Service

### Performance Testing

```bash
# Test API response times
time curl http://powernova-workers-test.eastus.azurecontainer.io:8000/health

# Compare with App Service
time curl https://api.powernova.ai/health

# Load test (requires hey or ab)
hey -n 1000 -c 10 http://powernova-workers-test.eastus.azurecontainer.io:8000/health
```

### Worker Validation

1. **Trigger Crawl Job**:
   - Use admin UI to start a new crawl
   - Check crawler worker logs for job pickup
   - Verify job status changes: PENDING → RUNNING → COMPLETED

2. **Trigger Document Processing**:
   - Crawler creates DocumentJob entries
   - Check doc worker logs for processing
   - Verify embeddings are generated

3. **Check Database**:
   ```sql
   -- Check crawl jobs
   SELECT id, status, start_url, created_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 10;
   
   -- Check document jobs
   SELECT id, status, created_at FROM document_jobs ORDER BY created_at DESC LIMIT 10;
   
   -- Check processed documents
   SELECT id, url, embedding_generated FROM documents WHERE embedding_generated = true LIMIT 10;
   ```

## Cost Comparison

### Current: Azure App Service
- ~$50-100/month (depends on tier)
- Single instance running all components

### New: Azure Container Instances
- API Container: ~$15-25/month
- Crawler Worker: ~$7-15/month
- Doc Worker: ~$7-15/month
- **Total**: ~$30-55/month

**Potential Savings**: 30-40% cost reduction with better performance

## Migration Path

### Phase 1: Test (Current)
- ✅ Deploy to ACI test environment
- ✅ Validate all components working
- Test API endpoints
- Verify workers processing jobs
- Monitor for 1-2 weeks

### Phase 2: Production Testing
- Deploy to ACI production
- Run parallel with App Service
- Compare performance metrics
- Collect reliability data

### Phase 3: Migration
- Update DNS/load balancer to point to ACI
- Monitor for issues
- Keep App Service running as backup (1 week)
- Decommission App Service

### Phase 4: Optimization
- Tune worker resources (CPU/memory)
- Adjust poll intervals
- Implement auto-scaling (if needed)

## Troubleshooting

### API Container Not Responding

1. Check container status:
   ```bash
   az container show -g powernova -n powernova-workers-prod
   ```

2. Check logs:
   ```bash
   az container logs -g powernova -n powernova-workers-prod --container-name api
   ```

3. Verify environment variables are set

4. Check database connectivity

### Workers Not Processing Jobs

1. Check worker logs:
   ```bash
   az container logs -g powernova -n powernova-workers-prod --container-name crawler-worker
   az container logs -g powernova -n powernova-workers-prod --container-name doc-worker
   ```

2. Verify database has pending jobs:
   ```sql
   SELECT COUNT(*) FROM crawl_jobs WHERE status = 'PENDING';
   SELECT COUNT(*) FROM document_jobs WHERE status = 'PENDING';
   ```

3. Check worker is polling:
   - Look for "polling" messages in logs
   - Verify POLL_INTERVAL is set correctly

4. Check for errors in logs

### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check firewall rules allow container IPs
3. Verify PostgreSQL is running
4. Check connection pool settings

## Files

### Worker Entry Points
- `workers/crawler_worker.py` - Crawler worker main script
- `workers/doc_worker.py` - Document worker main script
- `workers/__init__.py` - Package initialization

### Docker Configuration
- `docker/docker-compose.workers.yml` - Local testing with Docker Compose
- `docker/Dockerfile.api.local` - Docker image (shared by all containers)

### Deployment Scripts
- `scripts/deploy-workers-azure-aci.sh` - Deploy to Azure Container Instances
- `scripts/test-workers-local.sh` - Test locally with Docker Compose
- `scripts/validate-aci-deployment.sh` - Validate ACI deployment

### API Changes
- `api/main.py` - Added WORKER_MODE detection to skip background threads

## Future Enhancements

### Auto-Scaling
- Implement Azure Container Instances auto-scaling
- Scale workers based on queue depth
- Cost-effective during peak times

### Monitoring
- Add Azure Application Insights
- Track worker performance metrics
- Set up alerting for failures

### High Availability
- Run multiple worker instances
- Implement job locking to prevent duplicate processing
- Add retry logic with exponential backoff

### Optimization
- Fine-tune resource allocation
- Optimize poll intervals based on workload
- Implement batch processing optimizations

## Support

For issues or questions:
1. Check logs first
2. Review troubleshooting section
3. Validate environment variables
4. Check Azure portal for resource status
