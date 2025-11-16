# Firestore Document Size Limit Fix

## Problem
Getting error when uploading large documents:
```
Error: Failed to save document: 3 INVALID_ARGUMENT: The value of property "content" is longer than 1048487 bytes.
```

## Root Cause
- **Firestore document size limit**: 1MB (1,048,576 bytes) maximum per document
- The upload controller was storing the full document text content in the Firestore document
- Large documents (PDFs, Word docs) can easily exceed this limit when their text content is extracted

## Solution
**Removed text content from Firestore document** and modified the vectorization worker to extract content on-demand from the file buffer.

### Changes Made

#### 1. Document Controller (`backend/src/controllers/documentController.js`)
**Before:**
```javascript
await firebaseService.saveDocument({
  documentId: documentId,
  userId: userId,
  fileName: file.originalname,
  fileSize: file.size,
  mimeType: file.mimetype,
  status: 'queued_for_processing',
  jobId: jobId,
  uploadedAt: new Date(),
  content: textContent // ❌ This could exceed 1MB limit
});
```

**After:**
```javascript
await firebaseService.saveDocument({
  documentId: documentId,
  userId: userId,
  fileName: file.originalname,
  fileSize: file.size,
  mimeType: file.mimetype,
  status: 'queued_for_processing',
  jobId: jobId,
  uploadedAt: new Date()
  // ✅ content removed to avoid 1MB size limit
  // The vectorization job will extract content from fileBuffer
});
```

#### 2. Vectorization Worker (`backend/src/services/vectorizationWorker.js`)
**Added text extraction method:**
```javascript
async _extractTextContent(buffer, mimeType, filename) {
  try {
    switch (mimeType) {
      case 'application/pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;
      case 'text/plain':
        return buffer.toString('utf-8');
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
  }
}
```

**Updated processing logic:**
```javascript
// Before: Get content from Firestore (limited to 1MB)
if (!document.content) {
  throw new Error(`Document ${documentId} has no content to process`);
}

// After: Extract content from file buffer (no size limit)
const { documentId, fileBuffer, filename, mimeType, userId } = job.payload;
const fileBufferData = Buffer.from(fileBuffer);
const textContent = await this._extractTextContent(fileBufferData, mimeType, filename);
```

## Benefits
1. **No more 1MB limit**: Document content is processed directly from memory, not stored in Firestore
2. **Better architecture**: Firestore only stores metadata, not large content
3. **Improved performance**: No need to read/write large content to/from Firestore
4. **Support for large documents**: Can now handle PDFs and Word docs up to 100MB (multer limit)

## File Upload Limits
- **Multer (HTTP upload)**: 100MB ✅
- **Firestore document**: Metadata only (well under 1MB) ✅
- **Document processing**: Limited by available memory (typically several GB) ✅

## Testing
Upload a large document (>1MB text content) to verify:
1. Upload succeeds without Firestore size error
2. Document appears in document list with correct metadata
3. Vectorization processes successfully
4. Document status updates correctly

## Data Flow
1. **Upload**: File → Extract text → Validate → Store metadata in Firestore + File buffer in job queue
2. **Processing**: Job queue → Extract text from buffer → Vectorize → Update status in Firestore
3. **Frontend**: Displays document metadata and status from Firestore
