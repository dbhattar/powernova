# Environment Variables Configuration Guide

## Overview

The PowerNOVA API uses environment variables for configuration. There are multiple ways to provide these variables to Docker containers.

## Current Setup

### API Container Configuration

The `powernova-api` service in `docker-compose.yml` loads environment variables from:

1. **`.env` file** (`api/.env`) - Loaded automatically via `env_file`
2. **`environment` section** - Override specific variables

```yaml
powernova-api:
  env_file:
    - ../api/.env  # Loads OPENAI_API_KEY and other variables
  environment:
    # These override values from .env file
    - PORT=8000
    - ENVIRONMENT=development
    - DATABASE_URL=postgresql://powernova:powernova_dev_2024@powernova-postgres:5432/powernova
```

## Environment Files

### `api/.env` (Local Development)

Current contents:
```bash
OPENAI_API_KEY=sk-proj-kuVGMxPxRxt4CFDfnr...
```

**This file is loaded automatically by Docker Compose.**

### Recommended `.env` Structure

Create a complete `api/.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-api-key-here

# Database (overridden by docker-compose for local dev)
DATABASE_URL=postgresql://powernova:powernova_dev_2024@localhost:5432/powernova

# API Configuration
PORT=8000
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:5173

# Security
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database Pool Settings
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
```

## How Environment Variables Work

### Priority Order (Highest to Lowest)

1. **`environment` in docker-compose.yml** - Highest priority
2. **`env_file` (.env file)** - Medium priority
3. **Shell environment variables** - Lowest priority
4. **Default values in code** - Used if not set

### Example

```yaml
env_file:
  - ../api/.env  # Contains: OPENAI_API_KEY=sk-abc123

environment:
  - PORT=8000    # This overrides PORT from .env if it exists
```

Result inside container:
- `OPENAI_API_KEY` = value from `.env` file
- `PORT` = `8000` (from environment section)

## Verifying Environment Variables

### Method 1: Check Inside Running Container

```bash
# List all environment variables
docker exec powernova-api env

# Check specific variable
docker exec powernova-api env | grep OPENAI_API_KEY

# Check if OPENAI_API_KEY is set
docker exec powernova-api sh -c 'echo $OPENAI_API_KEY'
```

### Method 2: Test in Python

```bash
# Run Python inside container
docker exec -it powernova-api python -c "import os; print('OPENAI_API_KEY:', os.getenv('OPENAI_API_KEY', 'NOT SET'))"
```

### Method 3: Check API Logs

```bash
# View logs for environment loading
docker logs powernova-api | grep -i openai
```

## Using Environment Variables in Code

### Python (FastAPI)

```python
import os
from dotenv import load_dotenv

# Optional: Load .env file (already done by Docker)
load_dotenv()

# Get environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
PORT = int(os.getenv("PORT", 8000))

# Use with error handling
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Use in OpenAI client
from openai import OpenAI
client = OpenAI(api_key=OPENAI_API_KEY)
```

## Security Best Practices

### 1. Never Commit `.env` Files

Ensure `.gitignore` includes:

```gitignore
# Environment files
.env
.env.local
.env.production
.env.*.local
api/.env
**/.env
```

### 2. Use `.env.template` Files

Create `api/.env.template`:

```bash
# Copy this to .env and fill in your values
OPENAI_API_KEY=your-api-key-here
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=generate-with-openssl-rand-hex-32
```

Users can copy and customize:
```bash
cp api/.env.template api/.env
nano api/.env  # Fill in real values
```

### 3. Rotate API Keys Regularly

```bash
# Generate new secret key
openssl rand -hex 32

# Update .env file
# Restart containers
docker-compose restart powernova-api
```

### 4. Different Keys for Different Environments

- **Development**: `api/.env` (local testing)
- **Production**: Azure App Service settings (not in files)
- **CI/CD**: GitHub Secrets or Azure DevOps variables

## Production Deployment

### Azure App Service

**Don't use `.env` files in production.** Use Azure App Service settings:

