# 🚀 Crawler Deployment Checklist

## Pre-Deployment Setup

### 1. Azure Storage Account

Create storage account if you don't have one:
```bash
# Create storage account
az storage account create \
  --name powernovadocs \
  --resource-group your-resource-group \
  --location eastus \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name powernovadocs \
  --resource-group your-resource-group \
  --query connectionString -o tsv
```

### 2. Environment Variables

Set these in Azure App Service:
```bash
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name your-app-name \
  --settings \
    ADMIN_KEY="generate-secure-random-key" \
    AZURE_STORAGE_CONNECTION_STRING="your-connection-string-from-above" \
    AZURE_STORAGE_CONTAINER_NAME="powernova-documents"
```

Or in Azure Portal:
- Go to App Service → Configuration → Application settings
- Add new settings:
  - `ADMIN_KEY`: Strong random key (use password generator)
  - `AZURE_STORAGE_CONNECTION_STRING`: From storage account
  - `AZURE_STORAGE_CONTAINER_NAME`: `powernova-documents`
- Save and restart

### 3. Install Dependencies

The new dependencies will be installed automatically on deployment, but verify `requirements.txt` includes:
- ✅ beautifulsoup4
- ✅ requests
- ✅ lxml
- ✅ azure-storage-blob
- ✅ azure-identity
- ✅ PyPDF2
- ✅ python-docx
- ✅ validators

## Deployment Steps

### Option 1: Azure CLI

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# Deploy
az webapp up \
  --resource-group your-resource-group \
  --name your-app-name \
  --runtime "PYTHON:3.11"
```

### Option 2: Git Push

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# Commit changes
git add .
git commit -m "Implement web crawler for RAG system"

# Push to Azure (if configured)
git push azure main
```

### Option 3: Manual Deployment

1. Zip the `api` directory
2. Go to Azure Portal → App Service → Deployment Center
3. Upload zip file
4. Wait for deployment to complete

## Post-Deployment Verification

### 1. Check API Health

```bash
# Test API is running
curl https://your-app-name.azurewebsites.net/

# Check admin endpoint (should get 401 without key)
curl https://your-app-name.azurewebsites.net/api/admin/stats
```

### 2. Check Environment Variables

In Azure Portal:
- App Service → Configuration → Application settings
- Verify all variables are set
- No typos in variable names

### 3. Check Logs

```bash
# Stream logs
az webapp log tail \
  --resource-group your-resource-group \
  --name your-app-name
```

Look for:
- ✅ "AZURE_STORAGE_CONNECTION_STRING" configured message
- ✅ Container creation log
- ❌ No import errors
- ❌ No Azure connection errors

### 4. Test Admin Access

1. Open: `https://your-app-name.azurewebsites.net/admin.html`
2. Enter your `ADMIN_KEY`
3. Should see dashboard with stats (all zeros initially)

### 5. Test Crawler

Create a simple test job:
```json
{
  "start_url": "https://example.com",
  "max_depth": 0,
  "max_pages": 1,
  "file_types": ["html"],
  "allowed_domains": [],
  "include_patterns": [],
  "exclude_patterns": []
}
```

Expected results:
- Job status: PENDING → RUNNING → COMPLETED
- Documents found: 1
- Check Azure Storage container for uploaded file

## Troubleshooting

### "Azure Storage not configured"

**Check:**
- Environment variable name is exactly `AZURE_STORAGE_CONNECTION_STRING`
- Connection string is valid (no line breaks)
- Storage account exists and is accessible

**Fix:**
```bash
# Verify variable is set
az webapp config appsettings list \
  --resource-group your-rg \
  --name your-app \
  --query "[?name=='AZURE_STORAGE_CONNECTION_STRING']"

# Update if needed
az webapp config appsettings set \
  --resource-group your-rg \
  --name your-app \
  --settings AZURE_STORAGE_CONNECTION_STRING="your-connection-string"

# Restart app
az webapp restart --resource-group your-rg --name your-app
```

### Import Errors (beautifulsoup4, PyPDF2, etc.)

**Check:**
- `requirements.txt` includes all dependencies
- Deployment logs show successful pip install

**Fix:**
```bash
# Redeploy to force reinstall
az webapp restart --resource-group your-rg --name your-app
```

### Crawl Jobs Stuck in "Running"

**Check:**
- Background tasks are working
- No Python exceptions in logs

**Fix:**
- Check logs for errors
- Cancel stuck jobs via admin UI
- Restart app service

### Container Creation Failed

**Check:**
- Storage account connection string is correct
- Storage account has proper permissions

**Fix:**
- Create container manually in Azure Portal
- Or wait for next job creation (auto-creates)

## Testing in Production

### Simple Test (1 page)
```
URL: https://example.com
Max Depth: 0
Max Pages: 1
File Types: html
```
Expected: ~5 seconds, 1 document

### Medium Test (Documentation)
```
URL: https://fastapi.tiangolo.com
Max Depth: 2
Max Pages: 50
File Types: html
```
Expected: ~30-60 seconds, 20-50 documents

### PDF Test
```
URL: https://yoursite.com/resources
Max Depth: 1
Max Pages: 10
File Types: pdf
```
Expected: Depends on PDF sizes and count

## Monitoring

### Azure Portal

Monitor these metrics:
- **CPU Time**: Should spike during crawls
- **Memory**: Should stay under limits
- **HTTP 5xx Errors**: Should be 0
- **Response Time**: Should be fast for admin UI

### Database

Check table sizes:
```sql
SELECT COUNT(*) FROM crawl_jobs;
SELECT COUNT(*) FROM documents;
SELECT status, COUNT(*) FROM crawl_jobs GROUP BY status;
```

### Azure Storage

Check container size:
- Azure Portal → Storage Account → Containers
- View `powernova-documents` container
- Monitor blob count and size

## Performance Tuning

### For Large Crawls

Increase timeouts if needed:
```python
# In crawler.py, adjust:
self.request_delay = 0.5  # Increase if getting rate limited
timeout=30  # Increase if pages are slow
```

### For App Service

Consider scaling up if crawls are slow:
```bash
# Scale up to higher tier
az appservice plan update \
  --resource-group your-rg \
  --name your-plan \
  --sku B2  # Or higher
```

## Security Checklist

- ✅ ADMIN_KEY is strong and random (not default)
- ✅ Storage connection string is kept secret
- ✅ CORS origins are properly configured
- ✅ Database credentials are secure
- ✅ SSL/HTTPS is enabled
- ✅ Admin UI requires authentication

## Next Steps After Deployment

1. **Test thoroughly** with various websites
2. **Monitor Azure costs** (storage, bandwidth)
3. **Set up alerts** for errors
4. **Document** your crawl configurations
5. **Implement embeddings** for RAG (next phase)

## Support

If issues persist:
1. Check Azure App Service logs
2. Check Azure Storage logs
3. Review database for error messages
4. Check network connectivity to target sites
5. Verify all environment variables are set correctly

## Quick Commands Reference

```bash
# View logs
az webapp log tail --resource-group your-rg --name your-app

# Restart app
az webapp restart --resource-group your-rg --name your-app

# List environment variables
az webapp config appsettings list --resource-group your-rg --name your-app

# Set environment variable
az webapp config appsettings set --resource-group your-rg --name your-app --settings KEY=value

# Check deployment status
az webapp deployment list --resource-group your-rg --name your-app

# SSH into container (if enabled)
az webapp ssh --resource-group your-rg --name your-app
```

---

## ✅ Ready to Deploy!

Once you've completed this checklist, your crawler will be fully operational and ready to index documents for your RAG system.
