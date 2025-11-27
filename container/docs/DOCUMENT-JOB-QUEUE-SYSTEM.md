# Document Processing Job Queue System

**Date**: November 27, 2025  
**Author**: AI Assistant  
**Status**: ✅ Implemented

## Overview

This document describes the implementation of an asynchronous job queue system for document processing in PowerNova. The system decouples document crawling from embedding generation, making the architecture more scalable, resilient, and maintainable.

## Problem Statement

### Original Architecture Issues

**Before**: Document processing was tightly coupled with crawling:

```python
# In crawler.py _save_fetched_document()
document = Document(...)
db.add(document)
db.commit()

# Process embedding IMMEDIATELY (blocking)
from services.embedding_processor import process_document_embedding
process_document_embedding(document.id, db)  # Blocks crawler!
```

**Problems**:
1. **Blocking**: Crawler had to wait for embedding generation (slow)
2. **Error Propagation**: Embedding failures could disrupt entire crawl
3. **No Retry Logic**: Failed embeddings required manual intervention
4. **Resource Intensive**: All processing happened in crawler process
5. **No Visibility**: Couldn't track processing status independently
6. **Scalability Issues**: Couldn't scale crawling and processing separately

## Solution Implemented

### New Architecture: Job Queue Pattern

**After**: Decoupled processing via job queue:

```python
# In crawler.py _save_fetched_document()
document = Document(...)
db.add(document)
db.commit()

# Create job entry (fast, non-blocking)
document_job = DocumentJob(
    document_id=document.id,
    status=DocumentJobStatus.PENDING
)
db.add(document_job)
db.commit()

# Document processor handles it later (asynchronously)
```

**Benefits**:
1. **Non-Blocking**: Crawler completes quickly, processing happens later
2. **Error Isolation**: Processing failures don't affect crawling
3. **Automatic Retries**: Failed jobs can be retried automatically
4. **Independent Scaling**: Can run multiple processors
5. **Full Visibility**: Track job status, timing, errors
6. **Better Resource Management**: Process documents in batches

## Implementation Details

### 1. DocumentJob Model

**File**: `api/models/document_job.py`

```python
class DocumentJobStatus(str, enum.Enum):
    PENDING = "PENDING"          # Job created, waiting for processing
    PROCESSING = "PROCESSING"    # Currently being processed
    COMPLETED = "COMPLETED"      # Successfully completed
    FAILED = "FAILED"           # Failed after max retries

class DocumentJob(Base, TimestampMixin):
    __tablename__ = "document_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), 
                        nullable=False, index=True, unique=True)
    
    status = Column(SQLEnum(DocumentJobStatus), nullable=False, 
                   default=DocumentJobStatus.PENDING, index=True)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    processor_id = Column(String(100), nullable=True)
```

**Key Features**:
- One job per document (unique constraint on `document_id`)
- CASCADE delete: job removed when document deleted
- Indexed on `status` for fast job polling
- Composite index on `(status, created_at)` for FIFO processing
- Tracks retry attempts and processor identity

### 2. Database Migration

**File**: `api/alembic/versions/2025_11_27_0110-7036e3afc055_create_document_jobs_table.py`

```python
def upgrade() -> None:
    op.create_table(
        'document_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 
                                    name='documentjobstatus'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('processor_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    )
    
    # Indexes for efficient querying
    op.create_index('ix_document_jobs_id', 'document_jobs', ['id'])
    op.create_index('ix_document_jobs_document_id', 'document_jobs', ['document_id'], unique=True)
    op.create_index('ix_document_jobs_status', 'document_jobs', ['status'])
    op.create_index('ix_document_jobs_status_created', 'document_jobs', ['status', 'created_at'])
```

### 3. Updated Crawler

**File**: `api/services/crawler.py`

**Import Changes**:
```python
from models import (CrawlJob, CrawlStatus, Document, DocumentType, DocumentStatus, 
                   DocumentJob, DocumentJobStatus)
```

