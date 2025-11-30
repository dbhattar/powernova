# Semantic Search Implementation

## Overview
Complete semantic search functionality has been added to PowerNOVA, enabling users to directly search across 100K+ documents using vector similarity search powered by pgvector and OpenAI embeddings.

## Implementation Date
**Date**: 2024-01-XX  
**Status**: ✅ Complete

---

## Features

### 1. Search Modal (Quick Search)
- **Location**: Available from main chat page
- **Access**: Click search icon in header or use keyboard shortcut
- **Features**:
  - Full-screen modal overlay
  - Search input with autofocus
  - Search suggestions and tips
  - Redirects to dedicated search results page

### 2. Search Results Page (`search.html`)
- **URL**: `/search.html?q=<query>&page=<page>`
- **Features**:
  - Persistent search bar for re-querying
  - Multiple UI states:
    - Initial empty state with suggested searches
    - Loading state with spinner
    - Results list with detailed cards
    - Empty results with search tips
  - Pagination controls
  - Result metadata (document type, source, similarity score)

### 3. Backend Search API
- **Endpoint**: `GET /api/search`
- **Parameters**:
  - `q` (required): Search query
  - `page` (optional, default: 1): Page number
  - `limit` (optional, default: 20, max: 100): Results per page
- **Features**:
  - Semantic vector similarity search
  - Intelligent snippet extraction
  - Source extraction (CAISO, ERCOT, PJM, etc.)
  - Performance tracking (search time in ms)

---

## Architecture

### Frontend Components

#### 1. Search Modal (`index.html`)
```html
<div class="modal-overlay" id="searchModal">
  <div class="modal-container modal-search">
    <!-- Search form with input -->
    <!-- Suggestions and tips -->
  </div>
</div>
```

#### 2. Search Results Page (`search.html`)
```html
<div class="search-page-container">
  <div class="search-bar-container"><!-- Re-query form --></div>
  <div class="search-results-container">
    <!-- Loading, empty, and results states -->
  </div>
</div>
```

#### 3. JavaScript (`search.js`)
- **Initialization**: Parse URL params, perform initial search
- **Event Handlers**: Form submit, pagination, suggestion clicks
- **API Integration**: Fetch search results
- **State Management**: Loading, results, empty states
- **URL Management**: Update query params for back/forward navigation

#### 4. Styling (`search.css`)
- Modal styles (overlay, container, input)
- Results page layout
- Result cards (hover effects, metadata)
- Pagination controls
- Loading animations
- Empty state illustrations
- Responsive design (mobile breakpoints)

### Backend Components

#### 1. Search Router (`api/routes/search.py`)
```python
@router.get("")
async def search_documents(
    q: str,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
) -> SearchResponse
```

**Key Functions**:
- `extract_snippet()`: Extract relevant text around query terms
- `extract_source_from_url()`: Identify data source (CAISO, ERCOT, etc.)
- `search_documents()`: Main search endpoint handler

#### 2. Database Query
```python
# Vector similarity search using pgvector
results = db.query(
    Document.id,
    Document.url,
    Document.title,
    Document.content,
    Document.document_type,
    Document.doc_metadata,
    (1 - Document.embedding.cosine_distance(query_embedding)).label('similarity')
).filter(
    Document.status == DocumentStatus.COMPLETED,
    Document.embedding_generated == True,
    Document.embedding.isnot(None)
).order_by(
    text('similarity DESC')
).offset(offset).limit(limit).all()
```

---

## User Flow

### Quick Search from Chat
1. User clicks search icon in header
2. Modal opens with input focused
3. User enters query (e.g., "CAISO interconnection")
4. Form submits → redirect to `search.html?q=CAISO+interconnection`
5. Results page loads and displays matches

### Direct Search Navigation
1. User lands on `search.html` (bookmarked/linked)
2. Initial empty state shows suggested queries
3. User clicks suggestion chip or enters query
4. Results display with pagination
5. User clicks document → opens source URL in new tab

### Pagination
1. User views page 1 of results
2. Clicks "Next Page" button
3. URL updates to `?q=query&page=2`
4. New results load
5. Page scrolls to top smoothly

---

## API Response Format

### Success Response
```json
{
  "query": "CAISO interconnection",
  "results": [
    {
      "id": 12345,
      "url": "https://www.caiso.com/documents/interconnection-requirements.pdf",
      "title": "CAISO Interconnection Requirements",
      "snippet": "...requirements for interconnection to the CAISO grid...",
      "similarity_score": 0.8543,
      "document_type": "PDF",
      "source": "CAISO"
    }
  ],
  "total": 142,
  "page": 1,
  "pages": 8,
  "search_time_ms": 127.45
}
```

