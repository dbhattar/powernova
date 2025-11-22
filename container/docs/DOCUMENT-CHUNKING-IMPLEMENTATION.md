# Document Chunking System - Implementation Complete

## Overview
The embedding generation system has been upgraded from a **single-embedding-per-document** approach to a **chunk-based embedding system** that gracefully handles large documents without truncation.

## Problem Solved
**Before**: Documents were truncated to 4000 words (~6000-7000 tokens), losing valuable content from large documents.

**After**: Documents are split into overlapping chunks (800 words each with 200-word overlap), with each chunk receiving its own embedding. No content is lost.

## Architecture Changes

### 1. New Database Model: `DocumentChunk`
**File**: `api/models/document_chunk.py`

```python
class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey('documents.id', ondelete='CASCADE'))
    chunk_index = Column(Integer)  # Sequential: 0, 1, 2...
    content = Column(Text)
    word_count = Column(Integer)
    char_start = Column(Integer)   # Character position in original document
    char_end = Column(Integer)
    embedding = Column(Vector(1536))  # OpenAI text-embedding-3-small
    embedding_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

### 2. Migration: `add_document_chunks_table`
**File**: `api/alembic/versions/2025_11_22_0353-80cc28c75bca_add_document_chunks_table.py`

- Creates `document_chunks` table with pgvector support
- Adds indexes on `document_id` and `embedding_generated` for performance
- Cascading delete: when document is deleted, all chunks are deleted

**Status**: ✅ Applied (migration 80cc28c75bca is current)

### 3. Updated `embedding_processor.py`
**File**: `api/services/embedding_processor.py`

**Previous behavior**:
```python
# Generate single embedding for entire document (truncated to 4000 words)
embedding = embedding_service.generate_embedding(document.content)
document.embedding = embedding
document.chunk_count = 1
```

**New behavior**:
```python
# Chunk the document using TextChunker
chunks = text_chunker.chunk_text(document.content)  # 800 words/chunk, 200 overlap

# Generate embedding for EACH chunk (no truncation)
for chunk_text, chunk_meta in chunks:
    embedding = embedding_service.generate_embedding(chunk_text)
    
    # Create DocumentChunk record
    doc_chunk = DocumentChunk(
        document_id=document_id,
        chunk_index=chunk_meta['chunk_index'],
        content=chunk_text,
        word_count=chunk_meta['word_count'],
        char_start=chunk_meta['char_start'],
        char_end=chunk_meta['char_end'],
        embedding=embedding,
        embedding_generated=True
    )
    db.add(doc_chunk)

document.chunk_count = len(chunks)
```

### 4. Updated `rag_service.py`
**File**: `api/services/rag_service.py`

**Previous behavior**:
```sql
SELECT * FROM documents 
WHERE embedding IS NOT NULL 
ORDER BY embedding <=> query_embedding 
LIMIT 5
```

**New behavior**:
```sql
SELECT 
    dc.id as chunk_id,
    dc.chunk_index,
    dc.content as chunk_content,
    dc.word_count,
    d.id as document_id,
    d.title,
    d.url,
    d.document_type,
    1 - (dc.embedding <=> query_embedding) AS similarity
FROM document_chunks dc
INNER JOIN documents d ON dc.document_id = d.id
WHERE dc.embedding IS NOT NULL
AND d.document_scope IN ('platform', 'user', 'conversation')
ORDER BY dc.embedding <=> query_embedding 
LIMIT 5
```

**Result**: Searches individual chunks instead of full documents, providing more precise semantic matches.

## Chunking Strategy

### TextChunker Configuration
- **Chunk size**: 800 words (~1000 tokens)
- **Overlap**: 200 words (25% overlap)
- **Why overlap?**: Prevents information loss at chunk boundaries

### Example
**Document**: 2000 words

**Chunks created**:
1. Chunk 0: words 0-800 (800 words)
2. Chunk 1: words 600-1400 (800 words, starts 200 words before chunk 0 ends)
3. Chunk 2: words 1200-2000 (800 words, starts 200 words before chunk 1 ends)

**Total**: 3 chunks, 3 embeddings, NO truncation

## Benefits

### 1. **No Content Loss**
- Large documents (10,000+ words) are fully processed
- Every section of the document is embedded and searchable

### 2. **Better Search Precision**
- Searching chunks provides more granular matches
- Query about a specific topic finds the exact chunk, not the entire document

### 3. **Efficient Processing**
- Each chunk stays well within OpenAI's 8192 token limit
- No need for aggressive truncation in embedding_service.py

### 4. **Scalable**
- System can handle documents of any size
- Chunks are indexed for fast retrieval

## Migration Path

### New Documents (After This Update)
✅ Automatically chunked when uploaded
✅ Multiple DocumentChunk records created
✅ Each chunk embedded separately
✅ RAG service searches chunks

### Existing Documents (Before This Update)
⚠️ Still have single `documents.embedding` field
⚠️ NOT chunked yet

**Recommendation**: Reprocess existing documents to create chunks

## Reprocessing Existing Documents

### Option 1: Manual Reprocessing
Use the existing `reprocess_failed_embeddings` function:

```python
# In Python shell or endpoint
from services.embedding_processor import process_document_embedding
from database import get_db

db = next(get_db())

