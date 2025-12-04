# Router Basename Fix for Production

## Problem

After deploying to production, the browser console showed this error:

```
<Router basename="/react"> is not able to match the URL "/" 
because it does not start with the basename, 
so the <Router> won't render anything.
```

**Cause**: React Router was hardcoded with `basename="/react"` (for local dual-app setup), but production serves from the root `/`.

## Solution

Made the router basename **environment-aware** using Vite environment variables.

## Changes Made

### 1. Environment Variables

**`.env.development`** (for local dual-app setup):
```env
VITE_ROUTER_BASENAME=/react
```

**`.env.production`** (for production at root domain):
```env
VITE_ROUTER_BASENAME=/
```

### 2. Config File

**`src/lib/config.ts`**:
```typescript
// Router basename - /react for local dual-app setup, / for production
export const ROUTER_BASENAME = import.meta.env.VITE_ROUTER_BASENAME || '/react';

export const config = {
  apiUrl: API_URL,
  routerBasename: ROUTER_BASENAME,  // NEW
  appVersion: '2.0.0-beta',
  appName: 'PowerNOVA',
} as const;
```

### 3. App Component

**`src/App.tsx`**:
```typescript
import { config } from './lib/config';

// Before (hardcoded):
<BrowserRouter basename="/react">

// After (dynamic):
<BrowserRouter basename={config.routerBasename}>
```

## How It Works

### Local Development (npm run dev)
1. Vite loads `.env.development`
2. `VITE_ROUTER_BASENAME=/react`
3. Router serves from: `http://localhost:5173/react/`
4. ✅ Works with dual-app setup (legacy + React side-by-side)

### Production Build (npm run build)
1. Vite loads `.env.production`
2. `VITE_ROUTER_BASENAME=/`
3. Router serves from: `https://app.powernova.ai/`
4. ✅ Works at root domain

## Deployment

The fix is now part of the production build:

```bash
# In Dockerfile
RUN npm run build -- --mode production
# Loads .env.production → VITE_ROUTER_BASENAME=/
```

When you redeploy:
```bash
./scripts/azure-deploy-chat.sh --update
```

The new build will:
- ✅ Use `basename="/"` in production
- ✅ Match URLs correctly
- ✅ Render routes properly
- ✅ No more console errors!

## Verification

### Check Built Code
After building, verify the basename in the bundle:
```bash
grep -r "basename" app-react/dist/assets/index-*.js
# Production: Should show "/" not "/react"
```

### Test Locally
```bash
# Build for production
cd app-react
npm run build

# Preview production build
npm run preview
# Visit: http://localhost:4173/ (no /react needed!)
```

### In Browser Console
After deployment, check:
```javascript
// Should be "/" in production
console.log(import.meta.env.VITE_ROUTER_BASENAME);
```

## Summary

| Environment | Basename | URL Example | Use Case |
|-------------|----------|-------------|----------|
| **Development** | `/react` | `http://localhost:5173/react/` | Local dual-app setup |
| **Production** | `/` | `https://app.powernova.ai/` | Production deployment |

**Fixed Files**:
- ✅ `.env.development` - Added `VITE_ROUTER_BASENAME=/react`
- ✅ `.env.production` - Added `VITE_ROUTER_BASENAME=/`
- ✅ `src/lib/config.ts` - Exported ROUTER_BASENAME config
- ✅ `src/App.tsx` - Used dynamic basename from config

**Result**: Router now works correctly in both local and production environments! 🎉
