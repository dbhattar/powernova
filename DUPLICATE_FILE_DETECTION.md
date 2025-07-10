# Duplicate File Detection Implementation

## Overview
Implemented SHA-256 hash-based duplicate file detection to prevent users from uploading the same document multiple times and provide a better user experience.

## How It Works

### 1. File Hash Generation
When a file is uploaded, the backend generates a SHA-256 hash of the file content:
```javascript
const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
```

### 2. Duplicate Detection
Before processing the upload, the system checks if a document with the same hash already exists for the user:
```javascript
const existingDocument = await firebaseService.findDocumentByHash(userId, fileHash);
```

### 3. Response Handling
- **If duplicate found**: Returns a 200 response with `isDuplicate: true` and existing document details
- **If new file**: Proceeds with normal upload and processing flow

## Implementation Details

### Backend Changes

#### 1. Document Controller (`backend/src/controllers/documentController.js`)
- Added `crypto` import for hash generation
- Added hash generation and duplicate check before processing
- Added `fileHash` field to document metadata
- Returns duplicate information when found

#### 2. Firebase Service (`backend/src/services/firebaseService.js`)
- Added `findDocumentByHash(userId, fileHash)` method
- Efficiently queries Firestore with compound index on `userId` and `fileHash`
- Returns existing document details if found

### Frontend Changes

#### Document Upload Component (`app/components/DocumentUpload.js`)
- Enhanced upload response handling
- Shows user-friendly duplicate detection dialog
- Offers option to view existing document
- Distinguishes between new uploads and duplicates

## User Experience

### Duplicate Detection Flow
1. **User selects file**: Same file they've uploaded before
2. **Upload starts**: File is sent to backend
3. **Hash check**: Backend generates hash and checks for duplicates
4. **User notification**: Friendly dialog explains the situation
5. **User choice**: Option to view existing document or cancel

### Dialog Message
```
"Duplicate Document"

"This document has already been uploaded as '[filename]'. 
Would you like to view the existing document?"

[Cancel] [View Document]
```

## Benefits

### 1. Prevents Duplicate Processing
- ✅ No redundant vectorization work
- ✅ Saves computing resources
- ✅ Reduces storage usage

### 2. Better User Experience
- ✅ Clear feedback about duplicates
- ✅ Option to find existing document
- ✅ No accidental duplicate uploads

### 3. Data Integrity
- ✅ Hash-based detection is reliable
- ✅ Works even if filename changes
- ✅ Detects identical content regardless of metadata

## Technical Implementation

### Hash Storage
Documents now include a `fileHash` field:
```javascript
{
  documentId: "uuid",
  userId: "user-id",
  fileName: "document.pdf",
  fileSize: 1234567,
  mimeType: "application/pdf",
  fileHash: "sha256-hash-string",  // NEW
  status: "completed",
  uploadedAt: "2025-01-01T00:00:00Z"
}
```

### Database Query
Efficient duplicate detection using compound query:
```javascript
db.collection('documents')
  .where('userId', '==', userId)
  .where('fileHash', '==', fileHash)
  .limit(1)
```

### API Response Format

**New Upload:**
```json
{
  "documentId": "uuid",
  "fileName": "document.pdf",
  "status": "queued_for_processing",
  "message": "Document uploaded successfully"
}
```

**Duplicate Detected:**
```json
{
  "message": "This document has already been uploaded",
  "isDuplicate": true,
  "existingDocument": {
    "id": "existing-uuid",
    "fileName": "document.pdf",
    "uploadedAt": "2025-01-01T00:00:00Z",
    "status": "completed"
  }
}
```

## Security Considerations

### 1. Hash Collision Protection
- SHA-256 provides excellent collision resistance
- Probability of collision is virtually zero for practical purposes

### 2. User Isolation
- Duplicate detection is per-user only
- Users cannot see or access other users' documents
- Hash queries are always scoped to `userId`

### 3. Privacy
- File hashes are stored securely in Firestore
- No file content is exposed in duplicate detection
- Only metadata is returned for existing documents

## Testing Scenarios

### 1. Upload Same File Twice
1. Upload `document.pdf`
2. Try uploading same `document.pdf` again
3. Should show duplicate dialog

### 2. Upload Same Content, Different Name
1. Upload `report.pdf`
2. Rename to `final-report.pdf` and upload
3. Should detect duplicate (same content hash)

### 3. Upload Different Files
1. Upload `document1.pdf`
2. Upload `document2.pdf` (different content)
3. Should proceed normally (different hashes)

## Performance Impact

### Storage
- **Minimal**: Only adds one `fileHash` string field per document
- **Efficient**: SHA-256 hash is only 64 characters

### Processing
- **Fast**: Hash generation is very quick
- **Indexed**: Firestore query uses compound index for speed
- **Early exit**: Duplicate detection happens before expensive processing

### Network
- **Reduced**: Prevents unnecessary file processing for duplicates
- **Responsive**: Quick feedback to user about duplicates
