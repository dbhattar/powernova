# Supabase PostgreSQL Setup for PowerNOVA

## Overview

This guide shows how to use **Supabase free tier** for production and keep **local PostgreSQL container** for development.

### Deployment Strategy
- **Production**: Supabase PostgreSQL (Free tier: 500MB database, unlimited API requests)
- **Development**: Local PostgreSQL container via Docker Compose
- **No data loss risk**: Managed PostgreSQL with automated backups
- **Cost**: FREE for up to 500MB database + 2GB file storage

---

## Supabase Free Tier Benefits

✅ **500MB PostgreSQL Database** - Plenty for initial production use  
✅ **Unlimited API Requests** - No throttling on free tier  
✅ **Automated Backups** - Daily backups included  
✅ **Connection Pooling** - Built-in PgBouncer for efficient connections  
✅ **SSL Encryption** - Secure connections by default  
✅ **Dashboard** - Visual database management and SQL editor  
✅ **Real-time Subscriptions** - For future features  
✅ **Auto-generated APIs** - REST and GraphQL APIs (optional)

---

## Step 1: Create Supabase Project

1. **Go to**: https://supabase.com
2. **Sign up/Login** with GitHub (recommended)
3. **Create New Project**:
   - Project Name: `powernova`
   - Database Password: Generate a strong password (save it securely!)
   - Region: Choose closest to your Azure App Service (e.g., `West US (West)`)
   - Pricing Plan: **Free**

4. **Wait 2-3 minutes** for project provisioning

---

## Step 2: Get Connection Details

After your project is created:

### Option A: Connection Pooler (RECOMMENDED for API)

1. Go to **Project Settings** → **Database**
2. Scroll to **Connection Pooling** section
3. Copy the **Connection Pooling** connection string:

```
postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Use this for your API** - it uses PgBouncer for connection pooling.

### Option B: Direct Connection (for Alembic migrations)

For running migrations, use the **Direct Connection** string:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxxxxxxxx.supabase.co:5432/postgres
```

**Important Settings**:
- **Port**: 
  - Connection Pooler: `6543` (Session mode)
  - Direct Connection: `5432`
- **SSL Mode**: `require` (always required)
- **Database**: `postgres` (default database name)
- **User**: `postgres` (default superuser)

---

## Step 3: Configure Environment Variables

### For Production (Azure App Service)

Create or update `.env.production`:

```bash
# Supabase Connection (Use Connection Pooler)
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require

# For Alembic migrations (use direct connection)
DATABASE_URL_DIRECT=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxxxxxxxx.supabase.co:5432/postgres?sslmode=require

# Supabase Project Details (optional, for additional features)
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### For Local Development

Your existing `.env` or `.env.local`:

```bash
# Local PostgreSQL container
DATABASE_URL=postgresql://powernova:powernova123@localhost:5432/powernova_db
```

---

## Step 4: Deploy to Azure App Service

### Update App Service Settings

Run the deployment script:

```bash
./scripts/deploy-api-with-supabase.sh
```

Or manually update via Azure CLI:

```bash
# Set Supabase connection string
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings \
    DATABASE_URL="postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"

# Restart app
az webapp restart --resource-group powernova --name powernovaapi
```

---

## Step 5: Run Database Migrations

### Option A: From Local Machine (Recommended)

```bash
# Set direct connection for migrations
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxxxxxxxx.supabase.co:5432/postgres?sslmode=require"

# Run migrations
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
alembic upgrade head
```

### Option B: Via Supabase SQL Editor

1. Go to **SQL Editor** in Supabase dashboard
2. Copy the migration SQL from `api/alembic/versions/001_initial_schema.py`
3. Run the SQL manually
4. Mark migration as complete:
   ```sql
   INSERT INTO alembic_version (version_num) VALUES ('001');
   ```

---

## Step 6: Verify Connection

### Test from Azure App Service

```bash
# Check app health
curl https://powernovaapi.azurewebsites.net/health

# View logs
az webapp log tail --resource-group powernova --name powernovaapi
```

### Test from Supabase Dashboard

1. Go to **Table Editor**
2. You should see your tables: `users`, `conversations`, `messages`, `artifacts`
3. Try inserting test data

---

## Connection Pooling Configuration

### Supabase PgBouncer Settings

Supabase uses **PgBouncer** in **Transaction mode** by default on port `6543`.

**Update your SQLAlchemy configuration** (`api/database/session.py`):

```python
from sqlalchemy import create_engine, pool

# For Supabase Connection Pooler
engine = create_engine(
    DATABASE_URL,
    poolclass=pool.NullPool,  # Let Supabase handle pooling
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
    }
)

