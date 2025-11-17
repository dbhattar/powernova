# Fixing Environment Variables in Azure Container

## Problem

When SSH'ing into the Azure container, environment variables (DATABASE_URL, OPENAI_API_KEY) are not available in the shell session, even though they are configured in Azure App Service settings.

This causes migration errors:
```
psycopg2.OperationalError: connection to server at "localhost" (127.0.0.1), port 5432 failed
```

## Root Cause

Azure App Service injects environment variables into the **application process** (uvicorn), but they are **NOT automatically available** in SSH shell sessions. This is by design for security reasons.

## Solutions

### Solution 1: Automated Migration Script (Recommended)

Use the new script that fetches env vars from Azure and runs migrations:

```bash
./scripts/azure-run-migrations.sh
```

This script:
1. ✅ Fetches DATABASE_URL from Azure App Service settings
2. ✅ Injects it into the SSH session
3. ✅ Runs migrations with proper environment
4. ✅ Verifies tables were created

---

### Solution 2: Manual Method (Inside Container)

#### Step 1: SSH into the container

```bash
az webapp ssh --resource-group powernova --name powernovaapi
```

#### Step 2: Get environment variables from running process

The environment variables ARE available in the uvicorn process, so we can extract them:

```bash
# Find the uvicorn process ID
PID=$(pgrep -f "uvicorn main:app" | head -1)
echo "Uvicorn PID: $PID"

# Extract environment variables from the process
export $(cat /proc/$PID/environ | tr '\0' '\n' | grep DATABASE_URL)
export $(cat /proc/$PID/environ | tr '\0' '\n' | grep OPENAI_API_KEY)

# Verify they're set
echo $DATABASE_URL | cut -c1-50
```

#### Step 3: Run migrations

```bash
cd /app
python -m alembic upgrade head
```

---

### Solution 3: Use the In-Container Helper Script

#### Step 1: SSH into container

```bash
az webapp ssh --resource-group powernova --name powernovaapi
```

#### Step 2: Download and run the helper script

```bash
# Copy the script from your local scripts folder
# (You'll need to have pushed it to the container or create it)

cat > /tmp/migrate.sh << 'EOF'
#!/bin/bash
set -e

# Find uvicorn process and extract DATABASE_URL
PID=$(pgrep -f "uvicorn main:app" | head -1)
if [ -n "$PID" ]; then
    export $(cat /proc/$PID/environ | tr '\0' '\n' | grep DATABASE_URL)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found"
    exit 1
fi

cd /app
echo "Running migrations..."
python -m alembic upgrade head

echo "Verifying tables..."
python -c "
from sqlalchemy import create_engine, inspect
import os
engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'Tables: {tables}')
"
EOF

chmod +x /tmp/migrate.sh
/tmp/migrate.sh
```

---

### Solution 4: Set Variables Manually (Quick Fix)

If you just want to test quickly:

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Set DATABASE_URL manually (get from Azure)
export DATABASE_URL="postgresql://postgres.vwqnppdhcfbaaycnyteb:nlMaq7CfLSuOrYEa@aws-0-us-east-2.pooler.supabase.com:5432/postgres"

# Run migrations
cd /app
python -m alembic upgrade head
```

To get your actual DATABASE_URL:

```bash
az webapp config appsettings list \
  --resource-group powernova \
  --name powernovaapi \
  --query "[?name=='DATABASE_URL'].value" \
  -o tsv
```

---

## Why This Happens

### How Azure App Service Works:

1. **App Service Settings** → Stored in Azure (✅ Working)
2. **Application Process** → Gets env vars injected by Azure (✅ Working)
3. **SSH Session** → Does NOT get env vars (⚠️ This is your issue)

```
┌─────────────────────────────────┐
│   Azure App Service Settings    │
│   - DATABASE_URL                 │
│   - OPENAI_API_KEY              │
└────────┬────────────────────────┘
         │
         ├─────────────────────────┐
         ▼                         ▼
┌─────────────────┐      ┌──────────────────┐
│  uvicorn process│      │   SSH session    │
│  ✅ Has env vars│      │   ❌ No env vars │
└─────────────────┘      └──────────────────┘
```

### Why SSH Session Doesn't Get Variables:

- Security isolation
- SSH session is separate from application runtime
- Environment variables are injected at container startup for the app, not the shell

---

## Verification

After running migrations, verify everything works:

### Check Tables in Database

```bash
# Inside container
python -c "
from sqlalchemy import create_engine, inspect
import os

engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()

print('Tables in database:')
for table in sorted(tables):
    print(f'  - {table}')
"
```

Expected output:
```
Tables in database:
  - alembic_version
  - artifacts
  - conversations
  - messages
  - users
```

### Check in Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Click "Table Editor" in sidebar
4. You should see 5 tables

---

## Long-Term Solution: Auto-Run Migrations

To avoid this issue in the future, modify the entrypoint to run migrations automatically:

### Update `docker/entrypoint.sh`:

```bash
#!/bin/sh
set -e

echo "Starting SSH daemon..."
/usr/sbin/sshd

echo "Running database migrations..."
cd /app
python -m alembic upgrade head || echo "⚠️  Migration failed (continuing anyway)"

echo "Starting FastAPI application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

This way, migrations run automatically on every deployment!

---

## Quick Reference Commands

```bash
# Get DATABASE_URL from Azure
az webapp config appsettings list \
  --resource-group powernova \
  --name powernovaapi \
  --query "[?name=='DATABASE_URL'].value" -o tsv

# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container: Extract env vars from running process
PID=$(pgrep -f "uvicorn" | head -1)
export $(cat /proc/$PID/environ | tr '\0' '\n' | grep DATABASE_URL)

# Run migrations
cd /app
python -m alembic upgrade head

# Verify tables
python -c "from sqlalchemy import create_engine, inspect; import os; inspector = inspect(create_engine(os.environ['DATABASE_URL'])); print(inspector.get_table_names())"
```

---

## Recommended Approach

**For now (immediate fix):**
```bash
./scripts/azure-run-migrations.sh
```

**For future (add to entrypoint.sh):**
- Auto-run migrations on container startup
- Migrations will always be up-to-date
- No manual intervention needed

---

## Summary

✅ **Environment variables ARE configured** in Azure App Service  
✅ **Application (uvicorn) CAN access** them  
❌ **SSH sessions CANNOT access** them directly  
✅ **Solution**: Extract from running process or use automated script

Choose the solution that works best for you! The automated script (`azure-run-migrations.sh`) is the easiest option.
