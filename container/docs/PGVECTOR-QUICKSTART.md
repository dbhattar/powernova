# pgvector RAG Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Rebuild Docker Containers (2 minutes)

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/docker

# Stop existing containers
docker-compose down

# Rebuild with pgvector support
docker-compose up --build -d

# Wait for containers to start (check logs)
docker-compose logs -f powernova-api
```

### Step 2: Run Database Migration (30 seconds)

```bash
# Enter API container
docker exec -it powernova-api bash

# Run migration
alembic upgrade head

# Exit container
exit
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade 002_add_documents_crawl -> e64fd1918790, add_pgvector_support
```

### Step 3: Verify Setup (30 seconds)

```bash
# Check if pgvector extension is enabled
docker exec -it powernova-postgres psql -U powernova -d powernova -c "\dx"
```

Should see:
```
                  List of installed extensions
  Name   | Version |   Schema   |         Description          
---------+---------+------------+------------------------------
 vector  | 0.7.0   | public     | vector data type and ivfflat...
```

### Step 4: Test RAG System (2 minutes)

#### 4a. Create a Test Crawl Job

```bash
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=" \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "max_depth": 1,
    "max_pages": 5,
    "file_types": ["html"],
    "allowed_domains": [],
    "include_patterns": [],
    "exclude_patterns": []
  }'
```

#### 4b. Check Crawl Job Status

```bash
# Get job ID from previous response, then check status
curl http://localhost:8000/api/admin/crawl/1 \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0="
```

Wait until `status: "completed"`

#### 4c. Test Semantic Search

```bash
curl -X POST http://localhost:8000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is artificial intelligence?",
    "top_k": 3,
    "similarity_threshold": 0.7
  }'
```

Expected response:
```json
{
  "query": "What is artificial intelligence?",
  "num_results": 3,
  "results": [
    {
      "id": 1,
      "title": "Artificial intelligence - Wikipedia",
      "similarity": 0.92,
      "content": "Artificial intelligence (AI) is..."
    }
  ]
}
```

#### 4d. Test Question Answering

```bash
curl -X POST http://localhost:8000/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main applications of AI?",
    "top_k": 3,
    "model": "gpt-4o-mini"
  }'
```

Expected response:
```json
{
  "answer": "Based on the crawled documents, the main applications of AI include: 1. Natural language processing...",
  "sources": [
    {
      "title": "Artificial intelligence - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
      "similarity": 0.95
    }
  ],
  "found_relevant_docs": true,
  "num_docs_used": 3
}
```

## ✅ Success Checklist

- [ ] Docker containers running
- [ ] pgvector extension enabled
- [ ] Migration completed
- [ ] Crawl job completed
- [ ] Documents have embeddings
- [ ] Search returns results
- [ ] Question answering works

## 🔍 Verification Commands

### Check if documents have embeddings:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova -c \
  "SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM documents;"
```

### View embedding dimensions:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova -c \
  "SELECT id, title, vector_dims(embedding) as dims FROM documents WHERE embedding IS NOT NULL LIMIT 5;"
```

### Test vector search directly in SQL:
```sql
docker exec -it powernova-postgres psql -U powernova -d powernova

-- In psql:
SELECT 
    id,
    title,
    LEFT(content, 100) as preview
FROM documents
WHERE embedding IS NOT NULL
LIMIT 5;
```

## 🐛 Troubleshooting

### Container won't start?
```bash
docker-compose logs powernova-api
```

### Migration fails?
```bash
# Check current migration version
docker exec -it powernova-api alembic current

# Check migration history
docker exec -it powernova-api alembic history
```

### No embeddings generated?
```bash
# Check logs for errors
docker logs powernova-api | grep -i embedding

# Manually trigger embedding generation
curl -X POST http://localhost:8000/api/rag/reprocess-embeddings?limit=10
```

### Search returns empty?
```bash
# Check how many docs have embeddings
curl http://localhost:8000/api/admin/documents?limit=10 \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0="
```

## 📊 Monitor Progress

### Watch API logs:
```bash
docker logs -f powernova-api
```

### Watch PostgreSQL logs:
```bash
docker logs -f powernova-postgres
```

### View crawl job progress:
```bash
# Replace {job_id} with actual ID
curl http://localhost:8000/api/admin/crawl/{job_id} \
  -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0="
```

## 🎯 Next Steps

1. ✅ Test with your own content
2. ✅ Adjust similarity threshold (0.5 - 0.9)
3. ✅ Experiment with different models (gpt-4o-mini, gpt-4o)
4. ✅ Integrate RAG into your chat interface
5. ✅ Deploy to production (Supabase + Azure)

## 📚 Full Documentation

See [PGVECTOR-RAG-IMPLEMENTATION.md](./PGVECTOR-RAG-IMPLEMENTATION.md) for complete details.

---

**That's it! You now have a working RAG system with pgvector!** 🎉
