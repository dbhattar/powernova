# PDF Extraction Error Handling

## Overview

The document processor now handles corrupted, incomplete, and problematic PDF files gracefully, providing detailed error information and preventing system failures.

## Common PDF Errors

### 1. EOF Marker Not Found

**Error**: `EOF marker not found`

**Cause**: PDF file is incomplete or corrupted - missing the end-of-file marker (`%%EOF`)

**Handling**:
- PyPDF2 reader attempts extraction with `strict=False` mode
- Metadata is extracted if possible
- Individual pages are processed, skipping corrupted ones
- Document is saved with error metadata

**Metadata Added**:
```json
{
  "error": "Incomplete PDF - EOF marker missing",
  "error_type": "incomplete_pdf",
  "page_count": 10,
  "failed_pages": 3,
  "successful_pages": 7,
  "extraction_warning": "3/10 pages failed to extract"
}
```

### 2. Encrypted PDFs

**Error**: `File has not been decrypted`

**Cause**: PDF is password-protected

**Handling**:
- Extraction fails immediately
- Document marked as FAILED
- Error metadata indicates encryption

**Metadata Added**:
```json
{
  "error": "Encrypted PDF - password required",
  "error_type": "encrypted_pdf"
}
```

### 3. Corrupted Cross-Reference Table

**Error**: `xref table read error`

**Cause**: PDF's cross-reference table is damaged

**Handling**:
- Lenient mode attempts to bypass corruption
- Partial extraction attempted
- Error logged with specific category

**Metadata Added**:
```json
{
  "error": "Corrupted PDF - cross-reference table damaged",
  "error_type": "corrupted_xref"
}
```

### 4. Image-Based PDFs (Scanned Documents)

**Symptoms**: 
- No error thrown
- Zero text extracted
- Page count > 0

**Handling**:
- Detected by checking text length vs page count
- Document marked as FAILED
- Metadata indicates likely scanned PDF

**Metadata Added**:
```json
{
  "page_count": 15,
  "extraction_warning": "PDF may be image-based (scanned) or corrupted"
}
```

**Error Message**: `No text extracted (15 pages - likely image-based PDF or corrupted)`

---

## Improved PDF Extraction Logic

### Flow Diagram

```
PDF Download
    ↓
Try extraction with strict=False
    ↓
Extract metadata (best effort)
    ↓
For each page:
    - Try to extract text
    - Log failures but continue
    ↓
Check results:
    - Any text extracted? → Continue
    - No text but pages exist? → Mark as image-based
    - Critical error? → Mark as failed with error type
    ↓
Return (title, text, metadata)
```

### Code Changes

**Before**:
```python
def extract_text_from_pdf(pdf_content: bytes, url: str):
    try:
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_content))
        # Extract all pages
        # ...
    except Exception as e:
        logger.error(f"Failed: {e}")
        return url, "", {}
```

**After**:
```python
def extract_text_from_pdf(pdf_content: bytes, url: str):
    title = url
    text = ""
    metadata = {}
    
    try:
        # Try lenient mode first
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_content), strict=False)
        
        # Extract metadata (may fail)
        try:
            # Extract metadata...
        except Exception:
            metadata['extraction_warning'] = 'Metadata extraction failed'
        
        # Extract text page by page
        failed_pages = 0
        for page_num in range(len(pdf_reader.pages)):
            try:
                # Extract page text...
            except Exception:
                failed_pages += 1
                continue
        
        # Add extraction statistics
        if failed_pages > 0:
            metadata['failed_pages'] = failed_pages
            metadata['extraction_warning'] = f'{failed_pages}/{total} pages failed'
        
        return title, text, metadata
        
    except PyPDF2.errors.PdfReadError as e:
        # Categorize specific PDF errors
        if 'EOF marker not found' in str(e):
            metadata['error'] = 'Incomplete PDF - EOF marker missing'
            metadata['error_type'] = 'incomplete_pdf'
        # ... other error types
        
        return title, text, metadata
```

---

## Crawler Integration

The crawler now checks extraction results and handles errors appropriately:

