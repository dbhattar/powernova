# pgvector RAG Implementation Guide

## Overview

PowerNOVA now includes a complete RAG (Retrieval-Augmented Generation) system using PostgreSQL's pgvector extension for semantic search over crawled documents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RAG System Flow                          │
└─────────────────────────────────────────────────────────────┘

1. Document Crawling:
   Crawler → Extract Text → Save to PostgreSQL → Generate Embedding

2. Embedding Generation:
   Document Content → OpenAI API → 1536-dim Vector → PostgreSQL (pgvector)

3. Search & Answer:
   User Question → OpenAI Embedding → pgvector Search → Top-K Docs → GPT-4 → Answer
```

## Components

### 1. Database (pgvector)
- **Extension**: pgvector for PostgreSQL
- **Storage**: Vectors stored in `documents.embedding` column
- **Index**: HNSW index for fast similarity search
- **Dimensions**: 1536 (OpenAI text-embedding-3-small)

### 2. Services

#### `text_chunker.py`
- Splits documents into manageable chunks
- Default: 800 words per chunk with 200 word overlap
- Prevents information loss at boundaries

#### `embedding_service.py`
- Generates embeddings using OpenAI
- Model: `text-embedding-3-small`
- Cost: $0.02 per 1M tokens (5x cheaper than ada-002)
- Supports batch processing

#### `embedding_processor.py`
- Orchestrates embedding generation
- Triggered after document save
- Handles failures gracefully

#### `rag_service.py`
- Semantic search using pgvector
- Cosine similarity for ranking
- GPT-4 for answer generation

### 3. API Endpoints

#### POST `/api/rag/search`
Search for similar documents

```json
{
  "query": "How do I use PowerNOVA?",
  "top_k": 5,
  "similarity_threshold": 0.7,
  "filters": {
    "document_type": "html",
    "crawl_job_id": 5
  }
}
```

Response:
```json
{
  "query": "How do I use PowerNOVA?",
  "num_results": 3,
  "results": [
    {
      "id": 123,
      "title": "PowerNOVA Getting Started",
      "url": "https://powernova.ai/docs/getting-started",
      "content": "PowerNOVA is...",
      "similarity": 0.92
    }
  ]
}
```

#### POST `/api/rag/ask`
Ask a question and get AI-generated answer

```json
{
  "question": "What features does PowerNOVA have?",
  "top_k": 5,
  "model": "gpt-4o-mini"
}
```

Response:
```json
{
  "answer": "PowerNOVA has the following features: 1. AI-powered chat...",
  "sources": [
    {
      "title": "Features Overview",
      "url": "https://powernova.ai/features",
      "similarity": 0.95
    }
  ],
  "found_relevant_docs": true,
  "num_docs_used": 3
}
```

#### POST `/api/rag/reprocess-embeddings`
Reprocess documents without embeddings

```json
{
  "limit": 100
}
```

## Setup Instructions

### 1. Update Docker Compose (✅ Done)
```yaml
powernova-postgres:
  image: pgvector/pgvector:pg16  # ← Changed from postgres:16-alpine
```

### 2. Install Dependencies
```bash
cd api
pip install pgvector==0.3.6
```

Or rebuild Docker container (recommended):
```bash
cd docker
docker-compose down
docker-compose up --build
```

### 3. Run Database Migration
```bash
cd api
alembic upgrade head
```

This will:
- ✅ Enable pgvector extension
- ✅ Add `embedding` column to `documents` table
- ✅ Create HNSW index for fast similarity search

### 4. Set Environment Variables

Add to `.env`:
```bash
# Embedding Configuration
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# OpenAI API Key (required)
OPENAI_API_KEY=sk-...
```

### 5. Test the Setup

#### Test 1: Create a crawl job
```bash
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://example.com",
    "max_pages": 10,
    "file_types": ["html"]
  }'
```

#### Test 2: Wait for crawl to complete, then search
```bash
curl -X POST http://localhost:8000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is this website about?",
    "top_k": 5
  }'
```

#### Test 3: Ask a question
```bash
curl -X POST http://localhost:8000/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What information is available on this site?",
    "top_k": 5
  }'