# Reprocess a specific document
document_id = 123
success = process_document_embedding(document_id, db)
```

### Option 2: Batch Reprocessing
Create an admin endpoint:

```python
@router.post("/admin/reprocess-all-documents")
def reprocess_all_documents(db: Session = Depends(get_db)):
    """
    Reprocess all documents to create chunks
    (Only for documents that don't have chunks yet)
    """
    documents = db.query(Document).filter(
        Document.embedding_generated == True,
        Document.chunk_count == None  # Old documents
    ).all()
    
    results = {
        'total': len(documents),
        'success': 0,
        'failed': 0
    }
    
    for doc in documents:
        try:
            # Clear old embedding
            doc.embedding = None
            doc.embedding_generated = False
            db.commit()
            
            # Reprocess with chunking
            success = process_document_embedding(doc.id, db)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
        except Exception as e:
            logger.error(f"Failed to reprocess document {doc.id}: {e}")
            results['failed'] += 1
    
    return results
```

### Option 3: Backward-Compatible Search (Temporary)
Modify `rag_service.py` to search BOTH old embeddings and new chunks:

```sql
-- Search chunks (new documents)
SELECT ... FROM document_chunks WHERE ...

UNION ALL

-- Search documents (old documents without chunks)
SELECT ... FROM documents WHERE embedding IS NOT NULL AND chunk_count IS NULL
```

This allows gradual migration.

## Testing the System

### 1. Upload a Large Document
1. Sign in to the app
2. Create a new conversation
3. Upload a large PDF (e.g., 50-page technical document)

### 2. Check Chunk Creation
```sql
-- Count chunks created
SELECT d.id, d.title, d.chunk_count, COUNT(dc.id) as actual_chunks
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.id = 123
GROUP BY d.id, d.title, d.chunk_count;
```

### 3. Test Search
```python
# Search across chunks
results = rag_service.search_similar_documents(
    query="What is the definition of X?",
    top_k=5,
    conversation_id=456,
    user_id=789
)

# Should return individual chunks with high similarity scores
for result in results:
    print(f"Chunk {result['chunk_index']} of '{result['title']}': {result['similarity']:.2%}")
```

### 4. Verify No Truncation
```sql
-- Check if large documents were fully chunked
SELECT 
    d.id,
    d.title,
    LENGTH(d.content) as original_length,
    d.chunk_count,
    SUM(dc.word_count) as total_chunk_words
FROM documents d
INNER JOIN document_chunks dc ON d.id = dc.document_id
WHERE LENGTH(d.content) > 10000  -- Large documents
GROUP BY d.id, d.title, d.chunk_count
ORDER BY original_length DESC;
```

Expected: `total_chunk_words` should be approximately equal to word count of `original_length` (accounting for overlap)

## Performance Considerations

### Database Indexes
The migration creates indexes on:
- `document_id` - Fast lookup of all chunks for a document
- `embedding_generated` - Filter only processed chunks

### Query Performance
- pgvector uses IVFFlat or HNSW indexes for vector similarity
- Joining `document_chunks` → `documents` adds minimal overhead
- Top-K search remains efficient (sub-second for most queries)

### Storage
- Each chunk: ~1-2 KB content + 6 KB embedding (1536 floats × 4 bytes)
- 100-page document (~30,000 words) = ~40 chunks = ~320 KB total

## Next Steps

### Immediate
1. ✅ Test document upload with large PDF
2. ✅ Verify chunks are created in database
3. ✅ Test RAG search returns chunk results

### Short-term
1. ⏳ Add admin endpoint to reprocess existing documents
2. ⏳ Monitor chunk creation for uploaded documents
3. ⏳ Adjust chunk size/overlap if needed based on search quality

### Long-term
1. ⏳ Implement HNSW index for pgvector (faster than IVFFlat)
2. ⏳ Add chunk deduplication (if multiple chunks are very similar)
3. ⏳ Implement chunk-level metadata (e.g., section headings, page numbers)
4. ⏳ Add chunk visualization in admin panel

## Technical Details

### Embedding Model
- **Model**: text-embedding-3-small (OpenAI)
- **Dimensions**: 1536
- **Token limit**: 8192 tokens/request
- **Our chunks**: ~1000 tokens (well within limit)

### Token Estimation
- 1 word ≈ 1.33 tokens (English)
- 800 words ≈ 1066 tokens
- Leaves 7000+ tokens headroom for edge cases

### Cascading Deletes
When a document is deleted:
```python
# In Document model
chunks = relationship("DocumentChunk", cascade="all, delete-orphan")
```

All associated chunks are automatically deleted from `document_chunks` table.

## Files Modified

1. ✅ `api/models/document_chunk.py` - NEW model
2. ✅ `api/models/__init__.py` - Export DocumentChunk
3. ✅ `api/models/document.py` - Added chunks relationship
4. ✅ `api/alembic/versions/2025_11_22_0353-80cc28c75bca_add_document_chunks_table.py` - NEW migration
5. ✅ `api/services/embedding_processor.py` - Chunk-based processing
6. ✅ `api/services/rag_service.py` - Search chunks instead of documents

## Deployment Status

- ✅ Migration applied (80cc28c75bca)
- ✅ API container rebuilt and running
- ✅ document_chunks table created in PostgreSQL
- ✅ pgvector extension active for chunk embeddings
- ✅ Ready for production use

## Summary

The document chunking system is **fully implemented and deployed**. Large documents are no longer truncated. Each document is split into overlapping chunks, with each chunk receiving its own embedding. The RAG service now searches individual chunks for more precise results.

**No more 4000-word truncation limit!** 🎉
