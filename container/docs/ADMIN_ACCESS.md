# Admin Panel Access Guide

## 🌐 Access URLs

### Local Development

- **Admin Panel**: http://localhost:8081/admin.html
- **API Endpoint**: http://localhost:8000/api
- **API Docs**: http://localhost:8000/docs

### Production (Azure)

- **Admin Panel**: https://app.powernova.ai/admin.html
- **API Endpoint**: https://api.powernova.ai/api
- **API Docs**: https://api.powernova.ai/docs

## 🚀 How to Access Locally

1. Make sure containers are running:
   ```bash
   cd docker
   docker-compose ps
   # Should show powernova-api and powernova-postgres as "running"
   ```

2. Open the admin panel:
   ```
   http://localhost:8081/admin.html
   ```


4. The admin panel will:
   - Show dashboard statistics
   - Allow creating crawl jobs
   - Display and manage documents
   - Auto-refresh every 10 seconds

## 🧪 Test API Directly

### Without Authentication (should fail)
```bash
curl http://localhost:8000/api/admin/stats
# Response: {"detail":"Admin key required. Provide X-Admin-Key header."}
```

### With Authentication (should work)
```bash
curl -H "X-Admin-Key: ******" \
     http://localhost:8000/api/admin/stats
# Response: JSON with stats
```

## 📝 Create a Test Crawl Job

```bash
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: ********" \
  -d '{
    "start_url": "https://docs.python.org",
    "max_depth": 2,
    "max_pages": 10,
    "file_types": ["html", "pdf"],
    "include_patterns": ["/3/.*"]
  }'
```

## 🔄 What Was Fixed

### Issue
The admin panel was calling `http://localhost:8081/api/admin/stats` (wrong port) instead of `http://localhost:8000/api/admin/stats` (correct port).

### Solution
Updated `app/admin.html` to detect local development and use the correct API URL:

```javascript
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isDev 
    ? 'http://localhost:8000/api'  // Local development
    : window.location.origin + '/api';  // Production (same origin)
```

### For Production
In production (Azure), both the app and API are on the same domain, so `window.location.origin + '/api'` works correctly.

## ✅ Verification Checklist

- [x] PostgreSQL container running
- [x] API container running  
- [x] Migration 002 applied (crawl_jobs and documents tables created)
- [x] ADMIN_KEY set in api/.env
- [x] API responding on http://localhost:8000
- [x] Admin authentication working
- [x] Admin panel loads at http://localhost:8081/admin.html

## 🎯 Next Steps

1. **Refresh your browser** at http://localhost:8081/admin.html
2. **Login** with the admin key above
3. **Create a test crawl job** to verify everything works
4. **Deploy to Azure** when ready:
   ```bash
   ./scripts/azure-deploy-api.sh --update
   ./scripts/azure-run-migrations.sh
   ```

---

**Note**: The admin key shown above is for local development only. For production, set a different secure key in Azure App Service settings.
