# Fixing Azure PostgreSQL Validation Issues

## Quick Fix

Run the automated fix script:
```bash
cd scripts
./fix-azure-database.sh
```

This will automatically attempt to:
- ✅ Install pgvector extension
- ✅ Install uuid-ossp extension  
- ✅ Verify SSL configuration

## Manual Fixes

### Issue 1: ⚠ SSL/TLS encryption status: (empty)

**Problem:** The SSL status check is returning empty, but this is usually just a query issue. Azure PostgreSQL has SSL enabled by default.

**Solution:** Ensure your connection string includes `sslmode=require`

```bash
# Correct format
postgresql://user:password@server:5432/db?sslmode=require
                                                ^^^^^^^^^^^^^^^^
```

**Verification:**
```bash
# Test SSL connection
psql "postgresql://user:pass@host:5432/db?sslmode=require" -c "SELECT 1;"
```

---

### Issue 2: ⚠ pgvector extension is available but not installed

**Problem:** The pgvector extension is available on the server but hasn't been installed in your database.

**Solution 1: Quick Fix (Automated)**
```bash
cd scripts
./fix-azure-database.sh
```

**Solution 2: Manual Fix**
```bash
# Connect to your database
psql "postgresql://ADMIN_USER:PASSWORD@server:5432/db?sslmode=require"

# Install the extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify installation
\dx vector
```

**If you get "permission denied":**
You need to connect as the **admin user** (the one you created when setting up the Azure PostgreSQL server).

```bash
# Use the admin credentials from your ARM template deployment
# Default admin user: powernova_admin (from azure-postgresql-deployment.parameters.json)

psql "postgresql://powernova_admin:YOUR_ADMIN_PASSWORD@server:5432/db?sslmode=require" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

### Issue 3: ⚠ uuid-ossp extension is not installed

**Problem:** The uuid-ossp extension is not installed (this is optional but recommended).

**Solution 1: Quick Fix (Automated)**
```bash
cd scripts
./fix-azure-database.sh
```

**Solution 2: Manual Fix**
```bash
# Connect as admin user
psql "postgresql://powernova_admin:PASSWORD@server:5432/db?sslmode=require"

# Install the extension (NOTE: quotes are required because of the hyphen!)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Verify installation
\dx uuid-ossp
```

**⚠️ Important:** The extension name `uuid-ossp` **must be quoted** because it contains a hyphen:
- ❌ Wrong: `CREATE EXTENSION uuid-ossp;` (syntax error)
- ✅ Correct: `CREATE EXTENSION "uuid-ossp";`

---

### Issue 4: ⚠ User may not have CREATE EXTENSION permission

**Problem:** The user you're connecting with doesn't have permission to create extensions.

**Root Cause:** Only the admin user (or users with SUPERUSER privileges) can install PostgreSQL extensions.

**Solution 1: Connect as Admin User**

Use the **admin username and password** from when you deployed the Azure PostgreSQL server:

```bash
# From azure-postgresql-deployment.parameters.json:
# - administratorLogin: powernova_admin (or what you set)
# - administratorLoginPassword: (the password you set)

# Connect as admin
psql "postgresql://powernova_admin:ADMIN_PASSWORD@server:5432/db?sslmode=require"

# Install extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Solution 2: Grant Permissions to Your User**

If you want your regular user to be able to install extensions:

```bash
# Connect as admin
psql "postgresql://powernova_admin:PASSWORD@server:5432/db?sslmode=require"

# Grant superuser to your application user (use with caution)
ALTER USER your_app_user WITH SUPERUSER;

# Or grant just extension creation permission (safer)
GRANT CREATE ON DATABASE powernova_db TO your_app_user;
```

**Note:** For production, it's better to:
1. Use admin user to install extensions during setup
2. Use a non-admin user for the application with limited permissions

---

## Complete Fix Workflow

### Step 1: Identify Admin Credentials

Your admin credentials are in:
- **File:** `templates/azure-postgresql-deployment.parameters.json`
- **Username:** Value of `administratorLogin` (likely `powernova_admin`)
- **Password:** The password you set during deployment

### Step 2: Run Automated Fix

```bash
cd scripts

# Set admin credentials as environment variable
export AZURE_DATABASE_URL="postgresql://powernova_admin:ADMIN_PASS@server:5432/db?sslmode=require"

# Run fix script
./fix-azure-database.sh
```

### Step 3: Verify Fixes

```bash
# Run validation again
./validate-azure-database.sh
```

You should now see:
```
✓ SSL/TLS encryption is enabled
✓ pgvector extension is installed (version: X.X.X)
✓ uuid-ossp extension is installed
✓ User has CREATE EXTENSION permission
```

---

## Alternative: Manual Step-by-Step

If the automated script doesn't work, do it manually:

```bash
# 1. Connect as admin user
psql "postgresql://powernova_admin:YOUR_ADMIN_PASSWORD@powernova-db-server.postgres.database.azure.com:5432/powernova_db?sslmode=require"

# 2. Install pgvector
CREATE EXTENSION IF NOT EXISTS vector;

# 3. Install uuid-ossp (NOTE: Must use quotes because of hyphen!)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# 4. Verify both are installed
\dx

# You should see both extensions listed

# 5. Exit
\q
```

---

## Verification Commands

After fixing, verify everything works:

```bash
# Test pgvector
psql "$AZURE_DATABASE_URL" -c "SELECT '[1,2,3]'::vector;"

# Test uuid-ossp
psql "$AZURE_DATABASE_URL" -c "SELECT uuid_generate_v4();"

# Test SSL
psql "$AZURE_DATABASE_URL" -c "SHOW ssl;"

# Run full validation
cd scripts
./validate-azure-database.sh
```

---

## Common Errors & Solutions

### Error: "permission denied to create extension"
**Fix:** You're not using the admin user. Switch to admin credentials.

### Error: "extension vector is not available"
**Fix:** Enable pgvector in Azure Portal:
1. Azure Portal → PostgreSQL Flexible Server
2. Settings → Server parameters
3. Search: `azure.extensions`
4. Add: `VECTOR`
5. Save and restart server

### Error: "could not load library vector"
**Fix:** Restart the PostgreSQL server after enabling the extension in Azure Portal.

### Error: "SSL connection required"
**Fix:** Add `?sslmode=require` to your connection string.

---

## Summary

**Quick Fix (Recommended):**
```bash
cd scripts
export AZURE_DATABASE_URL="postgresql://powernova_admin:ADMIN_PASS@server:5432/db?sslmode=require"
./fix-azure-database.sh
./validate-azure-database.sh  # Verify
```

**Manual Fix:**
```sql
-- Connect as admin, then run:
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**After fixing, you should see:**
```
✓ All checks passed
✓ Database is ready for migration
```
