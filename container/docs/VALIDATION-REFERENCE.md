# Azure Database Validation Quick Reference

## Quick Start
```bash
cd scripts
./validate-azure-database.sh
```

## What Gets Validated

### ✅ Connection Tests
- Database connectivity
- SSL/TLS encryption status
- Network latency measurement

### ✅ PostgreSQL Version
- Checks for version >= 13
- Displays exact version info

### ✅ Required Extensions
- **pgvector** - Critical for embeddings (must be installed)
- **uuid-ossp** - For UUID generation

### ✅ Database Configuration
- UTF8 encoding
- Locale settings
- Timezone configuration

### ✅ Performance Settings
- Max connections (should be >= 50)
- Shared buffers
- Work memory

### ✅ Storage & Size
- Current database size
- Table count
- Available storage

### ✅ User Permissions
- CREATE TABLE
- CREATE EXTENSION
- INSERT/UPDATE/DELETE

### ✅ Network Performance
- Query latency test
- Connection speed assessment

### ✅ PowerNOVA-Specific
- Vector columns (1536 dimensions)
- JSONB data type
- Timestamp with timezone
- pgvector functionality test

## Exit Codes

- **0** - All checks passed (or warnings only)
- **1** - Critical issues found, migration blocked

## Output Format

```
╔════════════════════════════════════════╗
║  ✓ DATABASE IS READY FOR MIGRATION!   ║
╚════════════════════════════════════════╝

Total checks: 25
Passed: 23
Failed: 0
Warnings: 2
Success rate: 92%
```

## Common Issues & Fixes

### Issue: pgvector not installed
```bash
psql "$AZURE_DATABASE_URL" -c 'CREATE EXTENSION vector;'
```

### Issue: pgvector not available
1. Go to Azure Portal
2. Navigate to PostgreSQL server
3. Settings → Server parameters
4. Search for `azure.extensions`
5. Enable `VECTOR`
6. Save and restart

### Issue: Connection refused
```bash
# Add your IP to firewall
az postgres flexible-server firewall-rule create \
  --resource-group powernova \
  --name powernova-db-server \
  --rule-name "MyIP" \
  --start-ip-address $(curl -s ifconfig.me) \
  --end-ip-address $(curl -s ifconfig.me)
```

### Issue: High latency (>500ms)
- Deploy application in same Azure region as database
- Check network connectivity
- Consider private endpoint for better performance

## Integration with Migration Workflow

```bash
# 1. Deploy Azure database
cd templates
./deploy-postgresql.sh

# 2. Validate it's ready
cd ../scripts
./validate-azure-database.sh

# 3. If validation passes, proceed with migration
./dump-supabase-database.sh -c
./restore-to-azure.sh -i backup.sql.gz
```

## Sample Output

```
===================================================
Azure PostgreSQL Database Validation
===================================================

ℹ Using: psql (PostgreSQL) 16.0
ℹ Validating database: powernova_db on powernova-db-server.postgres.database.azure.com

--- 1. Connection Tests ---

✓ Database connection successful
✓ SSL/TLS encryption is enabled

--- 2. PostgreSQL Version ---

✓ PostgreSQL version 16 is supported

--- 3. Extensions ---

✓ pgvector extension is available
✓ pgvector extension is installed (version: 0.5.1)
✓ uuid-ossp extension is installed

--- 4. Database Configuration ---

✓ Database encoding is UTF8
✓ Locale configured: en_US.utf8
✓ Timezone configured: UTC

--- 5. Connection & Performance Settings ---

✓ Max connections: 100 (sufficient)
✓ Shared buffers configured: 256MB
✓ Work memory configured: 4MB

--- 6. Database Size & Storage ---

✓ Database size: 128 kB
ℹ Database is empty (ready for migration)

--- 7. User Permissions ---

✓ User has CREATE TABLE permission
✓ User has CREATE EXTENSION permission

--- 8. Network & Performance ---

✓ Network latency is excellent (45ms)

--- 9. PowerNOVA Application Requirements ---

✓ Can create vector columns (1536 dimensions)
✓ JSONB data type is supported
✓ Timestamp with timezone is supported

--- 10. Backup Configuration ---

ℹ Verify in Azure Portal:
  • Backup retention period (recommended: 7+ days)
  • Geo-redundant backup (optional)
  • Point-in-time restore enabled

===================================================
Validation Summary
===================================================

Total checks: 24
Passed: 23
Failed: 0
Warnings: 0

Success rate: 96%

╔════════════════════════════════════════╗
║  ✓ DATABASE IS READY FOR MIGRATION!   ║
╚════════════════════════════════════════╝
```

## Tips

- Run validation **before** dumping Supabase (saves time if issues found)
- Run validation **after** Azure deployment (verify infrastructure)
- Save validation output for documentation
- Re-run after making configuration changes

## Environment Variables

```bash
# Set once, use everywhere
export AZURE_DATABASE_URL="postgresql://powernova_admin:PASSWORD@powernova-db-server.postgres.database.azure.com:5432/powernova_db?sslmode=require"

# Then just run:
./validate-azure-database.sh
```
