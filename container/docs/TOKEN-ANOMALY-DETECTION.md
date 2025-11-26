# Token Anomaly Detection System

**Date:** November 26, 2025  
**Issue:** Documents with corrupted encoding causing abnormal token inflation  
**Status:** ✅ Implemented

## Problem

Some documents have severely corrupted encoding or contain binary data that causes:
- **Token inflation**: 48,000+ tokens for small text (should be ~5,000)
- **Wasted API calls**: Embeddings fail due to token limit exceeded
- **Poor embedding quality**: Massive truncation loses most content
- **Processing delays**: Repeated retries for unfixable documents

### Example Log
```
Text exceeds token limit (48298 > 8091), truncating...
Cleaned text from 73513 to 66897 chars (6616 chars removed)
Text exceeds token limit (49806 > 8091), truncating...
```

**Root cause**: Certain documents have token-to-character ratios of 2.0-6.0+ instead of normal 0.3-0.5

## Solution

### 1. Token Anomaly Detection

Added detection logic to `embedding_processor.py`:

```python
# Sample first 5000 characters
sample_text = document.content[:5000]
token_count = embedding_service.count_tokens(sample_text)
char_count = len(sample_text)

# Calculate ratio
token_to_char_ratio = token_count / char_count

# Threshold: Normal = 0.3-0.5, Anomalous = >0.7
ANOMALY_THRESHOLD = 0.7

if token_to_char_ratio > ANOMALY_THRESHOLD:
    logger.warning(f"Token anomaly detected (ratio={ratio:.2f})")
    document.token_anomaly = True
    document.embedding_generated = False
    return False  # Skip this document
```

### 2. Database Schema

Added two new columns to `documents` table:

```sql
-- Track if document has token anomaly
token_anomaly BOOLEAN DEFAULT FALSE NOT NULL

-- Store actual ratio for analysis
token_to_char_ratio FLOAT

-- Index for efficient querying
CREATE INDEX idx_documents_token_anomaly ON documents(token_anomaly)
```

### 3. Admin API Endpoint

New endpoint: `GET /api/admin/embeddings/token-anomalies`

**Returns:**
```json
{
  "summary": {
    "total_anomalies": 47,
    "avg_ratio": 2.34,
    "max_ratio": 5.87,
    "threshold": 0.7,
    "normal_range": "0.3-0.5"
  },
  "documents": [
    {
      "id": 1234,
      "title": "Corrupted Document",
      "url": "https://example.com/doc.pdf",
      "document_type": "pdf",
      "token_to_char_ratio": 5.87,
      "severity": "critical",
      "suggestion": "Severely corrupted encoding..."
    }
  ]
}
```

### 4. Admin Dashboard

Added "Token Anomalies" section to Embeddings tab:

**Features:**
- **Statistics**: Total anomalies, average ratio, max ratio
- **Document table**: Sorted by severity (highest ratio first)
- **Severity levels**: 
  - 🔴 Critical (>2.0): Severely corrupted, likely binary data
  - 🟠 High (>1.0): Moderately corrupted, encoding issues
  - 🟡 Medium (0.7-1.0): Minor issues, potentially fixable
- **Export**: Download anomalies as CSV for analysis
- **Suggestions**: Actionable recommendations for each document

## Files Modified

### Backend
1. ✅ `api/models/document.py` - Added `token_anomaly`, `token_to_char_ratio` columns
2. ✅ `api/services/embedding_processor.py` - Added detection logic
3. ✅ `api/routes/admin.py` - Added `/embeddings/token-anomalies` endpoint
4. ✅ `api/alembic/versions/2025_11_26_0027-c96c28ec88dd_add_token_anomaly_tracking.py` - Migration

### Frontend
5. ✅ `app/admin.html` - Added Token Anomalies section
6. ✅ `app/js/admin.js` - Added `loadTokenAnomalies()`, `exportAnomalies()` functions

### Docker
7. ✅ `docker/Dockerfile.api` - Added `COPY api/monitoring/ ./monitoring/` (fixed missing module)

## How It Works

### Detection Flow

1. **Document processing starts** → `process_document_embedding()`
2. **Sample first 5000 chars** → Representative sample
3. **Count tokens** → Using tiktoken (accurate)
4. **Calculate ratio** → tokens / characters
5. **Check threshold** → If ratio > 0.7:
   - Mark `token_anomaly = True`
   - Store `token_to_char_ratio` for analysis
   - Skip embedding generation
   - Log warning with details
6. **Normal documents** → Proceed with chunking and embeddings

### Admin Workflow

1. **Navigate to Admin Dashboard** → Embeddings tab
2. **Click "🔍 View Anomalies"** → Loads token anomaly data
3. **Review statistics**:
   - Total anomalies found
   - Average and max ratios
   - Comparison to normal range (0.3-0.5)
4. **Review document table**:
   - Sorted by severity (worst first)
   - See URL, type, ratio, size
   - Read suggestions for fixing
5. **Export data** → Click "📥 Export Data" for CSV analysis
6. **Take action**:
   - Exclude problematic URL patterns from crawler
   - Fix source documents
   - Update text extraction logic

## Benefits

