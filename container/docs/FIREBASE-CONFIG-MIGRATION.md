# Firebase Configuration - Legacy vs React

## Overview

This document explains how Firebase configuration has changed from the legacy app to the React app.

---

## Legacy App (HTML/JS) - OLD ❌

### Location: `app/js/config.js`

**How it worked:**
```javascript
// config.js - Hardcoded in JavaScript file
const config = {
    firebase: {
        apiKey: "AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM",
        authDomain: "powernova-6753c.firebaseapp.com",
        projectId: "powernova-6753c",
        // ... other config
    }
};

window.PowerNOVA.config = config;
```

**Loaded in HTML:**
```html
<!-- index.html -->
<script src="js/config.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics-compat.js"></script>
```

**Problems:**
- ❌ Config hardcoded in source code
- ❌ Visible in browser source
- ❌ Same config for all environments
- ❌ Requires code changes to update config
- ❌ No separation of dev/prod

---

## React App - NEW ✅

### Location: Environment Variables

**How it works:**
```bash
# .env.production
VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"..."}
```

**Accessed in code:**
```typescript
// AnalyticsContext.tsx
const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG;
const config = JSON.parse(firebaseConfig);

const app = initializeApp(config);
const analytics = getAnalytics(app);
```

**Benefits:**
- ✅ Config stored as environment variable
- ✅ Different configs for dev/prod
- ✅ Not committed to git (can be ignored)
- ✅ Updated without code changes
- ✅ Auto-disabled in development
- ✅ Modern Firebase SDK (v9+ modular)

---

## Configuration Files

### 1. Development (`.env.development`)
```bash
# Development environment
VITE_API_URL=http://localhost:8000

# Firebase Analytics - Disabled in development
# Leave commented out to disable analytics in dev
# VITE_FIREBASE_CONFIG={"apiKey":"..."}
```

**Result:** Analytics disabled, no tracking in dev mode

### 2. Production (`.env.production`)
```bash
# Production environment
VITE_API_URL=https://api.powernova.ai

# Firebase Analytics - REQUIRED for production
VITE_FIREBASE_CONFIG={"apiKey":"AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM","authDomain":"powernova-6753c.firebaseapp.com","projectId":"powernova-6753c","storageBucket":"powernova-6753c.firebasestorage.app","messagingSenderId":"724076757764","appId":"1:724076757764:web:cd328f37ba41d2deaac651","measurementId":"G-XL0MQCC6TN"}

# Optional: Debug mode
VITE_ANALYTICS_DEBUG=false
```

**Result:** Analytics enabled, tracks events in production

### 3. Local Override (`.env.local`) - Optional
```bash
# Create this file for local development overrides
# This file is gitignored by default
VITE_API_URL=http://localhost:8080
# VITE_FIREBASE_CONFIG={"apiKey":"test..."}
```

---

## How to Get Firebase Config

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com
2. Select your project: `powernova-6753c`

### Step 2: Get Web App Config
1. Click gear icon ⚙️ (top left)
2. Click "Project settings"
3. Scroll to "Your apps" section
4. Click on your web app (or create one)
5. You'll see a config object like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM",
  authDomain: "powernova-6753c.firebaseapp.com",
  projectId: "powernova-6753c",
  storageBucket: "powernova-6753c.firebasestorage.app",
  messagingSenderId: "724076757764",
  appId: "1:724076757764:web:cd328f37ba41d2deaac651",
  measurementId: "G-XL0MQCC6TN"
};
```

### Step 3: Convert to JSON String
Convert the object to a single-line JSON string:

```bash
VITE_FIREBASE_CONFIG={"apiKey":"AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM","authDomain":"powernova-6753c.firebaseapp.com","projectId":"powernova-6753c","storageBucket":"powernova-6753c.firebasestorage.app","messagingSenderId":"724076757764","appId":"1:724076757764:web:cd328f37ba41d2deaac651","measurementId":"G-XL0MQCC6TN"}
```

---

## Analytics Auto-Disable Logic

The React app automatically disables analytics in development:

```typescript
// AnalyticsContext.tsx
const initAnalytics = () => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;  // ← Vite auto-sets this
  
  if (isDevelopment) {
    console.log('[Analytics] Disabled in development environment');
    return;  // Exit early, don't initialize
  }
  
  // Only runs in production...
  const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
  initializeApp(config);
};
```

**When does it run?**
- ✅ `npm run build` → Production build → `DEV = false` → Analytics enabled
- ❌ `npm run dev` → Development → `DEV = true` → Analytics disabled

---

## Docker Deployment

### Option 1: Build-Time Variables (Recommended)
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

# Copy env files
COPY .env.production .env.production

# Build with production env
RUN npm run build
```

