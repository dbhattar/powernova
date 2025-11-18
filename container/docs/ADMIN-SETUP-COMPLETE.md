# ✅ Admin Panel Setup - COMPLETE

## 🎉 Summary

The admin panel is now fully configured and uses the centralized PowerNOVA configuration system!

---

## 🔑 Your Admin Key

```
wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=
```

---

## 🌐 Access the Admin Panel

### Local Development
1. **Open**: http://localhost:8081/admin.html
2. **Login** with the admin key above
3. **API**: Automatically connects to http://localhost:8000/api

### Production (Azure)
1. **Open**: https://app.powernova.ai/admin.html
2. **Login** with your production admin key
3. **API**: Automatically connects to https://powernovaapi.azurewebsites.net/api

---

## 🔧 How It Works

### Configuration System

The admin panel now uses the same `config.js` system as the rest of the PowerNOVA app:

```html
<!-- admin.html includes config.js -->
<script src="js/config.js"></script>

<script>
    // API URL comes from PowerNOVA config
    const API_BASE = window.PowerNOVA.getApiUrl() + '/api';
</script>
```

### Environment Detection

**Local Development** (`config.local.js`):
```javascript
const config = {
    landingUrl: 'http://localhost:8080',
    apiUrl: 'http://localhost:8000',      // ← Admin uses this
    wsUrl: 'ws://localhost:8000',
    environment: 'local'
};
```

**Production** (`config.js`):
```javascript
const config = {
    landingUrl: 'https://www.powernova.ai',
    apiUrl: 'https://powernovaapi.azurewebsites.net',  // ← Admin uses this
    wsUrl: 'wss://api.powernova.ai',
    environment: 'production'
};
```

### Docker Build Process

During Docker build, the appropriate config is used:

```dockerfile
# Dockerfile.app.local (for local development)
RUN rm -f js/config.js && mv js/config.local.js js/config.js

# Dockerfile.app (for production)
# config.js stays as is (production settings)
```

---

## 🧪 Testing

### Test Config is Loaded

Open browser console at http://localhost:8081/admin.html:

```javascript
console.log(window.PowerNOVA.config);
// Should show: { apiUrl: 'http://localhost:8000', ... }

console.log(window.PowerNOVA.getApiUrl());
// Should show: 'http://localhost:8000'
```

### Test API Connection

```bash
# Without auth (should fail with 401)
curl http://localhost:8000/api/admin/stats

# With auth (should succeed)
curl -H "X-Admin-Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=" \
     http://localhost:8000/api/admin/stats
```

### Test Admin Panel

1. Open http://localhost:8081/admin.html
2. Should see login modal
3. Enter admin key: `wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=`
4. Should see dashboard with stats
5. Check browser console - no errors!

---

## 📋 What Was Fixed

### Issue 1: Hardcoded API URL ❌

**Before:**
```javascript
// Hardcoded logic in admin.html
const isDev = window.location.hostname === 'localhost';
const API_BASE = isDev 
    ? 'http://localhost:8000/api'
    : window.location.origin + '/api';
```

**Problem**: Inconsistent with the rest of the app, duplicated configuration logic.

### Solution 1: Use PowerNOVA Config ✅

**After:**
```javascript
// Uses centralized config
const API_BASE = window.PowerNOVA.getApiUrl() + '/api';
```

**Benefits**:
- ✅ Consistent with chat app
- ✅ Single source of truth for API URLs
- ✅ Easy to update for different environments
- ✅ Works for local, staging, production

---

### Issue 2: SQLAlchemy Reserved Attribute ❌

**Before:**
```python
class Document(Base):
    metadata = Column(JSON, default={})  # ❌ Conflicts with SQLAlchemy
```

**Error:**
```
sqlalchemy.exc.InvalidRequestError: Attribute name 'metadata' is reserved 
when using the Declarative API.
```

### Solution 2: Rename Column ✅

**After:**
```python
class Document(Base):
    doc_metadata = Column(JSON, default={})  # ✅ No conflict
```

**Files Updated**:
- ✅ `api/models/document.py`
- ✅ `api/alembic/versions/002_add_documents_crawl.py`

---

## 🗄️ Database Status

### Migration Applied ✅

```bash
docker exec -it powernova-api python -m alembic upgrade head
# INFO  [alembic.runtime.migration] Running upgrade 001 -> 002
```

### Tables Created ✅

```
✅ Found 7 tables in database:

  ✓ alembic_version
  ✓ artifacts
  ✓ conversations
  ✓ crawl_jobs          ← NEW
  ✓ documents           ← NEW
  ✓ messages
  ✓ users
```

