# Admin Panel Authentication - Setup Complete

## What Changed

Moved the admin panel to the `app/` directory and added admin key authentication for security.

---

## Changes Made

### 1. **Backend Authentication** (`api/routes/admin.py`)
- ✅ Added `verify_admin_key()` dependency
- ✅ All admin endpoints now require `X-Admin-Key` header
- ✅ Admin key loaded from `ADMIN_KEY` environment variable
- ✅ Returns 401 if key missing, 403 if invalid

### 2. **Admin UI** (`app/admin.html`)
- ✅ Moved from `website/` to `app/` directory
- ✅ Added login modal with key prompt
- ✅ Stores key in `localStorage` for persistence
- ✅ Automatically verifies key on page load
- ✅ All API calls include `X-Admin-Key` header
- ✅ Auto-logout if key becomes invalid

### 3. **Environment Configuration**
- ✅ Added `ADMIN_KEY` to `.env.example`
- ✅ Default key with warning if not set

---

## Setup Instructions

### 1. Set Admin Key

Add to your `api/.env` file:

```bash
# Generate a secure admin key
ADMIN_KEY=your-secure-random-key-here
```

**Generate a secure key:**
```bash
# On macOS/Linux:
openssl rand -base64 32

# Or use Python:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Configure Azure App Service

For production deployment:

```bash
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings ADMIN_KEY="your-secure-key-here"
```

### 3. Access Admin Panel

**Local Development:**
- URL: http://localhost:8081/admin.html (or whatever port your app runs on)
- Enter your `ADMIN_KEY` when prompted

**Production:**
- URL: https://app.powernova.ai/admin.html
- Enter your production `ADMIN_KEY`

---

## Security Features

### ✅ Authentication Required
- All admin API endpoints require valid admin key
- Key sent via `X-Admin-Key` HTTP header
- Stored securely in `localStorage`

### ✅ Automatic Verification
- Key verified on page load
- Invalid keys force re-login
- Auto-logout if key revoked

### ✅ Protected Routes
```
POST   /api/admin/crawl              ✓ Requires admin key
GET    /api/admin/crawl              ✓ Requires admin key
GET    /api/admin/crawl/{id}         ✓ Requires admin key
DELETE /api/admin/crawl/{id}         ✓ Requires admin key
POST   /api/admin/crawl/{id}/cancel  ✓ Requires admin key
GET    /api/admin/documents          ✓ Requires admin key
GET    /api/admin/documents/{id}     ✓ Requires admin key
DELETE /api/admin/documents/{id}     ✓ Requires admin key
GET    /api/admin/stats              ✓ Requires admin key
```

---

## How It Works

### Login Flow

```
1. User opens /admin.html
   ↓
2. Check localStorage for saved key
   ↓
3. If found, verify with API call to /admin/stats
   ↓
4. If valid → Show dashboard
   If invalid → Show login modal
   ↓
5. User enters admin key
   ↓
6. Test key with API
   ↓
7. If valid → Save to localStorage & show dashboard
   If invalid → Show error message
```

### API Request Flow

```javascript
// Frontend makes authenticated request
fetch('/api/admin/crawl', {
  headers: {
    'X-Admin-Key': 'user-provided-key'
  }
})
  ↓
// Backend verifies key
async function verify_admin_key(x_admin_key: str):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(403, "Invalid admin key")
  ↓
// If valid, process request
// If invalid, return 403 error
```

---

## Testing

### Test Authentication Locally

1. **Start the API:**
   ```bash
   cd api
   uvicorn main:app --reload
   ```

2. **Open admin page:**
   ```bash
   open http://localhost:8081/admin.html
   ```

3. **Enter your admin key** from `.env`

4. **Test invalid key:**
   - Enter wrong key → Should show error
   - Enter correct key → Should show dashboard

### Test API Directly

```bash
# Without key (should fail)
curl http://localhost:8000/api/admin/stats

# Response: 401 Unauthorized
# {"detail": "Admin key required. Provide X-Admin-Key header."}

# With wrong key (should fail)
curl -H "X-Admin-Key: wrong-key" \
  http://localhost:8000/api/admin/stats

# Response: 403 Forbidden
# {"detail": "Invalid admin key"}

# With correct key (should succeed)
curl -H "X-Admin-Key: your-actual-key" \
  http://localhost:8000/api/admin/stats

# Response: 200 OK
# {"crawl_jobs": {...}, "documents": {...}}
```

---

## File Structure

```
container/
├── app/
│   ├── admin.html           ← Admin panel (moved here)
│   ├── index.html           ← Chat app
│   ├── css/
│   └── js/
├── website/
│   ├── index.html           ← Landing page (no API calls)
│   ├── styles.css
│   └── js/
└── api/
    ├── routes/
    │   ├── admin.py         ← Protected with admin key
    │   └── chat.py
    └── .env                 ← Contains ADMIN_KEY
```

---

## Best Practices

### ✅ DO:
- Use a strong, randomly generated admin key
- Keep `ADMIN_KEY` secret (don't commit to git)
- Rotate the key periodically
- Use different keys for dev/staging/production
- Store production key in Azure App Service settings

### ❌ DON'T:
- Use simple/guessable keys like "admin123"
- Share the admin key publicly
- Commit `.env` file to git
- Use the same key across all environments
- Hard-code the key in the application

---

## Updating the Admin Key

### Local Development:
```bash
# Update api/.env
ADMIN_KEY=new-secure-key

# Restart the API
```

### Production (Azure):
```bash
# Update Azure App Service setting
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings ADMIN_KEY="new-secure-key"

# Restart the app
az webapp restart \
  --resource-group powernova \
  --name powernovaapi
```

All users will need to re-login with the new key.

---

## Troubleshooting

### "Admin key required" Error
**Solution**: Make sure you entered the key in the login modal.

### "Invalid admin key" Error
**Solutions**:
1. Check the key in `api/.env` matches what you entered
2. Restart the API server after changing `.env`
3. Clear `localStorage` and try again: `localStorage.removeItem('admin_key')`

### Auto-logout After Login
**Solutions**:
1. Verify `ADMIN_KEY` is set in environment
2. Check API logs for errors
3. Make sure API and app are on same domain (CORS)

### Can't Access Admin Page
**Solutions**:
1. Make sure app is running (nginx or static server)
2. Check URL is correct: `/admin.html` not `/admin`
3. Open browser console to see errors

---

## Security Considerations

### Current Level: **Basic**
- ✅ Prevents casual access
- ✅ Protects against unauthorized API calls
- ✅ Easy to implement and use

### For Production Enhancement:
- [ ] Add rate limiting (prevent brute force)
- [ ] Add session expiration (auto-logout after inactivity)
- [ ] Add multi-factor authentication
- [ ] Add user accounts with roles
- [ ] Add audit logging for admin actions
- [ ] Add IP whitelisting

---

## Summary

✅ **Admin panel** moved to `app/admin.html`  
✅ **Authentication** via `ADMIN_KEY` environment variable  
✅ **Login modal** with localStorage persistence  
✅ **All API endpoints** protected with key verification  
✅ **Website** remains static with no API calls  

**Access**: http://localhost:8081/admin.html (local) or https://app.powernova.ai/admin.html (production)

**Security**: Set a strong `ADMIN_KEY` in your environment variables before deploying!
