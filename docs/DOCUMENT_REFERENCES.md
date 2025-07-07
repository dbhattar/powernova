# Document Reference System

This document explains how the PowerNova chat system now includes references to source documents used in generating responses.

## Overview

When users ask questions, the system now:
1. Searches through uploaded documents for relevant context
2. Uses the context to generate more accurate responses
3. Includes clickable references to the source documents at the bottom of responses
4. Provides metadata about which documents were used

## Backend Implementation

### New Services

#### DocumentReferenceService
- `processSearchResults(searchResults, scoreThreshold)`: Processes vector search results and extracts document references
- `formatDocumentReferences(sourceDocuments)`: Formats references for display in chat responses
- `generateReferenceSummary(sourceDocuments)`: Creates metadata summary about referenced documents

### Enhanced Chat Controller

The chat controller now:
- Processes vector search results to identify relevant documents
- Adds formatted references to chat responses
- Includes document metadata in the response
- Provides a new endpoint to serve document details

#### New API Endpoints

```javascript
GET /api/chat/document/:documentId?page=1
```
- Returns document details for chat references
- Includes access control to ensure users can only access their own documents
- Supports optional page parameter for PDFs

### Response Format

Chat responses now include:

```javascript
{
  "response": "Your answer with references at the bottom",
  "threadId": "thread_123",
  "documentSources": [
    {
      "id": "doc_123",
      "name": "Solar Energy Report.pdf",
      "pages": [1, 3, 5],
      "relevanceScore": 0.85,
      "chunks": 3
    }
  ],
  "hasReferences": true,
  "referenceSummary": {
    "documentCount": 2,
    "totalChunks": 5,
    "averageRelevanceScore": 0.82,
    "topDocument": "Solar Energy Report.pdf"
  }
}
```

## Frontend Implementation

### Enhanced ConversationItem Component

The conversation item now displays:
- Document reference indicators in the header
- Clickable document links at the bottom
- Page numbers when available
- Number of referenced sections
- Reference summary

### DocumentViewerService

Handles opening documents when users click on references:
- Opens PDFs with page highlighting
- Downloads and opens other document types
- Provides fallback to web browser
- Handles authentication

## Usage Examples

### Basic Chat with References

```javascript
// Send a message
const response = await fetch('/api/chat/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'What are the benefits of solar energy?',
    threadId: null,
    isFollowUp: false,
  }),
});

const data = await response.json();

// Response includes references
console.log('Answer:', data.response);
console.log('Has references:', data.hasReferences);
console.log('Source documents:', data.documentSources);
```

### Frontend Component Usage

```javascript
import ConversationItem from './components/ConversationItem';
import DocumentViewerService from './services/documentViewerService';

const handleDocumentPress = async (documentId, page) => {
  try {
    await DocumentViewerService.handleDocumentPress(documentId, page);
  } catch (error) {
    console.error('Error opening document:', error);
  }
};

// In your render method
<ConversationItem 
  conversation={conversation}
  onPress={() => handleConversationSelect(conversation)}
  onDocumentPress={handleDocumentPress}
/>
```

## Reference Display Format

References appear at the bottom of responses like this:

```
📄 References:
- [Solar Energy Report.pdf (p. 1, 3, 5)](/api/chat/document/doc_123?page=1) • 3 sections
- [Wind Power Analysis.docx (p. 2)](/api/chat/document/doc_456?page=2) • 1 section

Based on 2 documents (4 sections)
```

## Configuration

### Relevance Threshold
The system filters documents based on a relevance score threshold (default: 0.3). You can adjust this in the `DocumentReferenceService.processSearchResults()` method.

### Document Types Supported
- PDF files (with page highlighting)
- DOC/DOCX files
- TXT files
- Other document types (basic download/open)

## Testing

Run the test script to verify functionality:

```bash
cd backend
node test-document-references.js
```

The test script will:
1. Upload a test document
2. Send a chat message that should reference the document
3. Verify the document reference endpoint works
4. Clean up test files

## Security Considerations

- Users can only access their own documents
- Document references include access control checks
- Authentication is required for all document endpoints
- File downloads are served through authenticated endpoints

## Performance Notes

- Document processing is asynchronous
- Vector search results are cached where possible
- Reference formatting is optimized for common cases
- Large documents are chunked for better relevance scoring

## Future Enhancements

Potential improvements:
- Visual highlighting of referenced text within documents
- Document preview in chat interface
- Reference confidence scoring
- Smart reference grouping for related documents
- Integration with document annotation systems
