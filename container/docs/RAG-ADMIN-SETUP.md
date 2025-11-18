# RAG System - Admin Crawl Manager

## Overview

This is the first phase of implementing a RAG (Retrieval-Augmented Generation) system for PowerNOVA. The admin interface allows you to:

- 🕷️ **Crawl websites** with configurable depth and scope
- 📄 **Download documents** (HTML, PDF, DOCX, etc.)
- 💾 **Store in Azure Blob Storage** for persistence
- 📊 **Track crawl jobs** with real-time status updates
- 🔍 **Manage documents** for RAG indexing

---

## What's Been Implemented

### ✅ Phase 1 Complete

1. **Database Models** (`api/models/`)
   - `Document` - Stores crawled documents and metadata
   - `CrawlJob` - Manages web crawling operations
   - Status enums for tracking progress

2. **Database Migration** (`api/alembic/versions/002_add_documents_crawl.py`)
   - Creates `documents` table
   - Creates `crawl_jobs` table
   - Adds proper indexes and constraints

3. **Admin API Endpoints** (`api/routes/admin.py`)
   - `POST /api/admin/crawl` - Create new crawl job
   - `GET /api/admin/crawl` - List all crawl jobs
   - `GET /api/admin/crawl/{id}` - Get specific job
   - `DELETE /api/admin/crawl/{id}` - Delete job
   - `POST /api/admin/crawl/{id}/cancel` - Cancel running job
   - `GET /api/admin/documents` - List documents
   - `GET /api/admin/stats` - Dashboard statistics

4. **Admin UI** (`website/admin.html`)
   - Beautiful, responsive admin dashboard
   - Create crawl jobs with configuration
   - Monitor job status in real-time
   - View statistics and metrics
   - Auto-refreshes every 10 seconds

---

## Database Schema

### `crawl_jobs` Table

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| start_url | String(2048) | URL to start crawling |
| max_depth | Integer | Max crawl depth (0-10) |
| max_pages | Integer | Max pages to crawl (1-1000) |
| allowed_domains | JSON | List of allowed domains |
| file_types | JSON | File types to download |
| url_patterns | JSON | Include/exclude patterns |
| status | Enum | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| pages_crawled | Integer | Number of pages processed |
| documents_found | Integer | Number of documents discovered |
| error_message | Text | Error details if failed |
| started_at | DateTime | Job start time |
| completed_at | DateTime | Job completion time |
| created_at | DateTime | Record creation |
| updated_at | DateTime | Record last update |

### `documents` Table

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| url | String(2048) | Original URL |
| title | String(500) | Document title |
| content | Text | Extracted text content |
| document_type | Enum | PDF, HTML, TEXT, MARKDOWN, DOCX, OTHER |
| file_path | String(1024) | Path in Azure Blob Storage |
| blob_url | String(2048) | Public URL |
| file_size | Integer | Size in bytes |
| status | Enum | PENDING, PROCESSING, COMPLETED, FAILED |
| error_message | Text | Error details |
| metadata | JSON | Additional metadata |
| crawl_job_id | Integer | Foreign key to crawl_job |
| embedding_generated | Boolean | Embeddings ready? |
| chunk_count | Integer | Number of text chunks |
| created_at | DateTime | Record creation |
| updated_at | DateTime | Record last update |

---

## How to Use

### 1. Run Database Migrations

First, apply the new migrations to create the tables:

```bash
# Locally
cd api
python -m alembic upgrade head

# On Azure
./scripts/azure-run-migrations.sh
```

### 2. Access the Admin Page

Open in your browser:
- **Local**: http://localhost:8080/admin.html
- **Production**: https://powernova.ai/admin.html (after deployment)

### 3. Create a Crawl Job

Fill out the form:
- **Start URL**: The URL to begin crawling
- **Max Depth**: How many link layers to follow (0 = only the start URL)
- **Max Pages**: Limit on total pages to crawl
- **File Types**: `html,pdf,docx` (comma-separated)
- **Allowed Domains**: Optional - leave empty to stay on same domain
- **Include Patterns**: Regex for URLs to include (e.g., `/docs/.*`)
- **Exclude Patterns**: Regex for URLs to skip (e.g., `/login,/logout`)

Click **Start Crawl Job** to begin.

### 4. Monitor Progress

The dashboard automatically refreshes every 10 seconds showing:
- Job status (PENDING → RUNNING → COMPLETED)
- Pages crawled vs max pages
- Documents found
- Any errors encountered

---

## API Examples

### Create Crawl Job

