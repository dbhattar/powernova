# Worker Container Architecture - Single Image, Multiple Entry Points

## Overview

PowerNOVA's worker architecture uses a **single Docker image** deployed as **3 separate containers** with different entry points. This is a common and efficient pattern for microservices.

## Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│      Single Docker Image                        │
│      powernovaregistry.azurecr.io/              │
│      powernova-api:latest                       │
│                                                  │
│  ├── api/              (Python code)            │
│  ├── workers/          (Worker scripts)         │
│  │   ├── crawler_worker.py                      │
│  │   └── doc_worker.py                          │
│  ├── models/           (Shared models)          │
│  ├── services/         (Shared services)        │
│  └── database/         (Shared DB code)         │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ API Container│ │   Crawler   │ │ Doc Worker   │
│              │ │   Worker    │ │  Container   │
│ Entry point: │ │ Container   │ │              │
│ uvicorn main │ │             │ │ Entry point: │
│ (default CMD)│ │ Entry point:│ │ python3      │
│              │ │ python3     │ │ workers/     │
│ WORKER_MODE  │ │ workers/    │ │ doc_worker.py│
│ = api        │ │ crawler_    │ │              │
│              │ │ worker.py   │ │              │
└──────────────┘ └─────────────┘ └──────────────┘
```

## Why Single Image?

### ✅ Advantages

1. **Code Sharing**: All containers share the same codebase
   - Same models, services, database code
   - No code duplication
   - Consistent versions across all containers

2. **Simpler Deployment**:
   - Build once, deploy three times
   - Single image to manage
   - Faster deployments (image cached after first pull)

3. **Version Consistency**:
   - All containers always use same code version
   - No version mismatch issues
   - Atomic updates (deploy new tag to all containers)

4. **Smaller Registry Footprint**:
   - One image instead of three
   - Less storage in ACR
   - Faster image pulls after first download

5. **Easier Maintenance**:
   - Single Dockerfile to maintain
   - Single build process
   - Single CI/CD pipeline

### ❌ Alternative Approaches (NOT Used)

**Separate Images (Not Recommended):**
```
❌ powernova-api:latest
❌ powernova-crawler:latest  
❌ powernova-doc-worker:latest
```

Problems:
- Code duplication
- Multiple Dockerfiles to maintain
- Larger registry footprint
- Version synchronization issues
- More complex CI/CD

## How It Works

### 1. Dockerfile (Dockerfile.api)

Includes everything needed by all containers:

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install all dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy entire codebase
COPY api/ ./
COPY workers/ ./workers/

# Default command (used by API container)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. ARM Template - Different Entry Points

**API Container** (uses default CMD):
```json
{
  "name": "api",
  "properties": {
    "image": "powernovaregistry.azurecr.io/powernova-api:latest",
    // No command override - uses default CMD from Dockerfile
    "environmentVariables": [
      {"name": "WORKER_MODE", "value": "api"}
    ]
  }
}
```

**Crawler Worker** (overrides command):
```json
{
  "name": "crawler-worker",
  "properties": {
    "image": "powernovaregistry.azurecr.io/powernova-api:latest",
    "command": ["python3", "workers/crawler_worker.py"],  // ← Override
    "environmentVariables": [
      {"name": "WORKER_ID", "value": "crawler-worker-aci-prod"}
    ]
  }
}
```

**Doc Worker** (overrides command):
```json
{
  "name": "doc-worker",
  "properties": {
    "image": "powernovaregistry.azurecr.io/powernova-api:latest",
    "command": ["python3", "workers/doc_worker.py"],  // ← Override
    "environmentVariables": [
      {"name": "WORKER_ID", "value": "doc-worker-aci-prod"}
    ]
  }
}
```

## Build and Deployment Process

### Step 1: Build Image

```bash
# Build single image containing all code
docker build -f docker/Dockerfile.api \
  -t powernovaregistry.azurecr.io/powernova-api:latest .