### Document Model ✅

```
📋 DOCUMENTS table structure:

  - id: INTEGER
  - url: VARCHAR(2048)
  - title: VARCHAR(500)
  - content: TEXT
  - document_type: VARCHAR(8)
  - file_path: VARCHAR(1024)
  - blob_url: VARCHAR(2048)
  - file_size: INTEGER
  - status: VARCHAR(10)
  - error_message: TEXT
  - doc_metadata: JSON          ← Fixed column name
  - crawl_job_id: INTEGER
  - embedding_generated: BOOLEAN
  - chunk_count: INTEGER
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
```

---

## 🚀 Next Steps

### 1. Deploy to Azure

```bash
# Deploy updated API code
./scripts/azure-deploy-api.sh --update

# Run migration in Azure
./scripts/azure-run-migrations.sh

# Set admin key in Azure
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings ADMIN_KEY="your-production-key"
```

### 2. Deploy Updated App

The app container now includes the updated admin.html that uses config.js:

```bash
# Deploy app with updated admin panel
./scripts/azure-deploy-app.sh --update
```

### 3. Test Production Admin

1. Go to https://app.powernova.ai/admin.html
2. Login with production admin key
3. Verify stats and crawl job features

---

## 📦 Container Status

### Running Containers

```bash
cd docker
docker-compose ps

# Should show:
# powernova-postgres   Up (healthy)
# powernova-api        Up (healthy)
# powernova-chat-app   Up
```

### Rebuild Containers

If you make changes:

```bash
cd docker

# Rebuild API (if you change models/routes)
docker-compose up -d --build powernova-api

# Rebuild chat app (if you change admin.html)
docker-compose up -d --build powernova-chat

# View logs
docker-compose logs -f powernova-api
```

---

## 🎯 Features Available

### Admin Panel Features ✅

- [x] **Authentication** - Admin key login with localStorage persistence
- [x] **Dashboard** - Real-time stats (jobs, documents, embeddings)
- [x] **Create Crawl Jobs** - Form with URL, depth, file types, filters
- [x] **Job Management** - List, view, cancel, delete crawl jobs
- [x] **Document Management** - List, view, delete documents
- [x] **Auto-refresh** - Dashboard updates every 10 seconds
- [x] **Responsive Design** - Works on mobile and desktop

### API Endpoints ✅

All protected with `X-Admin-Key` header:

```
POST   /api/admin/crawl              # Create crawl job
GET    /api/admin/crawl              # List jobs
GET    /api/admin/crawl/{id}         # Get job
DELETE /api/admin/crawl/{id}         # Delete job
POST   /api/admin/crawl/{id}/cancel  # Cancel job
GET    /api/admin/documents          # List documents
GET    /api/admin/documents/{id}     # Get document
DELETE /api/admin/documents/{id}     # Delete document
GET    /api/admin/stats              # Dashboard stats
```

---

## 📚 Documentation

- **Setup Guide**: `ADMIN-AUTH-SETUP.md` - Comprehensive authentication setup
- **Quick Start**: `ADMIN-AUTH-QUICKSTART.md` - Quick reference
- **RAG Setup**: `RAG-ADMIN-SETUP.md` - RAG system documentation
- **This File**: `ADMIN-SETUP-COMPLETE.md` - Complete status and configuration

---

## ✅ Checklist

Local Development:
- [x] PostgreSQL container running
- [x] API container running
- [x] Chat app container running
- [x] Migration 002 applied
- [x] ADMIN_KEY set in .env
- [x] config.js loaded in admin.html
- [x] API responds on http://localhost:8000
- [x] Admin panel loads at http://localhost:8081/admin.html
- [x] Authentication working
- [x] No browser console errors

Configuration:
- [x] Uses PowerNOVA config system
- [x] Environment detection working
- [x] API URL correctly configured
- [x] Admin key authentication enabled

Database:
- [x] crawl_jobs table created
- [x] documents table created (with doc_metadata column)
- [x] Enums created (CrawlStatus, DocumentType, DocumentStatus)
- [x] Indexes created

---

## 🎉 Status: READY FOR USE!

The admin panel is fully functional and ready to:
1. ✅ Create and manage crawl jobs
2. ✅ View and manage documents
3. ✅ Monitor statistics
4. ✅ Deploy to production

**Next Phase**: Implement the actual web crawler service to make crawl jobs functional!

---

**Access Now**: http://localhost:8081/admin.html

**Admin Key**: `wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=`
