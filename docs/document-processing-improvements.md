# Document Processing Improvements

## Overview
This document outlines the major improvements made to handle large document uploads and processing in the PowerNOVA app.

## Key Improvements

### 🔧 **Enhanced Text Chunking**
- **Smart Sentence Boundary Detection**: Chunks break at sentence boundaries instead of arbitrary character counts
- **Configurable Overlap**: Maintains context between chunks with configurable overlap
- **Adaptive Chunk Sizing**: Chunk size adapts based on document size for optimal processing

### 🚀 **Batch Processing**
- **Token Limit Checking**: Prevents OpenAI API token limit errors (300k tokens per request)
- **Batched Embedding Generation**: Processes embeddings in batches of 50 chunks at a time
- **Batched Vector Upserts**: Uploads vectors to Pinecone in batches of 100 vectors

### 📊 **Document Validation**
- **Size Validation**: Checks document size before processing (up to 100MB/2M tokens)
- **Content Validation**: Ensures minimum content length and quality
- **Token Estimation**: Estimates token count to prevent API errors

### 🔄 **Processing Status Tracking**
- **Real-time Status Updates**: Track processing progress in Firestore
- **Error Handling**: Comprehensive error messages and recovery
- **Progress Indicators**: Shows processing status to users

## Technical Details

### File Size Limits
- **Backend Multer**: 100MB file upload limit
- **Express Body Parser**: 100MB JSON/URL-encoded body limit
- **Firebase Storage**: Configure in Firebase Console storage rules

### Chunking Parameters
```javascript
// Adaptive chunk sizing based on document size
if (estimatedTokens > 1000000) {
  chunkSize: 1500, overlap: 300  // Very large docs
} else if (estimatedTokens > 500000) {
  chunkSize: 1200, overlap: 250  // Large docs
} else {
  chunkSize: 1000, overlap: 200  // Standard docs
}
```

### Token Limits
- **OpenAI Embedding API**: 300,000 tokens per request
- **Batch Processing**: 250,000 tokens per batch (safety buffer)
- **Document Limit**: 2,000,000 tokens total per document

### Processing Flow
1. **Upload**: File uploaded via multer (100MB limit)
2. **Extract**: Text extracted from PDF/DOC/DOCX/TXT
3. **Validate**: Document size and content validation
4. **Chunk**: Smart chunking with sentence boundaries and overlap
5. **Embed**: Batch embedding generation (50 chunks at a time)
6. **Store**: Batch vector upsert to Pinecone (100 vectors at a time)
7. **Status**: Real-time status updates in Firestore

## Usage Examples

### Processing a Large Document
```javascript
// Your 26MB document will now be processed as:
// 1. Validated (✅ passes 100MB/2M token limits)
// 2. Chunked into ~1200 character chunks with 250 char overlap
// 3. Embedded in batches of 50 chunks at a time
// 4. Stored in batches of 100 vectors at a time
// 5. Status tracked throughout the process
```

### Firebase Storage Rules Update
```javascript
// Update your Firebase Storage rules to allow larger files
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null 
        && request.resource.size < 100 * 1024 * 1024; // 100MB limit
    }
  }
}
```

## Error Handling

### Common Errors and Solutions
1. **Token Limit Exceeded**: Document automatically chunked and batched
2. **File Too Large**: Increase multer/Express limits and Firebase Storage rules
3. **Processing Failed**: Status updated with specific error message
4. **Vector Service Unavailable**: App continues without vector search

### Monitoring
- Check Firestore `documents` collection for processing status
- Monitor backend logs for chunking and embedding progress
- Use the test script to validate chunking logic

## Testing

Run the chunking test script:
```bash
cd backend
node tests/test-chunking.js
```

This tests:
- Document size validation
- Optimal chunk parameter calculation
- Smart chunking with sentence boundaries
- Token estimation accuracy
- Edge cases (empty docs, no sentences, etc.)

## Performance Benefits

### Before Improvements
- ❌ 26MB document failed with "2M tokens exceeded" error
- ❌ No progress tracking during processing
- ❌ Simple character-based chunking lost context
- ❌ Single-batch processing caused timeouts

### After Improvements
- ✅ 26MB document processes successfully
- ✅ Real-time progress tracking
- ✅ Smart sentence-boundary chunking preserves context
- ✅ Batch processing prevents timeouts and rate limits
- ✅ Adaptive chunking optimizes for document size
- ✅ Comprehensive error handling and recovery

## Configuration

### Environment Variables
```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=powernova-docs

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key

# Processing Limits
MAX_DOCUMENT_SIZE=104857600  # 100MB in bytes
MAX_TOKENS_PER_DOCUMENT=2000000  # 2M tokens
MAX_TOKENS_PER_BATCH=250000  # 250k tokens per batch
```

### Chunk Parameters
```javascript
// Modify these in vectorService.js calculateOptimalChunkSize()
const chunkParams = {
  small: { chunkSize: 1000, overlap: 200 },
  medium: { chunkSize: 1200, overlap: 250 },
  large: { chunkSize: 1500, overlap: 300 }
};
```

## Future Enhancements

1. **Streaming Processing**: Process chunks as they're generated
2. **Parallel Processing**: Process multiple documents simultaneously
3. **Resume Processing**: Resume failed document processing
4. **Chunk Optimization**: Machine learning-based optimal chunking
5. **Progress Websockets**: Real-time progress updates to frontend
6. **Smart Overlap**: Dynamic overlap based on content similarity
