# Special Characters in Passwords - Fixed! ✅

## Problem Solved

Your password contains special characters (like `/`, `@`, `=`, etc.) which break PostgreSQL connection strings. **All migration scripts have been updated to automatically handle this!**

## What Was Fixed

### Updated Scripts:
1. ✅ **validate-azure-database.sh** - Auto-encodes passwords
2. ✅ **dump-supabase-database.sh** - Auto-encodes passwords
3. ✅ **restore-to-azure.sh** - Auto-encodes passwords

### How It Works:

When you enter a password like:
```
iivAPQsflo/4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o=
```

The script automatically converts it to:
```
iivAPQsflo%2F4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o%3D
```

So the connection string becomes valid:
```
postgresql://user:iivAPQsflo%2F4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o%3D@host:5432/db
```

## You Don't Need to Do Anything!

Just use the scripts normally:

```bash
cd scripts

# 1. Validate Azure database
./validate-azure-database.sh
# Enter your password with special characters when prompted
# ✅ Script handles encoding automatically

# 2. Dump from Supabase
./dump-supabase-database.sh -c
# Enter your password as-is
# ✅ Script handles encoding automatically

# 3. Restore to Azure
./restore-to-azure.sh -i backup.sql.gz
# Enter your password as-is
# ✅ Script handles encoding automatically
```

## Verified Working

The URL encoding has been tested with these password types:

✅ **Simple passwords:** `SimplePass123`
✅ **Slash (/):** `MyP@ss/word#123` → `MyP%40ss%2Fword%23123`
✅ **At sign (@):** `user@domain.com` → `user%40domain.com`
✅ **Colons (:):** `pass:with:colons` → `pass%3Awith%3Acolons`
✅ **Question mark (?):** `query?string` → `query%3Fstring`
✅ **Hash (#):** `hash#tag` → `hash%23tag`
✅ **Spaces:** `space in pass` → `space%20in%20pass`
✅ **Percent (%):** `percent%sign` → `percent%25sign`
✅ **Plus (+):** `plus+sign` → `plus%2Bsign`
✅ **Equals (=):** `equal=sign` → `equal%3Dsign`
✅ **Ampersand (&):** `ampersand&sign` → `ampersand%26sign`
✅ **Base64-like:** `iivAPQsflo/4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o=`

Run the test yourself:
```bash
cd scripts
./test-url-encoding.sh
```

## Alternative: Using Environment Variables

If you prefer to set the connection string once:

```bash
# Option 1: Let scripts prompt for password (recommended)
export AZURE_DATABASE_URL="postgresql://powernova_admin@powernova-db.postgres.database.azure.com:5432/powernova_db?sslmode=require"
./validate-azure-database.sh
# You'll be prompted for password and it will be encoded automatically

# Option 2: Encode password yourself using Python
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('your/pass@word#123', safe=''))")
export AZURE_DATABASE_URL="postgresql://user:${ENCODED}@host:5432/db?sslmode=require"
./validate-azure-database.sh
```

## Common Characters That Are Now Handled

| Character | URL Encoded | Why It Breaks |
|-----------|-------------|---------------|
| `/` | `%2F` | Path separator in URLs |
| `@` | `%40` | Separates user:pass from host |
| `:` | `%3A` | Separates user from password and host from port |
| `?` | `%3F` | Starts query string |
| `#` | `%23` | Starts fragment identifier |
| `=` | `%3D` | Key-value separator in query strings |
| `&` | `%26` | Query parameter separator |
| `%` | `%25` | URL encoding indicator |
| `+` | `%2B` | Space in query strings (legacy) |
| ` ` | `%20` | Whitespace |

## Documentation

For more details, see:
- [PASSWORD-SPECIAL-CHARACTERS.md](PASSWORD-SPECIAL-CHARACTERS.md) - Complete guide
- [MIGRATION-SCRIPTS-README.md](MIGRATION-SCRIPTS-README.md) - Main documentation

## Summary

✅ **Problem identified:** Special characters in password break connection string
✅ **Solution implemented:** Automatic URL encoding in all scripts
✅ **Testing completed:** 12 test cases pass
✅ **Ready to use:** No manual encoding needed

**You can now run the migration with confidence!** 🎉
