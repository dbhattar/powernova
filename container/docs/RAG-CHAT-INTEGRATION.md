# RAG Chat Integration

## Overview

The PowerNOVA chat interface now uses **Retrieval-Augmented Generation (RAG)** to provide answers based on your crawled documents. When you ask a question, the system:

1. **Searches** the vector database for relevant documents
2. **Retrieves** the top matching documents based on semantic similarity
3. **Augments** the AI prompt with the retrieved context
4. **Generates** an answer that cites the source documents

## Architecture

```
User Question → Vector Search (pgvector) → Document Retrieval → OpenAI (with context) → Streaming Response
                                                                         ↓
                                                                   Source Citations
```

## How It Works

### Backend (`/api/chat/stream`)

The chat endpoint has been enhanced with RAG support:

```python
@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Search for relevant documents using vector similarity
    if request.use_rag:
        rag_service = get_rag_service(db)
        relevant_docs = rag_service.search_similar_documents(
            query=last_user_message,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold
        )
        
        # 2. Build context from retrieved documents
        context = build_context_from_docs(relevant_docs)
        
        # 3. Prepend system message with RAG context
        messages = [{"role": "system", "content": rag_prompt + context}] + messages
    
    # 4. Stream response from OpenAI with augmented context
    # 5. Send sources to frontend first, then stream content
```

### Frontend (`app.js`)

The frontend now handles RAG responses:

```javascript
// Enable RAG in chat requests
body: JSON.stringify({
    messages: messages,
    use_rag: true,        // Enable RAG
    top_k: 5,            // Retrieve top 5 documents
    similarity_threshold: 0.5  // Minimum 50% similarity
})

// Handle streaming response
// 1. Receive sources first (type: 'sources')
// 2. Display source citations below the answer
// 3. Stream content chunks (type: 'content')
// 4. Render markdown with syntax highlighting
```

## Request Format

### Chat Request with RAG

```json
POST /api/chat/stream
{
  "messages": [
    {"role": "user", "content": "What is MISO?"}
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true,
  "use_rag": true,              // Enable RAG
  "top_k": 5,                   // Number of documents to retrieve
  "similarity_threshold": 0.5   // Minimum similarity (0-1)
}
```

### Response Stream (SSE)

The server sends Server-Sent Events in this order:

1. **Sources Event** (if RAG found documents):
```json
data: {
  "type": "sources",
  "sources": [
    {
      "title": "MISO Overview",
      "url": "https://www.misoenergy.org/about",
      "similarity": 0.87
    }
  ]
}
```

2. **Content Events** (streamed chunks):
```json
data: {
  "type": "content",
  "content": "MISO (Midcontinent Independent System Operator)",
  "id": "chatcmpl-...",
  "role": "assistant",
  "model": "gpt-4o-mini"
}
```

3. **Done Event**:
```json
data: [DONE]
```

## Configuration

### Similarity Threshold

Controls how similar documents must be to be included:

- **0.5** (default): Moderate similarity - good balance
- **0.7**: High similarity - very relevant documents only
- **0.3**: Low similarity - cast a wider net

### Top K Documents

Number of documents to retrieve:

- **5** (default): Good for most questions
- **10**: For complex topics requiring more context
- **3**: For simple, focused questions

### Model Selection

- **gpt-4o-mini** (default): Fast, cost-effective, good for most queries
- **gpt-4o**: More powerful, better reasoning, higher cost
- **gpt-3.5-turbo**: Budget option, faster but less capable

## User Experience

### When Documents Are Found

1. User asks: "What are MISO's capacity planning requirements?"
2. System searches vector DB for similar documents
3. Finds 3 relevant documents from misoenergy.org
4. **Sources appear first** at the bottom of the response
5. AI streams answer citing the documents
6. User can click source links to verify information

### When No Documents Match

1. User asks: "What's the weather today?"
2. System searches but finds no relevant documents (similarity < 0.5)
3. AI responds: "I don't have enough information in my documents..."
4. Falls back to general knowledge (if appropriate)

## Benefits

### ✅ Accuracy
- Answers grounded in your actual crawled documents
- Reduces hallucinations and incorrect information
- Citations allow verification

