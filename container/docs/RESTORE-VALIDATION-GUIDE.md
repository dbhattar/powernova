# Database Restore Validation Guide

## Overview

The `restore-to-azure.sh` script now supports a **validate-only** mode that allows you to verify a restored database without performing an actual restore operation.

## Use Cases

### When to Use `--validate-only`

✅ **After a restore** - Verify all tables and data were restored correctly  
✅ **Before switching DATABASE_URL** - Confirm the Azure database is ready  
✅ **Troubleshooting** - Check what's missing without re-running the restore  
✅ **Monitoring** - Periodic checks on database health  
✅ **Migration verification** - Ensure all PowerNOVA tables are present  

## Usage

### Basic Validation

```bash
# Validate the current Azure database
./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"
```

### With Manual DATABASE_URL Entry

```bash
# Script will prompt for DATABASE_URL if not provided
./restore-to-azure.sh --validate-only
```

### Quick Check After Restore

```bash
# 1. Restore database
./restore-to-azure.sh -i supabase-backup.sql.gz -u "$AZURE_DATABASE_URL"

# 2. Validate immediately after
./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"
```

## What Gets Validated

The validation process checks:

### ✅ Database Connection
- Connects to Azure PostgreSQL
- Verifies credentials and network access
- Tests basic query execution

### ✅ Table Count
- Counts total tables in the database
- Reports the number found

### ✅ PowerNOVA Tables
Checks for the presence of all expected tables:
- `users`
- `conversations`
- `messages`
- `documents`
- `document_chunks`
- `crawl_jobs`
- `alembic_version`
- `artifacts`
- `feedback`

For each table:
- ✓ Confirms existence
- ✓ Reports row count
- ⚠ Warns if missing

### ✅ Extensions
- Checks if `pgvector` extension is installed
- Tests vector functionality with sample query
- Warns if pgvector is missing (required for embeddings)

### ✅ Data Integrity
- Verifies tables are accessible
- Confirms row counts can be retrieved
- Tests basic SELECT queries

## Output Examples

### Successful Validation

```
===================================================
Azure PostgreSQL Database Validation
===================================================

✓ Successfully connected to Azure PostgreSQL
ℹ Database has 15 tables
✓ pgvector extension is already installed
ℹ Skipping restore (validate-only mode)

===================================================
Verifying Restore
===================================================

ℹ Tables in database: 15
✓ Table 'users': 42 rows
✓ Table 'conversations': 128 rows
✓ Table 'messages': 1547 rows
✓ Table 'documents': 89 rows
✓ Table 'document_chunks': 3421 rows
✓ Table 'crawl_jobs': 15 rows
✓ Table 'alembic_version': 1 rows
✓ Table 'artifacts': 67 rows
✓ Table 'feedback': 23 rows
ℹ Testing pgvector extension...
✓ pgvector is working correctly

===================================================
Validation Summary
===================================================

✓ All expected tables found and validated

Tables: 15

✓ Database validation completed successfully!

ℹ Database is ready for use. All PowerNOVA tables are present.
```

### Validation with Issues

```
===================================================
Azure PostgreSQL Database Validation
===================================================

✓ Successfully connected to Azure PostgreSQL
ℹ Database has 8 tables
⚠ pgvector extension is not installed
⚠ You may need to install pgvector extension before restoring
ℹ Skipping restore (validate-only mode)

===================================================
Verifying Restore
===================================================

ℹ Tables in database: 8
✓ Table 'users': 0 rows
⚠ Table 'conversations': not found
⚠ Table 'messages': not found
✓ Table 'documents': 12 rows
⚠ Table 'document_chunks': not found
✓ Table 'crawl_jobs': 3 rows
✓ Table 'alembic_version': 1 rows
✓ Table 'artifacts': 5 rows
✓ Table 'feedback': 0 rows

===================================================
Validation Summary
===================================================

⚠ Validation found issues

⚠ Missing tables: conversations messages document_chunks

ℹ You may need to:
  • Run the restore process first: ./restore-to-azure.sh -i backup.sql
  • Check if data was migrated correctly
  • Install missing extensions (e.g., pgvector)
```

## Common Validation Scenarios

### Scenario 1: Post-Migration Verification

```bash
# After migrating from Supabase to Azure
# 1. Restore was completed earlier
# 2. Now verify everything is correct

./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"

# Expected: All tables present with row counts matching source
```

### Scenario 2: Before Switching DATABASE_URL

```bash
# You've restored to Azure but app still points to Supabase
# Verify Azure is ready before updating environment variables

./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"

# If validation passes:
# 1. Update DATABASE_URL environment variable
# 2. Restart application
# 3. Test functionality
```

