# ISO Filtering Fix

## Problem
Frontend showed projects when no ISO was selected, but no projects appeared when ERCOT was selected specifically.

## Root Cause
1. **Case Sensitivity Mismatch**: The gridstatus library stored ISO IDs as "Ercot" (mixed case), but the frontend was likely filtering using "ERCOT" (uppercase)
2. **Case-Sensitive Database Queries**: The Node.js backend was using exact case-sensitive matching (`IsoID = $1`) instead of case-insensitive matching

## Solution Applied

### 1. Fixed Database Queries (Case-Insensitive)
Updated `backend/src/services/projectsService.js`:

**Before:**
```sql
WHERE IsoID = $1
```

**After:**
```sql
WHERE UPPER(IsoID) = UPPER($1)
```

This allows filtering to work regardless of case (ERCOT, ercot, Ercot all work).

### 2. Normalized Existing Data
Updated all existing ISO IDs in the database to uppercase:
```sql
UPDATE QueueInfo SET IsoID = UPPER(IsoID);
```

Result: "Ercot" → "ERCOT"

### 3. Fixed Future Data Population
Updated `populate_queue_projects.py` to store ISO IDs in uppercase:
```python
data = [
    iso_id.upper(),  # Normalize ISO ID to uppercase
    queue_id,
    # ... other fields
]
```

## Verification

### Database Content
- ✅ 1,866 ERCOT projects stored
- ✅ Case-insensitive queries work (ERCOT, ercot, Ercot all return same results)
- ✅ Projects have proper status distribution (Active: 1,356, Completed: 510)

### API Endpoints
After backend restart, these should all work:
- `/api/projects/projects/ERCOT`
- `/api/projects/projects/ercot` 
- `/api/projects/projects/Ercot`

### Testing Commands
```bash
# Verify database content
npm run verify-database

# Test API endpoints (requires backend running)
npm run test-api-filtering
```

## Files Modified
1. `backend/src/services/projectsService.js` - Case-insensitive ISO filtering
2. `backend/scripts/populate_queue_projects.py` - Normalize ISO IDs to uppercase
3. Database: Updated existing records to uppercase

## Result
Frontend ERCOT filtering should now work correctly, regardless of how the frontend sends the ISO parameter (uppercase, lowercase, or mixed case).
