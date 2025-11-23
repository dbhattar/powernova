# Quick Reference: Duplicate Document Management

## Check for Duplicates

```bash
# Connect to database
docker exec -it powernova-postgres psql -U powernova -d powernova

# Find duplicate URLs
SELECT url, COUNT(*) as count, string_agg(id::text, ', ') as document_ids 
FROM documents 
GROUP BY url 
HAVING COUNT(*) > 1 
ORDER BY count DESC;
```

## Remove Duplicates

```bash
# Remove all duplicates (keeps oldest document for each URL)
curl -X POST http://localhost:8000/api/admin/documents/remove-duplicates \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0="
```

### Response Example
```json
{
  "duplicates_removed": 13,
  "urls_affected": 6,
  "chunks_deleted": 42,
  "blobs_deleted": 13,
  "blobs_failed": 0,
  "message": "Removed 13 duplicate documents across 6 URLs"
}
```

## What Gets Deleted

For each duplicate document (keeping the oldest):

1. ✅ **Database Record** - Document row in PostgreSQL
2. ✅ **Vector Chunks** - All associated embeddings in document_chunks table
3. ✅ **Azure Blob** - Original file from Azure Blob Storage

## Verify Cleanup

```sql
-- Should return 0 rows
SELECT url, COUNT(*) FROM documents 
GROUP BY url 
HAVING COUNT(*) > 1;

-- Check blob coverage (should be 100%)
SELECT 
    COUNT(*) as total_documents,
    COUNT(file_path) as documents_with_blobs,
    ROUND(100.0 * COUNT(file_path) / COUNT(*), 2) as coverage_percent
FROM documents;
```

## Prevention

Duplicate prevention is **automatic** - new crawl jobs won't create duplicates even when crawling the same URLs.

### Test Prevention

```bash
# Crawl a site that's already been crawled
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=" \
  -d '{
    "start_url": "https://www.caiso.com/",
    "max_depth": 1,
    "max_pages": 5
  }'

# Check the job status
curl http://localhost:8000/api/admin/crawl/{job_id} \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=" | jq

# Verify: documents_found > 0, but no new documents in database
```

## Logs

```bash
# View duplicate prevention logs
docker logs powernova-api | grep "Document already exists"

# View blob deletion logs
docker logs powernova-api | grep -i "blob"

# View duplicate removal operation
docker logs powernova-api | tail -100 | grep -A 5 "Found.*duplicates"
```

## Troubleshooting

### Issue: Blob deletion fails

**Check**:
```bash
# View blob deletion errors
docker logs powernova-api | grep "Failed to delete blob"
```

**Note**: Blob deletion failures are non-blocking. Documents and chunks will still be removed.

### Issue: Duplicates still appearing

**Possible causes**:
1. Multiple crawl jobs running simultaneously (rare race condition)
2. API not restarted after code deployment

**Fix**:
```bash
# Restart API
docker restart powernova-api

# Run cleanup again
curl -X POST http://localhost:8000/api/admin/documents/remove-duplicates \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0="
```

## Quick Stats

```sql
-- Document statistics
SELECT 
    COUNT(*) as total_documents,
    COUNT(DISTINCT url) as unique_urls,
    COUNT(*) - COUNT(DISTINCT url) as duplicates
FROM documents;

-- Storage usage
SELECT 
    COUNT(*) as documents_with_blobs,
    COUNT(DISTINCT url) as unique_urls_with_blobs
FROM documents 
WHERE file_path IS NOT NULL;
```

## Best Practices

✅ **Run cleanup periodically** if you suspect duplicates  
✅ **Check logs** after crawl jobs to verify prevention is working  
✅ **Monitor blob_failed** count - should always be 0  
✅ **Keep database index** on `documents.url` for performance  

---

**Files Modified**:
- `api/services/crawler.py` - Duplicate prevention
- `api/routes/admin.py` - Cleanup endpoint
- `api/services/azure_storage.py` - Blob deletion (already existed)

**Documentation**:
- [DUPLICATE-PREVENTION.md](./DUPLICATE-PREVENTION.md) - Full documentation
- [DUPLICATE-PREVENTION-SUMMARY.md](./DUPLICATE-PREVENTION-SUMMARY.md) - Implementation summary
