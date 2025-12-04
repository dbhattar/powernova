# Docker Build Fix: NODE_ENV vs Vite Mode

## Problem Encountered

During Azure deployment, the build failed with:
```
Error: Cannot find module @rollup/rollup-linux-x64-musl
```

## Root Causes

### Issue 1: npm Optional Dependencies Bug
- `npm ci` has a known bug with optional dependencies in Alpine Linux
- Rollup's platform-specific binaries weren't properly installed
- Solution: Use `npm install` and delete `package-lock.json` first

### Issue 2: NODE_ENV=production Too Early
- Setting `NODE_ENV=production` before `npm install` causes npm to skip devDependencies
- TypeScript (`tsc`), Vite, and other build tools are devDependencies
- Solution: Don't set `NODE_ENV=production` during build stage

## The Confusion: NODE_ENV vs Vite Mode

### Common Misconception ❌
"If I don't set NODE_ENV=production, Vite won't use .env.production"

### Reality ✅
**`NODE_ENV` and Vite's mode are SEPARATE!**

| Variable | Purpose | Controls |
|----------|---------|----------|
| **NODE_ENV** | npm behavior | Whether to install devDependencies |
| **Vite --mode** | Vite env files | Which `.env.*` file to load |

### How Vite Determines Which .env File to Use

Vite uses the `--mode` flag, NOT `NODE_ENV`:

```bash
# Development
npm run dev
# Runs: vite
# Default mode: development
# Loads: .env.development

# Production Build
npm run build
# Runs: vite build
# Default mode: production  ← KEY POINT!
# Loads: .env.production
```

## Final Solution

### Dockerfile Changes

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# NO NODE_ENV=production here! We need devDependencies
COPY app-react/package*.json ./

# Delete package-lock.json and fresh install to avoid Alpine issues
RUN rm -f package-lock.json && npm install

COPY app-react/ ./

# Explicitly set --mode production (though it's already the default for 'vite build')
RUN VITE_BASE_PATH=/ npm run build -- --mode production
```

### Why This Works

1. **`npm install`** (no NODE_ENV=production)
   - ✅ Installs ALL dependencies including devDependencies
   - ✅ TypeScript, Vite, Rollup, etc. are available

2. **`npm run build -- --mode production`**
   - ✅ Vite runs in production mode
   - ✅ Loads `.env.production`
   - ✅ Uses production API URL and Firebase config
   - ✅ Creates optimized production bundle

3. **Multi-stage build**
   - ✅ Stage 2 (nginx) only gets the `dist/` folder
   - ✅ node_modules and source code are discarded
   - ✅ Final image is small and secure

## Verification

### Check Vite Mode
```bash
# In your build script
npm run build -- --mode production

# Vite will output:
# vite v7.2.6 building for production...
```

### Check Which .env File is Loaded
Add this temporarily to see what's loaded:
```typescript
// In your src/main.tsx
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('Mode:', import.meta.env.MODE);
```

Build and check the output:
```bash
npm run build -- --mode production
# Check dist/assets/index-*.js
grep "api.powernova.ai" dist/assets/index-*.js
# Should find the production URL!
```

## NODE_ENV Values and Their Effects

### During `npm install`

```dockerfile
# ❌ WRONG - Skips devDependencies
ENV NODE_ENV=production
RUN npm install

# ✅ CORRECT - Installs everything
RUN npm install
```

### During `vite build`

```dockerfile
# Both work the same! Vite uses --mode, not NODE_ENV
RUN npm run build -- --mode production

# Explicitly setting NODE_ENV doesn't hurt, but isn't needed
RUN NODE_ENV=production npm run build -- --mode production
```

## Summary

**Question**: "If we don't set NODE_ENV, will it use .env.production?"

**Answer**: **YES!** ✅

- Vite's `--mode` determines which `.env.*` file to load
- `npm run build` defaults to `--mode production`
- `--mode production` loads `.env.production`
- `NODE_ENV` only affects npm's dependency installation behavior

**Best Practice**:
1. Don't set `NODE_ENV=production` during build step
2. Explicitly use `--mode production` for clarity
3. Let multi-stage build handle optimization

## Files Modified

1. **`docker/Dockerfile.app`**
   - Removed `ENV NODE_ENV=production` from builder stage
   - Changed `npm ci` to `rm -f package-lock.json && npm install`
   - Added explicit `--mode production` flag
   - Added `VITE_BASE_PATH=/ ` for root deployment

2. **`.dockerignore`** (created)
   - Excludes `app-react/node_modules` from build context
   - Prevents local node_modules from being copied

## Deployment

Now when you run:
```bash
./scripts/azure-deploy-chat.sh --update
```

The build will:
- ✅ Install all dependencies (including dev)
- ✅ Build using `.env.production`
- ✅ Embed production API URL
- ✅ Embed Firebase config
- ✅ Deploy optimized production bundle

**Ready to deploy!** 🚀