```bash
# Set via Azure CLI
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings \
    OPENAI_API_KEY="sk-prod-your-key" \
    DATABASE_URL="postgresql://..." \
    SECRET_KEY="production-secret"

# Or use the deployment script
./scripts/deploy-api-with-supabase.sh
```

### Supabase Deployment

The deployment script automatically loads from `.env.production`:

```bash
# Create production environment file
cp .env.production.template .env.production

# Edit with production values
nano .env.production

# Deploy (reads .env.production)
./scripts/deploy-api-with-supabase.sh
```

## Troubleshooting

### Issue: OPENAI_API_KEY not found in container

**Check if .env file exists:**
```bash
ls -la api/.env
```

**Check if docker-compose loads it:**
```bash
docker-compose config | grep env_file
```

**Verify inside container:**
```bash
docker exec powernova-api env | grep OPENAI_API_KEY
```

**Solution:**
1. Ensure `api/.env` exists with `OPENAI_API_KEY=...`
2. Restart containers: `docker-compose restart powernova-api`
3. Or rebuild: `docker-compose up -d --build powernova-api`

### Issue: Changes to .env not reflected

**Restart the container:**
```bash
docker-compose restart powernova-api
```

**Or recreate:**
```bash
docker-compose up -d --force-recreate powernova-api
```

### Issue: Want to use different .env file

**Option 1: Use symbolic link**
```bash
ln -sf .env.development api/.env
```

**Option 2: Override in docker-compose**
```bash
# Run with specific env file
docker-compose --env-file api/.env.development up -d
```

**Option 3: Specify in docker-compose.yml**
```yaml
env_file:
  - ../api/.env.${ENVIRONMENT:-development}
```

Then:
```bash
ENVIRONMENT=production docker-compose up -d
```

### Issue: Sensitive data in logs

**Don't log API keys!**

```python
# ❌ Bad - logs API key
print(f"Using API key: {OPENAI_API_KEY}")

# ✅ Good - masks sensitive data
print(f"Using API key: {OPENAI_API_KEY[:8]}...")

# ✅ Better - just confirm it's set
print(f"OPENAI_API_KEY: {'SET' if OPENAI_API_KEY else 'NOT SET'}")
```

## Quick Reference

### Start services with .env file
```bash
cd docker
docker-compose up -d
# Automatically loads api/.env
```

### Check OPENAI_API_KEY is loaded
```bash
docker exec powernova-api sh -c 'echo $OPENAI_API_KEY'
```

### Update .env and reload
```bash
# Edit api/.env
nano api/.env

# Restart API container
docker-compose restart powernova-api
```

### Test OpenAI connection
```bash
docker exec powernova-api python -c "
from openai import OpenAI
import os
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
print('✓ OpenAI client initialized successfully')
"
```

### Deploy to production
```bash
# Uses .env.production
./scripts/deploy-api-with-supabase.sh
```

## Environment Variable Checklist

- [x] `api/.env` file created with `OPENAI_API_KEY`
- [x] `docker-compose.yml` has `env_file: - ../api/.env`
- [x] `.env` files in `.gitignore`
- [x] `.env.template` created for reference
- [ ] API code loads `OPENAI_API_KEY` from environment
- [ ] Error handling if API key is missing
- [ ] Production uses Azure App Service settings (not .env files)

## Files

### `.gitignore`
```gitignore
# Environment files
.env
.env.local
.env.production
.env.development
api/.env
**/.env
!.env.template
!.env.*.template
```

### `api/.env.template`
```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-proj-your-api-key-here

# Database Connection (for local: use docker-compose value)
DATABASE_URL=postgresql://powernova:powernova_dev_2024@localhost:5432/powernova

# API Settings
PORT=8000
ENVIRONMENT=development
DEBUG=true
```

### `docker-compose.yml`
```yaml
powernova-api:
  env_file:
    - ../api/.env  # ✅ Loads all variables from .env
  environment:
    - DATABASE_URL=postgresql://...  # ✅ Override specific vars
```

---

**Your setup is now complete!** 

The `OPENAI_API_KEY` from `api/.env` will be automatically loaded into the `powernova-api` container. ✅
