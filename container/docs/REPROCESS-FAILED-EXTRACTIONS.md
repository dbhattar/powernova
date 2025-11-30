# Reprocessing Failed Document Extractions

## Overview

The `reprocess_failed_extractions.py` script identifies and reprocesses documents that failed text extraction with "No text extracted" errors. This is useful after:
- Fixing bugs in the document processor
- Installing missing dependencies (e.g., PyCryptodome)
- Improving extraction logic (e.g., better PDF handling)
- Updating file extension detection

## When to Use

Use this script when:
- ✅ Documents failed with "No text extracted" errors
- ✅ You've fixed the underlying extraction issue
- ✅ You want to retry extraction without re-crawling
- ✅ You've improved PDF/DOCX extraction logic
- ✅ You've added support for new file types

**Don't use** when:
- ❌ Original files are no longer in Azure Storage
- ❌ The extraction issue hasn't been fixed yet
- ❌ Documents failed for other reasons (use appropriate fix script)

## How It Works

```
┌─────────────────────────────────┐
│ Find FAILED documents with      │
│ "No text extracted" error       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Download original file from     │
│ Azure Storage (blob_path)       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Re-extract text using           │
│ document_processor              │
└────────────┬────────────────────┘
             │
             ├─── Still fails? ──► Update error message
             │
             ▼
┌─────────────────────────────────┐
│ Update document:                │
│ - title, content, metadata      │
│ - status = COMPLETED            │
│ - embedding_generated = False   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Create/reset DocumentJob        │
│ for re-embedding                │
└─────────────────────────────────┘
```

## Usage

### Prerequisites

```bash
# Ensure you're in the container directory
cd /path/to/powernova/container

# Install required packages (if running locally)
pip install psycopg2-binary sqlalchemy azure-storage-blob PyPDF2 python-docx beautifulsoup4

# Set up environment variables
# Create .env.local with Azure Storage connection string
cat > .env.local << 'EOF'
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=..."
AZURE_STORAGE_CONTAINER_NAME="powernova-documents"
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
EOF
```

### Basic Commands

#### 1. Dry Run (See What Would Happen)

```bash
# See all failed documents that would be reprocessed
python scripts/reprocess_failed_extractions.py --dry-run --all

# See what would happen for a specific document
python scripts/reprocess_failed_extractions.py --dry-run --doc-id 123
```

**Output:**
```
[DRY RUN] Reprocessing document 123: https://example.com/doc.pdf
  Current error: No text extracted (10 pages - likely image-based PDF or corrupted)
  File path: crawl_jobs/1/documents/doc_abc123.pdf
  Document type: PDF
  [DRY RUN] Would download from Azure and reprocess
```

#### 2. Reprocess Single Document

```bash
# Reprocess a specific document by ID
python scripts/reprocess_failed_extractions.py --doc-id 123
```

**Output:**
```
Reprocessing document 123: https://example.com/doc.pdf
  Current error: No text extracted
  File path: crawl_jobs/1/documents/doc_abc123.pdf
  Document type: PDF
  Downloading from Azure Storage: crawl_jobs/1/documents/doc_abc123.pdf
  Downloaded 256000 bytes
  Using file extension: pdf
  Extracting text...
  ✓ Successfully extracted 12500 chars of text
  Creating new document job
  ✓ Document 123 successfully reprocessed and queued for embedding
```

#### 3. Reprocess All Failed Documents

```bash
# Reprocess all documents (will prompt for confirmation)
python scripts/reprocess_failed_extractions.py --all

# Limit to first 50 documents
python scripts/reprocess_failed_extractions.py --all --limit 50

# Reprocess without confirmation (use with caution)
yes | python scripts/reprocess_failed_extractions.py --all
```

#### 4. Filter by Error Pattern

```bash
# Only reprocess image-based PDFs
python scripts/reprocess_failed_extractions.py --all --error-pattern "image-based"

# Only reprocess corrupted files
python scripts/reprocess_failed_extractions.py --all --error-pattern "corrupted"

# Only reprocess encrypted PDFs
python scripts/reprocess_failed_extractions.py --all --error-pattern "encrypted"
```

### Advanced Usage

#### Batch Processing with Monitoring