```

## How It Works

### Document Processing Flow

1. **Crawler downloads document** → Saves to Azure Blob Storage
2. **Text extraction** → Uses BeautifulSoup/PyPDF2/python-docx
3. **Save to PostgreSQL** → Full text stored in `documents.content`
4. **Generate embedding** → OpenAI API converts text to 1536-dim vector
5. **Store vector** → Saved in `documents.embedding` column (pgvector)
6. **Index** → HNSW index enables fast similarity search

### Search Flow

1. **User asks question** → "How do I use PowerNOVA?"
2. **Generate query embedding** → OpenAI converts question to vector
3. **Vector similarity search** → pgvector finds closest documents (cosine similarity)
4. **Rank by similarity** → Documents sorted by cosine similarity score
5. **Build context** → Top-K documents combined as context
6. **Generate answer** → GPT-4 generates answer using context
7. **Return with sources** → Answer + source documents with citations

## SQL Examples

### Direct Vector Search
```sql
-- Find documents similar to a query
SELECT 
    id,
    title,
    url,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM documents
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Filtered Vector Search
```sql
-- Search with filters
SELECT 
    id,
    title,
    1 - (embedding <=> :query_vector::vector) AS similarity
FROM documents
WHERE 
    embedding IS NOT NULL
    AND document_type = 'html'
    AND crawl_job_id = 5
    AND (1 - (embedding <=> :query_vector::vector)) >= 0.7
ORDER BY embedding <=> :query_vector::vector
LIMIT 5;
```

### Check Embedding Coverage
```sql
-- How many documents have embeddings?
SELECT 
    COUNT(*) as total_docs,
    COUNT(embedding) as docs_with_embeddings,
    ROUND(COUNT(embedding)::numeric / COUNT(*)::numeric * 100, 2) as coverage_pct
FROM documents;
```

## Performance

### Expected Performance (< 100K documents):

| Documents | Embeddings | Query Time | Notes |
|-----------|------------|------------|-------|
| 1,000 | 1,000 | ~20ms | Excellent |
| 10,000 | 10,000 | ~30ms | Very Good |
| 50,000 | 50,000 | ~60ms | Good |
| 100,000 | 100,000 | ~80-100ms | Acceptable |

### Optimization Tips:

1. **HNSW Index** (already configured)
   ```sql
   CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
   ```

2. **Partial Index** for filtered searches
   ```sql
   CREATE INDEX ON documents (crawl_job_id, document_type) 
   WHERE embedding IS NOT NULL;
   ```

3. **Connection Pooling** (already configured in database.py)

4. **Batch Embedding Generation** for large crawls

## Cost Estimates

### For 100,000 Documents:

**One-time Embedding Generation:**
```
100,000 docs × 500 words avg = 50M words
50M words × 1.33 tokens/word = 66.5M tokens
66.5M tokens × $0.02/1M = $1.33
```

**Monthly Costs:**
```
PostgreSQL: $0 (included in existing DB)
Storage: ~2 GB vectors = negligible
OpenAI queries: Pay-per-use (~$0.01 per 100 searches)
```

**Total: ~$1.33 one-time + $0-5/month**

Compare to Pinecone: $70/month minimum!

## Troubleshooting

### Issue: "Extension 'vector' does not exist"
```sql
-- Connect to database and enable extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "Embeddings not generating"
Check logs:
```bash
docker logs powernova-api | grep embedding
```

Reprocess failed embeddings:
```bash
curl -X POST http://localhost:8000/api/rag/reprocess-embeddings?limit=100
```

### Issue: "Search returns no results"
Check if documents have embeddings:
```sql
SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL;
```

### Issue: "Slow queries"
Check index exists:
```sql
\d+ documents
-- Should see: documents_embedding_idx (hnsw)
```

## Production Deployment

### Supabase Setup:
1. Supabase already has pgvector installed!
2. Run migration: `alembic upgrade head`
3. Add environment variables to Azure App Service
4. Deploy as usual

### Azure App Service Environment Variables:
```bash
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
OPENAI_API_KEY=sk-...
```

## Future Enhancements

1. **Chunking Strategy**: Implement `document_chunks` table for very large documents
2. **Hybrid Search**: Combine full-text search (PostgreSQL) + vector search
3. **Reranking**: Use cross-encoder for better ranking
4. **Caching**: Cache embeddings for common queries
5. **Queue System**: Use Azure Service Bus for async embedding generation

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector with SQLAlchemy](https://github.com/pgvector/pgvector-python)

## Success! 🎉

You now have a production-ready RAG system with:
- ✅ Vector similarity search
- ✅ AI-powered question answering
- ✅ Cost-effective ($1.33 for 100K docs vs $70/month)
- ✅ Fast queries (< 100ms for 100K docs)
- ✅ Easy to scale (up to 1M+ vectors)
- ✅ Integrated with existing PostgreSQL
