# Vector Index Creation Guide

## Problem
The HNSW vector index creation on `document_chunks.embedding` can take a long time (several minutes to hours) depending on the number of chunks. During this time, the migration appears to hang without progress updates.

## Solution

### Option 1: Monitor Current Migration (If Already Running)

If the migration is already running in production, you can monitor its progress:

```bash
# SSH into the API container
az container exec --resource-group <resource-group> --name <container-name> --exec-command "/bin/bash"

# Check if index creation is in progress
python scripts/create_vector_index.py --progress
```

This will show:
- Whether index creation is actively running
- How long it's been running
- What the process is waiting on

### Option 2: Create Index Manually with CONCURRENTLY

If you want to create the index without blocking the migration or with better control:

```bash
# 1. First, check current status
python scripts/create_vector_index.py --check --stats

# 2. Create the index (non-blocking, can take 5-30 minutes)
python scripts/create_vector_index.py --create

# 3. Monitor progress in another terminal
python scripts/create_vector_index.py --progress
```

### Option 3: Direct SQL (Advanced)

If you have direct database access:

```sql
-- Check if index exists
SELECT * FROM pg_indexes WHERE indexname = 'document_chunks_embedding_idx';

-- Check progress
SELECT 
    a.query,
    now() - a.query_start AS duration,
    a.state
FROM pg_stat_activity a
WHERE a.query LIKE '%document_chunks_embedding_idx%'
  AND a.state != 'idle';

-- Create index manually (use CONCURRENTLY for no blocking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## Expected Timings

Based on dataset size:

| Chunks | Estimated Time |
|--------|----------------|
| 10,000 | 2-10 seconds |
| 50,000 | 10-60 seconds |
| 100,000 | 1-5 minutes |
| 500,000 | 5-30 minutes |
| 1,000,000 | 10-60 minutes |

*Actual time depends on server specs, current load, and PostgreSQL configuration*

## How to Tell If It's Working

The migration/index creation is working if:

1. **Database CPU is high** - Index creation is CPU-intensive
2. **No errors in logs** - Check container logs for PostgreSQL errors
3. **Process shows in pg_stat_activity** - Query is actively running

## What to Do If Stuck

If the migration appears stuck for more than expected:

1. **Check database connections:**
   ```bash
   # In PostgreSQL
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
   ```

2. **Check for locks:**
   ```sql
   SELECT * FROM pg_locks WHERE relation = 'document_chunks'::regclass;
   ```

3. **Cancel and retry with CONCURRENTLY:**
   ```bash
   # Stop the current migration (if safe to do so)
   # Then run manually:
   python scripts/create_vector_index.py --create
   ```

## Updated Migration

The migration has been updated to:
- ✅ Check if index already exists (skip if present)
- ✅ Show chunk count before starting
- ✅ Print progress messages
- ✅ Try CONCURRENTLY first (non-blocking)
- ✅ Fallback to regular creation if needed

## Post-Creation Verification

After index is created, verify it's being used:

```sql
-- Check index exists
\d document_chunks

-- Test query uses index
EXPLAIN ANALYZE
SELECT chunk_text, embedding <=> '[0,0,0...]'::vector AS distance
FROM document_chunks
WHERE embedding IS NOT NULL
ORDER BY distance
LIMIT 5;
```

You should see "Index Scan using document_chunks_embedding_idx" in the query plan.

## Performance Impact

**Before index:**
- Similarity search: 5-30 seconds (full table scan)
- Query scans all rows

**After index:**
- Similarity search: 50-500ms (10-100x faster)
- Query uses HNSW index for approximate nearest neighbor

## Troubleshooting

### "Index already exists" error
The migration now handles this gracefully. The index won't be recreated.

### "Cannot run CONCURRENTLY in transaction" error
This happens in Alembic migrations. The updated migration handles this by:
1. Attempting CONCURRENTLY first
2. Falling back to regular creation if in transaction

### Migration timeout
If running through deployment, increase timeout:
```yaml
# In deployment config
healthCheck:
  timeoutSeconds: 1800  # 30 minutes
```

### Very slow creation (> 1 hour)
Consider:
1. Reducing `ef_construction` parameter (e.g., 32 instead of 64)
2. Running during off-peak hours
3. Temporarily scaling up database resources

## Next Steps After Index Creation

1. **Verify performance improvement:**
   - Test similarity search speed in chat
   - Check query times in database logs

2. **Monitor index usage:**
   ```sql
   SELECT 
       schemaname,
       tablename,
       indexname,
       idx_scan,
       idx_tup_read,
       idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE indexname = 'document_chunks_embedding_idx';
   ```

3. **Consider index maintenance:**
   - HNSW indexes don't require VACUUM/REINDEX like some other types
   - Monitor index size growth over time

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [HNSW Algorithm](https://github.com/nmslib/hnswlib)
- [PostgreSQL CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
