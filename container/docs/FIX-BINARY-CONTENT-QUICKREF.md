# Quick Reference: Fix Binary PDFs

## Quick Commands

### Preview (Dry Run)
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --dry-run --all
```

### Fix All
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all
```

### Fix One Document
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --doc-id 123
```

### Fix Limited Batch
```bash
docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --all --limit 50
```

## Quick SQL Queries

### Count Binary PDFs
```sql
SELECT COUNT(*)
FROM documents
WHERE document_type = 'PDF'
  AND content LIKE '%PDF-1.%';
```

### List Binary PDFs
```sql
SELECT id, title, url, LEFT(content, 50) as preview
FROM documents
WHERE content LIKE '%PDF-1.%'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Fix Results
```sql
SELECT 
    d.id, 
    d.title,
    LENGTH(d.content) as text_length,
    d.embedding_generated,
    dj.status as job_status
FROM documents d
LEFT JOIN document_jobs dj ON d.id = dj.document_id
WHERE d.document_type = 'PDF'
  AND d.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY d.updated_at DESC;
```

## Detection Logic

Binary PDF if content contains:
- ✓ Starts with `%PDF-`
- ✓ Contains `endobj`, `stream`, `%%EOF`
- ✓ >5% non-printable characters

## What Gets Fixed

- ❌ **Before**: `%PDF-1.4\n%âãÏÓ\n1 0 obj...`
- ✅ **After**: `This is the actual text from the PDF document...`

## Files

- 📓 Notebook: `notebooks/fix_binary_content.ipynb`
- 🐍 Script: `scripts/fix_binary_pdfs.py`
- 📖 Docs: `docs/FIX-BINARY-CONTENT.md`
