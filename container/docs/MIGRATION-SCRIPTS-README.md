# Supabase to Azure Migration Scripts

This directory contains scripts to help migrate your database from Supabase to Azure PostgreSQL.

## 📦 Available Scripts

### 1. v### Step 2: Deploy Azure PostgreSQL (if not done)
```bash
# Use the ARM template
cd ../templates
./deploy-postgresql.sh

# Or manually deploy
az deployment group create \
  --resource-group powernova \
  --template-file azure-postgresql-deployment.json \
  --parameters azure-postgresql-deployment.parameters.json
```

### Step 3: Validate Azure Database
```bash
# Go to scripts
cd ../scripts

# Validate the database is ready
./validate-azure-database.sh

# Fix any issues reported before proceeding
```

### Step 4: Dump Supabase Databasedatabase.sh
Validates that your Azure PostgreSQL database is properly configured and ready for migration.

**Features:**
- ✅ Connection testing with SSL verification
- ✅ PostgreSQL version check (>= 13 required)
- ✅ pgvector extension verification
- ✅ Database configuration validation
- ✅ Performance and network latency tests
- ✅ User permissions verification
- ✅ PowerNOVA-specific requirements
- ✅ Comprehensive summary report

**Basic Usage:**
```bash
cd scripts
./validate-azure-database.sh
```

**Advanced Options:**
```bash
# Provide connection string directly
./validate-azure-database.sh "postgresql://user:pass@server:5432/db"

# Use environment variable
export AZURE_DATABASE_URL="postgresql://..."
./validate-azure-database.sh
```

**What It Checks:**
- ✓ Database connectivity and SSL
- ✓ PostgreSQL version compatibility
- ✓ Required extensions (pgvector, uuid-ossp)
- ✓ Database encoding and locale
- ✓ Connection pool settings
- ✓ Storage and size information
- ✓ User permissions (CREATE, INSERT, etc.)
- ✓ Network latency
- ✓ Vector column support (1536 dimensions)
- ✓ JSONB and timestamp support

### 2. dump-supabase-database.sh
Exports your entire Supabase database to a SQL file.

**Features:**
- ✅ Interactive connection setup
- ✅ Progress indicators and size estimates
- ✅ Optional gzip compression
- ✅ Schema-only or data-only dumps
- ✅ Integrity verification
- ✅ Environment variable support

**Basic Usage:**
```bash
cd scripts
./dump-supabase-database.sh
```

**Advanced Options:**
```bash
# Compressed backup
./dump-supabase-database.sh -c

# Custom output file
./dump-supabase-database.sh -o my-backup.sql

# Schema only (no data)
./dump-supabase-database.sh -s

# Data only (no schema)
./dump-supabase-database.sh -d

# Help
./dump-supabase-database.sh -h
```

**Using Environment Variables:**
```bash
# Set your Supabase connection string
export SUPABASE_DATABASE_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:6543/postgres"

# Run dump
./dump-supabase-database.sh -c
```

### 3. restore-to-azure.sh
Restores a database dump to your Azure PostgreSQL server.

**Features:**
- ✅ Automatic pgvector extension installation
- ✅ Pre-restore validation
- ✅ Progress tracking with error detection
- ✅ Table verification
- ✅ Handles compressed files automatically

**Basic Usage:**
```bash
cd scripts
./restore-to-azure.sh -i supabase-backup-20241123.sql
```

**Advanced Options:**
```bash
# Restore compressed backup
./restore-to-azure.sh -i supabase-backup.sql.gz

# Specify database URL
./restore-to-azure.sh -i backup.sql -u "$AZURE_DATABASE_URL"

# Help
./restore-to-azure.sh -h
```

**Using Environment Variables:**
```bash
# Set your Azure connection string
export AZURE_DATABASE_URL="postgresql://powernova_admin:PASSWORD@powernova-db-server.postgres.database.azure.com:5432/powernova_db?sslmode=require"

# Run restore
./restore-to-azure.sh -i supabase-backup.sql.gz
```

## 🚀 Complete Migration Workflow

### Step 0: Validate Azure Database (NEW!)
```bash
# First, validate your Azure PostgreSQL setup
cd scripts
./validate-azure-database.sh

# This will check:
# - Connection and SSL
# - PostgreSQL version
# - pgvector extension
# - Permissions and configuration
# - Performance metrics
```

### Step 1: Prepare
```bash
# Install PostgreSQL client tools if not already installed
brew install postgresql  # macOS
# or
sudo apt-get install postgresql-client  # Linux

# Navigate to scripts directory
cd scripts
```

### Step 2: Deploy Azure PostgreSQL (if not done)
```bash
# Use the ARM template
cd ../templates
./deploy-postgresql.sh

# Or manually deploy
az deployment group create \
  --resource-group powernova \
  --template-file azure-postgresql-deployment.json \
  --parameters azure-postgresql-deployment.parameters.json
```

### Step 3: Validate Azure Database
```bash
# Go to scripts
cd ../scripts

# Validate the database is ready
./validate-azure-database.sh

# Fix any issues reported before proceeding
```

### Step 4: Dump Supabase Database
```bash
# Run the dump script
./dump-supabase-database.sh -c

# You'll be prompted for:
# - Supabase host (e.g., db.xxx.supabase.co)
# - Database name (usually: postgres)
# - Username (usually: postgres)
# - Password (from Supabase dashboard)
# - Port (6543 for pooler, 5432 for direct)

# Output: supabase-backup-TIMESTAMP.sql.gz
```