✅ **Prevents wasted API calls**: Don't generate embeddings for unfixable documents  
✅ **Saves processing time**: Skip documents that will fail  
✅ **Provides visibility**: Dashboard shows exactly which documents have issues  
✅ **Enables analysis**: Export data to identify patterns  
✅ **Actionable insights**: Suggestions help fix root causes  
✅ **Automatic detection**: No manual intervention needed

## Deployment

### 1. Run Migration

```bash
cd api
alembic upgrade head
```

This adds `token_anomaly` and `token_to_char_ratio` columns.

### 2. Deploy to Azure

```bash
./scripts/azure-deploy-api.sh
```

### 3. Verify in Dashboard

1. Open admin dashboard
2. Navigate to Embeddings tab
3. Check if "Token Anomalies" section appears
4. Click "View Anomalies" to see any flagged documents

## Monitoring

### Logs to Watch

**Anomaly detected:**
```
Token anomaly detected for document 1234 (ratio=5.87, tokens=29350, chars=5000). 
Marking as anomalous and skipping embedding generation.
```

**Normal ratio:**
```
Document 5678 token ratio is normal (ratio=0.45, tokens=2250, chars=5000)
```

### Dashboard Metrics

- **Total Anomalies**: Number of flagged documents
- **Avg Ratio**: Average token-to-char ratio across anomalies
- **Max Ratio**: Worst case ratio (indicates severity)
- **By Type**: Breakdown by document type (PDF, HTML, DOCX, etc.)

## Thresholds

| Ratio | Classification | Meaning |
|-------|---------------|---------|
| 0.3-0.5 | Normal | Typical text (English, code, etc.) |
| 0.5-0.7 | Borderline | Dense technical text, acceptable |
| 0.7-1.0 | Medium anomaly | Minor encoding issues, flag for review |
| 1.0-2.0 | High anomaly | Moderate corruption, likely unfixable |
| 2.0+ | Critical anomaly | Severe corruption, binary data, or malformed UTF-8 |

## Severity Levels

### 🟢 Normal (0.3-0.5)
- **Action**: None needed
- **Example**: Clean text documents, web pages

### 🟡 Medium (0.7-1.0)
- **Action**: Review and potentially fix
- **Suggestion**: Minor encoding issues, may be fixable with better text extraction
- **Example**: Documents with special characters or formatting

### 🟠 High (1.0-2.0)
- **Action**: Investigate source
- **Suggestion**: Moderately corrupted, check source document
- **Example**: Documents with corrupted sections or mixed encodings

### 🔴 Critical (2.0+)
- **Action**: Exclude from crawling
- **Suggestion**: Severely corrupted encoding, likely binary data or malformed UTF-8
- **Example**: Binary files misidentified as text, severely corrupted PDFs

## Common Causes

1. **Binary data in text fields**: PDF/DOCX with embedded images extracted as text
2. **Corrupted UTF-8**: Files with invalid byte sequences
3. **Mixed encodings**: Files switching between UTF-8, Latin-1, etc.
4. **Special characters**: Documents with many Unicode symbols or emojis
5. **Compression artifacts**: Corrupted during download/extraction

## Fixing Anomalies

### Option 1: Exclude URLs
Add to crawler exclude patterns:
```python
exclude_patterns = [
    "/corrupted/*",
    "/binary-data/*"
]
```

### Option 2: Improve Text Extraction
Update `document_processor.py`:
```python
# Better encoding detection
# Stricter validation
# Filter out binary content
```

### Option 3: Pre-processing
Add validation during crawl:
```python
if token_to_char_ratio > 0.7:
    logger.warning("Skipping document with high token ratio")
    continue
```

## Future Enhancements

1. **Auto-exclusion**: Automatically exclude URL patterns with high anomaly rates
2. **Re-extraction**: Attempt different extraction methods for anomalous documents
3. **Alerts**: Notify when anomaly rate exceeds threshold
4. **Trends**: Track anomaly rate over time
5. **Document preview**: Show sample text from anomalous documents

## Related Issues

- Resolves: Token limit exceeded errors for corrupted documents
- Resolves: Wasted API calls on unfixable documents
- Improves: Embedding quality by skipping corrupted content
- Enhances: Visibility into document quality issues

## Testing

### Test Scenarios

✅ **Normal document**: Ratio 0.45, embeddings generated  
✅ **High anomaly**: Ratio 2.5, embeddings skipped, flagged  
✅ **Dashboard loading**: Anomalies displayed correctly  
✅ **Export**: CSV download works  
✅ **Migration**: Columns added successfully  

### Validation

```bash
# Check migration applied
psql -h <host> -U <user> -d <db> -c "\d documents"
# Should show token_anomaly and token_to_char_ratio columns

# Test API endpoint
curl -H "X-Admin-Key: your-key" https://api.powernova.app/api/admin/embeddings/token-anomalies

# Check logs during embedding generation
docker logs powernova-api | grep -i "anomaly"
```

## Summary

The Token Anomaly Detection system automatically identifies documents with corrupted encoding or abnormal token inflation, preventing wasted API calls and providing visibility into document quality issues. The admin dashboard makes it easy to review, analyze, and take action on problematic documents.

**Next Steps:**
1. Deploy migration
2. Monitor anomaly detection in logs
3. Review flagged documents in dashboard
4. Exclude problematic URL patterns
5. Improve text extraction for fixable cases
