# Dockerfile.api File Copying Fix

## Problem
The production Dockerfile (`docker/Dockerfile.api`) was not copying all necessary files from the `api/` directory to the Docker image.

## Root Cause
The issue had two components:

1. **Generic COPY command**: `COPY . .` can sometimes miss files or copy unwanted files depending on .dockerignore
2. **Missing .dockerignore in build context**: The .dockerignore was in `docker/` but the build context is `api/`, so Docker couldn't find it

## Fix Applied

### 1. Updated Dockerfile.api
Changed from generic `COPY . .` to explicit file copying:

**Before:**
```dockerfile
COPY . .
```

**After:**
```dockerfile
# Copy application code explicitly
COPY main.py .
COPY routes/ ./routes/

# Verify files were copied (for debugging)
RUN echo "=== Files in /app ===" && ls -la /app && \
    echo "=== Files in /app/routes ===" && ls -la /app/routes
```

**Benefits:**
- ✅ Explicit control over what gets copied
- ✅ Debugging output to verify file copying
- ✅ Easier to understand and maintain
- ✅ Prevents accidentally copying unwanted files

### 2. Created api/.dockerignore
Added `.dockerignore` file in the `api/` directory (the build context):

```
# Python cache
__pycache__/
*.py[cod]

# Environment files
.env
.env.local

# Documentation
*.md

# IDE files
.vscode/
.idea/
```

**Why this matters:**
- Build context is `api/` directory
- Docker looks for `.dockerignore` in the build context root
- Having it in `docker/` directory doesn't help when building from `api/`

## File Structure

```
container/
├── api/                        # Build context root
│   ├── .dockerignore          # ✅ NEW: Controls what Docker copies
│   ├── main.py                # ✅ Explicitly copied
│   ├── requirements.txt       # ✅ Explicitly copied
│   └── routes/                # ✅ Explicitly copied
│       ├── __init__.py
│       └── chat.py
├── docker/
│   ├── Dockerfile.api         # ✅ Updated: Explicit COPY commands
│   └── .dockerignore          # Used for other builds
```

## Verification

### Test the build locally:
```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# Build with debugging output
docker build \
    --platform linux/amd64 \
    -t powernova-api:test \
    -f docker/Dockerfile.api \
    api/
```

**Expected output:**
```
...
=== Files in /app ===
total 24
drwxr-xr-x 1 root root 4096 Nov 16 07:30 .
drwxr-xr-x 1 root root 4096 Nov 16 07:30 ..
-rw-r--r-- 1 root root 2145 Nov 16 07:30 main.py
-rw-r--r-- 1 root root  234 Nov 16 07:30 requirements.txt
drwxr-xr-x 2 root root 4096 Nov 16 07:30 routes

=== Files in /app/routes ===
total 16
drwxr-xr-x 2 root root 4096 Nov 16 07:30 .
drwxr-xr-x 1 root root 4096 Nov 16 07:30 ..
-rw-r--r-- 1 root root   52 Nov 16 07:30 __init__.py
-rw-r--r-- 1 root root 3456 Nov 16 07:30 chat.py
...
```

### Check running container:
```bash
# Run the test image
docker run --rm -p 8000:8000 powernova-api:test

# In another terminal, verify files
docker exec -it <container-id> ls -la /app
docker exec -it <container-id> ls -la /app/routes
```

### Test after deployment:
```bash
# Deploy to Azure
./scripts/azure-deploy-api.sh --update

# Check logs
az webapp log tail \
    --name powernovaapi \
    --resource-group powernova

# SSH into container
az webapp ssh \
    --name powernovaapi \
    --resource-group powernova

# Inside container:
ls -la /app
ls -la /app/routes
```

## Files That Should Be Copied

### ✅ Must be copied:
- `main.py` - FastAPI application entry point
- `requirements.txt` - Python dependencies
- `routes/__init__.py` - Routes package initialization
- `routes/chat.py` - Chat endpoints

### ❌ Should NOT be copied:
- `.env` - Contains secrets (use Azure App Settings instead)
- `__pycache__/` - Python bytecode cache
- `.vscode/` - IDE configuration
- `README.md` - Documentation (not needed at runtime)

