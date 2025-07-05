# Test Files Documentation

This folder contains various test files created during development and debugging of the PowerNOVA application. These files are kept for future reference and debugging purposes.

## Test Files Overview

### API Testing
- **`test-api-call.js`** - Tests basic API calls and authentication
- **`test-api-delete.js`** - Tests document deletion via HTTP API endpoints with authentication
- **`test-server.js`** - Basic server connectivity and health check tests

### Document Management Testing
- **`test-documents.js`** - Tests document listing and retrieval functionality
- **`test-delete-manual.js`** - Complete document deletion test (upload → process → delete → verify)
- **`test-deletion.js`** - Basic document deletion functionality test
- **`test-deletion-manual.js`** - Manual deletion test with existing documents

### Vector Database Testing
- **`test-pinecone.js`** - Basic Pinecone vector database connectivity tests
- **`test-pinecone-new.js`** - Tests with updated Pinecone SDK and configuration
- **`check-pinecone-index.js`** - Validates Pinecone index configuration and stats

### Frontend Testing
- **`firebase-test.js`** - Frontend Firebase authentication and connectivity tests

### Test Data
- **`test-document.txt`** - Sample document used for testing upload/processing/deletion

## Key Issues Resolved

### 1. Document Deletion (Fixed)
- **Problem**: Pinecone metadata filtering not working with serverless index
- **Solution**: Changed to ID-based vector deletion using naming patterns
- **Files**: `test-delete-manual.js`, `test-api-delete.js`

### 2. API Authentication (Fixed)
- **Problem**: Custom tokens vs ID tokens confusion
- **Solution**: Proper Firebase ID token handling
- **Files**: `test-api-delete.js`, `firebase-test.js`

### 3. Vector Store Integration (Fixed)
- **Problem**: Pinecone SDK version and configuration issues
- **Solution**: Updated to latest SDK with proper serverless configuration
- **Files**: `test-pinecone-new.js`, `check-pinecone-index.js`

## Running Tests

To run any of these tests:

```bash
# From the backend directory
cd /path/to/backend
node tests/[test-file-name].js

# Or from the tests directory
cd /path/to/backend/tests
node [test-file-name].js
```

**Note**: Make sure environment variables are properly configured in `.env` file before running tests. The test files automatically load the `.env` file from the parent directory.

## Environment Requirements

- Firebase Admin SDK configuration
- Pinecone API key and index name
- OpenAI API key
- Proper CORS and authentication settings

## Test Status

✅ **Working**: All core functionality (upload, processing, deletion, listing)
✅ **Fixed**: Vector deletion, API authentication, metadata filtering
✅ **Verified**: End-to-end document lifecycle management

These tests were instrumental in diagnosing and fixing issues with the PowerNOVA document management system.