### Error Detection

```python
# After extraction
title, text_content, metadata = self.document_processor.process_document(...)

# Check for extraction errors
extraction_error = metadata.get('error')
error_type = metadata.get('error_type')
extraction_warning = metadata.get('extraction_warning')
```

### Error Handling Flow

1. **Critical Extraction Error** (`error` field present):
   ```python
   if extraction_error:
       # Save as FAILED with error details
       document = Document(
           status=DocumentStatus.FAILED,
           error_message=f"Extraction error: {extraction_error}",
           doc_metadata=metadata,  # Includes error_type
           content=text_content[:1000],  # Partial content if any
       )
       return False  # Skip processing
   ```

2. **Partial Extraction Warning** (`extraction_warning` field):
   ```python
   if extraction_warning:
       logger.warning(f"Partial extraction: {extraction_warning}")
       # Continue processing with available text
   ```

3. **Insufficient Text** (< 50 characters):
   ```python
   if not text_content or len(text_content.strip()) < 50:
       error_msg = "No text extracted"
       if metadata.get('page_count', 0) > 0:
           error_msg += " (likely image-based PDF)"
       
       # Save as FAILED
       document = Document(
           status=DocumentStatus.FAILED,
           error_message=error_msg,
       )
       return False
   ```

---

## Database Schema Updates

### Document Status

Documents with extraction errors are marked as `FAILED` with descriptive error messages.

### Error Message Examples

- `"Extraction error: Incomplete PDF - EOF marker missing"`
- `"Extraction error: Encrypted PDF - password required"`
- `"Extraction error: Corrupted PDF - cross-reference table damaged"`
- `"No text extracted (15 pages - likely image-based PDF or corrupted)"`

### Metadata Fields

New metadata fields added for error tracking:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `error` | string | Error description | `"Incomplete PDF - EOF marker missing"` |
| `error_type` | string | Error category | `"incomplete_pdf"` |
| `extraction_warning` | string | Non-fatal issues | `"3/10 pages failed to extract"` |
| `page_count` | int | Total pages | `10` |
| `failed_pages` | int | Pages that failed | `3` |
| `successful_pages` | int | Pages extracted | `7` |

---

## Querying Failed Extractions

### Find All Extraction Errors

```sql
SELECT 
    id,
    title,
    url,
    error_message,
    doc_metadata->>'error_type' as error_type,
    doc_metadata->>'page_count' as pages,
    created_at
FROM documents
WHERE status = 'FAILED'
  AND doc_metadata ? 'error_type'
ORDER BY created_at DESC;
```

### Group by Error Type

```sql
SELECT 
    doc_metadata->>'error_type' as error_type,
    COUNT(*) as count
FROM documents
WHERE status = 'FAILED'
  AND doc_metadata ? 'error_type'
GROUP BY doc_metadata->>'error_type'
ORDER BY count DESC;
```

### Find Image-Based PDFs

```sql
SELECT id, title, url, error_message
FROM documents
WHERE status = 'FAILED'
  AND error_message LIKE '%image-based%'
ORDER BY created_at DESC;
```

### Find Partially Extracted Documents

```sql
SELECT 
    id,
    title,
    doc_metadata->>'failed_pages' as failed,
    doc_metadata->>'successful_pages' as successful,
    doc_metadata->>'extraction_warning' as warning
FROM documents
WHERE status = 'COMPLETED'
  AND doc_metadata ? 'failed_pages'
ORDER BY (doc_metadata->>'failed_pages')::int DESC;
```

---

## Monitoring and Alerts

### Log Patterns to Watch

**Critical Errors**:
```
ERROR - Document extraction failed for {url}: {error}
```

**Warnings**:
```
WARNING - Partial extraction for {url}: {warning}
WARNING - Insufficient text content extracted from {url}
```

**Success with Issues**:
```
INFO - Extracted {chars} chars from PDF ({total} pages, {failed} failed)
```

### Metrics to Track