### Step 5: Restore to Azure
```bash
# Run the restore script
./restore-to-azure.sh -i supabase-backup-TIMESTAMP.sql.gz

# You'll be prompted for:
# - Azure server host
# - Database name
# - Admin username
# - Admin password
```

### Step 6: Update Application
```bash
# Update DATABASE_URL in your environment
# Azure Container Apps:
az containerapp update \
  --name powernova-api \
  --resource-group powernova \
  --set-env-vars DATABASE_URL="postgresql://..."

# Or update in Azure Portal:
# Container Apps → Environment Variables → DATABASE_URL
```

### Step 7: Test & Verify
```bash
# Test connection
psql "$AZURE_DATABASE_URL" -c "SELECT COUNT(*) FROM users;"

# Run migrations if needed
cd ../api
alembic upgrade head

# Start the application
python main.py
```

## 📋 Connection String Formats

### Supabase
```
# Pooler (recommended for serverless)
postgresql://postgres:PASSWORD@db.xxx.supabase.co:6543/postgres

# Direct connection
postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
```

### Azure PostgreSQL
```
# Standard connection
postgresql://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/DATABASE?sslmode=require

# Example
postgresql://powernova_admin:MyPass123@powernova-db-server.postgres.database.azure.com:5432/powernova_db?sslmode=require
```

**Note:** If your password contains special characters like `@`, `/`, `:`, `#`, etc., the scripts will automatically URL-encode them for you. See [PASSWORD-SPECIAL-CHARACTERS.md](PASSWORD-SPECIAL-CHARACTERS.md) for details.

## 🔍 Finding Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Use **Connection pooling** (port 6543) or **Direct connection** (port 5432)
6. Copy the URI and replace `[YOUR-PASSWORD]` with your actual password

## 🔧 Troubleshooting

### "Password contains special characters"
**Problem:** Your password has characters like `@`, `/`, `:`, `#` that break the connection string.

**Solution:** The scripts automatically URL-encode passwords! Just enter your password as-is when prompted.

For manual encoding or more details, see [PASSWORD-SPECIAL-CHARACTERS.md](PASSWORD-SPECIAL-CHARACTERS.md).

### "psql: command not found"
Install PostgreSQL client tools:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

### "Connection refused"
**For Supabase:**
- Check if your IP is whitelisted (Settings → Database → Network Restrictions)
- Verify you're using the correct port (6543 or 5432)
- Ensure password is correct

**For Azure:**
- Add your IP to firewall rules:
  ```bash
  az postgres flexible-server firewall-rule create \
    --resource-group powernova \
    --name powernova-db-server \
    --rule-name "MyIP" \
    --start-ip-address YOUR_IP \
    --end-ip-address YOUR_IP
  ```

### "pgvector extension not found"
Install it manually:
```bash
# Connect as admin
psql "$AZURE_DATABASE_URL"

# Install extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### "ERROR: must be owner of extension vector"
This warning during restore is normal. The extension is already installed and doesn't need to be recreated.

### Slow restore performance
For large databases:
```bash
# Use more aggressive pg_restore settings
gunzip -c backup.sql.gz | psql "$AZURE_DATABASE_URL" \
  -v ON_ERROR_STOP=0 \
  --set maintenance_work_mem='256MB'
```

## 📊 Estimating Dump/Restore Time

| Database Size | Dump Time | Restore Time |
|--------------|-----------|--------------|
| < 100 MB     | 1-2 min   | 2-5 min      |
| 100 MB - 1 GB| 2-10 min  | 5-15 min     |
| 1 GB - 10 GB | 10-30 min | 15-45 min    |
| > 10 GB      | 30+ min   | 45+ min      |

*Times are approximate and depend on network speed and database complexity*

## 🔐 Security Best Practices

1. **Never commit dump files** to version control
   ```bash
   echo "*.sql" >> .gitignore
   echo "*.sql.gz" >> .gitignore
   ```

2. **Use environment variables** for sensitive data
   ```bash
   # Add to .env (DON'T commit this file)
   export SUPABASE_DATABASE_URL="postgresql://..."
   export AZURE_DATABASE_URL="postgresql://..."
   ```

3. **Delete dump files** after successful migration
   ```bash
   # After verifying migration
   rm supabase-backup-*.sql.gz
   ```

4. **Encrypt backups** if storing long-term
   ```bash
   # Encrypt
   gpg -c supabase-backup.sql.gz
   
   # Decrypt
   gpg supabase-backup.sql.gz.gpg
   ```

## 📚 Additional Resources

- [Full Migration Plan](../docs/SUPABASE-TO-AZURE-MIGRATION-PLAN.md)
- [ARM Template Documentation](../templates/README.md)
- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Azure PostgreSQL Documentation](https://learn.microsoft.com/azure/postgresql/)

## 💡 Tips

- **Test first**: Do a test migration to a temporary Azure instance
- **Backup everything**: Keep Supabase running until Azure is fully tested
- **Monitor costs**: Set up Azure cost alerts
- **Schedule wisely**: Migrate during low-traffic periods
- **Verify data**: Check row counts match between source and destination

## ❓ Need Help?

If you encounter issues:
1. Check the `restore.log` file for detailed error messages
2. Review the troubleshooting section above
3. Consult the [full migration plan](../docs/SUPABASE-TO-AZURE-MIGRATION-PLAN.md)
4. Check Azure PostgreSQL logs in Azure Portal