### Option 2: Runtime Environment Variables
```yaml
# docker-compose.yml
services:
  powernova-chat:
    environment:
      - VITE_FIREBASE_CONFIG={"apiKey":"..."}
```

**Note:** Vite embeds env vars at **build time**, so Option 1 is preferred.

---

## Azure Deployment

### Set in App Service Configuration

1. Go to Azure Portal
2. Navigate to your App Service
3. Go to "Configuration" > "Application settings"
4. Add new setting:
   - **Name:** `VITE_FIREBASE_CONFIG`
   - **Value:** `{"apiKey":"...","projectId":"..."}`

5. Save and restart

---

## Security Considerations

### Q: Is it safe to expose Firebase config?

**A: YES** - Firebase config is designed to be public:

1. **API Keys are not secrets** - They identify your Firebase project
2. **Security Rules protect data** - Not the API key
3. **Firebase expects client-side config** - It's meant to be in the browser
4. **Domain restrictions** - Configure in Firebase Console

### Actual Security Measures:

1. **Configure Authorized Domains**
   - Firebase Console > Project Settings > Authorized domains
   - Only allow: `powernova.ai`, `api.powernova.ai`

2. **Set Analytics Data Retention**
   - Firebase Console > Analytics > Data retention
   - Configure as needed

3. **Use `.gitignore`**
   ```gitignore
   # Don't commit local env files
   .env.local
   .env.*.local
   ```

---

## Troubleshooting

### Analytics not working in production?

1. **Check env var is set:**
   ```bash
   echo $VITE_FIREBASE_CONFIG
   ```

2. **Check browser console:**
   ```
   [Analytics] ✅ Google Analytics initialized
   ```

3. **Verify Firebase config is valid:**
   ```bash
   # Should parse without error
   node -e "console.log(JSON.parse(process.env.VITE_FIREBASE_CONFIG))"
   ```

4. **Check build output:**
   ```bash
   # Env vars are embedded during build
   npm run build
   grep -r "measurementId" dist/  # Should find it
   ```

### Analytics running in development?

- Check `import.meta.env.DEV` is `true`
- Verify `.env.development` doesn't have `VITE_FIREBASE_CONFIG`
- Clear Vite cache: `rm -rf node_modules/.vite`

---

## Migration Checklist

- [x] ✅ Firebase config moved from `config.js` to `.env` files
- [x] ✅ Analytics auto-disables in development
- [x] ✅ Production config set in `.env.production`
- [x] ✅ AnalyticsContext uses environment variables
- [x] ✅ Modern Firebase SDK v9+ (modular imports)
- [x] ✅ Documentation created

---

## Summary

| Aspect | Legacy App | React App |
|--------|-----------|-----------|
| **Location** | `config.js` file | `.env` files |
| **Format** | JavaScript object | JSON string in env var |
| **Visibility** | Hardcoded in source | Environment variable |
| **Dev/Prod** | Same config | Separate configs |
| **SDK Version** | v7 (compat) | v9+ (modular) |
| **Auto-disable** | Manual check | Auto in dev mode |
| **Security** | Exposed in code | Standard env var practice |
| **Updates** | Requires code change | Env var update only |

**Result:** More secure, flexible, and maintainable configuration! ✨
