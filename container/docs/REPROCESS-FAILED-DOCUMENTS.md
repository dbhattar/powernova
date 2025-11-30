# Reprocess Failed Documents Script

## Overview

This script reprocesses documents that failed with "No text extracted" errors by:
1. **Re-downloading from original URL** (not Azure Storage)
2. **Using improved extension detection** (URL parsing + Content-Type fallback)
3. **Re-extracting text** with enhanced error handling
4. **Updating the document** with new content
5. **Creating/resetting document job** for embedding generation

## Why Re-download from URL?

Instead of downloading from Azure Storage, we re-download from the original URL because:

✅ **Correct Extension Detection**: Uses the actual URL with improved parsing logic  
✅ **Content-Type Validation**: Gets fresh Content-Type header for fallback detection  
✅ **Source of Truth**: Original URL is the authoritative source  
✅ **Catches URL Changes**: Some documents may have been updated at the source  

## Features

### 1. Improved Extension Detection

The script uses the same two-stage detection logic as the crawler:

```python
# Stage 1: Extract from URL path
/DRIS-UG.pdf/82afc884-fdf6-3e41-4729-0047d3c56207 → "pdf"

# Stage 2: Fallback to Content-Type if no extension in URL
/api/download/12345 + Content-Type: application/pdf → "pdf"
```

### 2. Enhanced Error Handling

- Handles PDF extraction errors (EOF markers, encryption, corruption)
- Validates extracted text length (minimum 50 characters)
- Updates metadata with extraction warnings
- Preserves partial extraction if available

### 3. Smart Document Updates

- Only updates if extraction succeeds
- Sanitizes text (removes NULL bytes)
- Sets correct document type based on extension
- Uploads to Azure Storage if missing
- Resets embedding status for re-generation

### 4. Document Job Management

- Creates new DocumentJob if doesn't exist
- Resets existing job to PENDING status
- Clears error messages and retry counts
- Triggers embedding generation automatically

## Usage

### Preview Mode (Dry Run)

```bash
# See what would be reprocessed without making changes
python scripts/reprocess_failed_documents.py --dry-run --all
```

### Process Single Document

```bash
# Reprocess a specific document by ID
python scripts/reprocess_failed_documents.py --doc-id 12345
```

### Process All Failed Documents

```bash
# Reprocess all documents with "No text extracted" error
python scripts/reprocess_failed_documents.py --all
```

### Process with Limit

```bash
# Reprocess first 50 failed documents
python scripts/reprocess_failed_documents.py --all --limit 50
```

## Query to Find Affected Documents

```sql
-- Count failed documents by error type
SELECT 
    CASE 
        WHEN error_message LIKE '%No text extracted%' THEN 'No text extracted'
        WHEN error_message LIKE '%Extraction error%' THEN 'Extraction error'
        WHEN error_message LIKE '%Non-English%' THEN 'Non-English'
        ELSE 'Other'
    END as error_type,
    COUNT(*) as count
FROM documents
WHERE status = 'FAILED'
GROUP BY error_type
ORDER BY count DESC;

-- List specific documents to reprocess
SELECT 
    id,
    url,
    error_message,
    created_at
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%'
ORDER BY created_at DESC
LIMIT 100;
```

## Process Flow

```
┌─────────────────────────────┐
│   Find Failed Documents     │
│ (status=FAILED, error like  │
│  '%No text extracted%')     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Download from URL         │
│ (original source, not       │
│  Azure Storage)             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Determine Extension        │
│  1. Parse URL path          │
│  2. Check Content-Type      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Extract Text              │
│ (using improved logic)      │
└──────────┬──────────────────┘
           │
           ├─── Success? ────┐
           │                 │
           ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│  Update Doc     │  │  Update Error    │
│  - Set content  │  │  - Log failure   │
│  - Set status   │  │  - Keep FAILED   │
│  - Clear error  │  │                  │
└────────┬────────┘  └──────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Upload to Azure Storage    │
│  (if missing file_path)     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Create/Reset Document Job  │
│  - status = PENDING         │
│  - retry_count = 0          │
│  - Triggers embedding gen   │
└─────────────────────────────┘
```

## Output Example

```
2025-11-29 10:30:15 - __main__ - INFO - Found 127 failed documents to reprocess

============================================================
Processing 1/127
============================================================
2025-11-29 10:30:16 - __main__ - INFO - Processing document 1234: https://www.nyiso.com/documents/20142/3625950/DRIS-UG.pdf/82afc884-fdf6-3e41-4729-0047d3c56207?t=1746116843952
2025-11-29 10:30:16 - __main__ - INFO -   Current status: DocumentStatus.FAILED
2025-11-29 10:30:16 - __main__ - INFO -   Error message: No text extracted (0 pages - likely image-based PDF or corrupted)
2025-11-29 10:30:17 - __main__ - INFO - Downloading from URL: https://www.nyiso.com/documents/...
2025-11-29 10:30:18 - __main__ - INFO -   Determined extension 'pdf' from URL
2025-11-29 10:30:18 - __main__ - INFO -   Downloaded 2451234 bytes, extension: pdf
2025-11-29 10:30:19 - __main__ - INFO -   ✓ Successfully updated document (extracted 125678 chars)
2025-11-29 10:30:19 - __main__ - INFO -   ✓ Uploaded to Azure Storage: crawl-job-5/nyiso.com/DRIS-UG.pdf
2025-11-29 10:30:19 - __main__ - INFO -   ✓ Reset document job to PENDING

============================================================
SUMMARY
============================================================
Total documents: 127
Successfully reprocessed: 98
Failed to reprocess: 29
```