### Empty Results
```json
{
  "query": "nonexistent term",
  "results": [],
  "total": 0,
  "page": 1,
  "pages": 0,
  "search_time_ms": 45.23
}
```

### Error Response
```json
{
  "detail": "Search failed: [error message]"
}
```

---

## File Changes

### New Files Created

1. **`app/css/search.css`** (560 lines)
   - Complete styling for search modal and results page
   - Responsive design with mobile breakpoints
   - Loading animations and state transitions

2. **`app/js/search.js`** (460 lines)
   - Search page initialization
   - API integration
   - Result rendering
   - Pagination handling
   - URL state management

3. **`app/search.html`** (179 lines)
   - Dedicated search results page
   - Header with back-to-chat link
   - Multiple UI states
   - Pagination controls

4. **`api/routes/search.py`** (246 lines)
   - Search endpoint implementation
   - Snippet extraction logic
   - Source identification
   - Pagination support

### Modified Files

1. **`app/index.html`**
   - Added search button in header (line ~60)
   - Added search modal before closing body tag (line ~395)
   - Linked `search.css` stylesheet

2. **`app/js/app.js`**
   - Added `initSearchModal()` function
   - Integrated search modal handlers
   - Keyboard shortcut support (Escape to close)

3. **`api/main.py`**
   - Imported search router
   - Added route: `app.include_router(search.router, prefix="/api", tags=["Search"])`

---

## Search Algorithm

### 1. Query Processing
```
User Query → OpenAI Embedding API → 1536-dimensional vector
```

### 2. Vector Similarity Search
```
Query Embedding → pgvector cosine distance → Ranked Results
```

**Formula**: `similarity = 1 - cosine_distance(query_embedding, document_embedding)`

### 3. Snippet Extraction
- Searches for query terms in document content
- Extracts ±150 characters around first match
- Falls back to beginning of document if no match
- Adds ellipsis for truncated text

### 4. Result Ranking
- Sorted by similarity score (highest first)
- Scores displayed as percentage (e.g., 85% match)
- Color-coded badges:
  - **High** (≥80%): Green badge
  - **Medium** (<80%): Yellow badge

---

## Data Sources

The search recognizes and tags documents from these sources:

| Source | Domain Pattern | Badge |
|--------|---------------|-------|
| CAISO | caiso.com | CAISO |
| ERCOT | ercot.com | ERCOT |
| PJM | pjm.com | PJM |
| MISO | misoenergy.org | MISO |
| SPP | spp.org | SPP |
| NYISO | nyiso.com | NYISO |
| ISO-NE | iso-ne.com | ISO-NE |
| FERC | ferc.gov | FERC |

---

## Performance Optimization

### Database Indexes
- `documents.status` - Filter for completed documents
- `documents.embedding_generated` - Filter for searchable documents
- `documents.embedding` - pgvector HNSW index for fast similarity search

### Query Optimization
```python
# Only query necessary fields
db.query(
    Document.id,
    Document.url,
    Document.title,
    Document.content,
    Document.document_type,
    Document.doc_metadata,
    (1 - Document.embedding.cosine_distance(query_embedding)).label('similarity')
)
```

### Response Optimization
- Limit content field to snippet extraction only
- Paginate results (max 100 per page)
- Track and log search performance

### Frontend Optimization
- Debounced search input (if implementing autocomplete)
- URL-based state management (no complex state library needed)
- Lazy loading with pagination
- Optimistic UI updates

---

## Error Handling

### Backend Errors
```python
try:
    # Search logic
except HTTPException:
    raise
except Exception as e:
    logger.error(f"Search error: {str(e)}", exc_info=True)
    raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
```

### Frontend Errors
```javascript
try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
    }
    // Process results
} catch (error) {
    console.error('Search error:', error);
    showError(error.message);
}
```

---

## Testing Checklist

### Frontend Testing
- [ ] Search modal opens on button click
- [ ] Modal closes on background click
- [ ] Modal closes on Escape key
- [ ] Form submission redirects to search page
- [ ] URL parameters parsed correctly
- [ ] Suggestion chips trigger searches
- [ ] Pagination updates URL and results
- [ ] Loading states display correctly
- [ ] Empty states display correctly
- [ ] Result cards render with all metadata
- [ ] Links open in new tabs
- [ ] Mobile responsive layout works

