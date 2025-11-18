# RAG System - Web Crawler Setup

This document explains how to set up and use the web crawler for the PowerNOVA RAG (Retrieval-Augmented Generation) system.

## Overview

The crawler system allows admins to:
- Crawl websites and extract content
- Download specific file types (HTML, PDF, DOCX, etc.)
- Upload documents to Azure Blob Storage
- Extract text for RAG indexing
- Track crawl jobs and documents in the database

## Architecture

The system consists of several components:

1. **Admin UI** (`app/admin.html`) - Web interface for managing crawl jobs
2. **Admin API** (`api/routes/admin.py`) - REST endpoints for job management
3. **Web Crawler** (`api/services/crawler.py`) - Crawls websites and downloads documents
4. **Document Processor** (`api/services/document_processor.py`) - Extracts text from various formats
5. **Azure Storage Service** (`api/services/azure_storage.py`) - Uploads to Azure Blob Storage

## Environment Variables

Add these to your `.env` file or Azure App Service configuration:

### Required

```bash
# Admin authentication
ADMIN_KEY=your-secure-admin-key-here

# Azure Storage for documents
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccountname;AccountKey=yourkey;EndpointSuffix=core.windows.net
```

### Optional

```bash
# Azure Storage container name (defaults to "powernova-documents")
AZURE_STORAGE_CONTAINER_NAME=powernova-documents
```

## Getting Azure Storage Connection String

1. Go to Azure Portal
2. Navigate to your Storage Account
3. Go to "Access keys" in the left menu
4. Copy the "Connection string" value
5. Set it as `AZURE_STORAGE_CONNECTION_STRING` environment variable

## Setting Up Locally

1. **Install dependencies:**
   ```bash
   cd api
   pip install -r requirements.txt
   ```

2. **Set environment variables:**
   ```bash
   export ADMIN_KEY="your-secure-key"
   export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
   ```

3. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

4. **Start the API:**
   ```bash
   uvicorn main:app --reload
   ```

5. **Access admin panel:**
   - Open `http://localhost:8000/admin.html`
   - Enter your admin key
   - Create your first crawl job

## Setting Up on Azure

### Add Environment Variables

Using Azure CLI:
```bash
az webapp config appsettings set \
  --resource-group your-rg \
  --name your-app-name \
  --settings \
    ADMIN_KEY="your-secure-key" \
    AZURE_STORAGE_CONNECTION_STRING="your-connection-string" \
    AZURE_STORAGE_CONTAINER_NAME="powernova-documents"
```

Or in Azure Portal:
1. Go to your App Service
2. Configuration > Application settings
3. Add the environment variables
4. Save and restart

### Create Storage Account

If you don't have one:
```bash
# Create storage account
az storage account create \
  --name powernovadocs \
  --resource-group your-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name powernovadocs \
  --resource-group your-rg \
  --query connectionString -o tsv
```

## Using the Crawler

### Creating a Crawl Job

1. Open the admin panel
2. Enter your admin key
3. Fill in the crawl job form:
   - **Start URL**: The website to crawl (e.g., `https://docs.example.com`)
   - **Max Depth**: How many link levels to follow (0 = only start URL)
   - **Max Pages**: Maximum pages to crawl (limit: 1000)
   - **File Types**: Comma-separated (e.g., `html,pdf,docx`)
   - **Allowed Domains**: Optional, leave empty to stay on same domain
   - **Include Patterns**: Optional regex for URLs to include
   - **Exclude Patterns**: Optional regex for URLs to exclude

4. Click "Start Crawl Job"

### Example Configurations

**Crawl a documentation site:**
```
Start URL: https://docs.python.org/3/
Max Depth: 3
Max Pages: 200
File Types: html
Allowed Domains: docs.python.org
Exclude Patterns: /download/,/genindex/
```

**Download PDFs from a specific section:**
```
Start URL: https://example.com/resources
Max Depth: 2
Max Pages: 50
File Types: pdf
Include Patterns: /resources/.*
```

**Comprehensive site crawl:**
```
Start URL: https://myblog.com
Max Depth: 5
Max Pages: 500
File Types: html,pdf,docx
Exclude Patterns: /login,/signup,/admin
```

### Monitoring Jobs

The admin panel shows:
- Total jobs created
- Currently running jobs
- Total documents indexed
- Documents with embeddings (ready for RAG)

Each job displays:
- Status (Pending, Running, Completed, Failed, Cancelled)
- Progress (pages crawled / max pages)
- Documents found
- Start/completion time
- Error messages (if failed)

### Managing Jobs

- **Cancel**: Stop a running job
- **Delete**: Remove job and all its documents
- **View Documents**: See all documents from this job (coming soon)

## How It Works

1. **Job Creation**: Admin creates a crawl job via the UI
2. **Background Task**: Job starts in a background task (non-blocking)
3. **URL Discovery**: Crawler follows links up to max depth
4. **Document Download**: Downloads HTML pages and specified file types
5. **Text Extraction**: Extracts text content from each document
6. **Azure Upload**: Uploads original files to Azure Blob Storage
7. **Database Storage**: Saves metadata and extracted text to PostgreSQL
8. **Status Updates**: Updates job progress in real-time

## File Types Supported

- **HTML/HTM**: Web pages (text extraction with BeautifulSoup)
- **PDF**: Adobe PDF documents (text extraction with PyPDF2)
- **DOCX**: Microsoft Word documents (text extraction with python-docx)
- **TXT/MD**: Plain text and Markdown files

## Document Storage

Documents are stored in Azure Blob Storage with this structure:
```
container/
  job_1/
    abc123_20241118_120000.pdf
    def456_20241118_120001.html
  job_2/
    ...
```

Each document gets:
- Unique filename based on URL hash + timestamp
- Organized by job ID
- Public URL for access
- Metadata stored in database

## API Endpoints

All endpoints require `X-Admin-Key` header.

- `POST /api/admin/crawl` - Create crawl job
- `GET /api/admin/crawl` - List all jobs
- `GET /api/admin/crawl/{id}` - Get job details
- `DELETE /api/admin/crawl/{id}` - Delete job
- `POST /api/admin/crawl/{id}/cancel` - Cancel running job
- `GET /api/admin/documents` - List documents
- `GET /api/admin/stats` - Get dashboard statistics

## Troubleshooting

### "Azure Storage not configured"
- Check `AZURE_STORAGE_CONNECTION_STRING` is set
- Verify connection string is valid
- Check storage account exists

### Crawl job stuck in "Running"
- Check API logs for errors
- Job might have crashed - restart the API
- Consider cancelling and recreating the job

### No documents found
- Check URL patterns (include/exclude)
- Verify file types are correct
- Check allowed domains
- Look at job error messages

### Import errors in logs
- Run `pip install -r requirements.txt`
- Verify all dependencies installed

## Security Considerations

1. **Admin Key**: Use a strong, random admin key
2. **Storage Access**: Blob storage should have appropriate access controls
3. **Rate Limiting**: Crawler includes polite delays (0.5s between requests)
4. **Domain Restrictions**: Always set allowed domains to prevent abuse
5. **Max Pages**: Limit crawl scope to prevent resource exhaustion

## Next Steps

After crawling documents:
1. Generate embeddings for each document (coming soon)
2. Chunk documents for better retrieval (coming soon)
3. Use documents in RAG chat responses (coming soon)

## Support

For issues or questions, check:
- Application logs in Azure Portal
- Database tables: `crawl_jobs`, `documents`
- Azure Storage container contents
