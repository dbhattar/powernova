# Fixing PDF Documents with Binary Content

## Problem Summary

Some PDF documents in the database have raw binary bytes stored in the `content` column instead of extracted text. This causes several issues:

1. **Embedding Generation Failures**: Binary content can't be embedded
2. **Token Counting Errors**: Binary characters cause anomalies
3. **Text Processing Issues**: Language detection and chunking fail
4. **Query Failures**: Text search doesn't work on binary data

### Example of Binary Content

Instead of extracted text:
```
"This is a sample PDF document with readable text..."
```

The database contains:
```
"%PDF-1.4\n%âãÏÓ\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>endobj..."
```

## Root Cause

The issue occurs when:
1. PDF is downloaded during crawling
2. Document processor fails to extract text (silently or with error)
3. Raw PDF bytes are stored in `content` column instead of extracted text
4. Document status is marked as COMPLETED even though content is wrong

## Solution

We provide **3 methods** to fix these documents:

### Method 1: Jupyter Notebook (Recommended for Testing)
### Method 2: Python Script (Recommended for Production)
### Method 3: Direct SQL (Quick Fix)

---

## Method 1: Jupyter Notebook

**Best for**: Interactive testing, examining specific documents, understanding the problem

### Steps:

1. **Open the notebook**:
   ```bash
   # The notebook is at: notebooks/fix_binary_content.ipynb
   # Run in the container or locally with database access
   ```

2. **Run cells sequentially**:
   - Cell 1-3: Connect to database
   - Cell 4-5: Identify binary documents
   - Cell 6: Test on one document (DRY RUN)
   - Cell 7: Fix one document (set `DRY_RUN = False`)
   - Cell 8: Batch fix all documents

3. **Features**:
   - ✅ Binary content detection with detailed analysis
   - ✅ Preview extracted text before saving
   - ✅ Dry run mode to test safely
   - ✅ Batch processing with progress tracking
   - ✅ Generates SQL scripts for manual execution

### Example Output:

```
Found 15 PDF documents with potential binary content

1. ID: 123
   Title: Sample Document
   Content Length: 45,231 chars
   Preview: '%PDF-1.4\n%âãÏÓ\n1 0 obj...'
   
Testing binary detection:

Doc ID 123: True
  Reason: Starts with %PDF- magic bytes
  Preview: '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<...'

✓ Confirmed 15 documents with binary content

Processing Document ID: 123
  Downloading from Azure Storage: documents/job_5/doc_123.pdf
  Downloaded 234,567 bytes
  Extracting text from PDF...
  Extracted 12,345 chars
  
  Text preview (first 500 chars):
  This is the actual extracted text from the PDF document...
  
  ✓ Database updated and document job created
```

---

## Method 2: Python Script

**Best for**: Production fixes, automated processing, CLI usage

### Location:
```
scripts/fix_binary_pdfs.py
```

### Usage:

**Dry run (preview only)**:
```bash
# Inside container
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --dry-run --all

# Or limit to 10 documents
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --dry-run --all --limit 10
```

**Fix specific document**:
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --doc-id 123
```

**Fix all binary PDFs**:
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all
```

**Fix with limit**:
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all --limit 50
```

### Options:

- `--dry-run`: Preview changes without saving
- `--doc-id <ID>`: Process specific document
- `--all`: Process all binary PDFs
- `--limit <N>`: Maximum number of documents to process

### Example Output:

```
2025-11-27 10:30:00 - root - INFO - Finding binary documents...
2025-11-27 10:30:01 - root - INFO - Found 15 documents with binary content
2025-11-27 10:30:01 - root - WARNING - DRY RUN MODE - No changes will be saved

================================================================================
Processing 1/15: Document ID 123
================================================================================
2025-11-27 10:30:02 - root - INFO - Processing Document ID: 123
2025-11-27 10:30:02 - root - INFO -   Title: Sample Document
2025-11-27 10:30:02 - root - INFO -   URL: https://example.com/doc.pdf
2025-11-27 10:30:02 - root - INFO -   File Path: documents/job_5/doc_123.pdf
2025-11-27 10:30:02 - root - INFO -   Current content length: 45231 chars
2025-11-27 10:30:02 - root - INFO -   Is Binary: True - Starts with %PDF- magic bytes
2025-11-27 10:30:02 - root - INFO -   Downloading from Azure Storage: documents/job_5/doc_123.pdf
2025-11-27 10:30:03 - root - INFO -   Downloaded 234567 bytes
2025-11-27 10:30:03 - root - INFO -   Extracting text from PDF...
2025-11-27 10:30:04 - root - INFO -   Extracted 12345 chars
2025-11-27 10:30:04 - root - INFO -   New title: Sample Document
2025-11-27 10:30:04 - root - WARNING -   DRY RUN - Changes not saved

