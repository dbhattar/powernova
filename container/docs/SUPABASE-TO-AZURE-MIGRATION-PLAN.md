# Migration Plan: Supabase → Azure PostgreSQL

**Date:** November 24, 2025  
**Objective:** Migrate PowerNOVA data from Supabase (free tier limits hit) to Azure PostgreSQL  
**Status:** 📋 Planning Phase - **REVIEW BEFORE IMPLEMENTING**

---

## Current Situation Assessment

### What You Have Now

**Supabase Setup:**
- Free tier with connection/storage limits
- Currently using port 6543 (Connection Pooler) or 5432 (Direct)
- Your code already detects Supabase via connection string
- Conservative pooling settings (pool_size=3, max_overflow=5)

**Your Application:**
- FastAPI backend with SQLAlchemy
- Alembic migrations for schema management
- Vector embeddings stored in database (pgvector)
- Tables: users, documents, document_chunks, conversations, messages, feedback, etc.

**Code Detection Logic:**
```python
is_supabase_pooler = ":6543/" in DATABASE_URL
is_supabase_direct = "supabase.com" in DATABASE_URL and ":5432/" in DATABASE_URL
```

---

## Migration Approaches (3 Options)

### **Option 1: Direct Database Dump & Restore** ⭐ **RECOMMENDED**

**Best for:** Full data migration with minimal downtime

**Process:**
1. Create Azure PostgreSQL server
2. Dump Supabase database using `pg_dump`
3. Restore to Azure PostgreSQL using `pg_restore`
4. Update `DATABASE_URL` environment variable
5. Run migrations to ensure schema is current
6. Deploy application with new connection string

**Pros:**
- ✅ Fastest migration (minutes to hours depending on data size)
- ✅ Complete data preservation (schema + data + indexes)
- ✅ Battle-tested approach
- ✅ Can be done with minimal downtime
- ✅ Easy rollback (keep Supabase running until confirmed)

**Cons:**
- ⚠️ Requires brief downtime (~5-30 minutes)
- ⚠️ Need to coordinate dump/restore timing

**Estimated Time:** 1-2 hours total, ~15 min downtime

---

### **Option 2: Schema Migration + Data Sync Script**

**Best for:** If you need zero downtime (complex)

**Process:**
1. Create Azure PostgreSQL server
2. Run Alembic migrations on Azure to create schema
3. Write Python script to copy data table by table
4. Handle foreign keys and sequences correctly
5. Switch applications gradually (blue-green deployment)

**Pros:**
- ✅ Can achieve near-zero downtime
- ✅ More control over data transformation
- ✅ Can validate data during migration

**Cons:**
- ⚠️ More complex to implement
- ⚠️ Higher risk of data inconsistencies
- ⚠️ Need to handle concurrent writes during migration
- ⚠️ Takes longer to develop and test

**Estimated Time:** 4-8 hours development + testing

---

### **Option 3: Dual-Write + Gradual Migration**

**Best for:** Maximum safety but most complex

**Process:**
1. Create Azure PostgreSQL server
2. Modify application to write to both databases
3. Migrate historical data in batches
4. Validate data consistency
5. Switch reads to Azure
6. Stop writing to Supabase

**Pros:**
- ✅ Zero downtime
- ✅ Can validate everything works before switching
- ✅ Easy rollback

**Cons:**
- ⚠️ Requires code changes to support dual-write
- ⚠️ Complex coordination logic
- ⚠️ Risk of data drift if not careful
- ⚠️ More expensive (running both for longer)

**Estimated Time:** 8-16 hours development + testing

---

## Recommended Approach: Option 1 (Dump & Restore)

### Detailed Migration Steps

#### **Phase 1: Preparation (Do First - No Downtime)**

**1.1 Create Azure PostgreSQL Server**

```bash
# Variables
RESOURCE_GROUP="powernova"
LOCATION="westus2"
DB_SERVER_NAME="powernova-db-server"
DB_ADMIN_USER="powernova_admin"
DB_NAME="powernova_db"

# Create PostgreSQL server (Basic tier for testing, Standard for production)
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password <STRONG_PASSWORD> \
  --sku-name Standard_B2s \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0-255.255.255.255

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME
```

