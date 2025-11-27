# Document Job Processor - Quick Start Guide

## Automatic Startup (Default Behavior)

The document job processor **starts automatically** when the PowerNOVA API service starts. No manual intervention required!

### What Happens on Startup

When you start the API (`docker-compose up` or `uvicorn main:app`), you'll see:

```
Starting PowerNOVA API...
Checking database connection...
✓ Database connection successful
Starting document job processor...
✓ Document job processor started (poll_interval=10s, batch_size=10)
  Processor ID: processor-a3f8d2c1
  Thread: DocumentJobProcessor
✓ No interrupted crawl jobs to resume
```

The processor runs in the background and:
- Polls the `document_jobs` table every 10 seconds (configurable)
- Processes up to 10 pending jobs per batch (configurable)
- Automatically retries failed jobs (up to 3 attempts)
- Runs as a daemon thread (won't block shutdown)

## Configuration

### Environment Variables

Add these to your `.env` file to customize the processor:

```bash
# Poll interval in seconds (default: 10)
DOC_PROCESSOR_POLL_INTERVAL=10

# Max jobs to process per batch (default: 10)
DOC_PROCESSOR_BATCH_SIZE=10
```

### Recommended Settings

**Development**:
```bash
DOC_PROCESSOR_POLL_INTERVAL=5   # Check frequently
DOC_PROCESSOR_BATCH_SIZE=5      # Small batches
```

**Production (Low Volume)**:
```bash
DOC_PROCESSOR_POLL_INTERVAL=15  # Check less frequently
DOC_PROCESSOR_BATCH_SIZE=20     # Larger batches
```

**Production (High Volume)**:
```bash
DOC_PROCESSOR_POLL_INTERVAL=5   # Check frequently
DOC_PROCESSOR_BATCH_SIZE=50     # Large batches
```

## Monitoring

### Check if Processor is Running

**Method 1: Check API Logs**
```bash
docker logs powernova-api | grep "Document job processor"
```

Expected output:
```
✓ Document job processor started (poll_interval=10s, batch_size=10)
```

**Method 2: Check Thread Status**
```bash
docker exec powernova-api ps aux | grep python
```

**Method 3: Admin Dashboard**
1. Navigate to **Admin Dashboard → Embeddings** tab
2. Look at **Document Processing Jobs** section
3. Stats should show pending/processing/completed counts

### View Processor Activity

```bash
# Tail logs
docker logs -f powernova-api | grep "Processing document job"

# Expected output:
# Processing document job 123 for document 456 (attempt 1)
# Successfully processed document job 123 for document 456
```

## Disabling Automatic Startup

If you need to disable automatic startup (e.g., during maintenance):

```bash
# .env file
MAINTENANCE_MODE=true
```

When enabled, you'll see:
```
⚠ Maintenance mode enabled - skipping background task auto-resume
  Background crawl jobs will NOT be started automatically
  Document job processor will NOT be started automatically
```

## Manual Processing

Even with automatic startup, you can still trigger manual processing via API:

```bash
# Process 50 jobs immediately
curl -X POST \
  -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=50"
```

Or via Admin Dashboard:
- Navigate to **Embeddings** tab
- Click **▶️ Process 10 Jobs** or **▶️ Process 50 Jobs**

## Troubleshooting

### Processor Not Starting

**Check 1: Database Connection**
```bash
docker logs powernova-api | grep "Database connection"
```
Expected: `✓ Database connection successful`

**Check 2: Maintenance Mode**
```bash
docker exec powernova-api printenv MAINTENANCE_MODE
```
Should be empty or `false`

**Check 3: Error Messages**
```bash
docker logs powernova-api | grep "Failed to start document job processor"
```

### Processor Started But Not Processing

**Check 1: Are There Pending Jobs?**
```bash
curl -H "X-Admin-Key: YOUR_KEY" \
  http://localhost:8000/api/admin/document-jobs/stats | jq '.summary.pending'
```

**Check 2: Check for Errors**
```bash
docker logs powernova-api | grep "Error processing job"
```

**Check 3: Manual Trigger**
```bash
curl -X POST -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=1"
```

### High Pending Job Count

If jobs are piling up:

**Option 1: Increase Batch Size**
```bash
# Restart with larger batch
docker-compose down
# Update .env
DOC_PROCESSOR_BATCH_SIZE=50
docker-compose up -d
```

**Option 2: Decrease Poll Interval**
```bash
# Update .env
DOC_PROCESSOR_POLL_INTERVAL=5
docker-compose restart powernova-api
```

**Option 3: Manual Burst Processing**
```bash
# Process 100 jobs immediately
curl -X POST -H "X-Admin-Key: YOUR_KEY" \
  "http://localhost:8000/api/admin/document-jobs/process?batch_size=100"
```

## Best Practices

### ✅ Do's

- **Monitor job stats** regularly via admin dashboard
- **Set appropriate batch size** for your volume (10-50 jobs)
- **Set appropriate poll interval** for your needs (5-15 seconds)
- **Check logs** after deployment to confirm processor started
- **Use maintenance mode** during database maintenance

### ❌ Don'ts

- **Don't set batch size > 100** (can cause memory issues)
- **Don't set poll interval < 2 seconds** (too much DB load)
- **Don't disable automatic startup** in production (unless necessary)
- **Don't ignore failed jobs** (check errors and retry)

## Example Workflows

### Normal Operation

```
1. API starts
   ↓
2. Processor starts automatically (poll_interval=10s, batch_size=10)
   ↓
3. Crawler creates documents → Creates DocumentJobs
   ↓
4. Processor picks up jobs every 10 seconds
   ↓
5. Jobs processed → Embeddings generated
   ↓
6. Documents ready for RAG queries
```

### During Deployment

```
1. Set MAINTENANCE_MODE=true
   ↓
2. Deploy new code
   ↓
3. Run database migrations
   ↓
4. Set MAINTENANCE_MODE=false
   ↓
5. Restart API → Processor starts automatically
   ↓
6. Process any pending jobs from deployment
```

### High Volume Crawl

```
1. Start crawl (creates 1000s of jobs)
   ↓
2. Monitor pending count in admin dashboard
   ↓
3. If growing too fast:
   - Increase batch_size to 50
   - Decrease poll_interval to 5s
   - Or run manual burst: process?batch_size=100
   ↓
4. Once caught up, restore normal settings
```

## Deployment Checklist

- [ ] Database migration applied (`alembic upgrade head`)
- [ ] `.env` configured with processor settings
- [ ] API service started (processor auto-starts)
- [ ] Check logs for `✓ Document job processor started`
- [ ] Verify stats in admin dashboard
- [ ] Create test job to verify processing
- [ ] Monitor for first few hours after deployment

## Summary

The document job processor:
- ✅ **Starts automatically** with the API service
- ✅ **Runs in background** as a daemon thread
- ✅ **Configurable** via environment variables
- ✅ **Resilient** with automatic retries
- ✅ **Monitorable** via admin dashboard and logs
- ✅ **Production-ready** out of the box

No manual intervention required - just start the API and it works! 🚀
