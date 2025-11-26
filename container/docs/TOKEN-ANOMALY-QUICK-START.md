# Token Anomaly Detection - Quick Start

**Status:** ✅ Implemented and Tested Locally  
**Ready for:** Azure Deployment

## What Was Built

A system to automatically detect and skip documents with corrupted encoding that cause abnormal token inflation during embedding generation.

## Problem Solved

Documents with encoding issues were causing:
- Token counts of 48,000+ instead of ~5,000 (10x inflation)
- Repeated API failures and retries
- Wasted OpenAI API costs
- Poor embedding quality due to massive truncation

## Solution

### 1. Automatic Detection
- Samples first 5000 characters of each document
- Calculates token-to-character ratio
- Flags documents with ratio > 0.7 as anomalous
- Skips embedding generation for flagged documents

### 2. Admin Dashboard
- View all documents with token anomalies
- See severity levels (critical, high, medium)
- Export data as CSV for analysis
- Get suggestions for fixing each document

### 3. Database Tracking
- New columns: `token_anomaly`, `token_to_char_ratio`
- Indexed for fast queries
- Persistent history of problematic documents

## Files Modified

✅ **Backend:**
- `api/models/document.py` - Added columns
- `api/services/embedding_processor.py` - Detection logic
- `api/routes/admin.py` - API endpoint
- `api/alembic/versions/2025_11_26_0027-c96c28ec88dd_add_token_anomaly_tracking.py` - Migration
- `docker/Dockerfile.api` - Fixed missing monitoring module

✅ **Frontend:**
- `app/admin.html` - Token Anomalies section
- `app/js/admin.js` - Load and display functions

✅ **Documentation:**
- `docs/TOKEN-ANOMALY-DETECTION.md` - Full documentation

## Local Testing ✅

Migration applied successfully:
```bash
docker exec powernova-api alembic upgrade head
# ✅ Success: Columns added
```

Database verification:
```bash
docker exec powernova-postgres psql -U powernova -d powernova -c "\d documents"
# ✅ token_anomaly | boolean | not null | false
# ✅ token_to_char_ratio | double precision
# ✅ idx_documents_token_anomaly (index)
```

API endpoint test:
```bash
curl -H "X-Admin-Key: <key>" http://localhost:8000/api/admin/embeddings/token-anomalies
# ✅ Returns: {"summary": {"total_anomalies": 0, ...}}
```

## How to Use

### 1. View Anomalies in Dashboard
1. Open admin dashboard: http://localhost:8080/admin.html (or Azure URL)
2. Navigate to "Embeddings" tab
3. Scroll to "Token Anomalies" section
4. Click "🔍 View Anomalies" button

### 2. Review Statistics
- **Total Anomalies**: How many documents are flagged
- **Avg Ratio**: Average token-to-char ratio (normal: 0.3-0.5)
- **Max Ratio**: Worst case (>2.0 = critical)

### 3. Take Action
Based on severity:
- **Critical (>2.0)**: Exclude URL from crawler
- **High (1.0-2.0)**: Check source document
- **Medium (0.7-1.0)**: Review text extraction

### 4. Export Data
Click "📥 Export Data" to download CSV with all anomalies for analysis.

## Next Steps for Azure

### 1. Commit and Push
```bash
git add -A
git commit -m "feat: Add token anomaly detection for corrupted documents"
git push
```

### 2. Deploy to Azure
```bash
./scripts/azure-deploy-api.sh
```

The migration will run automatically via `startup.sh`.

### 3. Monitor Logs
```bash
az containerapp logs show -n powernova-api -g powernova-rg --follow

# Look for:
# "Token anomaly detected for document X (ratio=Y.YY)"
# "Document X token ratio is normal (ratio=0.45)"
```

### 4. Check Dashboard
After deployment, trigger embedding generation for some documents and check the admin dashboard for any detected anomalies.

## API Endpoint

**GET** `/api/admin/embeddings/token-anomalies`

**Headers:**
```
X-Admin-Key: <your-admin-key>
```

**Query Parameters:**
- `skip` (int): Pagination offset (default: 0)
- `limit` (int): Max results (default: 100)
- `scope` (string): Filter by scope ('platform', 'user', 'conversation')

**Response:**
```json
{
  "summary": {
    "total_anomalies": 15,
    "avg_ratio": 2.34,
    "max_ratio": 5.87,
    "threshold": 0.7,
    "normal_range": "0.3-0.5"
  },
  "by_type": {
    "pdf": 10,
    "html": 5
  },
  "documents": [
    {
      "id": 1234,
      "title": "Document Title",
      "url": "https://...",
      "token_to_char_ratio": 5.87,
      "severity": "critical",
      "suggestion": "Severely corrupted encoding..."
    }
  ]
}
```

## Thresholds

| Ratio | Status | Action |
|-------|--------|--------|
| 0.3-0.5 | ✅ Normal | None needed |
| 0.5-0.7 | ⚠️ Borderline | Monitor |
| 0.7-1.0 | 🟡 Medium | Review extraction |
| 1.0-2.0 | 🟠 High | Fix or exclude |
| 2.0+ | 🔴 Critical | Exclude from crawler |

## Benefits

✅ **Prevents wasted API calls** - Skip unfixable documents  
✅ **Saves money** - Don't pay for failed embeddings  
✅ **Improves quality** - Only embed clean documents  
✅ **Provides visibility** - See exactly what's broken  
✅ **Enables fixes** - Export data to find patterns  

## Monitoring

After deployment, documents will automatically be flagged during embedding generation. Check:

1. **API Logs**: Look for "Token anomaly detected" warnings
2. **Admin Dashboard**: View flagged documents in Embeddings tab
3. **Database**: Query `SELECT * FROM documents WHERE token_anomaly = true;`

## Example Output

When processing documents, you'll see logs like:
```
✅ Document 123 token ratio is normal (ratio=0.45, tokens=2250, chars=5000)
⚠️ Token anomaly detected for document 456 (ratio=5.87, tokens=29350, chars=5000). 
   Marking as anomalous and skipping embedding generation.
```

## Rollback (if needed)

If you need to rollback the migration:
```bash
docker exec powernova-api alembic downgrade -1
```

This will remove the `token_anomaly` and `token_to_char_ratio` columns.

## Support

See full documentation: `docs/TOKEN-ANOMALY-DETECTION.md`
