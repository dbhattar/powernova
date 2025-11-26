# Password Special Characters Guide

## The Problem

PostgreSQL connection strings use the URI format:
```
postgresql://username:password@host:port/database
```

If your password contains special characters (like `/`, `@`, `:`, `?`, `#`, etc.), they can break the connection string parsing.

## Special Characters That Need Encoding

| Character | URL Encoded | Common In |
|-----------|-------------|-----------|
| `/` | `%2F` | Generated passwords |
| `@` | `%40` | Email-style passwords |
| `:` | `%3A` | Separator-style passwords |
| `?` | `%3F` | Random passwords |
| `#` | `%23` | Random passwords |
| `&` | `%26` | Random passwords |
| `%` | `%25` | Random passwords |
| `+` | `%2B` | Base64 strings |
| ` ` (space) | `%20` | Accidental spaces |
| `=` | `%3D` | Base64 strings |

## Automatic Encoding (Recommended)

**All migration scripts now automatically URL-encode passwords!**

When you run any of these scripts:
- `validate-azure-database.sh`
- `dump-supabase-database.sh`
- `restore-to-azure.sh`

They will automatically encode your password when you enter it interactively.

### Example:
```bash
cd scripts
./validate-azure-database.sh

# When prompted, enter your password as-is:
Database Password: MyP@ss/word#123

# The script automatically converts it to:
# MyP%40ss%2Fword%23123
```

## Manual Encoding (If Needed)

### Option 1: Using Python (Recommended)
```bash
python3 -c "import urllib.parse; print(urllib.parse.quote('MyP@ss/word#123', safe=''))"
# Output: MyP%40ss%2Fword%23123
```

### Option 2: Using Node.js
```bash
node -e "console.log(encodeURIComponent('MyP@ss/word#123'))"
# Output: MyP%40ss%2Fword%23123
```

### Option 3: Using Online Tool
Visit: https://www.urlencoder.org/

### Option 4: Using Bash Script
```bash
# Use the url_encode function from our scripts
url_encode() {
    local string="$1"
    local encoded=""
    local pos c o
    
    for ((pos=0; pos<${#string}; pos++)); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9])
                encoded+="$c"
                ;;
            *)
                printf -v o '%%%02X' "'$c"
                encoded+="$o"
                ;;
        esac
    done
    echo "$encoded"
}

# Usage:
url_encode "MyP@ss/word#123"
```

## Using Environment Variables

### If password has special characters:
```bash
# Encode the password first
ENCODED_PASS=$(python3 -c "import urllib.parse; print(urllib.parse.quote('MyP@ss/word#123', safe=''))")

# Set environment variable with encoded password
export AZURE_DATABASE_URL="postgresql://powernova_admin:${ENCODED_PASS}@server:5432/db?sslmode=require"

# Now run scripts
./validate-azure-database.sh
```

### Or let the scripts handle it:
```bash
# Just set a marker to prompt for password
export AZURE_DATABASE_URL="postgresql://powernova_admin@powernova-db.postgres.database.azure.com:5432/powernova_db?sslmode=require"

# Script will prompt for password and encode it
./validate-azure-database.sh
```

## Testing Your Connection String

### Test with psql directly:
```bash
# Method 1: Let psql prompt for password (recommended)
psql -h powernova-db.postgres.database.azure.com \
     -p 5432 \
     -U powernova_admin \
     -d powernova_db \
     -W  # This will prompt for password

# Method 2: Use encoded password in URL
psql "postgresql://powernova_admin:MyP%40ss%2Fword%23123@powernova-db.postgres.database.azure.com:5432/powernova_db?sslmode=require"
```

## Common Error Messages

### Error: "could not translate host name to address"
**Cause:** The `@` in password was interpreted as the username/host separator

**Example of broken connection string:**
```
postgresql://admin:MyP@ss@server:5432/db
                     ^  ^
                     |  |
          Password ends here (wrong!)
                        |
           Host starts here (wrong!)
```

**Fix:** URL-encode the password
```
postgresql://admin:MyP%40ss@server:5432/db
                     ^^^^^^^
                Password is now correctly encoded
```

### Error: "FATAL: password authentication failed"
**Cause:** Special characters in password not encoded, causing truncation

**Fix:** Ensure password is URL-encoded

### Error: "incomplete connection string"
**Cause:** Special characters like `?` or `#` in password breaking the query string

**Example of broken:**
```
postgresql://admin:Pass?word@server:5432/db
                        ^
          Query string starts here (wrong!)
```

**Fix:** URL-encode
```
postgresql://admin:Pass%3Fword@server:5432/db
                        ^^^^
                  Now correctly encoded
```

## Best Practices

### 1. Use Environment Variables
```bash
# .env file (DON'T commit this!)
AZURE_DATABASE_URL="postgresql://user:encoded_password@host:5432/db"
```

### 2. Use .pgpass File (Most Secure)
```bash
# ~/.pgpass (must be chmod 600)
powernova-db.postgres.database.azure.com:5432:powernova_db:powernova_admin:MyP@ss/word#123

# Then connect without password in connection string
psql -h powernova-db.postgres.database.azure.com -U powernova_admin -d powernova_db
```

### 3. Generate Passwords Without Special Characters
When creating Azure PostgreSQL admin password:
```bash
# Good: alphanumeric + underscores
MySecurePassword_2024

# Avoid: special URL characters
MyP@ss/word#123  # Requires encoding
```

### 4. Use Azure Key Vault
For production:
- Store password in Azure Key Vault
- Reference from Container Apps using managed identity
- Never hardcode in scripts or configs

## Verification

After encoding your password, verify it works:

```bash
# Test connection
psql "postgresql://user:ENCODED_PASSWORD@host:5432/db" -c "SELECT 1;"

# If successful, you'll see:
#  ?column? 
# ----------
#         1
# (1 row)
```

## Script Updates

All three migration scripts have been updated with automatic URL encoding:

- ✅ **validate-azure-database.sh** - Encodes password when entered interactively
- ✅ **dump-supabase-database.sh** - Encodes password when entered interactively  
- ✅ **restore-to-azure.sh** - Encodes password when entered interactively

**You don't need to manually encode passwords anymore when using these scripts!**

## Example: Full Migration with Special Character Password

```bash
# Your actual password (with special characters)
# MyP@ss/word#2024

cd scripts

# Step 1: Validate Azure database
./validate-azure-database.sh
# Enter password as-is when prompted: MyP@ss/word#2024
# ✓ Script automatically encodes it

# Step 2: Dump Supabase
./dump-supabase-database.sh -c
# Enter password as-is when prompted
# ✓ Script automatically encodes it

# Step 3: Restore to Azure
./restore-to-azure.sh -i backup.sql.gz
# Enter password as-is when prompted: MyP@ss/word#2024
# ✓ Script automatically encodes it
```

## Quick Reference: URL Encoding

```bash
# Quick encode function (copy-paste to terminal)
urlencode() {
    python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

# Usage:
urlencode "MyP@ss/word#123"
# Output: MyP%40ss%2Fword%23123

# Use in connection string:
export DB_URL="postgresql://admin:$(urlencode 'MyP@ss/word#123')@server:5432/db"
```
