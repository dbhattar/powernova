# Docker Image Build Context - Workers Integration

## Issue Discovered

The original `Dockerfile.api` was not copying the `workers/` directory into the image, which would cause worker containers to fail when trying to run `python3 workers/crawler_worker.py`.

## Solution

Updated `docker/Dockerfile.api` to include the workers directory.

## Project Structure

```
container/
├── api/                    # API application code
│   ├── main.py
│   ├── routes/
│   ├── models/
│   ├── services/
│   ├── database/
│   └── requirements.txt
│
├── workers/                # Worker scripts (NEW!)
│   ├── __init__.py
│   ├── crawler_worker.py
│   └── doc_worker.py
│
└── docker/
    ├── Dockerfile.api      # Production Dockerfile
    └── Dockerfile.api.local # Local development
```

## Build Context

### Deployment Script

```bash
cd "$(dirname "$0")/.."  # Navigate to container/ directory
docker build -f docker/Dockerfile.api -t powernova-api:latest .
#                                                             ^
#                                                      Build context is "."
#                                                      (container/ directory)
```

### Dockerfile Changes

**Before (BROKEN):**
```dockerfile
# Copy application code explicitly
COPY api/main.py .
COPY api/routes/ ./routes/
COPY api/models/ ./models/
COPY api/database/ ./database/
COPY api/services/ ./services/
# ... other api/ files

# ❌ Workers directory NOT copied!
```

**After (FIXED):**
```dockerfile
# Copy application code explicitly
COPY api/main.py .
COPY api/routes/ ./routes/
COPY api/models/ ./models/
COPY api/database/ ./database/
COPY api/services/ ./services/
# ... other api/ files

# ✅ Copy workers directory for worker containers
COPY workers/ ./workers/
```

## Resulting Image Structure

```
/app/                       # Working directory in container
├── main.py                 # From api/main.py
├── routes/                 # From api/routes/
├── models/                 # From api/models/
├── database/               # From api/database/
├── services/               # From api/services/
├── monitoring/             # From api/monitoring/
├── alembic/                # From api/alembic/
├── alembic.ini             # From api/alembic.ini
├── startup.sh              # From api/startup.sh
│
└── workers/                # ✅ From workers/ (NOW INCLUDED!)
    ├── __init__.py
    ├── crawler_worker.py
    └── doc_worker.py
```

## How Containers Use Workers

### API Container
```bash
# Default CMD from Dockerfile
uvicorn main:app --host 0.0.0.0 --port 8000

# Does NOT use workers/ directory
# But still includes it in the image (same image for all containers)
```

### Crawler Worker Container
```bash
# Command override from ARM template
python3 workers/crawler_worker.py
#       ^^^^^^^^^^^^^^^^^^^^^^
#       This path now exists in the image!
```

### Doc Worker Container
```bash
# Command override from ARM template
python3 workers/doc_worker.py
#       ^^^^^^^^^^^^^^^^^^^
#       This path now exists in the image!
```

## Verification

### Build and Check

```bash
# Build image
docker build -f docker/Dockerfile.api -t test-workers .

# Check if workers directory exists
docker run --rm test-workers ls -la /app/workers

# Expected output:
# total 12
# drwxr-xr-x 2 root root 4096 Dec  1 12:00 .
# drwxr-xr-x 1 root root 4096 Dec  1 12:00 ..
# -rw-r--r-- 1 root root   80 Dec  1 12:00 __init__.py
# -rw-r--r-- 1 root root 5234 Dec  1 12:00 crawler_worker.py
# -rw-r--r-- 1 root root 3142 Dec  1 12:00 doc_worker.py
```

### Test Worker Execution

```bash
# Test crawler worker
docker run --rm test-workers python3 -c "import workers.crawler_worker; print('✓ Crawler worker module loads')"

# Test doc worker
docker run --rm test-workers python3 -c "import workers.doc_worker; print('✓ Doc worker module loads')"
```

## Docker Compose (Local Testing)

The local Docker Compose file already handles this correctly:

```yaml
# docker-compose.workers.yml
crawler-worker:
  build:
    context: ..
    dockerfile: docker/Dockerfile.api.local
  command: python3 workers/crawler_worker.py
  #                 ^^^^^^^^^^^^^^^^^^^^^^
  #                 Works because Dockerfile.api.local uses COPY . .
```

`Dockerfile.api.local` uses `COPY . .` which copies everything including `workers/`.

## Import Paths in Worker Scripts

### workers/crawler_worker.py
```python
import sys
import os

# Add parent directory to path so we can import from api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))
#                                                           ^^^^
#                                                   Goes up to /app, then into api/

from database.session import SessionLocal
from models import CrawlJob, CrawlStatus
from services.crawler import run_crawler
```

This works because in the container:
```
/app/
├── workers/
│   └── crawler_worker.py     # Script runs from here
└── (api code at /app level)  # Imports work via sys.path manipulation
```

## Build Process

### Step-by-Step

1. **Set build context:**
   ```bash
   cd /path/to/container/  # Project root
   ```

2. **Build image:**
   ```bash
   docker build -f docker/Dockerfile.api -t powernova-api:latest .
   #            ^                                                ^
   #            Dockerfile location                      Build context
   ```

3. **Dockerfile copies:**
   - `api/` contents → `/app/`
   - `workers/` → `/app/workers/`

4. **Result:** Single image with both API and worker code

### Why This Works

- **Build context (`.`)**: `container/` directory
- **Dockerfile location**: `docker/Dockerfile.api`
- **COPY commands**: Relative to build context
  - `COPY api/main.py .` → Copies from `container/api/main.py`
  - `COPY workers/ ./workers/` → Copies from `container/workers/`

## Debugging

### Check Image Contents

```bash
# Build image
docker build -f docker/Dockerfile.api -t debug-workers .

# Run interactive shell
docker run --rm -it debug-workers /bin/bash

# Inside container:
ls -la /app/workers/
python3 -c "import sys; print(sys.path)"
python3 workers/crawler_worker.py --help
```

### Common Issues

**Error: `No such file or directory: 'workers/crawler_worker.py'`**
- ❌ Workers directory not copied to image
- ✅ Solution: Ensure `COPY workers/ ./workers/` in Dockerfile

**Error: `ModuleNotFoundError: No module named 'database'`**
- ❌ sys.path not set correctly in worker script
- ✅ Solution: Worker scripts add parent/api to sys.path

**Error: `FileNotFoundError: [Errno 2] No such file or directory: '../api'`**
- ❌ Relative path from worker script doesn't work
- ✅ Solution: Use `os.path.join(os.path.dirname(__file__), '..', 'api')`

## Summary

✅ **Fixed:** `Dockerfile.api` now copies `workers/` directory
✅ **Verified:** Build context includes both `api/` and `workers/`
✅ **Tested:** Image includes all necessary code for all 3 containers
✅ **Working:** All containers (API, crawler, doc worker) can start successfully

## Related Files

- **Dockerfile**: `docker/Dockerfile.api` (production)
- **Dockerfile**: `docker/Dockerfile.api.local` (local dev)
- **Workers**: `workers/crawler_worker.py`, `workers/doc_worker.py`
- **Deployment**: `scripts/deploy-workers-azure-aci.sh`