**Important:** Save the password securely!

**1.2 Install pgvector Extension (Required for Embeddings)**

```bash
# Enable pgvector extension
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --name azure.extensions \
  --value vector

# Connect and create extension
psql "host=$DB_SERVER_NAME.postgres.database.azure.com \
     port=5432 dbname=$DB_NAME user=$DB_ADMIN_USER \
     password=<PASSWORD> sslmode=require" \
     -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**1.3 Configure Firewall Rules**

```bash
# Allow your IP for migration
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowMyIP \
  --start-ip-address <YOUR_IP> \
  --end-ip-address <YOUR_IP>

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**1.4 Test Azure Connection**

```bash
# Get connection string
AZURE_DB_URL="postgresql://${DB_ADMIN_USER}:${PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"

# Test connection
psql "$AZURE_DB_URL" -c "SELECT version();"
```

---

#### **Phase 2: Data Migration (Scheduled Downtime)**

**2.1 Put Application in Maintenance Mode**

```bash
# Option A: Return 503 Service Unavailable
# Add environment variable: MAINTENANCE_MODE=true

# Option B: Display maintenance page
# Update app to check for maintenance mode

# Option C: Temporarily stop containers
docker-compose stop powernova-api powernova-chat
```

**2.2 Dump Supabase Database**

```bash
# Get your Supabase connection details
SUPABASE_HOST="<your-project>.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="<your-supabase-password>"

# Dump database (schema + data)
pg_dump \
  "postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:5432/${SUPABASE_DB}?sslmode=require" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=custom \
  --file=powernova_backup_$(date +%Y%m%d_%H%M%S).dump

# Backup size check
ls -lh powernova_backup_*.dump
```

**Options for dump:**
- `--format=custom` (compressed, recommended for large DBs)
- `--format=plain` (SQL text, easier to inspect/edit)

**2.3 Restore to Azure PostgreSQL**

```bash
# Restore from dump
pg_restore \
  --host=$DB_SERVER_NAME.postgres.database.azure.com \
  --port=5432 \
  --username=$DB_ADMIN_USER \
  --dbname=$DB_NAME \
  --no-owner \
  --no-acl \
  --verbose \
  powernova_backup_*.dump

# Or if you used plain format:
psql "$AZURE_DB_URL" < powernova_backup_*.sql
```

**Handle Potential Issues:**
- If pgvector types fail: Ensure extension is installed first
- If permissions fail: Use `--no-owner --no-acl`
- If sequences fail: Reset them manually (see troubleshooting section)

**2.4 Verify Data Migration**

```bash
# Connect to Azure DB
psql "$AZURE_DB_URL"

# Check tables exist
\dt

# Check row counts
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'document_chunks', COUNT(*) FROM document_chunks
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'feedback', COUNT(*) FROM feedback;

# Check vector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

# Check a sample embedding
SELECT id, LEFT(title, 50), pg_column_size(embedding) as embedding_size
FROM documents
WHERE embedding IS NOT NULL
LIMIT 5;
```

**2.5 Run Alembic Migrations (Safety Check)**

```bash
# Update DATABASE_URL temporarily for migration
export DATABASE_URL="$AZURE_DB_URL"

# Check current state
cd api
alembic current

# If behind, upgrade
alembic upgrade head

# This ensures schema matches your latest code
```

---

#### **Phase 3: Application Configuration Update**

**3.1 Update Environment Variables**

```bash
# Azure Container App
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    DATABASE_URL="$AZURE_DB_URL" \
    DB_POOL_SIZE=10 \
    DB_MAX_OVERFLOW=20 \
    DB_POOL_RECYCLE=3600

# Or update in Azure Portal:
# Container Apps → powernovaapi → Environment variables
```

**3.2 Update Local Development (Optional)**

