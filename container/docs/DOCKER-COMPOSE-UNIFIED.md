# Docker Compose Update - Unified Configuration

## Summary

Updated the main `docker-compose.yml` to include worker services instead of using a separate `docker-compose.workers.yml` file. This provides a single, unified local development environment.

## Changes Made

### 1. Updated `docker/docker-compose.yml`

**Added Worker Services:**
- `powernova-crawler-worker` - Background crawl job processor
- `powernova-doc-worker` - Background document/embedding processor

**Updated API Service:**
- Added `WORKER_MODE=api` environment variable
- API now runs in API-only mode (no background tasks)

**Architecture:**
```
docker-compose.yml (unified configuration)
├── powernova-web (port 8080)
├── powernova-chat (port 8081)
├── powernova-api (port 8000, WORKER_MODE=api)
├── powernova-crawler-worker (background, no ports)
├── powernova-doc-worker (background, no ports)
└── powernova-postgres (internal only)
```

### 2. Worker Service Configuration

**Crawler Worker:**
```yaml
powernova-crawler-worker:
  build:
    context: ../api
    dockerfile: ../docker/Dockerfile.api.local
  command: ["python3", "workers/crawler_worker.py"]
  environment:
    - WORKER_ID=crawler-worker-local
    - POLL_INTERVAL=30
  volumes:
    - ../api:/app  # Hot-reload support
```

**Doc Worker:**
```yaml
powernova-doc-worker:
  build:
    context: ../api
    dockerfile: ../docker/Dockerfile.api.local
  command: ["python3", "workers/doc_worker.py"]
  environment:
    - WORKER_ID=doc-worker-local
    - DOC_PROCESSOR_POLL_INTERVAL=10
    - DOC_PROCESSOR_BATCH_SIZE=10
  volumes:
    - ../api:/app  # Hot-reload support
```

### 3. Updated `scripts/test-workers-local.sh`

**New Options:**
```bash
./test-workers-local.sh [--logs] [--stop] [--workers-only]
```

**Options:**
- `--logs` - Follow logs after starting
- `--stop` - Stop and remove all containers
- `--workers-only` - Start only backend services (API, workers, DB)

**What Changed:**
- Now uses `docker-compose.yml` instead of `docker-compose.workers.yml`
- Added `--workers-only` flag for minimal setup
- Updated container names (e.g., `postgres` → `powernova-postgres`)
- Better service status display

## Benefits

### 1. Unified Configuration
- ✅ Single `docker-compose.yml` for all services
- ✅ No need to maintain separate worker compose file
- ✅ Easier to understand project structure

### 2. Flexible Testing
```bash
# Start everything (web, chat, API, workers, DB)
./scripts/test-workers-local.sh

# Start only backend services
./scripts/test-workers-local.sh --workers-only

# Start and follow logs
./scripts/test-workers-local.sh --logs

# Stop everything
./scripts/test-workers-local.sh --stop
```

### 3. Hot Reload Support
- All services mount source code as volumes
- Changes to worker code auto-reload
- Faster development cycle

### 4. Consistent Names
- All containers prefixed with `powernova-*`
- Clear distinction between services
- Easier to identify in `docker ps`

## Usage Examples

### Start Full Stack
```bash
cd /path/to/container
./scripts/test-workers-local.sh
```

**Services Started:**
- Website: http://localhost:8080
- Chat App: http://localhost:8081
- API: http://localhost:8000
- Crawler Worker (background)
- Doc Worker (background)
- PostgreSQL (internal)

### Start Workers Only (Minimal)
```bash
./scripts/test-workers-local.sh --workers-only
```

**Services Started:**
- API: http://localhost:8000
- Crawler Worker (background)
- Doc Worker (background)
- PostgreSQL (internal)

**Skipped:**
- Website
- Chat App

### View Logs
```bash
# All services
docker-compose -f docker/docker-compose.yml logs -f

# Specific service
docker logs -f powernova-crawler-worker
docker logs -f powernova-doc-worker
docker logs -f powernova-api

# Follow logs on startup
./scripts/test-workers-local.sh --logs

# Workers only + logs
./scripts/test-workers-local.sh --workers-only --logs
```

### Stop Services
```bash
./scripts/test-workers-local.sh --stop
```

## Environment Variables

