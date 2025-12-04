# Firebase Configuration Quick Reference

## TL;DR

**Legacy:** Hardcoded in `app/js/config.js`  
**React:** Environment variable in `.env.production`

---

## Set Up Firebase Config (3 Steps)

### 1. Get Config from Firebase Console
```
https://console.firebase.google.com
→ Project Settings
→ Your apps
→ Copy config object
```

### 2. Convert to JSON String (one line)
```bash
{"apiKey":"AIzaSy...","authDomain":"project.firebaseapp.com","projectId":"project-id","storageBucket":"project.firebasestorage.app","messagingSenderId":"123","appId":"1:123:web:abc","measurementId":"G-ABC"}
```

### 3. Add to `.env.production`
```bash
VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"..."}
```

---

## Environment Files

```
app-react/
├── .env.development     # npm run dev (analytics disabled)
├── .env.production      # npm run build (analytics enabled)
└── .env.example         # Template for reference
```

---

## Current Production Config

From legacy `config.js`:
```bash
VITE_FIREBASE_CONFIG={"apiKey":"AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM","authDomain":"powernova-6753c.firebaseapp.com","projectId":"powernova-6753c","storageBucket":"powernova-6753c.firebasestorage.app","messagingSenderId":"724076757764","appId":"1:724076757764:web:cd328f37ba41d2deaac651","measurementId":"G-XL0MQCC6TN"}
```

✅ Already set in `.env.production`

---

## How It Works

```typescript
// Auto-detects environment
const isDev = import.meta.env.DEV;

if (isDev) {
  // Development: Analytics disabled
  console.log('Analytics disabled');
  return;
}

// Production: Initialize analytics
const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const app = initializeApp(config);
const analytics = getAnalytics(app);
```

---

## Common Commands

```bash
# Development (analytics OFF)
npm run dev

# Build for production (analytics ON)
npm run build

# Preview production build
npm run preview
```

---

## Verify Setup

### Check browser console:
```
✅ [Analytics] ✅ Google Analytics initialized  # Good!
❌ [Analytics] Disabled in development          # Expected in dev
⚠️  [Analytics] Firebase config not found       # Missing env var
```

### Check environment:
```bash
# In terminal
echo $VITE_FIREBASE_CONFIG

# Should output JSON config
```

---

## Security Notes

✅ **Safe to expose** - Firebase config is public by design  
✅ **Protected by domain restrictions** - Set in Firebase Console  
✅ **Analytics data protected** - By Firebase security rules  
✅ **API key identifies project** - Not a secret authentication key  

**Real security:** Firebase Console → Authorized domains

---

## Deployment

### Docker
```dockerfile
# Copy production env during build
COPY .env.production .env.production
RUN npm run build
```

### Azure App Service
```
Configuration → Application settings
→ Add: VITE_FIREBASE_CONFIG = {"apiKey":"..."}
```

### Manual
```bash
export VITE_FIREBASE_CONFIG='{"apiKey":"..."}'
npm run build
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Analytics not working | Check `.env.production` has `VITE_FIREBASE_CONFIG` |
| Working in dev (shouldn't) | Remove `VITE_FIREBASE_CONFIG` from `.env.development` |
| Build error | Verify JSON is valid one-line string |
| Events not tracked | Check Firebase Console for data (24h delay) |

---

**Full docs:** See `FIREBASE-CONFIG-MIGRATION.md`
