# Reprocess Failed Documents - Quick Reference

## Quick Start

```bash
# Preview what will be reprocessed
python scripts/reprocess_failed_documents.py --dry-run --all

# Reprocess all failed documents
python scripts/reprocess_failed_documents.py --all

# Reprocess first 50
python scripts/reprocess_failed_documents.py --all --limit 50

# Reprocess specific document
python scripts/reprocess_failed_documents.py --doc-id 12345
```

## What It Does

1. ✅ Downloads from **original URL** (not Azure Storage)
2. ✅ Uses **improved extension detection** (URL + Content-Type)
3. ✅ Re-extracts text with **enhanced error handling**
4. ✅ Updates document with new content
5. ✅ Creates/resets **DocumentJob** for embedding generation

## Key Improvements Over Old Approach

| Old (Azure Storage) | New (Original URL) |
|---------------------|-------------------|
| ❌ Stored filename | ✅ Actual URL |
| ❌ No Content-Type | ✅ Fresh headers |
| ❌ Wrong extension | ✅ Correct detection |
| ❌ Can't fix URL issues | ✅ Leverages improvements |

## Extension Detection Flow

```
1. Parse URL: /doc.pdf/uuid → "pdf"
2. If none, check Content-Type: application/pdf → "pdf"
3. Extract text using correct extension
```

## Find Documents to Reprocess

```sql
-- Count by error type
SELECT 
    CASE 
        WHEN error_message LIKE '%No text extracted%' THEN 'No text'
        WHEN error_message LIKE '%Extraction error%' THEN 'Extraction'
        ELSE 'Other'
    END as type,
    COUNT(*)
FROM documents
WHERE status = 'FAILED'
GROUP BY type;

-- List specific documents
SELECT id, url, error_message
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%'
LIMIT 20;
```

## Monitor Progress

```sql
-- Before/after comparison
SELECT status, COUNT(*) FROM documents GROUP BY status;

-- Check document jobs created
SELECT status, COUNT(*) 
FROM document_jobs 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

## Common Errors After Reprocessing

| Error Type | Meaning | Action |
|------------|---------|--------|
| `encrypted_pdf` | Password protected | Manual decrypt or skip |
| `incomplete_pdf` | Missing EOF marker | File corrupted at source |
| `image-based` | Scanned PDF, no text | Needs OCR |
| HTTP 404 | URL no longer exists | Remove or update URL |
| HTTP 403 | Access denied | Check authentication |

## Example Output

```
Found 127 failed documents to reprocess

Processing 1/127
✓ Downloaded 2.4 MB, extension: pdf
✓ Extracted 125,678 chars
✓ Updated document
✓ Created document job

SUMMARY
Total: 127
Success: 98
Failed: 29
```

## Best Practices

1. **Always dry-run first**: `--dry-run --all`
2. **Process in batches**: `--limit 50`
3. **Monitor database**: Check status counts
4. **Investigate failures**: Review updated error messages

## Requirements

```bash
# Environment
.env.local file with DATABASE_URL

# Packages
pip install requests psycopg2-binary sqlalchemy PyPDF2 python-docx
```

## See Also

- [REPROCESS-FAILED-DOCUMENTS.md](REPROCESS-FAILED-DOCUMENTS.md) - Full documentation
- [FILE-EXTENSION-DETECTION.md](FILE-EXTENSION-DETECTION.md) - Extension improvements
- [PDF-EXTRACTION-ERROR-HANDLING.md](PDF-EXTRACTION-ERROR-HANDLING.md) - Error handling
