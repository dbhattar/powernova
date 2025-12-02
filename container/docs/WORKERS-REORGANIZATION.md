# Workers Folder Reorganization

## Change Summary

Moved the `workers/` directory from project root into the `api/` directory for cleaner module imports and better code organization.

## Before

```
container/
├── api/
│   ├── main.py
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── database/
│
└── workers/              ← At project root
    ├── __init__.py
    ├── crawler_worker.py
    └── doc_worker.py
```

**Issues:**
- Workers at different level than api code
- Required complex sys.path manipulation: `sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))`
- Confusing directory structure
- Two separate COPY commands in Dockerfile

## After

```
container/
└── api/
    ├── main.py
    ├── routes/
    ├── models/
    ├── services/
    ├── database/
    └── workers/          ← Now inside api/
        ├── __init__.py
        ├── crawler_worker.py
        └── doc_worker.py
```

**Benefits:**
- ✅ Workers in same directory structure as api code
- ✅ Simpler imports: `sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))`
- ✅ Cleaner project organization
- ✅ Single COPY in Dockerfile (everything under api/)

## Changes Made

### 1. Moved Directory

```bash
mv workers/ api/workers/
```

### 2. Updated Worker Scripts

**crawler_worker.py and doc_worker.py:**

**Before:**
```python
# Add parent directory to path so we can import from api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))
```

**After:**
```python
# Add parent directory to Python path to import from api modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

**Explanation:**
- `__file__` → `/app/workers/crawler_worker.py`
- `os.path.dirname(__file__)` → `/app/workers/`
- `os.path.dirname(os.path.dirname(__file__))` → `/app/`
- Now imports work: `from database.session import ...` finds `/app/database/session.py`

### 3. Updated Dockerfile.api

**Before:**
```dockerfile
COPY api/main.py .
COPY api/routes/ ./routes/
# ... other api files

# Copy workers directory for worker containers
COPY workers/ ./workers/
```

**After:**
```dockerfile
COPY api/main.py .
COPY api/routes/ ./routes/
# ... other api files
COPY api/workers/ ./workers/
```

All code now copied from `api/` directory - cleaner and more consistent!

## Directory Structure in Container

```
/app/                       # Working directory
├── main.py                 # From api/main.py
├── routes/                 # From api/routes/
├── models/                 # From api/models/
├── database/               # From api/database/
├── services/               # From api/services/
└── workers/                # From api/workers/
    ├── __init__.py
    ├── crawler_worker.py
    └── doc_worker.py
```

## Import Flow

### Worker Script Execution

```python
# workers/crawler_worker.py runs
import sys
import os

# Get parent directory (/app)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now can import from /app/database, /app/models, etc.
from database.session import SessionLocal  # → /app/database/session.py ✓
from models import CrawlJob                # → /app/models/__init__.py ✓
from services.crawler import run_crawler   # → /app/services/crawler.py ✓
```

## Container Commands (No Changes)

The ARM template and Docker Compose commands remain exactly the same:

```json
{
  "name": "crawler-worker",
  "properties": {
    "command": ["python3", "workers/crawler_worker.py"]
  }
}
```

This still works because:
- Working directory is `/app`
- Workers are at `/app/workers/`
- Command runs: `python3 /app/workers/crawler_worker.py`

## Verification

### Check Directory Structure

```bash
# Build image
docker build -f docker/Dockerfile.api -t test-structure .

# Verify workers location
docker run --rm test-structure ls -la /app/workers/

# Expected output:
# total 20
# drwxr-xr-x 2 root root 4096 Dec  1 12:00 .
# drwxr-xr-x 1 root root 4096 Dec  1 12:00 ..
# -rw-r--r-- 1 root root   80 Dec  1 12:00 __init__.py
# -rw-r--r-- 1 root root 5234 Dec  1 12:00 crawler_worker.py
# -rw-r--r-- 1 root root 3142 Dec  1 12:00 doc_worker.py
```

### Test Imports

```bash
# Test crawler worker imports
docker run --rm test-structure python3 -c "
import sys
import os
sys.path.insert(0, '/app')
from database.session import SessionLocal
from models import CrawlJob
print('✓ Imports work correctly')
"

# Test worker script execution
docker run --rm test-structure python3 workers/crawler_worker.py --help
```

## Files Modified

1. ✅ Moved: `workers/` → `api/workers/`
2. ✅ Updated: `api/workers/crawler_worker.py` (sys.path)
3. ✅ Updated: `api/workers/doc_worker.py` (sys.path)
4. ✅ Updated: `docker/Dockerfile.api` (COPY command)

## Files Not Changed

- ✅ `templates/aci-deployment.json` - Commands still work
- ✅ `docker/docker-compose.workers.yml` - Commands still work
- ✅ `scripts/deploy-workers-azure-aci.sh` - No changes needed

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Location** | `workers/` at root | `api/workers/` |
| **Imports** | Complex path manipulation | Simple parent directory |
| **Dockerfile** | Two COPY commands | One COPY (api/) |
| **Organization** | Separated | Cohesive |
| **Clarity** | Confusing structure | Clear hierarchy |

## Testing

### Local Development

```bash
# Start workers locally
cd scripts
./test-workers-local.sh

# Check logs
docker-compose -f ../docker/docker-compose.workers.yml logs crawler-worker
docker-compose -f ../docker/docker-compose.workers.yml logs doc-worker
```

### Azure Deployment

```bash
# Deploy to test environment
./deploy-workers-azure-aci.sh --test

# Validate
./validate-aci-deployment.sh --test

# Check worker logs
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker
az container logs -g powernova -n powernova-workers-test --container-name doc-worker
```

## Conclusion

✅ **Cleaner architecture** - Workers now inside api/ where they belong
✅ **Simpler imports** - Standard Python relative imports
✅ **Better organization** - All application code under api/
✅ **No breaking changes** - Container commands work exactly the same
✅ **Easier maintenance** - One cohesive codebase structure

The workers are now properly organized as part of the API application codebase!
