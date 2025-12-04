# Environment Variables in Production Build

## Summary

**YES**, `.env.production` **IS** being used in the Docker build! Here's exactly how it works:

## How Vite Handles Environment Files

Vite automatically loads environment files based on the mode:

```bash
# When you run:
npm run build

# Vite automatically:
1. Sets NODE_ENV=production
2. Loads .env.production (if it exists)
3. Loads .env (base config, if it exists)
4. Variables prefixed with VITE_ are embedded in the build
```

## Environment Files in Your Project

```
app-react/
├── .env.development     # Used for: npm run dev
├── .env.production      # Used for: npm run build ✅
├── .env.local          # Used for: local overrides (gitignored)
└── .env.example        # Template for reference
```

## What Gets Embedded

From `.env.production`:
```env
VITE_API_URL=https://api.powernova.ai
VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"..."}
VITE_ANALYTICS_DEBUG=false
```

These become **hardcoded** in the JavaScript bundle during build:
```javascript
// In your built dist/assets/index-xyz.js
const apiUrl = "https://api.powernova.ai";  // Not a variable, it's a literal string!
const firebaseConfig = {"apiKey":"...","projectId":"..."};
```

## Docker Build Process

Here's the complete flow:

```dockerfile
# 1. Set environment
ENV NODE_ENV=production

# 2. Copy source (includes .env.production)
COPY app-react/ ./

# 3. Build - Vite automatically uses .env.production
RUN VITE_BASE_PATH=/ npm run build
```

### What Happens:

1. **NODE_ENV=production** → Vite knows to use production mode
2. **Vite loads** `.env.production` automatically
3. **Variables** prefixed with `VITE_` are replaced in code
4. **Output** `dist/` folder has production URLs embedded

## Verification

You can verify by checking the built files:

```bash
# Build locally
cd app-react
npm run build

# Check the built file
grep -r "api.powernova.ai" dist/

# You'll see the production URL hardcoded in the bundle!
```

## Important Notes

### ✅ Runtime vs Build Time

- **Build Time** (CORRECT): Environment variables are embedded during `npm run build`
  - ✅ `.env.production` values become part of the JavaScript
  - ✅ Cannot be changed after build without rebuilding
  - ✅ This is how Vite works (by design)

- **Runtime** (NOT USED): Docker ENV at runtime doesn't affect the built app
  - ❌ Setting `ENV VITE_API_URL=...` in Dockerfile after build does nothing
  - ❌ The values are already baked into the bundle

### ✅ To Change Production Config

If you need to change `VITE_API_URL` or Firebase config:

1. Update `app-react/.env.production`
2. Rebuild the Docker image (it runs `npm run build`)
3. Deploy the new image

You **cannot** change these at runtime - they're compiled into the code!

## Current Configuration

### Production API URL
```env
VITE_API_URL=https://api.powernova.ai
```

Used in code as:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// Becomes: "https://api.powernova.ai"
```

### Firebase Config
```env
VITE_FIREBASE_CONFIG={"apiKey":"AIza...","projectId":"powernova-6753c",...}
```

Used in code as:
```typescript
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
// Becomes: {apiKey: "AIza...", projectId: "powernova-6753c", ...}
```

## Multi-Environment Setup

You can have different configs for different environments:

```bash
# Local development
npm run dev  # Uses .env.development → http://localhost:8000

# Local production test
npm run build && npm run preview  # Uses .env.production → https://api.powernova.ai

# Docker build
docker build ...  # Uses .env.production → https://api.powernova.ai
```

## Base Path Configuration

We also added `VITE_BASE_PATH` to handle different deployment paths:

### Local Dual-App Setup
```bash
# vite.config.ts default
base: '/react/'  # App served at http://localhost:8081/react/
```

### Production Deployment
```dockerfile
# In Dockerfile
RUN VITE_BASE_PATH=/ npm run build  # App served at https://app.powernova.ai/
```

This means:
- **Local**: http://localhost:8081/react/ (side-by-side with legacy)
- **Production**: https://app.powernova.ai/ (root domain)

## Common Mistakes to Avoid

### ❌ WRONG: Setting ENV in Dockerfile stage 2
```dockerfile
FROM nginx:alpine
ENV VITE_API_URL=https://api.powernova.ai  # ❌ TOO LATE! Build already done
COPY --from=builder /app/dist/ .
```

### ✅ CORRECT: ENV is in .env.production
```dockerfile
FROM node:20-alpine AS builder
COPY app-react/ ./  # Includes .env.production
RUN npm run build   # Vite reads .env.production automatically
```

## Testing Environment Variables

To test if the right values are being used:

```bash
# 1. Build the Docker image
docker build -f docker/Dockerfile.app -t test-app .

# 2. Run it
docker run -p 8080:80 test-app

# 3. Open browser to http://localhost:8080
# 4. Open DevTools Console and check:
console.log(import.meta.env.VITE_API_URL)
# Should show: undefined (because it's already replaced with the actual value)

# 5. Check Network tab - API calls should go to:
# https://api.powernova.ai
```

## Summary

| Question | Answer |
|----------|--------|
| Is `.env.production` used? | ✅ YES, automatically by Vite |
| When is it loaded? | During `npm run build` in Docker stage 1 |
| Can I change it at runtime? | ❌ NO, values are embedded in bundle |
| How to update production config? | Update `.env.production` → rebuild → redeploy |
| Are values in the final nginx image? | ✅ YES, baked into JavaScript files |
| Can I have different configs per environment? | ✅ YES, using different .env files |

**The current setup is correct!** Your production build will use:
- ✅ `VITE_API_URL=https://api.powernova.ai`
- ✅ Firebase config from `.env.production`
- ✅ Base path `/` (root) for production deployment
