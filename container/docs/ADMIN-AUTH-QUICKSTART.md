# ✅ Admin Panel Secured & Moved

## What We Did

1. **Moved Admin Panel** 
   - From: `website/admin.html` (static site)
   - To: `app/admin.html` (app with API access)
   
2. **Added Authentication**
   - Admin key required for all endpoints
   - Login modal with key verification
   - Persistent login via localStorage

3. **Protected All Routes**
   - Backend: `X-Admin-Key` header verification
   - Frontend: Auto-includes key in all requests
   - Auto-logout if key invalid

---

## Quick Setup

### 1. Set Admin Key

In `api/.env`:
```bash
ADMIN_KEY=your-secure-random-key-here
```

Generate secure key:
```bash
openssl rand -base64 32
```

### 2. Access Admin Panel

- **Local**: http://localhost:8081/admin.html
- **Production**: https://app.powernova.ai/admin.html

Enter your `ADMIN_KEY` when prompted.

---

## What's Protected

All admin endpoints now require authentication:

```
✓ POST   /api/admin/crawl
✓ GET    /api/admin/crawl
✓ GET    /api/admin/crawl/{id}
✓ DELETE /api/admin/crawl/{id}
✓ POST   /api/admin/crawl/{id}/cancel
✓ GET    /api/admin/documents
✓ GET    /api/admin/documents/{id}
✓ DELETE /api/admin/documents/{id}
✓ GET    /api/admin/stats
```

---

## Files Changed

```
✓ api/routes/admin.py          - Added verify_admin_key() dependency
✓ api/.env.example             - Added ADMIN_KEY variable
✓ app/admin.html               - Moved & added login modal
✗ website/admin.html           - Deleted (moved to app/)
```

---

## Testing

```bash
# 1. Start API with admin key set
cd api
ADMIN_KEY="test123" uvicorn main:app --reload

# 2. Open admin page
open http://localhost:8081/admin.html

# 3. Login with key: test123

# 4. Should see dashboard!
```

---

## Production Deployment

Set admin key in Azure:

```bash
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings ADMIN_KEY="$(openssl rand -base64 32)"
```

---

## Security Features

- ✅ Header-based authentication
- ✅ localStorage persistence  
- ✅ Auto-verification on load
- ✅ 401/403 error handling
- ✅ Logout on invalid key
- ✅ No plaintext in URL/cookies

---

**Status**: Admin panel is now secure and ready to use!

See `ADMIN-AUTH-SETUP.md` for full documentation.