================================================================================
SUMMARY:
================================================================================
  Total: 15
  ✓ Success: 15
  ✗ Failed: 0
```

---

## Method 3: Direct SQL

**Best for**: Quick identification, manual inspection

### Identify Binary Documents:

```sql
-- Find all PDFs with binary content
SELECT 
    id,
    title,
    url,
    document_type,
    file_path,
    status,
    embedding_generated,
    LENGTH(content) as content_length,
    LEFT(content, 50) as content_preview
FROM documents
WHERE document_type = 'PDF'
  AND (
    content LIKE '%PDF-1.%'
    OR content LIKE '%âãÏÓ%'
    OR content LIKE '%endobj%'
  )
ORDER BY created_at DESC;
```

### Count by Status:

```sql
SELECT 
    status,
    COUNT(*) as count
FROM documents
WHERE content LIKE '%PDF-1.%'
GROUP BY status;
```

### Mark for Reprocessing:

```sql
-- Reset embedding flag (so they can be reprocessed)
UPDATE documents
SET 
    embedding_generated = FALSE,
    updated_at = NOW()
WHERE content LIKE '%PDF-1.%';

-- Create document jobs for reprocessing
INSERT INTO document_jobs (document_id, status, retry_count, created_at)
SELECT id, 'PENDING', 0, NOW()
FROM documents
WHERE content LIKE '%PDF-1.%'
ON CONFLICT (document_id) 
DO UPDATE SET 
    status = 'PENDING',
    retry_count = 0,
    error_message = NULL;
```

**⚠️ WARNING**: This SQL approach marks documents for reprocessing but **does NOT** fix the content. You still need to use Method 1 or 2 to re-extract text.

---

## How the Fix Works

### Step-by-Step Process:

1. **Identify Binary Content**:
   - Check if content starts with `%PDF-`
   - Count non-printable characters (>5% = binary)
   - Look for PDF binary markers (`endobj`, `stream`, etc.)

2. **Download Original File**:
   - Fetch PDF from Azure Storage using `file_path`
   - Original file is still intact (only DB content is wrong)

3. **Re-extract Text**:
   - Use PyPDF2 to extract text from downloaded PDF
   - Extract metadata (title, author, page count)
   - Clean up whitespace and formatting

4. **Update Database**:
   - Replace binary content with extracted text
   - Update title if metadata has better title
   - Update metadata field
   - Set `embedding_generated = FALSE`

5. **Create Document Job**:
   - Create or reset DocumentJob with `status = PENDING`
   - Document job processor will generate embeddings
   - Embeddings will be based on correct text content

### What Gets Updated:

```python
document.title = extracted_title           # Better title from PDF metadata
document.content = extracted_text          # Clean text instead of binary
document.doc_metadata = metadata           # Author, page count, etc.
document.embedding_generated = False       # Trigger re-embedding
```

---

## Binary Content Detection Logic

### Detection Function:

```python
def is_binary_content(content: str) -> Tuple[bool, str]:
    """Detect if content is binary."""
    
    # Check 1: PDF magic bytes
    if content.startswith('%PDF-'):
        return (True, "Starts with %PDF- magic bytes")
    
    # Check 2: High non-printable character ratio
    sample = content[:5000]
    non_printable = sum(1 for c in sample if ord(c) < 32 and c not in '\n\r\t')
    if (non_printable / len(sample)) > 0.05:  # >5%
        return (True, f"High non-printable ratio: {non_printable/len(sample)*100:.1f}%")
    
    # Check 3: PDF binary markers
    binary_markers = ['%%EOF', '/Type', 'endobj', 'stream', 'endstream']
    marker_count = sum(1 for m in binary_markers if m in content[:1000])
    if marker_count >= 3:
        return (True, f"Contains {marker_count} PDF binary markers")
    
    return (False, "Appears to be text content")
```

### Why This Works:

- **Magic Bytes**: All PDFs start with `%PDF-1.x`
- **Non-Printable Characters**: Text has <5%, binary has >5%
- **PDF Markers**: Binary PDFs contain structural markers like `endobj`, `stream`

---

## Safety Features

### Dry Run Mode:

Both the notebook and script support dry run mode:
- Downloads file from Azure ✓
- Extracts text ✓
- Shows preview ✓
- **Does NOT save to database** ✓

Use this to verify the fix works before committing changes.

### Transaction Safety:

- All database updates are wrapped in transactions
- On error, changes are rolled back
- No partial updates

### Logging:

- Detailed logging at each step
- Shows before/after content length
- Previews extracted text
- Records errors with stack traces

---

## Troubleshooting

### Issue 1: "Failed to download from Azure Storage"

**Cause**: File doesn't exist at `file_path` or Azure credentials wrong

**Solution**:
```bash
# Check Azure connection
docker exec powernova-api python -c "from services.azure_storage import get_storage_service; s = get_storage_service(); print('✓ Connected')"

