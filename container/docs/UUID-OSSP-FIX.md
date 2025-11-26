# UUID-OSSP Extension Installation

## The Problem

Extension names with hyphens (like `uuid-ossp`) need to be **quoted** in PostgreSQL SQL commands.

## ❌ Wrong (Syntax Error)
```sql
CREATE EXTENSION uuid-ossp;
-- ERROR: syntax error at or near "-"
```

## ✅ Correct (With Quotes)
```sql
CREATE EXTENSION "uuid-ossp";
-- or
CREATE EXTENSION 'uuid-ossp';
```

## Quick Fix

### Option 1: Use Double Quotes (Recommended)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Option 2: Use Single Quotes
```sql
CREATE EXTENSION IF NOT EXISTS 'uuid-ossp';
```

## Complete Commands

### In psql Interactive Mode
```sql
powernova_db=> CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION

powernova_db=> \dx uuid-ossp
                                      List of installed extensions
    Name    | Version |   Schema   |                         Description                          
------------+---------+------------+--------------------------------------------------------------
 uuid-ossp  | 1.1     | public     | generate universally unique identifiers (UUIDs)
```

### From Command Line
```bash
# Single command
psql "$AZURE_DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# Or using the fix script (already has correct syntax)
cd scripts
./fix-azure-database.sh
```

## Verification

After installation, verify it works:

```sql
-- Test UUID generation
SELECT uuid_generate_v4();

-- Output should look like:
           uuid_generate_v4           
--------------------------------------
 a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

## Why Quotes Are Needed

PostgreSQL treats hyphens as minus operators in unquoted identifiers:
- `uuid-ossp` → parsed as `uuid` minus `ossp` (syntax error)
- `"uuid-ossp"` → treated as a single identifier (correct)

## Other Extensions That Need Quotes

Common PostgreSQL extensions that need quotes:
- ✅ `"uuid-ossp"` (has hyphen)
- ✅ `"postgres-bdr"` (has hyphen)
- ❌ `vector` (no special characters, no quotes needed)
- ❌ `postgis` (no special characters, no quotes needed)

## Full Installation Script

```sql
-- Install all common extensions
CREATE EXTENSION IF NOT EXISTS vector;           -- No quotes needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Quotes required
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- No quotes needed
CREATE EXTENSION IF NOT EXISTS btree_gin;        -- No quotes needed
```

## Automated Fix

The automated script already has the correct syntax:

```bash
cd scripts
./fix-azure-database.sh
```

The script uses:
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
                                                      ^            ^
                                            Escaped double quotes
```