### Backend Testing
- [ ] Search endpoint returns results
- [ ] Pagination works correctly
- [ ] Empty queries handled gracefully
- [ ] Invalid page numbers handled
- [ ] Similarity scores calculated correctly
- [ ] Snippets extracted properly
- [ ] Source identification works
- [ ] Performance metrics logged
- [ ] Error responses formatted correctly

### Integration Testing
- [ ] End-to-end search flow works
- [ ] Analytics tracking fires
- [ ] Authentication not required (public search)
- [ ] CORS headers set correctly
- [ ] Results match expected relevance

---

## Future Enhancements

### Phase 2 Features
1. **Autocomplete**: Real-time search suggestions as user types
2. **Filters**: 
   - Document type (PDF, HTML, DOCX)
   - Data source (CAISO, ERCOT, PJM)
   - Date range
   - Language
3. **Advanced Search**:
   - Boolean operators (AND, OR, NOT)
   - Phrase search ("exact match")
   - Wildcard search (interconnect*)
4. **Search History**: Save recent searches for quick access
5. **Saved Searches**: Bookmark frequently used queries
6. **Export Results**: Download search results as CSV/JSON

### Performance Improvements
1. **Caching**: Cache popular queries with Redis
2. **Indexing**: Optimize pgvector HNSW parameters
3. **Precomputed Embeddings**: Cache common query embeddings
4. **CDN**: Cache static assets (CSS, JS) on CDN

### Analytics Enhancements
1. **Search Analytics Dashboard**:
   - Most searched queries
   - Average search time
   - Click-through rates
   - Zero-result queries
2. **A/B Testing**: Test different ranking algorithms
3. **User Feedback**: Thumbs up/down on results

---

## Known Limitations

1. **Embedding Generation**: Search only works on documents with embeddings
   - Current coverage: ~100K documents
   - Documents without embeddings are excluded from results

2. **Query Length**: Very long queries (>500 characters) may fail
   - OpenAI embedding API has token limits
   - Consider truncating or warning users

3. **Language Support**: Works best with English queries
   - Embedding model optimized for English
   - Other languages may have reduced accuracy

4. **Real-time Updates**: New documents require embedding generation
   - Search results may lag behind crawler by a few minutes
   - Consider adding refresh indicator

---

## Troubleshooting

### Search Returns No Results
1. Check if documents have embeddings:
   ```sql
   SELECT COUNT(*) FROM documents 
   WHERE status = 'COMPLETED' 
   AND embedding_generated = true;
   ```

2. Verify embedding service is working:
   ```python
   from services.embedding_service import get_embedding_service
   service = get_embedding_service()
   embedding = service.generate_embedding("test query")
   print(len(embedding))  # Should be 1536
   ```

### Slow Search Performance
1. Check pgvector index exists:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'documents' 
   AND indexname LIKE '%embedding%';
   ```

2. Monitor query execution time:
   ```python
   import time
   start = time.time()
   results = db.query(...).all()
   print(f"Query time: {(time.time() - start) * 1000}ms")
   ```

### Frontend Not Loading Results
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Check CORS headers in network tab
4. Validate API response format

---

## References

### Documentation
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [FastAPI Router Documentation](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

### Related Files
- `docs/ADMIN-EMBEDDINGS-FEATURE.md` - Embedding generation documentation
- `docs/ARCHITECTURE-DIAGRAM.md` - System architecture overview
- `api/services/embedding_service.py` - Embedding generation service
- `api/models/document.py` - Document model with vector field

### API Endpoints
- `GET /api/search` - Search documents
- `POST /api/rag/search` - RAG-based search (alternative)
- `GET /health` - Health check

---

## Conclusion

The semantic search feature provides PowerNOVA users with direct access to the 100K+ document corpus through intuitive vector similarity search. The implementation balances user experience, performance, and scalability while maintaining consistency with the existing PowerNOVA design system.

**Key Achievements**:
- ✅ Complete full-stack implementation
- ✅ Responsive design (desktop + mobile)
- ✅ Vector similarity search with pgvector
- ✅ Intelligent snippet extraction
- ✅ Source identification
- ✅ Pagination support
- ✅ Performance tracking
- ✅ Clean, maintainable code

**Next Steps**:
1. Deploy to production
2. Monitor search analytics
3. Gather user feedback
4. Iterate on Phase 2 features
