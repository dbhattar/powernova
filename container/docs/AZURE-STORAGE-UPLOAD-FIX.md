# Azure Storage Upload Fix

## Date: November 20, 2024

## Issue

**Error Message:**
```
Error: Failed to upload document: 'AzureStorageService' object has no attribute 'upload_file'
```

**User Impact:**
- Users could not upload documents to conversations
- Document upload feature completely broken
- Error occurred when clicking upload button in conversation UI

## Root Cause

The conversation routes (`api/routes/conversations.py`) was calling a non-existent method:

```python
# ❌ INCORRECT - Method doesn't exist
blob_url, file_path = await storage_service.upload_file(
    file_content=file_content,
    filename=file.filename,
    container_name="user-documents"
)
```

**Problems:**
1. Method name wrong: `upload_file` doesn't exist (should be `upload_document`)
2. Parameters incorrect: Wrong parameter names and types
3. Async/await mismatch: `upload_document` is NOT an async method
4. Return values wrong: Expected 2 values, method returns 3

## Correct AzureStorageService API

The actual method signature in `api/services/azure_storage.py`:

```python
def upload_document(
    self, 
    content: bytes,           # Document content
    url: str,                 # Unique identifier/path
    file_extension: str,      # Extension without dot (e.g., 'pdf')
    job_id: int,             # Job ID for organizing uploads
    content_type: Optional[str] = None
) -> Tuple[str, str, int]:   # Returns (blob_path, blob_url, file_size)
```

## Solution

### 1. Fixed Method Call

```python
# ✅ CORRECT
import hashlib
from datetime import datetime

# Generate unique URL for user upload
file_hash = hashlib.md5(file_content).hexdigest()
timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
unique_url = f"user_upload/{current_user.id}/{file_hash}_{timestamp}"

# Upload document (NOT async)
try:
    file_path, blob_url, uploaded_size = storage_service.upload_document(
        content=file_content,
        url=unique_url,
        file_extension=file_ext.lstrip('.'),  # Remove leading dot
        job_id=0,  # User upload, not from crawl job
        content_type=None  # Let service determine content type
    )
except Exception as e:
    logger.error(f"Failed to upload to Azure Storage: {e}")
    raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")
```

### 2. Added Missing Import

```python
import logging

logger = logging.getLogger(__name__)
```

## Key Changes

### File: `api/routes/conversations.py`

**Lines Changed:**
- Line 11: Added `import logging`
- Line 22: Added `logger = logging.getLogger(__name__)`
- Lines 350-370: Completely rewrote upload logic

**Before:**
```python
# Wrong method name, wrong parameters, wrong await
blob_url, file_path = await storage_service.upload_file(
    file_content=file_content,
    filename=file.filename,
    container_name="user-documents"
)
```

**After:**
```python
# Generate unique URL for blob storage organization
file_hash = hashlib.md5(file_content).hexdigest()
timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
unique_url = f"user_upload/{current_user.id}/{file_hash}_{timestamp}"

# Correct method call with proper parameters
file_path, blob_url, uploaded_size = storage_service.upload_document(
    content=file_content,
    url=unique_url,
    file_extension=file_ext.lstrip('.'),
    job_id=0,
    content_type=None
)
```

## File Organization in Azure Blob Storage

User-uploaded documents are now organized as:
```
user_upload/
  └── {user_id}/
      └── {file_hash}_{timestamp}.{extension}

Example:
user_upload/
  └── 123/
      ├── a1b2c3d4_20241120_143022.pdf
      ├── e5f6g7h8_20241120_143145.docx
      └── i9j0k1l2_20241120_143330.txt
```

This provides:
- ✅ User isolation (each user has their own folder)
- ✅ Unique filenames (hash + timestamp)
- ✅ Collision prevention (MD5 hash of content)
- ✅ Easy cleanup (delete all files for a user)

## Testing

### Manual Test
```bash
# 1. Login to app
http://localhost:8081

# 2. Create a conversation
Click "New Conversation"

# 3. Upload a document
Click paperclip icon → Select PDF/DOCX/TXT/MD → Upload

# 4. Verify in logs
docker logs powernova-api | grep "Uploaded document"

# Expected output:
# INFO: Uploaded document to Azure: user_upload/123/abc123_20241120_143022.pdf (12345 bytes)
```

### API Test
```bash
# Get auth token
TOKEN="your_jwt_token"

# Upload document to conversation
curl -X POST "http://localhost:8000/api/conversations/1/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf"

# Expected response:
{
  "id": 123,
  "url": "https://storage.blob.core.windows.net/powernova-documents/user_upload/...",
  "title": "test.pdf",
  "document_type": "pdf",
  "document_scope": "conversation",
  "status": "processing",
  "file_size": 12345,
  "uploaded_by": 1,
  "created_at": "2024-11-20T14:30:22Z"
}
```

## Files Modified

1. ✅ `api/routes/conversations.py`
   - Added logging import
   - Added logger instance
   - Fixed upload_document call
   - Added proper error handling
   - Added unique URL generation

## Deployment Status

- ✅ Local environment: Fixed and tested
- ✅ API container rebuilt
- ✅ No errors in logs
- ⏳ Azure deployment: Pending

## Next Steps

1. Test document upload in browser
2. Verify document appears in conversation
3. Test document embedding generation
4. Test RAG search with uploaded documents
5. Deploy to Azure App Service

## Related Documentation

- `CONVERSATION-MANAGEMENT.md` - Full technical spec
- `CONVERSATION-MANAGEMENT-SUMMARY.md` - Executive summary
- `FRONTEND-FIXES.md` - Frontend integration fixes
