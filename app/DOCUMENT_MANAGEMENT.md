# Document Management System

## Overview
PowerNOVA now includes a comprehensive document management system that allows users to upload documents (PDF, DOC, DOCX, TXT) and ask questions about their content.

## Features

### 1. Document Upload
- **Supported formats**: PDF, DOC, DOCX, TXT
- **File size limit**: 10MB per document
- **Storage**: Firebase Storage for files, Firestore for metadata
- **Security**: Only authenticated users can upload documents

### 2. Document Processing
- **Text extraction**: Automatic text extraction from uploaded documents
- **Status tracking**: Processing status (uploaded, processing, ready, error)
- **Background processing**: Non-blocking document processing

### 3. Document Management UI
- **Document library**: View all uploaded documents
- **Search functionality**: Search documents by filename
- **Delete documents**: Remove documents from storage
- **Status indicators**: Visual status of document processing

### 4. AI Integration
- **Document context**: AI queries include relevant document content
- **Smart search**: Documents are searched based on query relevance
- **Enhanced responses**: More detailed answers using document content

## How It Works

### User Workflow:
1. **Sign in** with Google account
2. **Upload documents** using the document button (📄) in the header
3. **Wait for processing** - documents are processed in the background
4. **Ask questions** - include document content in your queries
5. **Manage documents** - view, search, and delete documents

### Technical Implementation:

#### Storage Architecture:
```
Firebase Storage: /documents/{userId}/{filename}
Firestore: collection('documents') -> document metadata
```

#### Document Processing:
- Text extraction (currently basic, can be enhanced)
- Metadata storage in Firestore
- Status tracking and error handling

#### AI Integration:
- Document context is automatically added to AI queries
- Relevant documents are identified based on query content
- Enhanced responses using document information

## Usage Examples

### Upload a Document:
1. Click the document button (📄) in the header
2. Click "Upload Document"
3. Select a PDF, DOC, DOCX, or TXT file
4. Wait for processing to complete

### Ask Questions About Documents:
- "What are the key findings in my uploaded research paper?"
- "Summarize the main points from the document about power systems"
- "Based on my uploaded manual, how do I configure the protection settings?"

### Manage Documents:
- View all documents in the document library
- Search documents by name
- Delete documents you no longer need
- Monitor processing status

## Security & Privacy

- **Authentication required**: Only signed-in users can upload documents
- **User isolation**: Users can only access their own documents
- **Secure storage**: Files stored in Firebase Storage with proper access controls
- **Data privacy**: Document content is only used for AI responses, not stored permanently in conversation history

## Current Limitations

1. **Text extraction**: Basic implementation for text files, PDF/DOC extraction needs enhancement
2. **File size**: 10MB limit per document
3. **Processing time**: Depends on document size and complexity
4. **Context limit**: Document content is truncated for AI queries (4000 chars per doc)

## Future Enhancements

1. **Advanced text extraction**: OCR for scanned documents, better PDF parsing
2. **Document types**: Support for more file formats (Excel, PowerPoint, etc.)
3. **Batch upload**: Upload multiple documents at once
4. **Document organization**: Folders, tags, and categories
5. **Collaboration**: Share documents with other users
6. **Version control**: Track document versions and changes

## Technical Notes

### Firebase Storage Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Required Dependencies:
- `pdfjs-dist` - PDF text extraction
- `firebase/storage` - File storage
- `firebase/firestore` - Metadata storage

### Browser Compatibility:
- Modern browsers with File API support
- Web platform only (not mobile apps yet)
