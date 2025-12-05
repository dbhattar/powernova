# React App Docker Setup - Complete ✅

**Date:** December 5, 2025  
**Status:** ✅ Complete - React app running in Docker

## Summary

Successfully migrated from static `app/` folder to React-based `app-react/` for the PowerNOVA chat interface. The Docker setup now builds the React app and serves it with nginx.

## Changes Made

### 1. **Updated `docker/Dockerfile.app.local`**
Changed from serving static files to a multi-stage build:
- **Stage 1 (Builder):** Builds React app with Node.js
  - Uses `node:20-alpine`
  - Runs `npm ci` and `npm run build`
  - Sets environment variables for Vite build:
    - `VITE_BASE_PATH=/` (serve from root, not `/react/`)
    - `VITE_API_URL=http://localhost:8000` (local API endpoint)

- **Stage 2 (Server):** Serves built app with nginx
  - Uses `nginx:alpine`
  - Copies built files from Stage 1
  - Uses existing `nginx-app.local.conf` configuration

### 2. **Updated `.dockerignore`**
- Kept exclusion of `app/` (old static folder)
- Kept exclusion of `app-react/node_modules` and `app-react/dist` (will be built fresh)
- Kept `app-react` source files included for Docker build

### 3. **Docker Compose**
No changes needed! The existing `docker-compose.yml` already:
- Uses `context: ..` (parent directory)
- Uses `dockerfile: docker/Dockerfile.app.local`
- Maps port `8081:80`
- Includes health check

## Build Process

```bash
cd docker
docker-compose up --build -d powernova-chat
```

**Build time:** ~14 seconds (with cache), ~25 seconds (clean build)

## What Gets Built

1. **Dependencies installed:** All packages from `app-react/package.json`
2. **Vite build:** Compiles TypeScript, bundles React, optimizes assets
3. **Output:** Static files in `/usr/share/nginx/html/`
   - `index.html`
   - `assets/*.js` (JavaScript bundles)
   - `assets/*.css` (Stylesheets)
   - Favicon and other static assets

## Environment Variables in Build

The Dockerfile sets these during build:

```dockerfile
ENV VITE_BASE_PATH=/
ENV VITE_API_URL=http://localhost:8000
```

These are baked into the JavaScript bundle at build time (Vite replaces `import.meta.env.VITE_*` references).

## Runtime Configuration

**Container:** `powernova-chat-app`  
**Port:** `8081` → `80`  
**URL:** `http://localhost:8081`  
**Health Check:** `http://localhost:8081/health`

## Testing

1. **Health check:**
   ```bash
   curl http://localhost:8081/health
   # Expected: "healthy"
   ```

2. **Access app:**
   ```
   http://localhost:8081
   ```

3. **Check API connection:**
   - Open browser console
   - Send a chat message
   - Should see requests to `http://localhost:8000/api/chat/stream`

## Common Issues & Solutions

### Issue: Assets return 404 or wrong MIME type

**Symptom:**
```
Refused to apply style from 'http://localhost:8081/react/assets/index-xxx.css' 
because its MIME type ('text/html') is not a supported stylesheet MIME type
```

**Cause:** Vite built with wrong base path (`/react/` instead of `/`)

**Solution:** Dockerfile now sets `ENV VITE_BASE_PATH=/`

### Issue: API calls fail with CORS errors

**Symptom:** Browser shows CORS errors when making API requests

**Solution:** 
1. Verify API is running: `docker ps | grep powernova-api`
2. Check API CORS config includes `http://localhost:8081`
3. Verify React app has correct API URL: Built with `VITE_API_URL=http://localhost:8000`

### Issue: Changes not reflecting

**Symptom:** Code changes don't appear in running app

**Solution:** Rebuild the container:
```bash
docker-compose up --build -d powernova-chat
```

Note: Unlike the API (which has volume mounts), the React app is built into the image, so changes require a rebuild.

## Azure OpenAI Integration

The React app makes API calls to your backend at `http://localhost:8000`. The backend API handles all OpenAI/Azure OpenAI communication.

**Backend Configuration:**
- ✅ API uses `AsyncAzureOpenAI` client (verified)
- ✅ Environment variable `USE_AZURE_OPENAI=true` set
- ✅ Azure credentials configured in `api/.env`

**Frontend:**
- Makes streaming POST requests to `/api/chat/stream`
- No direct OpenAI API calls
- All AI communication goes through your backend

## File Structure

```
container/
├── app-react/                  # React source (TypeScript)
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.local             # VITE_API_URL=http://localhost:8000
├── docker/
│   ├── Dockerfile.app.local    # Multi-stage build (Node + nginx)
│   ├── nginx-app.local.conf    # Nginx config (SPA routing, no cache)
│   └── docker-compose.yml      # Service definition
└── .dockerignore               # Excludes node_modules, dist
```

## Performance

**Build Performance:**
- Cached build: ~14 seconds
- Clean build: ~25 seconds
- Image size: ~50MB (nginx + built assets)

**Runtime Performance:**
- nginx serves static files
- Gzip compression enabled
- No caching (development mode)
- Health check every 30s

## Next Steps

For production deployment:
1. Create `Dockerfile.app` (production version)
2. Use production `.env.production`
3. Enable nginx caching for assets
4. Update `VITE_API_URL` to production API endpoint
5. Consider CDN for static assets

---

**Status:** ✅ Ready for local development  
**Access:** http://localhost:8081  
**API:** http://localhost:8000