## Common Issues and Solutions

### Issue 1: "No module named 'routes'"
**Cause:** `routes/` directory not copied
**Solution:** ✅ Fixed with explicit `COPY routes/ ./routes/`

### Issue 2: "ModuleNotFoundError: No module named 'dotenv'"
**Cause:** `requirements.txt` not copied or not installed
**Solution:** ✅ Ensure `requirements.txt` copied before `RUN pip install`

### Issue 3: Container starts but crashes immediately
**Cause:** `main.py` not copied
**Solution:** ✅ Fixed with explicit `COPY main.py .`

### Issue 4: Environment variables not working
**Cause:** `.env` copied into image (bad practice) or not set in Azure
**Solution:** 
- ✅ `.env` excluded via `.dockerignore`
- ✅ Use Azure App Service Application Settings instead

## Deployment Script Build Command

The deployment script builds like this:
```bash
docker build \
    --platform linux/amd64 \
    -t powernova-api:latest \
    -f docker/Dockerfile.api \
    api/
```

**Key points:**
- `-f docker/Dockerfile.api` - Dockerfile location
- `api/` - Build context (last argument)
- Docker reads `.dockerignore` from `api/` (build context root)
- `COPY` commands are relative to `api/` directory

## Testing Checklist

After rebuilding, verify:

- [ ] API starts without errors
- [ ] Health endpoint works: `curl https://powernovaapi.azurewebsites.net/health`
- [ ] Chat endpoint works: Test streaming
- [ ] No module import errors in logs
- [ ] Environment variables loaded correctly
- [ ] CORS configured properly

## Related Files

- `docker/Dockerfile.api` - Production Dockerfile (updated)
- `api/.dockerignore` - Build context ignore file (new)
- `api/main.py` - Application entry point
- `api/routes/` - API routes directory
- `scripts/azure-deploy-api.sh` - Deployment script

## Next Steps After Fix

1. **Test locally:**
   ```bash
   docker build -t powernova-api:test -f docker/Dockerfile.api api/
   docker run --rm -p 8000:8000 -e OPENAI_API_KEY="sk-..." powernova-api:test
   ```

2. **Deploy to Azure:**
   ```bash
   ./scripts/azure-deploy-api.sh --update
   ```

3. **Verify deployment:**
   ```bash
   curl https://powernovaapi.azurewebsites.net/health
   curl https://powernovaapi.azurewebsites.net/docs
   ```

4. **Check logs if issues:**
   ```bash
   az webapp log tail --name powernovaapi --resource-group powernova
   ```

## Benefits of This Approach

1. **Explicit is better than implicit** - Clear what files are copied
2. **Better debugging** - Build output shows copied files
3. **Smaller images** - Only copy what's needed
4. **Security** - .env files excluded automatically
5. **Maintainability** - Easy to see and modify what gets copied

## Alternative Approaches

### Option 1: COPY with wildcards (not recommended)
```dockerfile
COPY *.py .
COPY routes/ ./routes/
```
❌ Misses files with different extensions

### Option 2: COPY everything with better .dockerignore (good)
```dockerfile
COPY . .
```
✅ Works if .dockerignore is comprehensive
⚠️ Less explicit about what's included

### Option 3: Explicit COPY (current approach - best)
```dockerfile
COPY main.py .
COPY routes/ ./routes/
```
✅ Crystal clear what gets copied
✅ Easy to audit and maintain
✅ Fails fast if file missing

## Summary

**What changed:**
- ✅ Dockerfile.api now explicitly copies `main.py` and `routes/`
- ✅ Added debugging output to verify files copied
- ✅ Created `.dockerignore` in `api/` directory

**Why it works:**
- Explicit COPY commands ensure all necessary files are included
- .dockerignore in correct location (build context root)
- Debugging output helps verify during build

**How to deploy:**
```bash
./scripts/azure-deploy-api.sh --update
```

The build will now show exactly what files were copied, making it easy to verify everything is included.