### ✅ Transparency
- Shows which documents were used
- Displays similarity scores
- Links to original sources

### ✅ Up-to-date
- Uses YOUR latest crawled content
- Not limited to AI's training cutoff date
- Reflects current regulations, prices, schedules

### ✅ Domain-Specific
- Focused on energy markets and grid operations
- Uses your curated document set
- No generic internet knowledge pollution

## Testing

### 1. Crawl Some Documents

```bash
# Via Admin UI
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://www.misoenergy.org/",
    "max_depth": 2,
    "max_pages": 50
  }'
```

### 2. Wait for Embeddings

Check job status - wait for `embedding_generated: true`

### 3. Ask Questions

Open the chat interface and ask:
- "What is MISO?"
- "What are capacity planning requirements?"
- "How do I participate in MISO markets?"

### 4. Verify RAG is Working

- ✅ Source citations appear below answers
- ✅ Answers reference your crawled documents
- ✅ Clicking sources opens the original pages
- ✅ Similar questions get consistent answers

## Troubleshooting

### No Sources Appearing

**Possible Causes:**
1. No documents have embeddings yet
2. Similarity threshold too high
3. Question not related to crawled content

**Solutions:**
```bash
# Check if documents have embeddings
curl http://localhost:8000/api/admin/crawl-jobs

# Reprocess embeddings
curl -X POST http://localhost:8000/api/rag/reprocess-embeddings

# Lower similarity threshold in frontend (app.js line 263)
similarity_threshold: 0.3
```

### Wrong Documents Retrieved

**Possible Causes:**
1. Embeddings not capturing semantic meaning
2. Need more specific queries
3. Document chunks too large/small

**Solutions:**
- Be more specific in questions
- Check document chunking (800 words default)
- Review similarity scores - should be > 0.6 for good matches

### Slow Response

**Possible Causes:**
1. Retrieving too many documents (high top_k)
2. Vector search on large dataset
3. OpenAI API latency

**Solutions:**
- Reduce `top_k` to 3-5
- Consider HNSW index (already enabled)
- Use gpt-4o-mini instead of gpt-4o

## Performance

### Typical Latency

- **Vector Search**: 10-50ms for 10K documents
- **OpenAI Streaming**: Starts in 200-500ms
- **First Token**: ~500-700ms total
- **Full Response**: 2-5 seconds

### Scaling

- **< 100K docs**: Excellent performance with pgvector
- **100K-1M docs**: Good performance, consider index tuning
- **> 1M docs**: May need dedicated vector DB (Pinecone, Weaviate)

## Cost

### Per Query (with 5 docs @ 500 words each)

- **Context tokens**: ~2,500 (retrieved docs)
- **Response tokens**: ~300 (average answer)
- **Cost**: ~$0.0008 per query (gpt-4o-mini)

### Monthly (10K queries)

- **Total cost**: ~$8/month
- **vs. Pinecone**: $70/month just for vector DB
- **Savings**: $62/month

## Future Enhancements

### Planned
- [ ] Hybrid search (keyword + vector)
- [ ] Document filtering by domain/type
- [ ] Conversational context retention
- [ ] Citation highlighting in responses
- [ ] Document freshness scoring

### Possible
- [ ] Multi-query retrieval
- [ ] Reranking with cross-encoders
- [ ] Parent document retrieval
- [ ] Metadata filtering UI
- [ ] A/B testing different models

## Related Documentation

- [PGVECTOR-RAG-IMPLEMENTATION.md](./PGVECTOR-RAG-IMPLEMENTATION.md) - Technical implementation
- [PGVECTOR-QUICKSTART.md](./PGVECTOR-QUICKSTART.md) - Quick start guide
- [ETHICAL-CRAWLING.md](./ETHICAL-CRAWLING.md) - Crawler ethics and robots.txt
- [RAG-QUICKSTART.md](./RAG-QUICKSTART.md) - RAG setup guide

---

**Summary**: The chat interface now uses RAG by default (`use_rag: true`). When you ask questions, it searches your crawled documents, retrieves the most relevant ones, and generates answers that cite those sources. This provides accurate, transparent, domain-specific responses grounded in your actual content.
