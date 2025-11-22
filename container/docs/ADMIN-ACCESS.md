# Admin Access Information

## Admin Key
The production admin key is stored as an environment variable in the container:

## Admin Dashboard URLs

### Main Admin Panel
```
http://localhost:8080/admin.html
```

### Embedding Management Dashboard
```
http://localhost:8080/admin-embeddings.html
```

## API Endpoints

All admin endpoints require the `X-Admin-Key` header.

**Base URL**: `http://localhost:8000/api/admin`

### Embedding Management Endpoints

- `GET /api/admin/embeddings/stats` - Get statistics
- `GET /api/admin/embeddings/documents-needing-reprocessing` - List documents needing migration
- `POST /api/admin/embeddings/reprocess-document/{id}` - Reprocess single document
- `POST /api/admin/embeddings/reprocess-all` - Batch reprocess
- `GET /api/admin/embeddings/chunks/{id}` - View document chunks
- `DELETE /api/admin/embeddings/chunks/{id}` - Delete chunks

## Current State

- **Total Documents**: 308
- **With Old Embeddings**: 288 (need reprocessing)
- **No Embeddings**: 20
- **Migration Progress**: 0%

### By Scope
- **Platform**: 302 documents (286 need reprocessing)
- **User**: 0 documents
- **Conversation**: 6 documents (2 need reprocessing)

## Next Steps

1. Access embedding dashboard: http://localhost:8080/admin-embeddings.html
2. Update admin key in browser (will be prompted)
3. Click "Reprocess 10 Documents (Test)" to test
4. Monitor progress
5. Batch reprocess all documents
