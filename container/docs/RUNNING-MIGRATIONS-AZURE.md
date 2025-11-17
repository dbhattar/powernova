# Running Database Migrations on Azure App Service

## Issue

The database tables haven't been created yet because Alembic migrations haven't run on the Azure container.

## Quick Solution

### Step 1: Explore Container Structure

First, let's find where your application files are located:

```bash
./scripts/explore-azure-container.sh
```

This will show you:
- Current working directory
- Where `/app`, `/home/site/wwwroot`, or other directories are
- Where your Python files are located
- Where `alembic.ini` is located
- If alembic is installed

### Step 2: Run Migrations

Once you know the structure, run:

```bash
./scripts/run-migrations-azure.sh
```

This script will:
1. Auto-detect your application directory
2. Check if Alembic is installed
3. Show current migration status
4. Run `alembic upgrade head`
5. Verify tables were created

---

## Manual Method (If Scripts Don't Work)

### Option 1: SSH and Run Manually

```bash
# SSH into container
./scripts/ssh-azure.sh

# Once inside, find your application directory
pwd
ls -la

# Common locations:
cd /app                      # Try this first
cd /home/site/wwwroot        # Or this
cd /home                     # Or this

# Once you find where alembic.ini is:
ls -la alembic/
python -m alembic current
python -m alembic upgrade head
```

### Option 2: Direct Command (If you know the path)

```bash
# Replace /app with your actual path
az webapp ssh --resource-group powernova --name powernovaapi \
  --command "cd /app && python -m alembic upgrade head"
```

---

## Common Azure Container Paths

Depending on your Dockerfile and deployment method:

| Deployment Method | Common Path |
|-------------------|-------------|
| **Custom Dockerfile with WORKDIR /app** | `/app` |
| **Azure App Service default** | `/home/site/wwwroot` |
| **Some Python images** | `/code` or `/usr/src/app` |
| **Environment variable $HOME** | `/home` |

---

## Check Your Dockerfile

Let me check what your Dockerfile sets as WORKDIR:

```dockerfile
# In docker/Dockerfile.api or Dockerfile.api.local
WORKDIR /app  # <-- This is your app directory
```

If your Dockerfile has `WORKDIR /app`, then your files are in `/app`.

---

## Verification After Migration

### Check Tables Were Created

```bash
# SSH into container
./scripts/ssh-azure.sh

# Inside container (replace /app with your path):
cd /app

# Check tables using Python
python -c "
from database.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'Tables: {tables}')
"
```

### Expected Tables

You should see:
- `users`
- `conversations`
- `messages`
- `artifacts`
- `alembic_version`

---

## Troubleshooting

### Issue: "alembic.ini not found"

**Solution**: Your deployment didn't include the alembic files.

Check your `.dockerignore` and ensure it doesn't exclude:
- `alembic/`
- `alembic.ini`
- `api/alembic/` (if that's your structure)

### Issue: "Database connection failed"

**Solution**: Check your DATABASE_URL setting.

```bash
# Check environment variables
az webapp config appsettings list --resource-group powernova --name powernovaapi | grep DATABASE_URL

# Verify it's correct (should point to Supabase or Azure PostgreSQL)
```

### Issue: "Alembic not installed"

**Solution**: Alembic is missing from requirements.txt or container.

```bash
# Check if alembic is in requirements.txt
cat api/requirements.txt | grep alembic

# Should show:
# alembic==1.13.1

# If missing, add it and redeploy
```

### Issue: "Permission denied"

**Solution**: Database user doesn't have CREATE TABLE permission.

For Supabase:
- Use the connection string with full privileges (not read-only)
- The postgres user should have full permissions

### Issue: "Can't find directory"

**Solution**: Use the explorer script to find where files are.

```bash
./scripts/explore-azure-container.sh
```

---

## Automated Migration on Deployment

To automatically run migrations on every deployment, you can add a startup script.

### Create startup script: `startup.sh`

```bash
#!/bin/bash
# startup.sh

echo "Running database migrations..."
python -m alembic upgrade head

echo "Starting application..."
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Update Dockerfile

```dockerfile
# Copy startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Use startup script as CMD
CMD ["/app/startup.sh"]
```

### Or configure in Azure App Service

```bash
az webapp config set --resource-group powernova --name powernovaapi \
  --startup-file "python -m alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"
```

---

## Quick Commands Reference

```bash
# Explore container structure
./scripts/explore-azure-container.sh

# Run migrations
./scripts/run-migrations-azure.sh

# SSH into container
./scripts/ssh-azure.sh

# Check logs
az webapp log tail --resource-group powernova --name powernovaapi

# Check app settings
az webapp config appsettings list --resource-group powernova --name powernovaapi
```

---

## What to Check

✅ **Before running migrations:**
1. Database connection works (DATABASE_URL is set correctly)
2. Alembic is installed in container (`pip list | grep alembic`)
3. Alembic files exist (`alembic/` directory and `alembic.ini`)
4. You're in the correct directory (where `alembic.ini` is)

✅ **After running migrations:**
1. No errors in migration output
2. Tables exist in database (check with query)
3. `alembic_version` table shows current migration
4. API can connect to database and query tables

---

## Next Steps

1. **Run the explorer**: `./scripts/explore-azure-container.sh`
2. **Check the output** to find your app directory
3. **Run migrations**: `./scripts/run-migrations-azure.sh`
4. **Verify tables** exist in your database
5. **Test API** endpoints that use the database

---

## Need Help?

If the scripts don't work, you can:

1. **SSH manually**: `./scripts/ssh-azure.sh`
2. **Explore manually**: Look around with `ls`, `pwd`, `find`
3. **Share the output**: Run explorer script and share the output
4. **Check deployment logs**: See if files were copied correctly

Good luck! 🚀