## Error Scenarios

### Still Fails After Reprocessing

If a document still fails after reprocessing:

1. **Check the updated error message** - It may provide more details
2. **Inspect metadata** - Look at `doc_metadata` field for error details
3. **Manual inspection** - Download the file manually and check:
   - Is it a valid PDF/DOCX?
   - Is it encrypted?
   - Is it an image-based scan?
   - Is it corrupted?

### Common Reasons for Continued Failure

- **Encrypted PDFs** - Requires password (error_type: `encrypted_pdf`)
- **Image-based PDFs** - Scanned documents with no text layer (need OCR)
- **Corrupted files** - Damaged file structure (error_type: `corrupted_xref`, `incomplete_pdf`)
- **Invalid URLs** - Document no longer available (404 errors)
- **Access restrictions** - Authentication required (401/403 errors)

## Database Impact

### Before Running Script

```sql
SELECT status, COUNT(*) 
FROM documents 
GROUP BY status;

-- Example output:
-- COMPLETED: 5,432
-- FAILED: 127
-- PROCESSING: 12
```

### After Running Script

```sql
SELECT status, COUNT(*) 
FROM documents 
GROUP BY status;

-- Example output:
-- COMPLETED: 5,530 (+98 recovered)
-- FAILED: 29 (-98, still 29 truly failed)
-- PROCESSING: 12
```

## Monitoring Reprocessing

### Check Document Jobs Created

```sql
SELECT 
    dj.status,
    COUNT(*) as count
FROM document_jobs dj
JOIN documents d ON d.id = dj.document_id
WHERE d.updated_at > NOW() - INTERVAL '1 hour'
GROUP BY dj.status;
```

### Track Embedding Progress

```sql
SELECT 
    COUNT(*) as total_pending,
    COUNT(CASE WHEN embedding_generated THEN 1 END) as completed,
    COUNT(CASE WHEN NOT embedding_generated THEN 1 END) as remaining
FROM documents
WHERE status = 'COMPLETED'
  AND updated_at > NOW() - INTERVAL '1 hour';
```

## Environment Requirements

### Required Environment Variables

The script uses `.env.local` file if available:

```bash
# Database connection
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Azure Storage (optional - only if uploading missing files)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..."
AZURE_STORAGE_CONTAINER_NAME="powernova-documents"
```

### Required Python Packages

```bash
pip install requests psycopg2-binary sqlalchemy PyPDF2 python-docx beautifulsoup4 azure-storage-blob
```

## Best Practices

### 1. Start with Dry Run

Always preview changes first:
```bash
python scripts/reprocess_failed_documents.py --dry-run --all
```

### 2. Process in Batches

For large numbers of documents, use `--limit`:
```bash
# Process 50 at a time
python scripts/reprocess_failed_documents.py --all --limit 50
```

### 3. Monitor Progress

Watch the logs and check database periodically:
```sql
SELECT status, COUNT(*) FROM documents GROUP BY status;
```

### 4. Handle Still-Failed Documents

After reprocessing, investigate documents that still fail:
```sql
SELECT id, url, error_message, doc_metadata
FROM documents
WHERE status = 'FAILED'
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY id;
```

## Comparison: Old vs New Approach

### Old Approach (Download from Azure Storage)
```
❌ Uses stored filename (may be wrong)
❌ No Content-Type header available
❌ Extension already determined (incorrectly)
❌ Can't leverage URL improvements
```

### New Approach (Download from Original URL)
```
✅ Uses actual source URL
✅ Gets fresh Content-Type header
✅ Applies improved extension detection
✅ Can handle URL pattern fixes
✅ Source of truth for content
```

## Related Documentation

- [FILE-EXTENSION-DETECTION.md](FILE-EXTENSION-DETECTION.md) - Extension detection improvements
- [PDF-EXTRACTION-ERROR-HANDLING.md](PDF-EXTRACTION-ERROR-HANDLING.md) - PDF error handling
- [FIX-BINARY-CONTENT.md](FIX-BINARY-CONTENT.md) - Binary content fixes

## Troubleshooting

### ImportError: No module named 'database'

Make sure you're running from the container directory:
```bash
cd /path/to/container
python scripts/reprocess_failed_documents.py --dry-run --all
```

### Azure Storage Connection Failed

If not uploading to Azure Storage, the script will continue with text extraction.
Azure upload is optional - it only uploads if `file_path` is missing.

### Timeout Errors

The script uses 30-second timeout for downloads. For slow connections:
- Process documents one at a time
- Increase timeout in the script (line 215)

## Future Enhancements

1. **Parallel Processing**: Process multiple documents concurrently
2. **Resume Support**: Save progress and resume after interruption
3. **Retry Logic**: Retry failed downloads with exponential backoff
4. **OCR Integration**: Add OCR for image-based PDFs
5. **Progress Bar**: Visual progress indicator for large batches
