# Search API Fix - Document Chunk Embeddings

## Problem
The search API was returning 0 results even though:
- 136,585 documents were marked as COMPLETED
- 77,869 documents had `embedding_generated=True`
- BUT: 0 documents had actual embeddings in the `Document.embedding` column

## Root Cause
The system stores embeddings in the **`DocumentChunk` table**, not the `Document` table. The search endpoint was querying the wrong table:

```python
# OLD (INCORRECT) - Looking for embeddings in Document table
results = db.query(Document).filter(
    Document.embedding.isnot(None)  # This was always empty!
).all()
```

## Solution
Updated the search endpoint to:

1. **Query DocumentChunk instead of Document** - Search across document chunks where embeddings actually exist
2. **Deduplicate results by document** - Use `ROW_NUMBER()` window function to select only the best matching chunk per document
3. **Return document-level results** - Show one result per document with the snippet from the best matching chunk

### Key Changes in `/api/routes/search.py`

#### 1. Import DocumentChunk model
```python
from models.document_chunk import DocumentChunk
```

#### 2. Query chunks with similarity search
```python
# Step 1: Calculate similarity scores for all chunks
chunk_scores = db.query(
    DocumentChunk.id.label('chunk_id'),
    DocumentChunk.content,
    Document.url,
    Document.title,
    (1 - DocumentChunk.embedding.cosine_distance(query_embedding)).label('similarity'),
    # Rank chunks within each document by similarity
    func.row_number().over(
        partition_by=DocumentChunk.document_id,
        order_by=text('similarity DESC')
    ).label('rn')
).join(Document).filter(
    DocumentChunk.embedding_generated == True,
    DocumentChunk.embedding.isnot(None)
).subquery()

# Step 2: Select only the best chunk per document (rn = 1)
chunk_results = db.query(chunk_scores).filter(
    chunk_scores.c.rn == 1
).order_by(
    text('similarity DESC')
).all()
```

#### 3. Count unique documents (not total chunks)
```python
# Count distinct documents with searchable chunks
total_docs = db.query(Document.id).join(DocumentChunk).filter(
    DocumentChunk.embedding_generated == True,
    DocumentChunk.embedding.isnot(None),
    Document.status == DocumentStatus.COMPLETED
).distinct().count()
```

## Benefits

1. **Deduplication** - Returns one result per document, not multiple results for different chunks
2. **Best Match** - Selects the most relevant chunk from each document
3. **Accurate Snippets** - Shows the actual matching chunk content, not just document metadata
4. **Correct Pagination** - Paginate by documents (what users expect), not chunks

## Testing

Run the test script to verify:
```bash
cd api
python3 test_search_fix.py
```

This will show:
- Total number of searchable chunks
- Number of unique documents with searchable chunks
- Sample search results

## Expected Behavior

With this fix, searches should now:
- Return results from the 77,869+ documents that have chunk embeddings
- Show the most relevant chunk from each matching document
- Properly paginate through unique documents
- Display accurate similarity scores based on chunk embeddings

## Database Schema

```
Document (1) ----< (N) DocumentChunk
  ├─ id                    ├─ id
  ├─ url                   ├─ document_id (FK)
  ├─ title                 ├─ content
  ├─ content (full text)   ├─ embedding (VECTOR) ← USED FOR SEARCH
  ├─ embedding (NULL)      └─ embedding_generated
  └─ embedding_generated
```

The embeddings are stored at the **chunk level** to handle:
- Documents larger than embedding model token limits
- More granular semantic matching
- Better context retrieval for RAG
