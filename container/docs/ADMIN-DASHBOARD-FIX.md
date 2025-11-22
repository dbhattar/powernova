# Admin Dashboard API Connection Fix

## Issue

Browser console showed error:
```
API Error: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This indicated the admin dashboard was receiving HTML instead of JSON from API calls.

## Root Cause

The `API_BASE` URL calculation was too simple and only handled the specific case of port 8080:

```javascript
// OLD - Only worked for port 8080
const API_BASE = window.location.origin.replace(':8080', ':8000') + '/api';
```

**Problems:**
1. Admin dashboard is served from port **8081** (powernova-chat container), not 8080
2. The `.replace(':8080', ':8000')` wouldn't match port 8081
3. Result: API calls went to wrong URL, got 404 HTML pages instead of JSON

## Solution

### 1. Improved API Base URL Detection

Updated to handle all environments:

```javascript
// NEW - Handles all cases
let API_BASE;
const currentOrigin = window.location.origin;

if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    // Local development - API is always on port 8000
    API_BASE = currentOrigin.replace(/:\d+/, ':8000') + '/api';
} else if (currentOrigin.includes('app.powernova.ai')) {
    // Production - API subdomain
    API_BASE = 'https://api.powernova.ai/api';
} else {
    // Fallback - assume API is on same origin
    API_BASE = currentOrigin + '/api';
}

console.log('API Base URL:', API_BASE);
```

**How it works:**
- **Local development**: Replaces ANY port with 8000 (handles 8080, 8081, etc.)
- **Production**: Uses dedicated API subdomain
- **Debug logging**: Prints API_BASE to console for verification

### 2. Enhanced Error Handling

Improved `apiCall()` function to provide better diagnostics:

```javascript
async function apiCall(endpoint, options = {}) {
    try {
        const url = `${API_BASE}${endpoint}`;
        console.log('API Call:', url); // Debug logging
        
        const response = await fetch(url, { /* ... */ });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMsg = `Request failed with status ${response.status}`;
            
            // Check if response is JSON or HTML
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                errorMsg = error.detail || error.message || errorMsg;
            } else {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                errorMsg = `API returned HTML instead of JSON. Check if endpoint exists: ${url}`;
            }
            
            throw new Error(errorMsg);
        }

        // Verify response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Expected JSON, got:', text.substring(0, 200));
            throw new Error(`API returned non-JSON response. Got: ${text.substring(0, 50)}...`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showAlert(error.message, 'error');
        throw error;
    }
}
```

**Improvements:**
- ✅ Logs exact URL being called
- ✅ Detects HTML vs JSON responses
- ✅ Shows first 200 chars of HTML errors in console
- ✅ Provides actionable error messages
- ✅ Displays alerts to user automatically

## Verification

### Check API Base URL
Open browser console when loading admin dashboard:
```
API Base URL: http://localhost:8000/api
```

### Verify API Calls
Watch console for successful API calls:
```
API Call: http://localhost:8000/api/admin/stats
API Call: http://localhost:8000/api/admin/crawl?limit=50
```

### Test Different Ports
All these URLs now work correctly:
- `http://localhost:8080/admin.html` → API: `http://localhost:8000/api` ✅
- `http://localhost:8081/admin.html` → API: `http://localhost:8000/api` ✅
- `https://app.powernova.ai/admin.html` → API: `https://api.powernova.ai/api` ✅

## Container Port Mapping

For reference:
```yaml
services:
  powernova-web:      # Website (landing page)
    ports: ["8080:80"]
    
  powernova-chat:     # Chat app (includes admin.html)
    ports: ["8081:80"]
    
  powernova-api:      # API backend
    ports: ["8000:8000"]
```

**Correct URLs:**
- Landing page: `http://localhost:8080`
- Chat app: `http://localhost:8081`
- **Admin dashboard: `http://localhost:8081/admin.html`** ← Note port 8081!
- API: `http://localhost:8000`

## Files Changed

- `app/admin.html`:
  - Updated `API_BASE` calculation (lines ~807-825)
  - Enhanced `apiCall()` error handling (lines ~848-896)

## Testing Checklist

- [x] Load admin dashboard: `http://localhost:8081/admin.html`
- [x] Check console for "API Base URL: http://localhost:8000/api"
- [x] Verify no "Unexpected token '<'" errors
- [x] Overview tab loads statistics
- [x] All tabs switch smoothly
- [x] API calls return JSON (not HTML)

## Common Errors Fixed

### Error: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
**Cause:** API call returned 404 HTML page instead of JSON  
**Fix:** Corrected API_BASE to point to port 8000

### Error: Network request fails silently
**Cause:** CORS or wrong origin  
**Fix:** API_BASE now uses regex to replace any port

### Error: Works on 8080 but not 8081
**Cause:** Hard-coded port replacement  
**Fix:** Dynamic port detection using `/:\d+/` regex

## Future Improvements

- [ ] Add retry logic for failed API calls
- [ ] Implement request timeout handling
- [ ] Add loading states for better UX
- [ ] WebSocket for real-time updates
- [ ] Service worker for offline support

---

**Status:** ✅ Fixed and tested  
**Last Updated:** November 21, 2024
