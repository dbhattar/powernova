# Crawler NULL Byte Sanitization Fix

**Date:** November 23, 2025  
**Issue:** PostgreSQL NULL byte error during document crawling  
**Status:** ✅ Fixed

## Problem Description

The crawler was failing when processing certain PDF documents and other binary files with the following error:

```
Failed to save document https://www.pjm.com/.../document.pdf: 
A string literal cannot contain NUL (0x00) characters.

This Session's transaction has been rolled back due to a previous exception during flush.
```

### Root Cause

PostgreSQL's TEXT columns cannot store NULL bytes (`\x00`). When the document processor extracted text content from binary files (especially PDFs), the extracted text sometimes contained NULL bytes embedded in the content. When trying to save this to the database, PostgreSQL rejected it.

The error then cascaded because:
1. Initial exception occurred during `db.commit()`
2. Transaction was left in a failed state
3. Subsequent database operations failed with "transaction rolled back" error
4. Entire crawl job crashed

## Solution

### 1. Text Sanitization Method

Added a `_sanitize_text()` method to remove NULL bytes from text content:

```python
def _sanitize_text(self, text: Optional[str]) -> Optional[str]:
    """
    Sanitize text content to remove NULL bytes and other problematic characters.
    PostgreSQL TEXT columns cannot contain NULL (0x00) bytes.
    
    Args:
        text: Text to sanitize
        
    Returns:
        Sanitized text or None if input is None
    """
    if text is None:
        return None
    
    # Remove NULL bytes (0x00) which PostgreSQL doesn't allow in TEXT columns
    sanitized = text.replace('\x00', '')
    
    return sanitized
```

### 2. Applied Sanitization

Sanitized all text fields before database insertion:

- **Document title** - `sanitized_title = self._sanitize_text(title)`
- **Document content** - `sanitized_content = self._sanitize_text(text_content)`
- **Error messages** - `error_message=self._sanitize_text(str(e))`

Applied in:
- `_save_fetched_document()` - Main document saving method
- `_download_and_save_document()` - Legacy download method
- `run()` - Job-level error handler
- `run_crawler()` - Top-level error handler

### 3. Transaction Rollback

Added `db.rollback()` in all exception handlers to prevent cascading transaction errors:

```python
except Exception as e:
    logger.error(f"Failed to save document {url}: {e}")
    
    # Rollback the failed transaction
    self.db.rollback()
    
    # Now safe to create new document record
    document = Document(...)
    self.db.add(document)
    self.db.commit()
```

## Files Modified

- `api/services/crawler.py`:
  - Added `_sanitize_text()` method (line ~125)
  - Updated `_download_and_save_document()` - sanitize title, content, error_message
  - Updated `_save_fetched_document()` - sanitize title, content, error_message
  - Updated `run()` - rollback + sanitize error_message
  - Updated `run_crawler()` - rollback + sanitize error_message

## Testing

The fix handles:
- ✅ PDF documents with embedded NULL bytes
- ✅ Binary file text extraction errors
- ✅ Error messages containing NULL bytes
- ✅ Transaction rollback and recovery
- ✅ Continuation of crawl after individual document failures

## Impact

**Before Fix:**
- Crawl jobs crashed completely when encountering problematic PDFs
- Database left in inconsistent state
- Lost all progress from the crawl

**After Fix:**
- Individual document failures are logged but don't crash the crawl
- Failed documents are marked with sanitized error messages
- Crawl continues processing remaining URLs
- Database transactions are properly managed

## Deployment

```bash
# Restart API container to apply fix
docker restart powernova-api

# Verify startup
docker logs powernova-api --tail 20
```

## Notes

- The NULL byte removal is safe for text content as NULL bytes shouldn't appear in valid UTF-8 text
- The original binary files are preserved in Azure Blob Storage unchanged
- Only the extracted text content (for search/RAG) is sanitized
- This fix is defensive and handles edge cases in PDF text extraction libraries

## Related Issues

- Error occurred during crawl job #12 on PJM website
- Multiple PDF documents from pjm.com contained NULL bytes in extracted text
- Similar issues may occur with other binary document formats (DOCX, etc.)

## Future Improvements

Consider:
1. Better PDF text extraction library that handles binary content more robustly
2. Content validation before database insertion
3. Structured logging of sanitization events for analysis
4. Metadata tracking of documents that required sanitization
