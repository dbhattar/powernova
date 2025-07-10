# Job Queue System Implementation

This document describes the implementation of the job queue system for handling document vectorization asynchronously with real-time frontend updates.

## Overview

The job queue system separates document upload from vectorization processing, allowing users to upload multiple documents without blocking while providing real-time status updates via WebSocket connections.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │────│    Backend      │────│  Redis Queue    │
│                 │    │                 │    │                 │
│ - WebSocket     │    │ - Document API  │    │ - Job Storage   │
│ - Real-time UI  │    │ - WebSocket     │    │ - Status Cache  │
│                 │    │ - Auth          │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │ Vectorization   │
                       │    Worker       │
                       │                 │
                       │ - Job Processor │
                       │ - Vector Store  │
                       │ - Notifications │
                       └─────────────────┘
```

## Components

### Backend Components

1. **Job Queue Service** (`src/services/jobQueue.js`)
   - Manages Redis-based job queue
   - Stores job status and metadata
   - Provides job enqueueing and dequeueing

2. **Vectorization Worker** (`src/services/vectorizationWorker.js`)
   - Processes vectorization jobs asynchronously
   - Updates job status and sends notifications
   - Handles errors and retries

3. **WebSocket Manager** (`src/services/webSocketManager.js`)
   - Manages WebSocket connections
   - Handles user authentication
   - Routes messages to specific users

4. **Notification Service** (`src/services/notificationService.js`)
   - Sends real-time updates to users
   - Handles different notification types

### Frontend Components

1. **WebSocket Service** (`services/webSocketService.js`)
   - Manages WebSocket connection to backend
   - Handles reconnection and authentication
   - Provides event listener interface

2. **Enhanced Document Upload** (`components/DocumentUpload.js`)
   - Supports both legacy and new upload flows
   - Real-time status updates
   - Document list with processing status

## Database Schema

```sql
CREATE TABLE documents (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    job_id VARCHAR(255),
    error_message TEXT,
    vector_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);
```

## Job Flow

1. **Document Upload**:
   ```
   User uploads → File validated → Document record created → Job enqueued → Response sent
   ```

2. **Job Processing**:
   ```
   Worker picks job → Updates status to 'processing' → Processes document → Updates status → Sends notification
   ```

3. **Real-time Updates**:
   ```
   Job status change → Notification sent via WebSocket → Frontend updates UI
   ```

## Environment Variables

Add to your `.env` file:

```bash
# Redis configuration
REDIS_URL=redis://localhost:6379

# WebSocket configuration  
CORS_ORIGIN=http://localhost:8081,http://localhost:3000
```

## Installation

1. **Install dependencies**:
   ```bash
   ./install-job-queue-deps.sh
   ```

2. **Setup database**:
   ```bash
   psql -d your_database -f backend/database_schema.sql
   ```

3. **Start Redis**:
   ```bash
   brew services start redis
   # or
   redis-server
   ```

4. **Start the system**:
   ```bash
   ./start-with-worker.sh
   ```

## API Endpoints

### Document Upload
```
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Response:
{
  "documentId": "uuid",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "status": "queued_for_processing",
  "jobId": "job-uuid",
  "message": "Document uploaded successfully and queued for processing"
}
```

### Document Status
```
GET /api/documents/:id/status
Authorization: Bearer <token>

Response:
{
  "documentId": "uuid",
  "filename": "document.pdf",
  "status": "processing|completed|failed",
  "error": "error message if failed",
  "createdAt": "2023-01-01T00:00:00Z",
  "startedAt": "2023-01-01T00:01:00Z",
  "completedAt": "2023-01-01T00:05:00Z"
}
```

## WebSocket Events

### Client → Server
```javascript
// Authentication
{ "type": "auth", "token": "firebase-jwt-token" }

// Keepalive
{ "type": "ping" }
```

### Server → Client
```javascript
// Document processing completed
{
  "type": "document_processed",
  "data": {
    "documentId": "uuid",
    "filename": "document.pdf",
    "status": "completed",
    "error": null,
    "processedAt": "2023-01-01T00:05:00Z"
  }
}

// Job progress update
{
  "type": "job_progress", 
  "data": {
    "jobId": "job-uuid",
    "status": "processing",
    "progress": 50,
    "message": "Processing document..."
  }
}

// Keepalive response
{ "type": "pong" }
```

## Error Handling

1. **Job Failures**: Jobs that fail are marked with status 'failed' and error message
2. **WebSocket Disconnects**: Automatic reconnection with exponential backoff
3. **Redis Unavailable**: Worker waits and retries connection
4. **Database Errors**: Transactions are rolled back, jobs marked as failed

## Monitoring

Monitor the system using:

1. **Redis CLI**:
   ```bash
   redis-cli
   LLEN vectorization_jobs  # Check queue length
   KEYS job_status:*        # List all job statuses
   ```

2. **Database Queries**:
   ```sql
   -- Check document processing status
   SELECT status, COUNT(*) FROM documents GROUP BY status;
   
   -- Find failed jobs
   SELECT * FROM documents WHERE status = 'failed';
   ```

3. **Logs**: Check application logs for worker activity and errors

## Performance Considerations

1. **Queue Size**: Monitor Redis memory usage for large queues
2. **Worker Scaling**: Can run multiple worker processes if needed
3. **Database Connections**: Use connection pooling for high load
4. **WebSocket Connections**: Monitor connection count and memory usage

## Future Enhancements

1. **Multiple Workers**: Support for horizontal scaling
2. **Job Priorities**: Priority queue for urgent documents
3. **Retry Logic**: Configurable retry attempts for failed jobs
4. **Metrics Dashboard**: Real-time monitoring interface
5. **Job Scheduling**: Delayed job execution