```bash
# In .env file or docker-compose.yml
DATABASE_URL=postgresql://powernova_admin:PASSWORD@powernova-db-server.postgres.database.azure.com:5432/powernova_db?sslmode=require
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
```

**3.3 Code Changes (Minimal/None Needed!)**

Your existing code already handles regular PostgreSQL connections:
```python
# This else block will now be used (not Supabase-specific code)
else:
    # Local or Azure direct connection - standard pooling
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_timeout=DB_POOL_TIMEOUT,
        pool_recycle=DB_POOL_RECYCLE,
        echo=os.getenv("ENVIRONMENT") == "development",
    )
```

**No code changes needed!** Your app will automatically use standard pooling.

---

#### **Phase 4: Testing & Validation**

**4.1 Functional Testing**

```bash
# Test health endpoint
curl https://powernovaapi.azurecontainerapps.io/health

# Test chat endpoint (requires authentication)
curl -X POST https://powernovaapi.azurecontainerapps.io/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"message": "Test query", "conversation_id": null}'

# Test admin endpoints
curl https://powernovaapi.azurecontainerapps.io/admin/feedback \
  -H "X-API-Key: YOUR_ADMIN_API_KEY"
```

**4.2 Data Integrity Checks**

```sql
-- Check users can log in (passwords intact)
SELECT id, email, hashed_password IS NOT NULL as has_password
FROM users
LIMIT 5;

-- Check embeddings are valid
SELECT 
    COUNT(*) as total_chunks,
    COUNT(embedding) as chunks_with_embeddings,
    AVG(array_length(embedding::float[], 1)) as avg_dimensions
FROM document_chunks;

-- Check conversations have messages
SELECT 
    c.id,
    c.title,
    COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id, c.title
ORDER BY c.created_at DESC
LIMIT 10;
```

**4.3 Performance Testing**

```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM document_chunks
ORDER BY embedding <-> '[...]'::vector
LIMIT 10;
```

---

#### **Phase 5: Go Live**

**5.1 Remove Maintenance Mode**

```bash
# Restart services
docker-compose up -d powernova-api powernova-chat

# Or remove MAINTENANCE_MODE env var from Azure
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --remove-env-vars MAINTENANCE_MODE
```

**5.2 Monitor Application**

```bash
# Watch logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# Look for:
# ✓ "Using Direct PostgreSQL Connection" (not Supabase)
# ✓ Successful database queries
# ✗ Connection errors
# ✗ Pool exhaustion warnings
```

**5.3 Monitor Database**

```bash
# Check active connections
psql "$AZURE_DB_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';"

# Check slow queries
psql "$AZURE_DB_URL" -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 second' ORDER BY duration DESC;"
```

---

## Migration Checklist

### Pre-Migration
- [ ] Create Azure PostgreSQL server
- [ ] Install pgvector extension
- [ ] Configure firewall rules
- [ ] Test connection to Azure DB
- [ ] Schedule maintenance window (communicate to users!)
- [ ] Back up current Supabase database locally
- [ ] Document current row counts for verification

### During Migration
- [ ] Enable maintenance mode
- [ ] Dump Supabase database
- [ ] Restore to Azure PostgreSQL
- [ ] Verify row counts match
- [ ] Check embeddings are intact
- [ ] Run Alembic migrations
- [ ] Update environment variables
- [ ] Deploy updated configuration

### Post-Migration
- [ ] Remove maintenance mode
- [ ] Test all major features (login, chat, admin)
- [ ] Monitor logs for errors
- [ ] Monitor database connections
- [ ] Verify performance is acceptable
- [ ] Keep Supabase running for 7 days (safety net)
- [ ] Update documentation with new connection info

---

## Rollback Plan

**If something goes wrong:**

1. **Immediate Rollback** (< 5 minutes)
   ```bash
   # Revert DATABASE_URL to Supabase
   az containerapp update \
     --name $APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --set-env-vars DATABASE_URL="<SUPABASE_URL>"
   
   # Restart application
   az containerapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP
   ```