```bash
# Process in batches of 100
for i in {1..5}; do
  echo "Batch $i"
  python scripts/reprocess_failed_extractions.py --all --limit 100
  sleep 5
done
```

#### Combine with Dry Run for Analysis

```bash
# First, see what would happen
python scripts/reprocess_failed_extractions.py --dry-run --all > reprocess_preview.txt

# Review the preview
cat reprocess_preview.txt

# Then actually run it
python scripts/reprocess_failed_extractions.py --all --limit 10
```

## Output Examples

### Success Case

```
[1/5] Processing document 456...
Reprocessing document 456: https://nyiso.com/doc.pdf
  Current error: No text extracted
  File path: crawl_jobs/2/documents/doc_xyz789.pdf
  Document type: PDF
  Downloading from Azure Storage: crawl_jobs/2/documents/doc_xyz789.pdf
  Downloaded 512000 bytes
  Using file extension: pdf
  Extracting text...
  ✓ Successfully extracted 25000 chars of text
  Creating new document job
  ✓ Document 456 successfully reprocessed and queued for embedding
```

### Partial Extraction

```
[2/5] Processing document 789...
Reprocessing document 789: https://example.com/report.pdf
  Current error: No text extracted (20 pages)
  File path: crawl_jobs/3/documents/report_def012.pdf
  Document type: PDF
  Downloading from Azure Storage: crawl_jobs/3/documents/report_def012.pdf
  Downloaded 1024000 bytes
  Using file extension: pdf
  Extracting text...
  Partial extraction: 5/20 pages failed to extract
  ✓ Successfully extracted 15000 chars of text
  Creating new document job
  ✓ Document 789 successfully reprocessed and queued for embedding
```

### Still Failing

```
[3/5] Processing document 101...
Reprocessing document 101: https://example.com/scan.pdf
  Current error: No text extracted (15 pages - likely image-based PDF)
  File path: crawl_jobs/4/documents/scan_ghi345.pdf
  Document type: PDF
  Downloading from Azure Storage: crawl_jobs/4/documents/scan_ghi345.pdf
  Downloaded 2048000 bytes
  Using file extension: pdf
  Extracting text...
  Still insufficient text extracted: 0 chars
  ✗ Failed to reprocess document 101: Still no extractable text
```

### Final Summary

```
============================================================
SUMMARY
============================================================
Total documents: 5
Successfully reprocessed: 3
Failed to reprocess: 2
============================================================

Successfully reprocessed 3 documents
Documents have been queued for re-embedding
```

## Database Queries

### Find Candidates for Reprocessing

```sql
-- All failed documents with extraction errors
SELECT 
    id,
    url,
    error_message,
    document_type,
    file_size,
    created_at
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%'
ORDER BY created_at DESC;

-- Count by error type
SELECT 
    CASE 
        WHEN error_message LIKE '%image-based%' THEN 'image-based'
        WHEN error_message LIKE '%corrupted%' THEN 'corrupted'
        WHEN error_message LIKE '%encrypted%' THEN 'encrypted'
        ELSE 'other'
    END as error_type,
    COUNT(*) as count
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%'
GROUP BY error_type;

-- Documents without file_path (can't be reprocessed)
SELECT COUNT(*)
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%'
  AND (file_path IS NULL OR file_path = '');
```

### Verify Reprocessing Results

```sql
-- Check recently reprocessed documents
SELECT 
    id,
    url,
    status,
    LENGTH(content) as content_length,
    embedding_generated,
    updated_at
FROM documents
WHERE id IN (123, 456, 789)  -- IDs of reprocessed docs
ORDER BY updated_at DESC;

-- Check document jobs for reprocessed docs
SELECT 
    dj.id,
    dj.document_id,
    dj.status,
    dj.error_message,
    dj.created_at,
    d.url
FROM document_jobs dj
JOIN documents d ON d.id = dj.document_id
WHERE dj.document_id IN (123, 456, 789)
ORDER BY dj.created_at DESC;
```

## Troubleshooting

### Error: "Failed to download document from Azure Storage"

**Problem**: Original file not found in Azure Storage

