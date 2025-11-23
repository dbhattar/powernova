# Server-Side Web Page Support Enhancement

**Date:** November 23, 2025  
**Enhancement:** Added support for common server-side web page formats  
**Status:** ✅ Implemented

## Overview

Enhanced the crawler and document processor to support common server-side web page file types (ASPX, ASP, JSP, PHP, etc.) that were previously being rejected as "unsupported file type".

## Problem

The crawler was encountering errors when processing server-side web pages:

```
Unsupported file type: aspx
Unsupported file type: ashx
Unsupported file type: jsp
```

These files contain rendered HTML content but have different file extensions based on the server-side technology used (Microsoft ASP.NET, Java, PHP, ColdFusion, etc.).

## Solution

### Supported File Types

Added support for the following server-side web page extensions:

| Extension | Technology | Description |
|-----------|------------|-------------|
| `.aspx` | ASP.NET | Active Server Pages Extended |
| `.asp` | Classic ASP | Active Server Pages |
| `.jsp` | Java | JavaServer Pages |
| `.jspx` | Java | JavaServer Pages XML |
| `.php` | PHP | PHP: Hypertext Preprocessor |
| `.ashx` | ASP.NET | ASP.NET Generic Handler |
| `.asmx` | ASP.NET | ASP.NET Web Services |
| `.cfm` | ColdFusion | ColdFusion Markup |
| `.xhtml` | XHTML | Extensible HTML |

### Implementation Details

All these file types are treated as **HTML** for processing purposes since they render HTML content to the browser.

#### 1. Document Processor Enhancement

Updated `process_document()` to recognize server-side extensions:

```python
# HTML and server-side web pages (they typically render as HTML)
if file_type in ['html', 'htm', 'aspx', 'asp', 'jsp', 'jspx', 'php', 
                  'ashx', 'asmx', 'cfm', 'xhtml']:
    return DocumentProcessor.extract_text_from_html(content, url)
```

#### 2. Crawler Document Type Mapping

Updated both `_download_and_save_document()` and `_save_fetched_document()`:

```python
doc_type_map = {
    'pdf': DocumentType.PDF,
    'html': DocumentType.HTML,
    'htm': DocumentType.HTML,
    'aspx': DocumentType.HTML,
    'asp': DocumentType.HTML,
    'jsp': DocumentType.HTML,
    'jspx': DocumentType.HTML,
    'php': DocumentType.HTML,
    'ashx': DocumentType.HTML,
    'asmx': DocumentType.HTML,
    'cfm': DocumentType.HTML,
    'xhtml': DocumentType.HTML,
    # ... other types
}
```

#### 3. Content Type Detection

Enhanced `_crawl_page()` to recognize server-side pages by extension:

```python
# Server-side pages often have text/html content type even with different extensions
elif file_ext in ['aspx', 'asp', 'jsp', 'jspx', 'php', 'ashx', 'asmx', 'cfm'] and 'html' in self.file_types:
    should_save = True
    # Keep the original extension for proper storage
```

## Files Modified

1. **`api/services/document_processor.py`:**
   - Updated `process_document()` method
   - Added server-side extensions to HTML processing logic

2. **`api/services/crawler.py`:**
   - Updated `doc_type_map` in `_download_and_save_document()`
   - Updated `doc_type_map` in `_save_fetched_document()`
   - Enhanced content type detection in `_crawl_page()`

## Processing Behavior

### Extension Preservation
The original file extension is preserved in storage (e.g., file is stored as `document.aspx`), but content is processed using HTML extraction logic.

### Content Type Handling
- If content type is `text/html` → processed normally
- If extension is server-side (aspx, jsp, etc.) → processed as HTML regardless of content type
- Original extension preserved in database and blob storage

### Text Extraction
All server-side pages use the same HTML extraction logic:
- Remove script, style, nav, footer, header tags
- Extract title from `<title>` or first `<h1>`
- Extract meta description, keywords, author
- Clean and normalize whitespace

## Use Cases

### ASP.NET Sites (Microsoft)
```
https://example.com/default.aspx
https://example.com/api/handler.ashx
https://example.com/service.asmx
```

### Java Sites
```
https://example.com/index.jsp
https://example.com/home.jspx
```

### PHP Sites
```
https://example.com/index.php
https://example.com/about.php
```

### ColdFusion Sites
```
https://example.com/page.cfm
```

## Database Impact

Documents are stored with:
- **document_type:** `HTML` (enum value)
- **file_path:** Original extension preserved (e.g., `crawl_12/document_1.aspx`)
- **title:** Extracted from HTML
- **content:** Extracted text from HTML

## Configuration

No configuration changes needed. When crawl jobs specify `'html'` in `file_types`, these server-side pages are now automatically included.

Example crawl job config:
```json
{
  "file_types": ["html", "pdf"],
  "max_pages": 100,
  ...
}
```

This now crawls:
- ✅ `.html` files
- ✅ `.htm` files  
- ✅ `.aspx` files
- ✅ `.asp` files
- ✅ `.jsp` files
- ✅ `.php` files
- ✅ All other supported server-side pages
- ✅ `.pdf` files

## Testing

Validated with:
- ✅ ASP.NET sites (pjm.com with `.aspx` pages)
- ✅ Various server-side page extensions
- ✅ Content type validation
- ✅ Text extraction quality
- ✅ Database storage

## Examples

### Before Enhancement
```
2025-11-23T21:43:38Z Unsupported file type: aspx
2025-11-23T21:41:19Z Unsupported file type: ashx
[Page skipped, not crawled]
```

### After Enhancement
```
2025-11-23T21:45:00Z Saving aspx document: https://example.com/page.aspx
2025-11-23T21:45:01Z Extracted 1250 chars from HTML: Page Title
[Page successfully crawled and indexed]
```

## Performance Impact

- **No negative impact:** Processing uses existing HTML extraction
- **Better coverage:** More pages can be indexed from enterprise websites
- **Accurate counts:** Pages previously skipped now counted correctly

## Common Websites Using These Technologies

- **ASP.NET (.aspx, .ashx, .asmx):** Microsoft sites, enterprise portals, government sites
- **JSP (.jsp, .jspx):** Enterprise Java applications, banking sites
- **PHP (.php):** WordPress, Drupal, many open-source projects
- **ColdFusion (.cfm):** Legacy enterprise applications

## Future Enhancements

Consider adding support for:
- `.cshtml` (ASP.NET Razor)
- `.vbhtml` (ASP.NET Razor with VB)
- `.erb` (Ruby on Rails)
- `.ejs` (Express.js)
- `.hbs` (Handlebars)
- `.tpl` (Smarty templates)

## Deployment

```bash
# Deploy to production
./scripts/azure-deploy-api.sh

# Or restart locally
docker restart powernova-api
```

## Related Documentation

- CRAWLER-NULL-BYTE-FIX.md - NULL byte sanitization
- CRAWLER-DOCX-VALIDATION-FIX.md - DOCX validation improvements
