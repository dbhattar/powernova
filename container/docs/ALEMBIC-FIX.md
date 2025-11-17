# Alembic Migration Fix

## Issue

When running database tests, you encountered:
```
OCI runtime exec failed: exec failed: unable to start container process: 
exec: "alembic": executable file not found in $PATH: unknown
```

## Root Cause

The `alembic` package was missing from `api/requirements.txt`, so it wasn't installed in the Docker container.

## Solution Applied

### 1. Added Alembic to requirements.txt

**File**: `api/requirements.txt`

Added:
```
alembic==1.13.1
```

### 2. Updated All Scripts to Use `python -m alembic`

Changed all alembic commands from:
```bash
docker exec powernova-api alembic upgrade head
```

To:
```bash
docker exec powernova-api python -m alembic upgrade head
```

**Files Updated**:
- `scripts/test-database.sh`
- `scripts/manage-database.sh`

### 3. Fixed SQLAlchemy Text Query

**File**: `api/database/session.py`

Changed:
```python
# Before (caused error)
from sqlalchemy import create_engine
result = conn.execute("SELECT 1")

# After (working)
from sqlalchemy import create_engine, text
result = conn.execute(text("SELECT 1"))
```

### 4. Rebuilt Container

```bash
cd docker
docker-compose up -d --build powernova-api
```

## Verification

All tests now pass:

```bash
./scripts/test-database.sh
```

Results:
```
✓ PostgreSQL container is running
✓ API container is running
✓ Database is accepting connections
✓ Found 5 tables
✓ API can connect to database
✓ CRUD operations successful
✓ Health endpoint working
✓ Migrations up to date

Database setup is working correctly! 🎉
```

## Files Modified

1. **`api/requirements.txt`**
   - Added `alembic==1.13.1`

2. **`api/database/session.py`**
   - Added `text` import from sqlalchemy
   - Updated `check_db_connection()` to use `text("SELECT 1")`

3. **`scripts/test-database.sh`**
   - Changed `alembic` to `python -m alembic` (2 occurrences)

4. **`scripts/manage-database.sh`**
   - Changed `alembic` to `python -m alembic` (6 occurrences)

## Why `python -m alembic`?

Using `python -m alembic` instead of just `alembic`:

✅ **More reliable**: Works even if alembic isn't in PATH  
✅ **Explicit Python**: Uses the correct Python interpreter  
✅ **Best practice**: Recommended way to run Python modules  
✅ **Container-friendly**: Works consistently in Docker environments  

## Migration Commands

All migration commands now work properly:

```bash
# Run migrations
docker exec powernova-api python -m alembic upgrade head

# Create new migration
docker exec powernova-api python -m alembic revision --autogenerate -m "description"

# Check current version
docker exec powernova-api python -m alembic current

# View history
docker exec powernova-api python -m alembic history

# Rollback
docker exec powernova-api python -m alembic downgrade -1
```

Or use the interactive script:
```bash
./scripts/manage-database.sh
```

## Quick Reference

### Test Database
```bash
./scripts/test-database.sh
```

### Manage Database
```bash
./scripts/manage-database.sh
```

### Run Migrations Manually
```bash
docker exec powernova-api python -m alembic upgrade head
```

### Check Alembic Version
```bash
docker exec powernova-api python -m alembic --version
```

## Summary

✅ **Alembic installed**: Added to requirements.txt  
✅ **Scripts updated**: All use `python -m alembic`  
✅ **SQLAlchemy fixed**: Using `text()` for raw SQL  
✅ **Tests passing**: All database tests successful  
✅ **Container rebuilt**: Changes applied  

Everything is now working correctly! 🚀