```

### Step 2: Push to Registry

```bash
# Push to Azure Container Registry
docker push powernovaregistry.azurecr.io/powernova-api:latest
```

### Step 3: Deploy 3 Containers

```bash
# Deploy using ARM template
az deployment group create \
  --template-file aci-deployment.json \
  --parameters @params.json

# Creates:
# - 1 API container (default CMD)
# - 1 Crawler worker (command override)
# - 1 Doc worker (command override)
```

## Container Behavior

### API Container

**What runs:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Environment:**
- `WORKER_MODE=api` → Skips background threads
- Handles HTTP requests only
- Port 8000 exposed

### Crawler Worker Container

**What runs:**
```bash
python3 workers/crawler_worker.py
```

**Environment:**
- `WORKER_ID=crawler-worker-aci-prod`
- `POLL_INTERVAL=30`
- Polls database for crawl jobs
- No ports exposed

### Doc Worker Container

**What runs:**
```bash
python3 workers/doc_worker.py
```

**Environment:**
- `WORKER_ID=doc-worker-aci-prod`
- `DOC_PROCESSOR_POLL_INTERVAL=10`
- `DOC_PROCESSOR_BATCH_SIZE=10`
- Polls database for document jobs
- No ports exposed

## Verification

### Check Running Containers

```bash
# Show all containers in the group
az container show \
  --resource-group powernova \
  --name powernova-workers-prod \
  --query 'containers[].name' -o table
```

Output:
```
Result
----------------
api
crawler-worker
doc-worker
```

### Check Container Images

```bash
# All containers use the same image
az container show \
  --resource-group powernova \
  --name powernova-workers-prod \
  --query 'containers[].{Name:name, Image:image}' -o table
```

Output:
```
Name            Image
--------------  ----------------------------------------------------
api             powernovaregistry.azurecr.io/powernova-api:latest
crawler-worker  powernovaregistry.azurecr.io/powernova-api:latest
doc-worker      powernovaregistry.azurecr.io/powernova-api:latest
```

### Check Container Commands

```bash
# Show what each container is running
az container show \
  --resource-group powernova \
  --name powernova-workers-prod \
  --query 'containers[].{Name:name, Command:command}' -o table
```

Output:
```
Name            Command
--------------  -----------------------------------------
api             null (uses default CMD)
crawler-worker  ['python3', 'workers/crawler_worker.py']
doc-worker      ['python3', 'workers/doc_worker.py']
```

## Common Patterns

This single-image-multiple-containers pattern is used by:

### Docker Compose
```yaml
services:
  api:
    image: myapp:latest
    # Uses default CMD
  
  worker:
    image: myapp:latest
    command: python worker.py  # Override
```

### Kubernetes
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: api
    image: myapp:latest
    # Uses default command
  
  - name: worker
    image: myapp:latest
    command: ["python", "worker.py"]  # Override
```

### Azure Container Instances
```json
{
  "containers": [
    {
      "name": "api",
      "properties": {"image": "myapp:latest"}
    },
    {
      "name": "worker",
      "properties": {
        "image": "myapp:latest",
        "command": ["python", "worker.py"]
      }
    }
  ]
}
```

## Benefits Summary

| Aspect | Single Image | Multiple Images |
|--------|--------------|-----------------|
| **Build Time** | ✅ Fast (build once) | ❌ Slow (build 3x) |
| **Storage** | ✅ ~1GB | ❌ ~3GB |
| **Consistency** | ✅ Always same version | ❌ May differ |
| **Deployment** | ✅ Simple (one image) | ❌ Complex (sync 3) |
| **Code Sharing** | ✅ Natural | ❌ Duplication |
| **Maintenance** | ✅ One Dockerfile | ❌ Three Dockerfiles |
| **CI/CD** | ✅ One pipeline | ❌ Three pipelines |

## Conclusion

✅ **This is the correct and recommended approach!**

The deployment script is building one image (`powernova-api`) and the ARM template is deploying it as three containers with different entry points. This is:
- Industry standard pattern
- Efficient and maintainable
- Consistent across all containers
- Simple to deploy and update

The naming might be confusing ("api" image used for workers), but this is intentional - it's a unified image containing all code.