1. **Extraction Failure Rate**:
   ```sql
   SELECT 
       COUNT(CASE WHEN status = 'FAILED' AND doc_metadata ? 'error_type' THEN 1 END) * 100.0 / COUNT(*) as failure_rate
   FROM documents
   WHERE document_type = 'PDF'
     AND created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Error Type Distribution**:
   ```sql
   SELECT 
       doc_metadata->>'error_type',
       COUNT(*)
   FROM documents
   WHERE status = 'FAILED'
     AND doc_metadata ? 'error_type'
     AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY doc_metadata->>'error_type';
   ```

3. **Partial Extraction Rate**:
   ```sql
   SELECT 
       COUNT(CASE WHEN doc_metadata ? 'failed_pages' THEN 1 END) * 100.0 / COUNT(*) as partial_rate
   FROM documents
   WHERE document_type = 'PDF'
     AND status = 'COMPLETED'
     AND created_at > NOW() - INTERVAL '24 hours';
   ```

---

## Future Improvements

### 1. OCR for Image-Based PDFs

**Current**: Image-based PDFs are marked as failed

**Future**: Integrate OCR (Tesseract, Azure Computer Vision)
```python
if metadata.get('extraction_warning') == 'PDF may be image-based':
    # Try OCR extraction
    text = ocr_service.extract_text_from_pdf(pdf_content)
```

### 2. Alternative PDF Libraries

**Current**: Only PyPDF2

**Future**: Fallback to other libraries
```python
try:
    # Try PyPDF2 first
    text = extract_with_pypdf2(pdf_content)
except:
    try:
        # Fallback to pdfplumber
        text = extract_with_pdfplumber(pdf_content)
    except:
        # Last resort: pdfminer
        text = extract_with_pdfminer(pdf_content)
```

### 3. PDF Repair

**Current**: Corrupted PDFs fail

**Future**: Attempt repair before extraction
```python
if metadata.get('error_type') == 'incomplete_pdf':
    # Try to repair PDF
    repaired_pdf = pdf_repair_service.repair(pdf_content)
    # Retry extraction
```

### 4. Encryption Handling

**Current**: Encrypted PDFs fail

**Future**: Support common passwords
```python
if metadata.get('error_type') == 'encrypted_pdf':
    # Try common passwords
    for password in ['', 'password', 'PDF', etc.]:
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_file, password=password)
            # Success!
        except:
            continue
```

---

## Testing

### Test Cases

1. **Incomplete PDF** (EOF marker missing)
2. **Encrypted PDF** (password-protected)
3. **Corrupted xref** (damaged cross-reference)
4. **Image-based PDF** (scanned document)
5. **Partially corrupted** (some pages fail)
6. **Valid PDF** (should extract normally)

### Manual Test

```python
# Test with problematic PDF
from services.document_processor import get_document_processor

processor = get_document_processor()

# Load test PDF
with open('test_corrupted.pdf', 'rb') as f:
    pdf_bytes = f.read()

# Extract
title, text, metadata = processor.extract_text_from_pdf(pdf_bytes, 'test.pdf')

# Check results
print(f"Title: {title}")
print(f"Text length: {len(text)}")
print(f"Metadata: {metadata}")
print(f"Error: {metadata.get('error')}")
print(f"Error type: {metadata.get('error_type')}")
```

---

## Summary

### Benefits

✅ **Graceful Degradation**: System continues even with corrupted PDFs
✅ **Detailed Error Reporting**: Know exactly why extraction failed
✅ **Partial Extraction**: Get text from valid pages even if some fail
✅ **Error Categorization**: Different error types for different problems
✅ **Monitoring Ready**: Easy to query and track extraction issues
✅ **Future-Proof**: Metadata structure supports future improvements

### Impact

- **Before**: One corrupted PDF could crash the crawler
- **After**: Corrupted PDFs are logged, categorized, and skipped gracefully

### Files Modified

1. `api/services/document_processor.py` - Improved PDF extraction
2. `api/services/crawler.py` - Enhanced error handling in crawler
3. `docs/PDF-EXTRACTION-ERROR-HANDLING.md` - This documentation