# Verify file exists
docker exec powernova-api python -c "from services.azure_storage import get_storage_service; s = get_storage_service(); data = s.download_document('YOUR_FILE_PATH'); print(f'Downloaded {len(data)} bytes')"
```

### Issue 2: "Failed to extract text from PDF"

**Cause**: PDF is corrupted, encrypted, or image-based (scanned)

**Solution**:
- Check PDF manually
- For image PDFs, need OCR (not currently supported)
- For encrypted PDFs, need password (not currently supported)

### Issue 3: "Database connection refused"

**Cause**: Not running inside container or wrong credentials

**Solution**:
```bash
# Run inside container
docker exec -it powernova-api bash
cd /app
python scripts/fix_binary_pdfs.py --dry-run --all
```

### Issue 4: No documents found

**Cause**: Query might be too restrictive

**Solution**: Use the comprehensive query in Section 9 of the notebook

---

## Prevention

To prevent binary content from being stored in the future:

### 1. Add Validation in Crawler:

```python
# In crawler.py, after extracting text
if doc_type == 'PDF':
    # Validate extraction succeeded
    if not text_content or len(text_content) < 100:
        logger.error(f"PDF text extraction failed: {url}")
        raise Exception("Failed to extract text from PDF")
    
    # Validate it's not binary
    if text_content.startswith('%PDF-'):
        logger.error(f"Binary content detected instead of text: {url}")
        raise Exception("Binary content in text field")
```

### 2. Add Database Constraint:

```sql
-- Add check constraint (optional, might be too strict)
ALTER TABLE documents
ADD CONSTRAINT check_no_binary_content
CHECK (
    document_type != 'PDF' 
    OR content NOT LIKE '%PDF-1.%'
);
```

### 3. Monitor Document Jobs:

Watch for documents that fail embedding:
```sql
SELECT d.id, d.title, d.url, dj.error_message
FROM documents d
JOIN document_jobs dj ON d.id = dj.document_id
WHERE dj.status = 'FAILED'
  AND dj.error_message LIKE '%token%'
ORDER BY dj.updated_at DESC;
```

---

## Recommended Workflow

### For First-Time Fix:

1. **Identify scope**:
   ```bash
   docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --dry-run --all
   ```

2. **Test on one document**:
   ```bash
   docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --dry-run --doc-id 123
   ```

3. **Fix small batch**:
   ```bash
   docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all --limit 10
   ```

4. **Verify results**:
   ```sql
   SELECT id, title, LENGTH(content), LEFT(content, 100)
   FROM documents
   WHERE id IN (123, 124, 125);  -- IDs you just fixed
   ```

5. **Fix remaining**:
   ```bash
   docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all
   ```

6. **Monitor re-embedding**:
   - Check admin dashboard → Document Processing Jobs
   - Jobs should be created and processed automatically
   - Watch for failures

### For Ongoing Monitoring:

1. **Weekly check**:
   ```sql
   SELECT COUNT(*)
   FROM documents
   WHERE document_type = 'PDF'
     AND content LIKE '%PDF-1.%';
   ```

2. **If found, fix immediately**:
   ```bash
   docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all
   ```

---

## Files Included

1. **`notebooks/fix_binary_content.ipynb`**
   - Interactive Jupyter notebook
   - Step-by-step guided process
   - Detailed analysis and testing

2. **`scripts/fix_binary_pdfs.py`**
   - Command-line script
   - Production-ready
   - Logging and error handling

3. **`docs/FIX-BINARY-CONTENT.md`**
   - This documentation file
   - Complete guide and troubleshooting

---

## Summary

**Problem**: Raw PDF binary in `content` column instead of extracted text

**Solution**: Re-download from Azure and re-extract text

**Methods**:
- Notebook: Interactive, testing
- Script: Production, automated
- SQL: Quick identification

**Safety**: Dry run mode, transactions, detailed logging

**Prevention**: Add validation in crawler, monitor document jobs

---

## Questions?

- Check Jupyter notebook for interactive examples
- Run script with `--dry-run` to preview changes
- Check logs in `/app/logs/` for errors
- Review admin dashboard for re-embedding progress

