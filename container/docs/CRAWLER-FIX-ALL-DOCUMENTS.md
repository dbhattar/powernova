# Crawler Fix - Downloading All Document Types

## Issue Identified

The crawler was only uploading HTML pages, missing PDFs, DOCX files, and other document types.

## Root Cause

The original crawler logic had a fundamental flaw:

**Before Fix:**
```python
# 1. Check if URL has a file extension (e.g., .pdf)
if self._is_document_url(url):
    self._download_and_save_document(url, depth)
    return

# 2. If no extension, fetch as HTML
response = self.session.get(url, timeout=30)

# 3. If not HTML content type, SKIP IT!
if 'text/html' not in content_type.lower():
    logger.debug(f"Skipping non-HTML content: {content_type}")
    return  # ❌ PDFs and other docs were skipped here!
```

### Why This Failed

1. **URL-based detection is unreliable**: Many documents are served through URLs without extensions:
   - ✅ `https://example.com/doc.pdf` - Would work
   - ❌ `https://example.com/download?id=123` - Would skip even if it's a PDF!
   - ❌ `https://example.com/api/file/456` - Would skip
   - ❌ `https://example.com/resources/whitepaper` - Would skip

2. **Content-Type was checked AFTER deciding to skip**: The crawler would fetch the URL, see it wasn't HTML based on Content-Type, then throw it away instead of checking if it was a PDF or other document type we want.

3. **Double download for documents with extensions**: URLs like `doc.pdf` would be downloaded twice - once in the extension check, once later.

## Solution Implemented

### New Approach: Content-Type Based Detection

**After Fix:**
```python
# 1. ALWAYS fetch the URL first
response = self.session.get(url, timeout=30)
content_type = response.headers.get('Content-Type', '').lower()

# 2. Check Content-Type to determine what it is
if 'text/html' in content_type:
    should_save = 'html' in self.file_types
    file_ext = 'html'
elif 'application/pdf' in content_type:
    should_save = 'pdf' in self.file_types
    file_ext = 'pdf'
elif 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type:
    should_save = 'docx' in self.file_types
    file_ext = 'docx'
# ... etc

# 3. Save if it matches our file types
if should_save:
    self._save_fetched_document(url, response.content, file_ext, content_type, depth)
```

## Changes Made

### 1. Refactored `_crawl_page` Method

**Key improvements:**
- ✅ Fetch URL FIRST, check Content-Type SECOND
- ✅ Use Content-Type header to determine document type
- ✅ Fallback to URL extension if Content-Type doesn't match
- ✅ Save document only if its type is in the configured file_types
- ✅ Only extract links from HTML pages
- ✅ No double-downloading

### 2. Added `_save_fetched_document` Method

New method that saves already-fetched content instead of downloading again:

```python
def _save_fetched_document(self, url: str, content: bytes, file_ext: str, 
                          content_type: str, depth: int) -> bool:
    """Save an already-fetched document to Azure Storage"""
    # Upload to Azure
    # Extract text
    # Create database record
```

Benefits:
- ✅ Reuses already-downloaded content
- ✅ No duplicate HTTP requests
- ✅ More efficient

### 3. Content-Type to File Extension Mapping

```python
Content-Type                                                    → file_ext
====================================================================
text/html                                                      → html
application/pdf                                                → pdf
application/vnd.openxmlformats-officedocument...              → docx
application/msword                                            → doc
text/plain                                                    → txt
text/markdown                                                 → md
```

## Supported Content Types

The crawler now correctly detects and downloads:

| Content-Type | File Extension | Requires in file_types |
|--------------|----------------|------------------------|
| `text/html` | `.html` | `html` |
| `application/pdf` | `.pdf` | `pdf` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | `docx` |
| `application/msword` | `.doc` | `doc` or `docx` |
| `text/plain` | `.txt` | `txt` or `text` |
| `text/markdown` | `.md` | `md` or `markdown` |

## Example Scenarios

### Scenario 1: PDF Without Extension
```
URL: https://example.com/download?id=123
Content-Type: application/pdf
file_types: ["html", "pdf"]

Before: ❌ Skipped (no .pdf in URL)
After:  ✅ Downloaded as PDF
```

### Scenario 2: DOCX via API
```
URL: https://api.example.com/files/report-2024
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
file_types: ["html", "docx"]

Before: ❌ Skipped (not HTML)
After:  ✅ Downloaded as DOCX
```

### Scenario 3: PDF With Extension
```
URL: https://example.com/whitepaper.pdf
Content-Type: application/pdf
file_types: ["pdf"]

Before: ✅ Downloaded (but inefficiently - double request)
After:  ✅ Downloaded (single request, more efficient)
```

### Scenario 4: HTML Page
```
URL: https://example.com/docs/intro
Content-Type: text/html
file_types: ["html"]

Before: ✅ Downloaded
After:  ✅ Downloaded (same behavior)
```

### Scenario 5: Unwanted File Type
```
URL: https://example.com/video.mp4
Content-Type: video/mp4
file_types: ["html", "pdf"]

Before: ❌ Skipped
After:  ❌ Skipped (correctly)
```

## Benefits

1. ✅ **Reliable Detection**: Uses actual content type, not just URL
2. ✅ **No Missed Documents**: Catches PDFs/DOCX without file extensions
3. ✅ **More Efficient**: Single HTTP request per URL
4. ✅ **Better Logging**: Shows file type being saved
5. ✅ **Handles Edge Cases**: Works with API endpoints, download links, etc.

## Testing

To verify the fix works:

### Test 1: PDF Downloads
```json
{
  "start_url": "https://example.com/resources",
  "max_depth": 1,
  "max_pages": 20,
  "file_types": ["pdf", "html"]
}
```

**Expected**: Both HTML pages AND PDFs should be downloaded, even if PDFs don't have `.pdf` in URL

### Test 2: Mixed Documents
```json
{
  "start_url": "https://docs.example.com",
  "max_depth": 2,
  "max_pages": 50,
  "file_types": ["html", "pdf", "docx"]
}
```

**Expected**: HTML, PDF, and DOCX files all downloaded based on Content-Type

### Test 3: Check Logs
```bash
docker-compose logs -f powernova-api | grep "Saving"
```

**Look for:**
```
Saving pdf document: https://example.com/download?id=123
Saving docx document: https://example.com/api/files/report
Saving html document: https://example.com/docs/intro
```

### Test 4: Check Database
```sql
SELECT document_type, COUNT(*) 
FROM documents 
WHERE crawl_job_id = X 
GROUP BY document_type;
```

**Expected**: Multiple document types, not just HTML

## Deployment

Changes applied and API restarted:
```bash
docker-compose restart powernova-api
```

The crawler now correctly identifies and downloads all document types based on their actual content, not just their URL! 🎉

## Migration Note

Existing crawl jobs that only found HTML pages can be re-run to capture the PDFs and other documents that were missed.

Simply:
1. Delete the old job (or keep for reference)
2. Create a new job with the same configuration
3. The new crawler will now find ALL document types

## Performance Impact

**Before:**
- URLs with extensions: 2 HTTP requests (check + download)
- URLs without extensions: 1 HTTP request + skip

**After:**
- All URLs: 1 HTTP request
- More efficient overall ✅

## Summary

The crawler now:
- ✅ Downloads PDFs, DOCX, and other formats even without file extensions in URL
- ✅ Uses Content-Type header for reliable detection
- ✅ Makes single HTTP request per URL (more efficient)
- ✅ Better logging to show what type of document is being saved
- ✅ Handles modern web APIs and download endpoints properly

No more missing documents! 🚀