2. **Verify Supabase Still Works**
   ```bash
   # Test connection
   curl https://powernovaapi.azurecontainerapps.io/health
   ```

3. **Investigate Issues**
   - Check Azure PostgreSQL logs
   - Review connection settings
   - Validate data integrity
   - Fix and try again

---

## Cost Estimation

### Azure PostgreSQL Pricing (Flexible Server)

**Development/Testing:**
- Tier: Burstable
- SKU: Standard_B2s (2 vCores, 4 GB RAM)
- Storage: 32 GB
- **Cost:** ~$30-40/month

**Production:**
- Tier: General Purpose
- SKU: Standard_D2s_v3 (2 vCores, 8 GB RAM)
- Storage: 128 GB + backup
- **Cost:** ~$150-200/month

**Compared to Supabase:**
- Free tier: $0 (but limited)
- Pro tier: $25/month (still limited)
- Team tier: $599/month

**Azure is cost-effective at scale!**

---

## Troubleshooting Guide

### Issue: pg_restore fails with "extension vector does not exist"

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Then re-run pg_restore.

### Issue: Sequence values are wrong after restore

**Solution:**
```sql
-- Reset sequences to max values
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('documents_id_seq', (SELECT MAX(id) FROM documents));
SELECT setval('document_chunks_id_seq', (SELECT MAX(id) FROM document_chunks));
-- ... repeat for all tables with serial IDs
```

### Issue: Permission denied errors

**Solution:**
```bash
# Use --no-owner and --no-acl flags
pg_restore --no-owner --no-acl ...
```

### Issue: Connection pool exhausted

**Solution:**
```bash
# Increase pool size
az containerapp update \
  --set-env-vars DB_POOL_SIZE=20 DB_MAX_OVERFLOW=30
```

### Issue: Slow queries after migration

**Solution:**
```sql
-- Rebuild indexes
REINDEX DATABASE powernova_db;

-- Update statistics
ANALYZE;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY abs(correlation) DESC;
```

---

## Timeline & Effort Estimate

### Conservative Estimate
- **Preparation:** 1-2 hours (create Azure DB, test connection)
- **Migration:** 30-60 minutes (dump, restore, verify)
- **Deployment:** 15-30 minutes (update env vars, restart)
- **Testing:** 30-60 minutes (functional, data integrity)
- **Total:** ~3-4 hours

### Expected Downtime
- **Optimistic:** 15 minutes (if everything works first try)
- **Realistic:** 30-45 minutes
- **Worst case:** 2 hours (if issues need fixing)

---

## Questions to Answer Before Proceeding

1. **How much data do you have?**
   - Run: `SELECT pg_size_pretty(pg_database_size('postgres'));` on Supabase
   - This determines dump/restore time

2. **What's your current Supabase connection string?**
   - Port 6543 (pooler) or 5432 (direct)?
   - This affects migration approach

3. **When can you schedule downtime?**
   - Low-traffic window (night/weekend)?
   - How long can you afford?

4. **Do you have users actively using the system?**
   - Need to communicate maintenance window
   - Consider notification system

5. **What's your budget for Azure PostgreSQL?**
   - Start with Burstable tier (~$30/month)?
   - Scale up to General Purpose later?

6. **Do you want to test on a staging environment first?**
   - Recommended for production systems
   - Can do a dry run migration

---

## Next Steps

**After you review this plan:**

1. **Discuss & Decide:**
   - Confirm Option 1 (Dump & Restore) is right approach
   - Set migration date/time
   - Answer questions above

2. **Prepare:**
   - Create Azure PostgreSQL server
   - Test connection and pgvector
   - Do a test migration with sample data

3. **Execute:**
   - Follow migration steps
   - Have rollback plan ready
   - Monitor closely

4. **Validate:**
   - Thorough testing
   - Performance monitoring
   - User feedback

---

**Status:** 📋 **Ready for Review** - Please review and provide answers to questions above before we proceed with implementation.

**Recommendation:** Start with Option 1 (Dump & Restore). It's the fastest, safest, and most battle-tested approach for PostgreSQL migrations.
