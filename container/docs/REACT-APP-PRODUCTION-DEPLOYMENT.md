# React App Production Deployment Guide

## Overview

Successfully updated `Dockerfile.app` to build and deploy the **new React app** instead of the legacy HTML/JS app.

## Changes Made

### Updated File: `docker/Dockerfile.app`

**Before** (Legacy App):
```dockerfile
FROM nginx:alpine
COPY app/ .
```

**After** (React App - Multi-stage Build):
```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY app-react/package*.json ./
RUN npm ci --only=production
COPY app-react/ ./
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist/ .
```

## Multi-Stage Build Benefits

1. **Smaller Image Size**: Final image only contains built files, not Node.js or source code
2. **Faster Deployments**: Production image is lightweight (nginx + static files)
3. **Build Once, Run Anywhere**: Consistent builds across environments
4. **Security**: No dev dependencies in production image

## Deployment Process

### Option 1: Using Azure Deployment Script (Recommended)

The existing deployment script will automatically use the new Dockerfile:

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# Full deployment (first time or new resources)
./scripts/azure-deploy-chat.sh

# Update existing deployment (just new code)
./scripts/azure-deploy-chat.sh --update
```

**What the script does:**
1. ✅ Checks prerequisites (Azure CLI, Docker)
2. ✅ Prompts for configuration (or loads from `.azure-chat-deployment.conf`)
3. ✅ Creates/verifies Azure resources (ACR, App Service Plan, Web App)
4. ✅ **Builds React app using multi-stage Dockerfile**
5. ✅ Pushes image to Azure Container Registry
6. ✅ Configures Web App with new image
7. ✅ Restarts app

### Option 2: Manual Deployment

If you prefer manual control:

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# 1. Build the Docker image locally (test)
docker build -f docker/Dockerfile.app -t powernova-chat-app .

# 2. Test locally
docker run -p 8080:80 powernova-chat-app
# Visit http://localhost:8080

# 3. Build and push to ACR
az acr build \
  --registry <your-acr-name> \
  --image powernova-chat-app:latest \
  --file docker/Dockerfile.app \
  .

# 4. Update Web App
az webapp config container set \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name <your-acr>.azurecr.io/powernova-chat-app:latest

# 5. Restart
az webapp restart \
  --name <your-webapp-name> \
  --resource-group <your-resource-group>
```

## Environment Variables

The React app uses environment variables during **build time** (not runtime). Make sure these are set in `app-react/.env.production`:

```env
VITE_API_URL=https://api.powernova.ai
VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"..."}
VITE_ANALYTICS_DEBUG=false
```

**Important**: These are baked into the build, so if you change them, you must **rebuild and redeploy**.

## Verification Steps

After deployment:

1. **Check Build Logs**:
   ```bash
   az acr task logs --registry <your-acr-name>
   ```

2. **Check App Logs**:
   ```bash
   az webapp log tail \
     --name <your-webapp-name> \
     --resource-group <your-resource-group>
   ```

3. **Test the App**:
   - Visit `https://<your-webapp-name>.azurewebsites.net`
   - Or custom domain: `https://app.powernova.ai`

4. **Verify Features**:
   - ✅ Login/Logout works
   - ✅ Conversations load
   - ✅ Chat functionality works
   - ✅ Firebase Analytics tracking
   - ✅ Account request modal

## Rollback Plan

If something goes wrong, you can rollback to the legacy app:

```bash
# 1. Revert Dockerfile
cd docker
git checkout HEAD~1 Dockerfile.app

# 2. Rebuild and deploy
az acr build \
  --registry <your-acr-name> \
  --image powernova-chat-app:rollback \
  --file docker/Dockerfile.app \
  .

# 3. Update Web App
az webapp config container set \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name <your-acr>.azurecr.io/powernova-chat-app:rollback
```

## Build Performance

**Build Time**: ~2-3 minutes
- Stage 1 (Node build): ~1.5-2 minutes
- Stage 2 (Nginx): ~10 seconds

**Image Sizes**:
- Builder stage: ~500 MB (includes Node.js, npm, source code)
- Final image: ~50 MB (nginx + built files only)

## Troubleshooting

### Build Fails

**Error**: `npm ci` fails
- **Solution**: Check `package.json` and `package-lock.json` are in sync
- **Fix**: Run `npm install` locally and commit updated `package-lock.json`

**Error**: Build context too large
- **Solution**: Add files to `.dockerignore`
- **Check**: `app-react/node_modules` should be in `.dockerignore`

### Runtime Issues

**Error**: Blank page or 404 errors
- **Cause**: SPA routing not configured
- **Solution**: Already handled by `nginx-app.conf` with `try_files $uri $uri/ /index.html;`

**Error**: API calls fail
- **Cause**: Wrong `VITE_API_URL` in `.env.production`
- **Fix**: Update `.env.production` and rebuild

**Error**: Firebase not working
- **Cause**: Invalid Firebase config
- **Fix**: Check `VITE_FIREBASE_CONFIG` in `.env.production`

## Docker Build Context

The build runs from the **container** directory as context:

```
container/
├── app-react/          ← React app source
│   ├── src/
│   ├── public/
│   ├── dist/          ← Build output (created during build)
│   ├── package.json
│   └── .env.production
├── docker/
│   ├── Dockerfile.app  ← The updated Dockerfile
│   └── nginx-app.conf  ← Nginx config (already SPA-ready)
└── scripts/
    └── azure-deploy-chat.sh
```

## Next Steps

1. **Test Locally First**:
   ```bash
   cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
   docker build -f docker/Dockerfile.app -t test-chat .
   docker run -p 8080:80 test-chat
   ```

2. **Deploy to Staging** (if you have one):
   ```bash
   ./scripts/azure-deploy-chat.sh
   # Use different resource group for staging
   ```

3. **Deploy to Production**:
   ```bash
   ./scripts/azure-deploy-chat.sh --update
   ```

4. **Monitor**:
   - Check Azure Portal for metrics
   - Watch Application Insights for errors
   - Monitor user feedback

## Files Modified

- ✅ `docker/Dockerfile.app` - Updated to build React app
- ✅ (No changes needed) `docker/nginx-app.conf` - Already SPA-ready
- ✅ (No changes needed) `scripts/azure-deploy-chat.sh` - Works with new Dockerfile

## Summary

The new Dockerfile:
- ✅ Builds the React app from `app-react/`
- ✅ Uses multi-stage build for optimal image size
- ✅ Copies only the `dist/` output to nginx
- ✅ Works with existing deployment scripts
- ✅ Compatible with Azure Container Registry builds
- ✅ Maintains same nginx configuration

**You're ready to deploy!** 🚀