**Modified `_save_fetched_document` Method**:
```python
# Save document
document = Document(...)
self.db.add(document)
self.db.commit()
self.db.refresh(document)

# Create processing job (instead of processing inline)
try:
    document_job = DocumentJob(
        document_id=document.id,
        status=DocumentJobStatus.PENDING,
        retry_count=0
    )
    self.db.add(document_job)
    self.db.commit()
    logger.info(f"Created document processing job for document {document.id}")
except Exception as e:
    logger.error(f"Failed to create document job for document {document.id}: {e}")
    # Don't fail the whole crawl - document is saved, can be manually reprocessed
```

**Key Changes**:
- ✅ Removed inline `process_document_embedding()` call
- ✅ Creates `DocumentJob` with `PENDING` status
- ✅ Error handling: job creation failure doesn't break crawl
- ✅ Non-blocking: crawler continues immediately

### 4. Document Job Processor Service

**File**: `api/services/document_job_processor.py`

#### Main Processor Class

```python
class DocumentJobProcessor:
    def __init__(self, processor_id: Optional[str] = None, max_retries: int = 3):
        self.processor_id = processor_id or f"processor-{uuid.uuid4().hex[:8]}"
        self.max_retries = max_retries
    
    def process_pending_jobs(self, db: Session, batch_size: int = 10) -> int:
        """Process a batch of pending jobs"""
        # Query for pending jobs (FIFO order)
        pending_jobs = db.query(DocumentJob).filter(
            and_(
                DocumentJob.status == DocumentJobStatus.PENDING,
                DocumentJob.retry_count < self.max_retries
            )
        ).order_by(DocumentJob.created_at.asc()).limit(batch_size).all()
        
        for job in pending_jobs:
            self._process_job(job, db)
        
        return len(pending_jobs)
    
    def _process_job(self, job: DocumentJob, db: Session):
        """Process a single job"""
        try:
            # Mark as processing
            job.status = DocumentJobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            job.processor_id = self.processor_id
            job.retry_count += 1
            db.commit()
            
            # Get document
            document = db.query(Document).filter(Document.id == job.document_id).first()
            
            # Process (chunking + embedding generation)
            success = process_document_embedding(job.document_id, db)
            
            if success:
                job.status = DocumentJobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
            else:
                job.status = DocumentJobStatus.FAILED
                job.error_message = "Embedding processing returned False"
            
            db.commit()
            
        except Exception as e:
            job.status = DocumentJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)[:1000]
            db.commit()
            
            # Retry if under max attempts
            if job.retry_count < self.max_retries:
                job.status = DocumentJobStatus.PENDING
                job.started_at = None
                job.completed_at = None
                db.commit()
```

#### Running Modes

**Mode 1: Continuous Processing (Background Worker)**
```python
processor = get_document_job_processor()
db = next(get_db())
processor.run_continuous(db, poll_interval=5, batch_size=10)
```

**Mode 2: One-Time Batch Processing**
```python
from services.document_job_processor import process_document_jobs_once
processed = process_document_jobs_once(batch_size=50)
```

**Mode 3: Standalone Worker Script**
```bash
# Continuous mode
python3 -m services.document_job_processor continuous 5 10

# One-time processing
python3 -m services.document_job_processor once 50
```

### 5. Admin API Endpoints

**File**: `api/routes/admin.py`

#### GET /admin/document-jobs/stats
Get job statistics and recent jobs

**Response**:
```json
{
  "summary": {
    "pending": 42,
    "processing": 3,
    "completed": 1205,
    "failed": 8,
    "total": 1258
  },
  "recent_jobs": [
    {
      "id": 1258,
      "document_id": 15234,
      "status": "COMPLETED",
      "created_at": "2025-11-27T01:15:30",
      "started_at": "2025-11-27T01:15:35",
      "completed_at": "2025-11-27T01:15:42",
      "retry_count": 1,
      "error_message": null
    }
  ]
}
```

#### GET /admin/document-jobs
List all jobs with optional filtering

**Query Parameters**:
- `status`: Filter by status (pending/processing/completed/failed)
- `skip`: Pagination offset
- `limit`: Maximum results (default: 50)

