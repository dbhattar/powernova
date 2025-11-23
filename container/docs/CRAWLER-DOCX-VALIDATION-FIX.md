# Crawler DOCX Validation & Office Component Filtering Fix

**Date:** November 23, 2025  
**Issue:** Invalid DOCX file processing errors during crawling  
**Status:** ✅ Fixed

## Problem Description

The crawler was encountering multiple errors when processing files with `.docx` extensions:

### Error 1: Office Theme Files
```
Failed to extract text from DOCX: 
file '<_io.BytesIO object>' is not a Word file, 
content type is 'application/vnd.openxmlformats-officedocument.themeManager+xml'
```

**Cause:** URLs with `.docx` extensions sometimes point to Office Open XML component files (themes, relationships, etc.) rather than actual Word documents.

### Error 2: Non-ZIP Files
```
Failed to extract text from DOCX: File is not a zip file
```

**Cause:** Some files have `.docx` extensions but aren't valid DOCX files (which are ZIP archives).

### Root Causes

1. **Content Type Mismatch:** The crawler was using file extensions to determine document type without validating against the HTTP Content-Type header
2. **Office Component Files:** Office Open XML format includes various component files (themes, relationships, etc.) that aren't Word documents but may have similar extensions
3. **Weak Validation:** The document processor wasn't validating file format before attempting to parse

## Solution

### 1. Content Type Filtering in Crawler

Added early filtering to skip Office XML component files:

```python
# Skip Office Open XML component files (themes, relationships, etc.)
office_component_types = [
    'thememanager+xml',
    'theme+xml', 
    'relationships+xml',
    'slideshow+xml',
    'presentation+xml'
]
if any(comp in content_type for comp in office_component_types):
    logger.debug(f"Skipping Office XML component file: {content_type} for {url}")
    return
```

### 2. Content Type Validation for Extension-Based Detection

Enhanced the fallback logic when content type doesn't match known types:

```python
# For DOCX files, verify the content type matches
if file_ext in ['docx', 'doc']:
    if content_type and not any(word_type in content_type for word_type in [
        'application/vnd.openxmlformats-officedocument.wordprocessingml',
        'application/msword',
        'application/octet-stream',  # Generic binary
        'application/zip'  # DOCX is a ZIP file
    ]):
        logger.warning(f"Skipping .docx file with mismatched content type: {content_type}")
        return
```

### 3. Document Processor ZIP Validation

Added proper ZIP file validation before attempting to parse as DOCX:

```python
import zipfile

# Check if it's a valid ZIP file (DOCX files are ZIP archives)
if not zipfile.is_zipfile(docx_file):
    logger.warning(f"File is not a ZIP archive, cannot be a valid DOCX: {url}")
    return url, "", {}
```

### 4. Enhanced Error Handling

Improved error handling to catch and properly log specific DOCX parsing errors:

```python
except PackageNotFoundError as e:
    error_msg = str(e)
    if 'themeManager' in error_msg or 'theme' in error_msg.lower():
        logger.warning(f"File is an Office theme file, not a Word document: {url}")
    else:
        logger.warning(f"File is not a valid Word document: {url} - {error_msg}")
    return url, "", {}
```

## Files Modified

### `api/services/crawler.py`
- Added `office_component_types` list to filter out Office XML components
- Added content type validation in the fallback `else` block
- Validates DOCX and PDF content types against file extensions
- Logs warnings instead of errors for mismatched files

### `api/services/document_processor.py`
- Added `import zipfile` for ZIP validation
- Added `zipfile.is_zipfile()` check before parsing
- Enhanced error handling with specific exception types
- Better logging to distinguish between different failure types

## Testing

The fixes handle:
- ✅ Office XML component files (themes, relationships)
- ✅ Files with `.docx` extension but wrong content type
- ✅ Non-ZIP files with `.docx` extension
- ✅ Corrupted or incomplete DOCX files
- ✅ PDF files with mismatched content types

## Impact

**Before Fix:**
- Crawler attempted to parse theme files as Word documents
- "Not a Word file" errors filled logs
- "File is not a zip file" errors for invalid files
- Processing time wasted on invalid files
- Misleading "document found" counts

**After Fix:**
- Office component files are filtered at HTTP response level
- Invalid DOCX files are detected early and skipped
- Clean warning logs for debugging
- Only valid documents are processed
- Accurate document counts

## Deployment

```bash
# Deploy to production
./scripts/azure-deploy-api.sh --update

# Or restart locally
docker restart powernova-api
```

## Example Scenarios

### Scenario 1: Office Theme File
**URL:** `https://example.com/theme.docx`  
**Content-Type:** `application/vnd.openxmlformats-officedocument.themeManager+xml`  
**Result:** ✅ Skipped with debug log (not counted as document)

### Scenario 2: HTML File with .docx Extension
**URL:** `https://example.com/document.docx`  
**Content-Type:** `text/html`  
**Result:** ✅ Skipped with warning log

### Scenario 3: Valid DOCX File
**URL:** `https://example.com/report.docx`  
**Content-Type:** `application/vnd.openxmlformats-officedocument.wordprocessingml.document`  
**Result:** ✅ Processed successfully

### Scenario 4: Generic Binary with .docx Extension
**URL:** `https://example.com/file.docx`  
**Content-Type:** `application/octet-stream`  
**Result:** ✅ Attempted (might be valid DOCX), ZIP validation catches invalid files

## Validation Layers

The fix implements multiple validation layers:

1. **HTTP Content-Type Check** (crawler.py line ~593)
   - Filters Office XML components early
   - Prevents unnecessary downloads

2. **Content-Type/Extension Match** (crawler.py line ~629)
   - Validates content type matches file extension
   - Logs warnings for mismatches

3. **ZIP Format Validation** (document_processor.py line ~153)
   - Checks if file is a valid ZIP archive
   - DOCX files must be ZIP format

4. **Magic Bytes Check** (document_processor.py line ~160)
   - Verifies ZIP signature (PK bytes)
   - Double-checks ZIP format

5. **python-docx Validation** (document_processor.py line ~167)
   - Library validates Office Open XML structure
   - Catches corrupted or invalid files

## Logging Improvements

**Before:**
```
ERROR: Failed to extract text from DOCX: file is not a Word file
```

**After:**
```
DEBUG: Skipping Office XML component file: application/...themeManager+xml for https://...
WARNING: File is an Office theme file, not a Word document: https://...
WARNING: Skipping .docx file with mismatched content type: text/html for https://...
```

## Performance Impact

- **Reduced Processing Time:** Invalid files filtered early
- **Fewer Errors:** Validation prevents exception handling overhead
- **Better Logging:** Debug vs. warning vs. error levels used appropriately
- **Network Efficiency:** Component files identified after single HTTP request

## Related Fixes

This fix builds on the NULL byte sanitization fix (CRAWLER-NULL-BYTE-FIX.md) to create a more robust document processing pipeline:

1. Content-type validation (this fix)
2. ZIP format validation (this fix)
3. Text sanitization (NULL byte fix)
4. Transaction rollback (NULL byte fix)

## Future Improvements

Consider:
1. **Content-Type Sniffing:** Use python-magic library to detect file type from content
2. **Allowlist Approach:** Only process files with explicitly allowed content types
3. **Metrics:** Track content type mismatches for analysis
4. **Configuration:** Make Office component filtering configurable
5. **Retry Logic:** Distinguish between temporary vs. permanent failures