### Scenario 3: Troubleshooting Missing Data

```bash
# Something seems wrong with the restored database
# Check what's actually there

./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"

# Review output to see:
# - Which tables are missing
# - Which tables have 0 rows (might indicate restore issue)
# - If pgvector is installed
```

### Scenario 4: Periodic Health Checks

```bash
# Add to monitoring/cron
# Check database health regularly

*/30 * * * * cd /path/to/scripts && ./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL" >> validation.log 2>&1
```

## Exit Codes

The script returns different exit codes based on validation results:

- `0` - Validation passed (all tables present, no errors)
- `1` - Validation failed (missing tables, connection errors, or other issues)

Use in scripts:

```bash
if ./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"; then
    echo "Database validation passed"
    # Safe to switch DATABASE_URL
else
    echo "Database validation failed"
    # Do NOT switch DATABASE_URL yet
fi
```

## Differences: Validation vs Full Restore

| Feature | Full Restore | Validate Only |
|---------|-------------|---------------|
| Requires input file | ✅ Yes (`-i`) | ❌ No |
| Connects to database | ✅ Yes | ✅ Yes |
| Drops existing tables | ✅ Yes | ❌ No |
| Restores data | ✅ Yes | ❌ No |
| Checks table existence | ✅ Yes | ✅ Yes |
| Counts rows | ✅ Yes | ✅ Yes |
| Tests pgvector | ✅ Yes | ✅ Yes |
| Creates restore.log | ✅ Yes | ❌ No |
| Modifies database | ✅ Yes | ❌ No (read-only) |

## Best Practices

### ✅ DO

- Run validation after every restore
- Use validation before switching DATABASE_URL in production
- Check validation output for warnings
- Verify row counts match expectations
- Test pgvector functionality if using embeddings

### ❌ DON'T

- Skip validation assuming restore worked
- Ignore warnings about missing tables
- Switch DATABASE_URL without validating first
- Assume empty tables are normal (investigate 0 row counts)

## Troubleshooting

### Connection Failed

**Problem**: `Failed to connect to Azure PostgreSQL`

**Solution**:
```bash
# Check connection manually
psql "$AZURE_DATABASE_URL" -c "SELECT version();"

# Common issues:
# - Wrong credentials
# - IP not whitelisted in Azure firewall
# - Network/VPN issues
# - DATABASE_URL format incorrect
```

### Missing Tables

**Problem**: `⚠ Table 'X': not found`

**Solution**:
```bash
# Option 1: Run restore again
./restore-to-azure.sh -i supabase-backup.sql.gz -u "$AZURE_DATABASE_URL"

# Option 2: Check if table exists in source dump
gunzip -c supabase-backup.sql.gz | grep "CREATE TABLE"
```

### pgvector Not Installed

**Problem**: `⚠ pgvector extension is not installed`

**Solution**:
```bash
# Install manually (requires admin privileges)
psql "$AZURE_DATABASE_URL" -c "CREATE EXTENSION vector;"

# Or use the fix script
./fix-azure-database.sh -u "$AZURE_DATABASE_URL"
```

### Empty Tables (0 rows)

**Problem**: `✓ Table 'users': 0 rows` but you expect data

**Solution**:
```bash
# Check source database
psql "$SUPABASE_DATABASE_URL" -c "SELECT COUNT(*) FROM users;"

# If source has data:
# 1. Re-run dump
# 2. Verify dump file
# 3. Re-run restore
```

## Integration with Migration Workflow

```bash
# Complete migration workflow with validation

# 1. Enable maintenance mode
export MAINTENANCE_MODE=true
docker-compose restart api

# 2. Dump Supabase
./dump-supabase-database.sh -c --use-docker

# 3. Restore to Azure
./restore-to-azure.sh -i supabase-backup-*.sql.gz -u "$AZURE_DATABASE_URL"

# 4. VALIDATE before switching
./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"

# 5. If validation passes, update DATABASE_URL
# az containerapp update --set-env-vars DATABASE_URL="$AZURE_DATABASE_URL"

# 6. Validate again with new DATABASE_URL active
./restore-to-azure.sh --validate-only

# 7. Disable maintenance mode
export MAINTENANCE_MODE=false
docker-compose restart api
```

## See Also

- [Main Restore Script](restore-to-azure.sh)
- [Database Validation Script](validate-azure-database.sh) - More comprehensive validation
- [Migration Scripts README](MIGRATION-SCRIPTS-README.md)
- [Maintenance Mode Guide](../docs/MAINTENANCE-MODE.md)
