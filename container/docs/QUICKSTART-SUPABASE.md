# PowerNOVA Database Setup - Quick Start

## Choose Your Setup

### 🏭 Production (Supabase - FREE)
```bash
# 1. Create Supabase project at https://supabase.com
# 2. Setup environment
cp .env.production.template .env.production
# Edit .env.production with your Supabase credentials

# 3. Deploy to Azure
./scripts/deploy-api-with-supabase.sh
```

### 💻 Local Development (Docker PostgreSQL)
```bash
# 1. Setup environment
cp .env.local.template .env.local

# 2. Start PostgreSQL container
docker-compose up -d db

# 3. Run migrations
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
alembic upgrade head

# 4. Start API
cd api
uvicorn main:app --reload
```

---

## Supabase Setup (5 minutes)

### Step 1: Create Project
1. Go to https://supabase.com
2. Sign up with GitHub
3. Click **New Project**
   - Name: `powernova`
   - Password: Generate strong password (save it!)
   - Region: West US
   - Plan: **Free**

### Step 2: Get Credentials

Go to **Project Settings** → **Database**:

**Connection Pooling** (for API):
```
postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Direct Connection** (for migrations):
```
postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require
```

### Step 3: Update .env.production

```bash
# Copy template
cp .env.production.template .env.production

# Edit file
nano .env.production

# Update these lines:
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require

DATABASE_URL_DIRECT=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres?sslmode=require

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
```

### Step 4: Deploy

```bash
# Deploy to Azure with Supabase
./scripts/deploy-api-with-supabase.sh

# Script will:
# ✓ Update Azure App Service with Supabase connection
# ✓ Run database migrations
# ✓ Restart API
# ✓ Test health endpoint
```

### Step 5: Verify

1. **Check Supabase**:
   - Go to **Table Editor**
   - See tables: `users`, `conversations`, `messages`, `artifacts`

2. **Test API**:
   ```bash
   curl https://powernovaapi.azurewebsites.net/health
   ```

3. **View Logs**:
   ```bash
   az webapp log tail --resource-group powernova --name powernovaapi
   ```

---

## Local Development Setup

### Step 1: Start PostgreSQL
```bash
cd docker
docker-compose up -d db

# Verify
docker ps | grep postgres
```

### Step 2: Run Migrations
```bash
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
alembic upgrade head
```

### Step 3: Start API
```bash
cd api
uvicorn main:app --reload
```

### Step 4: Test
```bash
# Health check
curl http://localhost:8000/health

# API docs
open http://localhost:8000/docs
```

---

## Switching Between Environments

### Use Supabase (Production)
```bash
export DATABASE_URL="postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
```

### Use Local PostgreSQL
```bash
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
```

---

## Database Management

### Run Migrations
```bash
# On Supabase (use direct connection)
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
alembic upgrade head

# On Local
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
alembic upgrade head
```

### Create New Migration
```bash
alembic revision -m "description of changes"
# Edit the generated file in api/alembic/versions/
alembic upgrade head
```

### Check Database
```bash
# Supabase: Use Table Editor in dashboard
# Local: Connect with psql
docker exec -it powernova-db psql -U powernova -d powernova_db
```

---

## Troubleshooting

### Connection Failed
```bash
# Check if PostgreSQL is running (local)
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Test connection
python -c "from sqlalchemy import create_engine; engine = create_engine('$DATABASE_URL'); conn = engine.connect(); print('✓ Connected')"
```

### Migrations Not Running
```bash
# Make sure you're using DIRECT connection for migrations
# Supabase pooler (port 6543) doesn't work with Alembic
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
alembic upgrade head
```

### API Not Connecting to Database
```bash
# Check Azure App Service logs
az webapp log tail --resource-group powernova --name powernovaapi

# Check if DATABASE_URL is set correctly
az webapp config appsettings list --resource-group powernova --name powernovaapi | grep DATABASE_URL
```

---

## Cost & Limits

### Supabase Free Tier
- ✅ **500MB Database** - Monitor in dashboard
- ✅ **Unlimited API Requests**
- ✅ **2GB File Storage**
- ✅ **50MB Database Backups**
- ✅ **Daily Automated Backups**

### When to Upgrade
Upgrade to **Pro ($25/month)** when:
- Database size exceeds 500MB
- Need more than 7 days of backups
- Need point-in-time recovery

---

## Quick Commands Reference

```bash
# Deploy to production
./scripts/deploy-api-with-supabase.sh

# Start local development
docker-compose up -d db
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
alembic upgrade head
cd api && uvicorn main:app --reload

# Run migrations on Supabase
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
alembic upgrade head

# Check health
curl https://powernovaapi.azurewebsites.net/health  # Production
curl http://localhost:8000/health                   # Local

# View logs
az webapp log tail --resource-group powernova --name powernovaapi
docker logs -f powernova-db
```

---

## Files Created

- ✅ `SUPABASE-SETUP.md` - Complete documentation
- ✅ `.env.production.template` - Supabase production config
- ✅ `.env.local.template` - Local development config
- ✅ `scripts/deploy-api-with-supabase.sh` - Deployment automation
- ✅ `api/database/session.py` - Auto-detects Supabase pooler

---

**Ready to go! 🚀**

For detailed instructions, see `SUPABASE-SETUP.md`