**Response**:
```json
{
  "total": 42,
  "skip": 0,
  "limit": 50,
  "jobs": [...]
}
```

#### POST /admin/document-jobs/process
Manually trigger job processing

**Query Parameters**:
- `batch_size`: Number of jobs to process (default: 10, max: 100)

**Response**:
```json
{
  "message": "Queued processing of up to 10 document jobs",
  "batch_size": 10,
  "pending_jobs": 42
}
```

#### POST /admin/document-jobs/{job_id}/retry
Retry a failed job

**Response**:
```json
{
  "message": "Reset job 1234 to PENDING for retry",
  "job_id": 1234,
  "retry_count": 2
}
```

#### DELETE /admin/document-jobs/{job_id}
Delete a job (doesn't delete the document)

**Response**:
```json
{
  "message": "Deleted document job 1234",
  "job_id": 1234
}
```

### 6. Admin Dashboard UI

**File**: `app/admin.html` + `app/js/admin.js`

#### UI Components

**Job Statistics Dashboard**:
```html
<div id="job-stats">
    <div>Pending: <span id="job-pending">42</span></div>
    <div>Processing: <span id="job-processing">3</span></div>
    <div>Completed: <span id="job-completed">1205</span></div>
    <div>Failed: <span id="job-failed">8</span></div>
    <div>Total: <span id="job-total">1258</span></div>
</div>
```

**Job Table**:
- Displays recent jobs with status, timing, errors
- Color-coded status badges
- Retry button for failed jobs
- Links to document details

**Action Buttons**:
- ▶️ Process 10 Jobs
- ▶️ Process 50 Jobs
- 🔄 Refresh Stats
- 📋 View Jobs

#### JavaScript Functions

```javascript
// Load job statistics
async function loadDocumentJobStats()

// Load and display jobs
async function loadDocumentJobs(status = null, limit = 50)

// Trigger processing
async function processDocumentJobs(batchSize = 10)

// Retry failed job
async function retryJob(jobId)
```

## Workflow Diagrams

### Document Crawl to Processing Flow

```
1. CRAWLER
   ├── Fetch URL
   ├── Extract content
   ├── Detect language
   ├── Save Document record (status=COMPLETED)
   └── Create DocumentJob (status=PENDING)
       └── Continue crawling (non-blocking!)

2. JOB PROCESSOR (runs separately)
   ├── Poll for PENDING jobs
   ├── Mark as PROCESSING
   ├── Load document
   ├── Chunk text
   ├── Generate embeddings
   └── Mark as COMPLETED or FAILED

3. RETRY LOGIC (automatic)
   ├── If FAILED and retry_count < 3
   ├── Reset to PENDING
   └── Will be picked up again
```

### Error Handling Flow

```
JOB PROCESSING
├── Exception caught
├── Mark job as FAILED
├── Store error_message
├── Increment retry_count
└── Decision:
    ├── retry_count < max_retries?
    │   ├── Yes: Reset to PENDING
    │   └── No: Keep as FAILED
    └── Admin can manually retry later
```

## Usage Examples

### Automatic Startup (Recommended)

The document job processor **starts automatically** when the API service starts. It runs as a background thread and processes jobs continuously.

**Configuration via Environment Variables**:

```bash
# .env file
DOC_PROCESSOR_POLL_INTERVAL=10  # Poll every 10 seconds (default)
DOC_PROCESSOR_BATCH_SIZE=10     # Process up to 10 jobs per batch (default)
```

**On startup, you'll see**:
```
Starting PowerNOVA API...
Starting document job processor...
✓ Document job processor started (poll_interval=10s, batch_size=10)
  Processor ID: processor-a3f8d2c1
  Thread: DocumentJobProcessor
```

**Disable automatic startup** (maintenance mode):
```bash
# .env file
MAINTENANCE_MODE=true
```

### Running the Job Processor

#### Option 1: Docker Exec (Manual Trigger)

```bash
# Process 10 jobs once
docker exec powernova-api python3 -m services.document_job_processor once 10

# Check job stats
curl -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/admin/document-jobs/stats
```

#### Option 2: Background Task (via API)

```bash
# Trigger processing via API
curl -X POST \
  -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=20"
```

#### Option 3: Continuous Worker (Dedicated Process)

```bash
# Run as continuous worker (polls every 5 seconds, batch of 10)
docker exec -d powernova-api python3 -m services.document_job_processor continuous 5 10
```

#### Option 4: Scheduled Cron Job

```cron
# Process jobs every 5 minutes
*/5 * * * * docker exec powernova-api python3 -m services.document_job_processor once 50
```

### Admin Dashboard Usage

1. Navigate to **Admin Dashboard → Embeddings** tab
2. Scroll to **Document Processing Jobs** section
3. View current statistics (pending, processing, completed, failed)
4. Click **▶️ Process 10 Jobs** to manually trigger processing
5. Click **📋 View Jobs** to see detailed job list
6. For failed jobs, click **🔄 Retry** button

### Monitoring Jobs

```bash
# Get job statistics
curl -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/admin/document-jobs/stats | jq

# List pending jobs
curl -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs?status=pending&limit=10" | jq

# List failed jobs
curl -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs?status=failed&limit=10" | jq
```

### Retry Failed Jobs

```bash
# Retry specific job
curl -X POST \
  -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/admin/document-jobs/1234/retry

# Then trigger processing
curl -X POST \
  -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=1"
```

## Files Created/Modified

### New Files Created

1. **`api/models/document_job.py`** (73 lines)
   - DocumentJob model
   - DocumentJobStatus enum
   - Relationships and indexes

2. **`api/services/document_job_processor.py`** (235 lines)
   - DocumentJobProcessor class
   - Continuous and batch processing modes
   - Retry logic and error handling
   - Standalone worker script

3. **`api/alembic/versions/2025_11_27_0110-7036e3afc055_create_document_jobs_table.py`** (40 lines)
   - Migration to create document_jobs table
   - Indexes for performance
   - Enum type definition

4. **`docs/DOCUMENT-JOB-QUEUE-SYSTEM.md`** (this file)
   - Comprehensive documentation

### Modified Files

5. **`api/models/__init__.py`**
   - Added DocumentJob and DocumentJobStatus exports

6. **`api/services/crawler.py`**
   - Removed inline `process_document_embedding()` call
   - Added DocumentJob creation after document save

7. **`api/routes/admin.py`**
   - Added 5 new endpoints for job management
   - Imported document_job_processor functions

8. **`app/admin.html`**
   - Added Document Processing Jobs section
   - Job statistics grid
   - Job list table with status badges

9. **`app/js/admin.js`**
   - Added `loadDocumentJobStats()` function
   - Added `loadDocumentJobs()` function
   - Added `processDocumentJobs()` function
   - Added `retryJob()` function
   - Integrated into embeddings tab initialization

## Migration Steps

### 1. Run Database Migration

```bash
# Local development
docker exec powernova-api alembic upgrade head

# Verify migration
docker exec powernova-api alembic current
# Should show: 7036e3afc055 (head)
```

### 2. Create Jobs for Existing Documents

If you have existing documents without jobs, create them:

```sql
-- Create jobs for documents that don't have them yet
INSERT INTO document_jobs (document_id, status, retry_count, created_at, updated_at)
SELECT 
    id,
    'PENDING'::documentjobstatus,
    0,
    NOW(),
    NOW()
FROM documents
WHERE 
    status = 'COMPLETED'
    AND embedding_generated = FALSE
    AND id NOT IN (SELECT document_id FROM document_jobs);
```

### 3. Start Processing Jobs

```bash
# Option A: Trigger via API
curl -X POST \
  -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=50"

# Option B: Run continuous worker
docker exec -d powernova-api \
  python3 -m services.document_job_processor continuous 5 10
```

### 4. Monitor Progress

```bash
# Check stats
curl -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/admin/document-jobs/stats | jq '.summary'

# Or use admin dashboard
open http://localhost:8080/admin.html
```

## Performance Considerations

### Batch Size Tuning

- **Small batch (10)**: Low memory, frequent DB queries, good for testing
- **Medium batch (50)**: Balanced for most workloads
- **Large batch (100)**: High throughput, more memory usage

### Poll Interval Tuning

- **Fast (1-5s)**: Near real-time processing, higher CPU/DB load
- **Medium (5-15s)**: Balanced for most workloads
- **Slow (30-60s)**: Batch-oriented, lower overhead

### Recommended Settings

**Development**:
```bash
python3 -m services.document_job_processor continuous 5 10
# Poll every 5s, process up to 10 jobs per batch
```

**Production (Low Traffic)**:
```bash
python3 -m services.document_job_processor continuous 15 20
# Poll every 15s, process up to 20 jobs per batch
```

**Production (High Traffic)**:
```bash
# Run multiple workers
python3 -m services.document_job_processor continuous 5 50 &
python3 -m services.document_job_processor continuous 5 50 &
# Each polls every 5s, processes up to 50 jobs
```

## Troubleshooting

### Jobs Stuck in PROCESSING

**Symptom**: Jobs remain in PROCESSING status indefinitely

**Cause**: Worker crashed or killed while processing

**Fix**:
```sql
-- Reset stuck jobs (older than 10 minutes)
UPDATE document_jobs
SET 
    status = 'PENDING',
    started_at = NULL,
    processor_id = NULL
WHERE 
    status = 'PROCESSING'
    AND started_at < NOW() - INTERVAL '10 minutes';
```

### High Failed Job Count

**Symptom**: Many jobs in FAILED status

**Check**: Look at error messages
```bash
curl -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs?status=failed" | jq '.jobs[].error_message'
```

**Common Causes**:
- Token anomaly detection flagging documents
- Missing document content
- OpenAI API rate limits
- Database connection issues

**Fix**: Address root cause, then retry jobs via admin dashboard

### No Jobs Being Processed

**Symptom**: Pending jobs not decreasing

**Check**:
1. Is processor running?
   ```bash
   docker exec powernova-api ps aux | grep document_job_processor
   ```

2. Check logs:
   ```bash
   docker logs powernova-api | grep "DocumentJobProcessor"
   ```

3. Manually trigger:
   ```bash
   curl -X POST -H "X-Admin-Key: YOUR_KEY" \
     "http://localhost:8000/api/admin/document-jobs/process?batch_size=1"
   ```

## Future Enhancements

### Potential Improvements

1. **Priority Queue**
   - Add `priority` field to DocumentJob
   - Process high-priority jobs first

2. **Distributed Processing**
   - Use Redis or RabbitMQ for job queue
   - Scale horizontally with multiple workers
   - Implement job locking to prevent duplicate processing

3. **Progress Tracking**
   - Add `progress_percentage` field
   - Update during chunking/embedding steps

4. **Job Dependencies**
   - Support job chains (e.g., extract → analyze → embed)
   - DAG-based workflow

5. **Monitoring & Alerts**
   - Prometheus metrics export
   - Alert on high failure rate
   - Track processing time SLAs

6. **Advanced Retry Logic**
   - Exponential backoff
   - Different retry strategies per error type
   - Circuit breaker pattern

## Related Documentation

- `LANGUAGE-DETECTION-AND-PAGINATION.md` - Language filtering system
- `TOKEN-ANOMALY-DETECTION.md` - Token anomaly detection
- `CRAWLER-IMPLEMENTATION-SUMMARY.md` - Web crawler architecture
- `ADMIN-EMBEDDINGS-FEATURE.md` - Admin dashboard features

## Conclusion

The document processing job queue system provides a robust, scalable foundation for asynchronous document processing in PowerNova. By decoupling crawling from embedding generation, the system is more resilient, easier to monitor, and can scale independently.

**Key Benefits**:
- ✅ Non-blocking crawler (faster crawls)
- ✅ Automatic retry logic (better reliability)
- ✅ Full visibility into processing status
- ✅ Independent scalability
- ✅ Better error isolation and handling
- ✅ Production-ready architecture

**Deployment Status**: ✅ Ready for production deployment
