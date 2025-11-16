# CORS Error Fix - PowerNOVA API

## Problem
```
Access to fetch at 'https://powernovaapi.azurewebsites.net/api/chat/stream' 
from origin 'https://powernova-chat-app.azurewebsites.net' 
has been blocked by CORS policy: Response to preflight request doesn't pass 
access control check: No 'Access-Control-Allow-Origin' header is present on 
the requested resource.
```

## Root Cause
The `ALLOWED_ORIGINS` list in `api/main.py` had a **trailing slash** on the Azure domain:

```python
# WRONG - Has trailing slash
"https://powernova-chat-app.azurewebsites.net/"

# Browser sends origin WITHOUT trailing slash
Origin: https://powernova-chat-app.azurewebsites.net
```

CORS middleware does **exact string matching**, so:
- Browser sends: `https://powernova-chat-app.azurewebsites.net`
- CORS checks: `https://powernova-chat-app.azurewebsites.net/`
- **Result**: No match → CORS blocked ❌

## Fix Applied

### Updated `api/main.py`:

**Before:**
```python
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",
    "https://www.powernova.ai",
    "http://localhost:8081",
    "http://localhost:8080",
    "https://powernova-chat-app.azurewebsites.net/",  # ❌ Trailing slash
]
```

**After:**
```python
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",                      # Production chat app (custom domain)
    "https://www.powernova.ai",                      # Production landing page
    "https://powernova-chat-app.azurewebsites.net",  # ✅ No trailing slash
    "http://localhost:8081",                          # Local chat app
    "http://localhost:8080",                          # Local landing page
]
```

### Added debugging and optimization:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # ✅ NEW: Cache preflight requests for 1 hour
)

# ✅ NEW: Log allowed origins for debugging
print("=" * 50)
print("CORS Configuration:")
print("Allowed Origins:")
for origin in ALLOWED_ORIGINS:
    print(f"  - {origin}")
print("=" * 50)
```

## Benefits of the Fix

1. **Removed trailing slash** - Matches browser's Origin header exactly
2. **Added `max_age=3600`** - Browsers cache preflight requests for 1 hour, reducing OPTIONS requests
3. **Added logging** - Startup logs show which origins are allowed (helps debugging)

## Verification

### Check CORS headers in browser:
```bash
# Test from browser console (on powernova-chat-app.azurewebsites.net)
fetch('https://powernovaapi.azurewebsites.net/health')
  .then(r => r.json())
  .then(data => console.log(data))
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "powernova-api",
  "version": "1.0.0"
}
```

### Check response headers:
```bash
curl -I -X OPTIONS \
  -H "Origin: https://powernova-chat-app.azurewebsites.net" \
  -H "Access-Control-Request-Method: POST" \
  https://powernovaapi.azurewebsites.net/api/chat/stream
```

**Expected headers:**
```
Access-Control-Allow-Origin: https://powernova-chat-app.azurewebsites.net
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Max-Age: 3600
```

### Check application logs:
```bash
az webapp log tail --name powernovaapi --resource-group powernova
```

**Expected on startup:**
```
==================================================
CORS Configuration:
Allowed Origins:
  - https://app.powernova.ai
  - https://www.powernova.ai
  - https://powernova-chat-app.azurewebsites.net
  - http://localhost:8081
  - http://localhost:8080
==================================================
```

## Common CORS Mistakes to Avoid

### ❌ Don't:
```python
# Trailing slashes
"https://example.com/"  # Won't match "https://example.com"

# Wildcards in production (security risk)
"*"  # Allows any origin

# Mixed protocols
"http://secure-site.com"  # Use https://

# Port in origin when not needed
"https://example.com:443"  # Just use "https://example.com"

# Subdomain wildcards (not supported)
"https://*.example.com"  # Not valid CORS syntax
```

### ✅ Do:
```python
# Exact origin match
"https://example.com"

# Specific allowed origins
["https://app.example.com", "https://www.example.com"]

# Include all variations you need
["https://example.com", "http://localhost:3000"]

# Use environment variables for flexibility
origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
```

## Testing CORS

### 1. Test with curl:
```bash
# Preflight request (OPTIONS)
curl -v -X OPTIONS \
  -H "Origin: https://powernova-chat-app.azurewebsites.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://powernovaapi.azurewebsites.net/api/chat/stream
```

### 2. Test from browser console:
```javascript
// On https://powernova-chat-app.azurewebsites.net
fetch('https://powernovaapi.azurewebsites.net/api/chat/stream', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    messages: [{role: 'user', content: 'Hello'}]
  })
})
```

### 3. Check browser DevTools:
1. Open Network tab
2. Look for OPTIONS request (preflight)
3. Check Response Headers for `Access-Control-Allow-Origin`
4. Verify it matches your origin exactly

## Deployment

The fix has been deployed:

```bash
# Deployment command used
./scripts/azure-deploy-api.sh --update

# Status
✅ Image built successfully
✅ Image pushed to ACR
✅ App Service updated
✅ Container restarted
```

**API URL:** https://powernovaapi.azurewebsites.net
**Chat App:** https://powernova-chat-app.azurewebsites.net

## Next Steps

### If CORS still not working:

1. **Check browser console** for exact origin being sent
2. **Check API logs** for CORS configuration output
3. **Verify container restarted** after deployment
4. **Clear browser cache** (hard refresh: Cmd+Shift+R)
5. **Test with curl** to isolate browser vs server issue

### Add more origins if needed:

Edit `api/main.py`:
```python
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",
    "https://www.powernova.ai",
    "https://powernova-chat-app.azurewebsites.net",
    "https://new-origin.com",  # Add here
    "http://localhost:8081",
    "http://localhost:8080",
]
```

Then redeploy:
```bash
./scripts/azure-deploy-api.sh --update
```

## Summary

✅ **Fixed:** Removed trailing slash from Azure domain in CORS origins
✅ **Added:** Preflight caching (max_age=3600)
✅ **Added:** Startup logging for debugging
✅ **Deployed:** Updated container now running in production

**Result:** CORS should now work for requests from `https://powernova-chat-app.azurewebsites.net`

The chat application should now be able to make requests to the API without CORS errors! 🎉