Workers need these environment variables (from `api/.env`):

```bash
# Database (automatically set to local PostgreSQL)
DATABASE_URL=postgresql://powernova:powernova_dev_2024@powernova-postgres:5432/powernova

# Azure Storage (required)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=documents

# OpenAI (required for doc worker)
OPENAI_API_KEY=sk-...
```

## Container Details

| Container | Image | Command | Ports | Purpose |
|-----------|-------|---------|-------|---------|
| powernova-web | Dockerfile.local | nginx | 8080 | Landing page |
| powernova-chat | Dockerfile.app.local | nginx | 8081 | Chat interface |
| powernova-api | Dockerfile.api.local | uvicorn | 8000 | REST API |
| powernova-crawler-worker | Dockerfile.api.local | python3 workers/crawler_worker.py | - | Crawl jobs |
| powernova-doc-worker | Dockerfile.api.local | python3 workers/doc_worker.py | - | Embeddings |
| powernova-postgres | pgvector/pgvector:pg16 | postgres | - | Database |

## Testing Workflow

### 1. Start Services
```bash
./scripts/test-workers-local.sh --workers-only
```

### 2. Create a Test Crawl Job
```bash
curl -X POST http://localhost:8000/api/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "https://example.com"}'
```

### 3. Watch Crawler Worker Process It
```bash
docker logs -f powernova-crawler-worker
```

**Expected output:**
```
[2025-12-01 04:15:30] INFO: Crawler worker started
[2025-12-01 04:15:35] INFO: Polling for crawl jobs...
[2025-12-01 04:15:36] INFO: Found 1 pending job(s)
[2025-12-01 04:15:36] INFO: Processing job ID: 123
[2025-12-01 04:15:45] INFO: Crawl completed: 5 pages
[2025-12-01 04:15:45] INFO: Job 123 completed successfully
```

### 4. Check Database
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova

# Check crawl job status
SELECT id, url, status, created_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 5;
```

### 5. Stop When Done
```bash
./scripts/test-workers-local.sh --stop
```

## Differences from Production

| Aspect | Local (docker-compose.yml) | Production |
|--------|---------------------------|------------|
| **API** | Docker container | Azure App Service |
| **Workers** | Docker containers | Azure Container Instances |
| **Database** | PostgreSQL container | Azure PostgreSQL |
| **Storage** | Azure Storage (via env vars) | Azure Storage |
| **Networking** | Docker network | Azure VNet |
| **Ports** | Exposed to host | API only (workers internal) |

## Troubleshooting

### Workers Not Starting
**Check logs:**
```bash
docker logs powernova-crawler-worker
docker logs powernova-doc-worker
```

**Common issues:**
- Missing environment variables
- Database not ready
- Python import errors

### Database Connection Failed
**Check PostgreSQL:**
```bash
docker logs powernova-postgres
docker exec -it powernova-postgres pg_isready -U powernova
```

### Port Already in Use
**Find and stop conflicting process:**
```bash
lsof -i :8000  # For API
lsof -i :8080  # For website
lsof -i :8081  # For chat app

# Or stop all services
./scripts/test-workers-local.sh --stop
```

### Hot Reload Not Working
**Restart specific service:**
```bash
docker-compose -f docker/docker-compose.yml restart powernova-crawler-worker
```

## Migration from docker-compose.workers.yml

If you were using the old `docker-compose.workers.yml`:

**1. Stop old services:**
```bash
docker-compose -f docker/docker-compose.workers.yml down
```

**2. Start new unified services:**
```bash
./scripts/test-workers-local.sh --workers-only
```

**3. Optional: Delete old file**
```bash
rm docker/docker-compose.workers.yml
```

## Files Modified

1. ✅ `docker/docker-compose.yml`
   - Added `powernova-crawler-worker` service
   - Added `powernova-doc-worker` service
   - Updated `powernova-api` with `WORKER_MODE=api`
   - Updated documentation comments

2. ✅ `scripts/test-workers-local.sh`
   - Changed from `docker-compose.workers.yml` to `docker-compose.yml`
   - Added `--workers-only` flag
   - Updated container names
   - Better service display

## Files Can Be Removed (Optional)

- `docker/docker-compose.workers.yml` (if it exists)

## Date
December 1, 2025