```bash
curl -X POST "http://localhost:8000/api/admin/crawl" \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://example.com",
    "max_depth": 2,
    "max_pages": 50,
    "file_types": ["html", "pdf"],
    "allowed_domains": [],
    "include_patterns": ["/docs/.*"],
    "exclude_patterns": ["/login", "/logout"]
  }'
```

### List Crawl Jobs

```bash
curl "http://localhost:8000/api/admin/crawl"
```

### Get Statistics

```bash
curl "http://localhost:8000/api/admin/stats"
```

Response:
```json
{
  "crawl_jobs": {
    "total": 5,
    "running": 1,
    "pending": 0,
    "completed": 3,
    "failed": 1
  },
  "documents": {
    "total": 47,
    "with_embeddings": 0,
    "pending": 5,
    "processing": 2,
    "completed": 35,
    "failed": 5
  }
}
```

---

## Next Steps (To Be Implemented)

### Phase 2: Web Crawler Service

- [ ] Implement actual web crawler using BeautifulSoup/Scrapy
- [ ] Handle different document types (PDF, DOCX extraction)
- [ ] Respect robots.txt and rate limiting
- [ ] Run crawlers as background tasks
- [ ] Content extraction and cleaning

### Phase 3: Azure Blob Storage Integration

- [ ] Create Azure Storage Account
- [ ] Configure connection strings
- [ ] Upload documents to blob storage
- [ ] Generate public URLs
- [ ] Handle file metadata

### Phase 4: Text Chunking & Embeddings

- [ ] Split documents into chunks
- [ ] Generate embeddings using OpenAI
- [ ] Store embeddings in vector database (Azure AI Search or Pinecone)
- [ ] Create similarity search API

### Phase 5: RAG Integration

- [ ] Update chat endpoint to query relevant documents
- [ ] Implement semantic search
- [ ] Add context to OpenAI prompts
- [ ] Show sources/citations in responses

---

## Configuration

### Environment Variables Needed (Future)

```bash
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_NAME=documents

# OpenAI for embeddings
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Optional: Vector Database
AZURE_AI_SEARCH_ENDPOINT=your-endpoint
AZURE_AI_SEARCH_API_KEY=your-key
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Admin UI (HTML/JS)               │
│  - Create crawl jobs                            │
│  - Monitor status                               │
│  - Manage documents                             │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│            FastAPI Admin Routes                 │
│  POST /admin/crawl                              │
│  GET  /admin/crawl                              │
│  GET  /admin/documents                          │
│  GET  /admin/stats                              │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│          PostgreSQL Database                    │
│  - crawl_jobs table                             │
│  - documents table                              │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Web Crawler Service (Coming Soon)          │
│  - Fetch pages                                  │
│  - Extract content                              │
│  - Download files                               │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│         Azure Blob Storage (Coming Soon)         │
│  - Store documents                              │
│  - Serve public URLs                            │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Embedding Generation (Coming Soon)          │
│  - Text chunking                                │
│  - OpenAI embeddings                            │
│  - Vector storage                               │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│         RAG Chat Integration (Future)            │
│  - Semantic search                              │
│  - Context injection                            │
│  - Source attribution                           │
└─────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### New Files
- `api/models/document.py` - Document model
- `api/models/crawl_job.py` - CrawlJob model
- `api/routes/admin.py` - Admin API endpoints
- `api/alembic/versions/002_add_documents_crawl.py` - Migration
- `website/admin.html` - Admin UI

### Modified Files
- `api/models/__init__.py` - Added new model exports
- `api/main.py` - Registered admin router

---

## Testing the Admin Page

1. **Start the API**:
   ```bash
   cd api
   uvicorn main:app --reload --port 8000
   ```

2. **Open the admin page**:
   ```bash
   open http://localhost:8080/admin.html
   ```
   (Assuming you have nginx serving the website on port 8080)

3. **Create a test crawl job**:
   - Enter URL: `https://example.com`
   - Max Depth: `1`
   - Max Pages: `10`
   - Click "Start Crawl Job"

4. **Check the database**:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM crawl_jobs;"
   ```

---

## Security Considerations

⚠️ **Important**: The admin page currently has NO authentication!

Before deploying to production:
1. Add authentication (JWT tokens, session-based, etc.)
2. Restrict access to admin routes
3. Add rate limiting for crawl job creation
4. Validate URLs to prevent SSRF attacks
5. Implement proper error handling
6. Add logging and monitoring

---

## Summary

✅ **Complete**: Database models, API endpoints, Admin UI
⏳ **Next**: Web crawler implementation, Azure Blob Storage
🎯 **Goal**: Full RAG system for context-aware chat responses

The foundation is ready! Next step is implementing the actual web crawler service to populate the database with real content.