**Solution**:
```bash
# Check if blob exists in Azure
az storage blob list \
  --account-name powernovaprod \
  --container-name powernova-documents \
  --prefix "crawl_jobs/" \
  --query "[?name=='crawl_jobs/1/documents/doc.pdf']"

# If blob doesn't exist, document cannot be reprocessed
# You'll need to re-crawl the URL
```

### Error: "Module not found"

**Problem**: Missing Python dependencies

**Solution**:
```bash
# Install all required packages
pip install -r api/requirements.txt

# Or install individually
pip install psycopg2-binary sqlalchemy azure-storage-blob PyPDF2 python-docx beautifulsoup4
```

### Error: "Database connection failed"

**Problem**: DATABASE_URL not set or incorrect

**Solution**:
```bash
# Check .env.local exists
cat .env.local | grep DATABASE_URL

# Verify connection
psql "$DATABASE_URL" -c "SELECT 1"

# Or test in Python
python -c "from database.session import SessionLocal; db = SessionLocal(); print('Connected!')"
```

### Still Getting "No text extracted"

**Possible causes:**

1. **Image-based PDFs** (scanned documents)
   - Solution: Requires OCR (not yet implemented)
   - Workaround: Mark as image-based, process separately

2. **Corrupted PDF structure**
   - Solution: May not be fixable
   - Workaround: Check if original URL has updated version

3. **Encrypted PDFs with password**
   - Solution: Need password to decrypt
   - Workaround: Skip or contact document owner

4. **Wrong file type detection**
   - Solution: Check Content-Type vs actual file type
   - Check: `file <downloaded_file>` in terminal

## Best Practices

### 1. Always Dry Run First

```bash
# See what would happen before making changes
python scripts/reprocess_failed_extractions.py --dry-run --all
```

### 2. Process in Batches

```bash
# Don't process thousands at once
python scripts/reprocess_failed_extractions.py --all --limit 100
```

### 3. Monitor Results

```bash
# Check logs
tail -f logs/reprocess_$(date +%Y%m%d).log

# Check database
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) 
  FROM documents 
  WHERE updated_at > NOW() - INTERVAL '1 hour'
  GROUP BY status
"
```

### 4. Verify Embeddings

```bash
# After reprocessing, check that document jobs are running
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) 
  FROM document_jobs 
  WHERE status = 'PENDING'
"

# Monitor embedding generation
python scripts/check_embedding_queue.py
```

## Related Scripts

- `scripts/fix_binary_pdfs.py` - Fix PDFs with binary content instead of extracted text
- `scripts/check_extraction_errors.py` - Analyze extraction error patterns
- `scripts/resume_crawl_job.py` - Resume interrupted crawl jobs

## Related Documentation

- [PDF Extraction Error Handling](PDF-EXTRACTION-ERROR-HANDLING.md)
- [File Extension Detection](FILE-EXTENSION-DETECTION.md)
- [Binary Content Fix](FIX-BINARY-CONTENT.md)

## Automation

### Cron Job for Periodic Reprocessing

```bash
# Add to crontab
0 2 * * * cd /path/to/container && python scripts/reprocess_failed_extractions.py --all --limit 50 >> logs/reprocess.log 2>&1
```

### Post-Deployment Hook

```bash
# After deploying PDF extraction fixes
./scripts/azure-deploy-api.sh
python scripts/reprocess_failed_extractions.py --all --limit 100
```

## Success Metrics

Track reprocessing success rate:

```sql
-- Before reprocessing
SELECT COUNT(*) as failed_count
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%No text extracted%';

-- After reprocessing
SELECT 
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM documents
WHERE id IN (
    SELECT id FROM documents
    WHERE status = 'FAILED'
      AND error_message LIKE '%No text extracted%'
      AND updated_at > NOW() - INTERVAL '1 day'
)
GROUP BY status;
```

Expected success rate: 60-80% after fixing extraction bugs.

## Future Improvements

1. **OCR Integration** - Process image-based PDFs with OCR
2. **Concurrent Processing** - Process multiple documents in parallel
3. **Progress Bar** - Add tqdm for better visual feedback
4. **Retry Logic** - Exponential backoff for transient Azure errors
5. **Webhook Notifications** - Notify when reprocessing completes
