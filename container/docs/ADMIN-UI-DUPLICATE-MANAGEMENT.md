# Admin UI: Duplicate Document Management

**Location**: Admin Dashboard → Embeddings Tab → Duplicate Document Management Section

## Features

### 1. Check for Duplicates

- **Button**: "🔍 Check for Duplicates"
- **Action**: Scans all documents in the database to find duplicate URLs
- **Display**: Shows statistics card with:
  - Number of duplicate documents
  - Number of URLs affected
  - Total chunks to be removed
  - Total blob files to be deleted

### 2. Remove Duplicates

- **Button**: "🗑️ Remove All Duplicates" (enabled after check)
- **Confirmation**: Asks user to confirm before deletion
- **Action**: Calls the backend API to remove all duplicates
- **Cleanup**: Removes from all three layers:
  1. ✅ Database records (PostgreSQL)
  2. ✅ Vector chunks (document_chunks)
  3. ✅ Azure Blob Storage files

### 3. Results Display

After successful cleanup, shows:
- Number of duplicates removed
- URLs affected
- Chunks deleted
- Blobs deleted
- Any failed blob deletions (warnings)

## Usage

1. **Navigate**: Open admin dashboard → Click "Embeddings" tab
2. **Check**: Click "🔍 Check for Duplicates" button
3. **Review**: Check the statistics displayed
4. **Confirm**: Click "🗑️ Remove All Duplicates"
5. **Verify**: Review the cleanup summary

## Visual Design

- **Red card**: Warning-style design with red left border
- **Stats grid**: 4-column responsive grid showing key metrics
- **Success card**: Green confirmation card after cleanup
- **Disabled state**: Remove button is disabled until duplicates are checked

## API Integration

### Endpoint Used
```
POST /api/admin/documents/remove-duplicates
```

### Response Format
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

## Safety Features

1. **Confirmation Dialog**: Requires explicit confirmation before deletion
2. **Non-Destructive Check**: Checking for duplicates doesn't modify anything
3. **Keeps Oldest**: Always keeps the oldest document (lowest ID)
4. **Error Handling**: Blob deletion failures don't block database cleanup
5. **Detailed Logging**: Backend logs all deletion operations

## Screenshots

### Before Cleanup
```
🗑️ Duplicate Document Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remove duplicate documents that have been crawled multiple times.
This will delete duplicates from the database, vector storage, 
and Azure Blob Storage.

┌─────────────────────────────────────────┐
│  13         6         42        13      │
│  Duplicate  URLs      Chunks    Blobs   │
│  Documents  Affected  to Remove to Del  │
└─────────────────────────────────────────┘

[🔍 Check for Duplicates]  [🗑️ Remove All Duplicates]
```

### After Cleanup
```
✅ Cleanup Complete!
━━━━━━━━━━━━━━━━━━━━
Cleanup Summary:
• 13 duplicate documents removed
• 6 URLs cleaned up
• 42 vector chunks deleted
• 13 blob files removed from Azure Storage

[🔍 Check for Duplicates]
```

## Files Modified

- **app/admin.html**: Added duplicate management section in embeddings tab
- **app/js/admin.js**: Added `checkForDuplicates()` and `removeDuplicates()` functions
- **app/css/admin.css**: Added `.btn-danger` styles for remove button

## Testing

1. **Check Function**: Verifies duplicate detection works
2. **Remove Function**: Confirms all three layers are cleaned
3. **UI Updates**: Stats refresh after cleanup
4. **Error Handling**: Failed blob deletions are reported but don't block

## Best Practices

✅ **Regular Checks**: Run duplicate check periodically  
✅ **Before Cleanup**: Always review stats before removing  
✅ **After Crawls**: Check for duplicates after large crawl jobs  
✅ **Monitor Logs**: Check backend logs for any blob deletion failures  

## Troubleshooting

**Issue**: Remove button stays disabled  
**Solution**: Click "Check for Duplicates" first

**Issue**: Stats show 0 duplicates  
**Solution**: Good! No action needed

**Issue**: Blob deletions failed  
**Check**: Backend logs with `docker logs powernova-api | grep "blob"`  
**Note**: Database and chunks are still cleaned up

## Related Documentation

- [DUPLICATE-PREVENTION.md](./DUPLICATE-PREVENTION.md) - Technical details
- [DUPLICATE-PREVENTION-QUICKREF.md](./DUPLICATE-PREVENTION-QUICKREF.md) - CLI reference
- [DUPLICATE-PREVENTION-SUMMARY.md](./DUPLICATE-PREVENTION-SUMMARY.md) - Implementation overview