# OR use QueuePool with conservative settings
engine = create_engine(
    DATABASE_URL,
    pool_size=5,          # Small pool since Supabase has pooler
    max_overflow=0,       # No overflow
    pool_pre_ping=True,   # Verify connections
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
    }
)
```

---

## Local Development Workflow

### 1. Start Local PostgreSQL

```bash
cd docker
docker-compose up -d db

# Verify
docker ps | grep postgres
```

### 2. Use Local Environment

```bash
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"

# Run migrations locally
alembic upgrade head

# Start API locally
cd api
uvicorn main:app --reload
```

### 3. Switch Between Environments

```bash
# Use local database
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"

# Use Supabase (production)
export DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

---

## Monitoring & Management

### Supabase Dashboard

- **Database**: View tables, run SQL queries
- **Table Editor**: Visual data management
- **SQL Editor**: Run custom queries
- **Database**: Monitor usage and performance
- **Logs**: View database logs and queries

### Check Database Size

```sql
SELECT 
    pg_size_pretty(pg_database_size('postgres')) as database_size;
```

### View Active Connections

```sql
SELECT 
    count(*) as active_connections,
    state,
    application_name
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state, application_name;
```

---

## Migration Path

### When to Upgrade from Free Tier

Supabase free tier limits:
- **500MB database size** - Monitor in dashboard
- **2GB file storage**
- **Unlimited API requests**

When you exceed 500MB, upgrade to **Pro** ($25/month):
- 8GB database
- 100GB file storage
- Point-in-time recovery
- Daily backups for 7 days

### Future Migration to Azure PostgreSQL

If you need to migrate later:

```bash
# Export from Supabase
pg_dump "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" > backup.sql

# Import to Azure PostgreSQL
psql "postgresql://user:password@server.postgres.database.azure.com:5432/db" < backup.sql
```

---

## Security Best Practices

### 1. Use Environment Variables

Never commit connection strings to git:

```bash
# .gitignore
.env
.env.production
.env.local
azure-connection-*.txt
supabase-connection-*.txt
```

### 2. Rotate Database Password

1. Go to Supabase **Project Settings** → **Database**
2. Click **Reset Database Password**
3. Update Azure App Service settings
4. Restart app

### 3. Enable Row Level Security (RLS)

Optional but recommended for future features:

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies (example)
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);
```

---

## Troubleshooting

### Connection Timeout

**Issue**: App can't connect to Supabase

**Solutions**:
1. Verify SSL mode is set: `?sslmode=require`
2. Check firewall allows outbound connections
3. Verify password is correct (no special characters escaped)
4. Use connection pooler port `6543`, not direct `5432`

### Migration Errors

**Issue**: Alembic migrations fail

**Solutions**:
1. Use **direct connection** (port 5432) for migrations
2. Check if tables already exist
3. Manually create `alembic_version` table if needed

### Too Many Connections

**Issue**: `FATAL: remaining connection slots are reserved`

**Solutions**:
1. Use connection pooler (port 6543) instead of direct connection
2. Reduce SQLAlchemy `pool_size` to 3-5
3. Set `max_overflow=0`
4. Use `NullPool` to let Supabase handle pooling

---

## Cost Comparison

| Solution | Monthly Cost | Database Size | Backups | Ideal For |
|----------|-------------|---------------|---------|-----------|
| **Supabase Free** | **$0** | 500MB | Daily | MVP, early production |
| **Supabase Pro** | $25 | 8GB | 7 days PITR | Growing apps |
| **Azure PostgreSQL B1ms** | $15-30 | 32GB+ | On-demand | Azure-only stack |
| **Multi-container (Azure)** | $10 | N/A | None | ⚠️ Dev/test only |

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Get connection strings (pooler + direct)
3. ✅ Run deployment script
4. ✅ Run database migrations
5. ✅ Test API health endpoint
6. ✅ Verify data persistence
7. ✅ Keep local PostgreSQL for development

---

## Quick Reference

### Environment Variables

```bash
# Production (Supabase)
DATABASE_URL=postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require

# Development (Local)
DATABASE_URL=postgresql://powernova:powernova123@localhost:5432/powernova_db
```

### Useful Commands

```bash
# Deploy to Azure with Supabase
./scripts/deploy-api-with-supabase.sh

# Run migrations on Supabase
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
alembic upgrade head

# Start local development
docker-compose up -d db
export DATABASE_URL="postgresql://powernova:powernova123@localhost:5432/powernova_db"
```

---

**Ready to go! 🚀**

This setup gives you:
- ✅ **Free production database** (Supabase)
- ✅ **Local development environment** (Docker PostgreSQL)
- ✅ **No vendor lock-in** (standard PostgreSQL)
- ✅ **Easy migration path** (can move to Azure/AWS later)
