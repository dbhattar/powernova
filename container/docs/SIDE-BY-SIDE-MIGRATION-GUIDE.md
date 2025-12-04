# Side-by-Side Migration Strategy: React + Vanilla JS

## Overview

Yes! You can (and should) run React and vanilla JS side-by-side during migration. This approach:
- ✅ Zero downtime for users
- ✅ Gradual migration with low risk
- ✅ A/B test new React pages vs old pages
- ✅ Easy rollback if issues arise
- ✅ Team can learn React while maintaining production

---

## Architecture Options

### Option 1: Separate Routes (Recommended)

Run React app on different routes while keeping vanilla JS on existing routes.

```
Current (Vanilla JS):
├── / (index.html)              → Chat page
├── /search.html                → Search page
├── /admin.html                 → Admin dashboard
└── /profile.html               → Profile page

During Migration:
├── / (index.html)              → Chat page (vanilla JS - OLD)
├── /react/                     → React app root
│   ├── /react/chat             → Chat page (React - NEW)
│   ├── /react/search           → Search page (React - NEW)
│   ├── /react/admin            → Admin (React - NEW)
│   └── /react/profile          → Profile (React - NEW)
├── /search.html                → Search page (vanilla JS - OLD)
├── /admin.html                 → Admin (vanilla JS - OLD)
└── /profile.html               → Profile (vanilla JS - OLD)

After Migration:
├── / (React SPA)               → All pages in React
├── /chat                       → Chat page
├── /search                     → Search page
├── /admin                      → Admin dashboard
└── /profile                    → Profile page
```

### Option 2: Subdomain

Run React on a subdomain.

```
Current:
https://powernova.app            → Vanilla JS app

During Migration:
https://powernova.app            → Vanilla JS (old)
https://beta.powernova.app       → React app (new)
https://v2.powernova.app         → React app (new)

After Migration:
https://powernova.app            → React app
https://legacy.powernova.app     → Vanilla JS (deprecated)
```

### Option 3: Feature Flags (Advanced)

Use feature flags to toggle between React and vanilla JS components on the same page.

```javascript
if (isReactEnabled('search-page')) {
  // Load React search component
} else {
  // Load vanilla JS search
}
```

---

## Recommended Approach: Option 1 (Separate Routes)

### Project Structure

```
container/
├── app/                          # Existing vanilla JS (unchanged)
│   ├── index.html
│   ├── search.html
│   ├── admin.html
│   ├── profile.html
│   ├── js/
│   └── css/
├── app-react/                    # New React app
│   ├── dist/                     # Built React app
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── api/                          # Backend (unchanged)
└── docker/
    ├── nginx.conf                # Updated to serve both apps
    └── Dockerfile.app
```

### Nginx Configuration

Update nginx to serve both apps:

```nginx
# /docker/nginx.conf

server {
    listen 80;
    server_name localhost;

    # Root for vanilla JS app (default)
    root /usr/share/nginx/html;
    index index.html;

    # Serve React app from /react/* routes
    location /react {
        alias /usr/share/nginx/html/react;
        try_files $uri $uri/ /react/index.html;
    }

    # API proxy (unchanged)
    location /api {
        proxy_pass http://powernova-api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Vanilla JS app (existing routes)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker Configuration

Update `Dockerfile.app` to build both apps:

```dockerfile
# docker/Dockerfile.app

# Stage 1: Build React app
FROM node:20-alpine AS react-builder

WORKDIR /app
COPY app-react/package*.json ./
RUN npm ci
COPY app-react/ ./
RUN npm run build

# Stage 2: Prepare vanilla JS app + React build
FROM nginx:alpine

# Copy vanilla JS app (existing)
COPY app/ /usr/share/nginx/html/

# Copy React build to /react subdirectory
COPY --from=react-builder /app/dist /usr/share/nginx/html/react

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose Update

```yaml
# docker/docker-compose.yml

services:
  powernova-chat:
    build:
      context: ..
      dockerfile: docker/Dockerfile.app
    ports:
      - "3000:80"
    volumes:
      # Mount both apps for development hot reload
      - ../app:/usr/share/nginx/html:ro
      - ../app-react/dist:/usr/share/nginx/html/react:ro
    depends_on:
      - powernova-api
```

---

## Development Workflow

### Setup React App (One-time)

```bash
# Navigate to container directory
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container

# Create React app
npm create vite@latest app-react -- --template react-ts
cd app-react

# Install dependencies
npm install

# Install additional packages
npm install \
  react-router-dom \
  @tanstack/react-query \
  zustand \
  tailwindcss \
  class-variance-authority \
  clsx \
  tailwind-merge

npm install -D \
  @types/node \
  vite-plugin-svgr \
  autoprefixer \
  postcss

# Configure Vite for /react base path
```

### Update Vite Config

```typescript
// app-react/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/react/',  // Important: serve from /react/ path
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
})
```

### Development Commands

```bash
# Terminal 1: Run vanilla JS app (existing)
cd docker
docker-compose up powernova-chat

# Terminal 2: Run React dev server (hot reload)
cd app-react
npm run dev

# Terminal 3: Run API
cd api
uvicorn main:app --reload
```

### Access Both Apps

```
Vanilla JS (existing):
http://localhost:3000              → Chat (vanilla)
http://localhost:3000/search.html  → Search (vanilla)
http://localhost:3000/admin.html   → Admin (vanilla)

React (new):
http://localhost:5173/             → React dev server (hot reload)
http://localhost:3000/react/       → React prod build (through nginx)
http://localhost:3000/react/search → Search (React)
http://localhost:3000/react/chat   → Chat (React)
```

---

## Migration Strategy: Page by Page

### Phase 1: Build React Search Page (Week 1-3)

**Why Search First?**
- Simplest page (no real-time streaming)
- Standalone functionality
- Easy to compare side-by-side

```typescript
// app-react/src/pages/SearchPage.tsx

import { useState } from 'react';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';

export function SearchPage() {
  const [query, setQuery] = useState('');
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <SearchBar value={query} onChange={setQuery} />
      <SearchResults query={query} />
    </div>
  );
}
```

**Testing:**
- ✅ Old: http://localhost:3000/search.html
- ✅ New: http://localhost:3000/react/search
- Compare UX, performance, bundle size

### Phase 2: Build React Chat Page (Week 4-7)

More complex with streaming, but same process.

### Phase 3: Gradual Rollout

#### Step 1: Add "Try Beta" Banner

```html
<!-- app/search.html -->
<div class="beta-banner" style="background: #667eea; color: white; padding: 12px; text-align: center;">
  🚀 Try our new search experience! 
  <a href="/react/search" style="color: white; text-decoration: underline; font-weight: bold;">
    Switch to Beta
  </a>
</div>
```

#### Step 2: Add Toggle Switch

```typescript
// app-react/src/components/VersionToggle.tsx

export function VersionToggle() {
  const goToLegacy = () => {
    // Redirect to vanilla JS version
    const currentPath = window.location.pathname.replace('/react', '');
    window.location.href = currentPath + '.html';
  };

  return (
    <button onClick={goToLegacy} className="text-sm text-gray-500">
      ← Switch to Classic Version
    </button>
  );
}
```

#### Step 3: A/B Testing

Use feature flags or random assignment:

```typescript
// app/index.html

<script>
// Randomly assign 20% of users to React version
if (Math.random() < 0.2 && !localStorage.getItem('version-preference')) {
  // Redirect to React search
  if (window.location.pathname === '/search.html') {
    window.location.href = '/react/search';
  }
}
</script>
```

#### Step 4: Gradual Rollout

```
Week 1: 10% of users → React
Week 2: 25% of users → React
Week 3: 50% of users → React
Week 4: 75% of users → React
Week 5: 100% of users → React (default)
Week 6: Remove vanilla JS version
```

---

## Shared Resources

### Share API Configuration

Both apps can use the same config:

```typescript
// app-react/src/lib/config.ts

export const API_URL = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://api.powernova.app';

export const config = {
  apiUrl: API_URL,
  // Share same config structure as vanilla JS
};
```

### Share Authentication State

Use shared localStorage:

```typescript
// app-react/src/hooks/useSharedAuth.ts

// Read token from vanilla JS app
const token = localStorage.getItem('auth_token');

// Both apps read/write to same key
export function useSharedAuth() {
  return {
    token: localStorage.getItem('auth_token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  };
}
```

### Cross-Link Between Apps

```typescript
// In React app - link to vanilla JS admin (not migrated yet)
<a href="/admin.html">Admin Dashboard (Classic)</a>

// In vanilla JS - link to React search
<a href="/react/search">Search (Beta)</a>
```

---

## Production Deployment

### Option A: Single Docker Container (Recommended)

Both apps in one container, nginx routes requests:

```bash
# Build and deploy
docker build -t powernova-app:latest -f docker/Dockerfile.app .
docker push powernova-app:latest

# Deploy to Azure Container Instances
az container create \
  --resource-group powernova-rg \
  --name powernova-app \
  --image powernova-app:latest \
  --ports 80
```

### Option B: Separate Deployments

```bash
# Deploy vanilla JS (existing)
az container create ... --name powernova-app-legacy

# Deploy React (new)
az container create ... --name powernova-app-react

# Use Azure Front Door to route:
# / → legacy container
# /react/* → React container
```

---

## Migration Checklist

### Before Starting
- [ ] Review migration plan with team
- [ ] Set up React development environment
- [ ] Configure nginx for dual-app serving
- [ ] Update Docker files
- [ ] Test local development workflow

### During Migration
- [ ] Build React search page
- [ ] Deploy side-by-side
- [ ] Add toggle switch between versions
- [ ] Monitor analytics (usage, performance)
- [ ] Migrate chat page
- [ ] Migrate profile page
- [ ] Migrate admin page

### After Each Page Migration
- [ ] Compare performance metrics
- [ ] Gather user feedback
- [ ] Fix any issues
- [ ] Increase traffic % to React version
- [ ] Update documentation

### Complete Migration
- [ ] All pages migrated to React
- [ ] 100% traffic on React version
- [ ] Remove vanilla JS code
- [ ] Update nginx to serve only React
- [ ] Simplify Docker setup
- [ ] Update deployment scripts
- [ ] Celebrate! 🎉

---

## Rollback Plan

If issues arise with React version:

```nginx
# Quick rollback via nginx config change

location /react {
    # Temporarily redirect React routes to vanilla JS
    return 302 /$1.html;
}
```

Or use feature flag:

```typescript
// Disable React version instantly
const REACT_ENABLED = false; // Toggle this

if (!REACT_ENABLED && window.location.pathname.startsWith('/react')) {
  window.location.href = '/search.html';
}
```

---

## Monitoring During Migration

### Key Metrics to Track

```typescript
// Add to both apps

// Performance
performance.mark('page-load-start');
window.addEventListener('load', () => {
  performance.mark('page-load-end');
  performance.measure('page-load', 'page-load-start', 'page-load-end');
  
  // Send to analytics
  trackMetric('page-load-time', {
    version: 'react', // or 'vanilla'
    duration: performance.getEntriesByName('page-load')[0].duration
  });
});

// User interactions
trackEvent('search-performed', {
  version: 'react',
  query: query,
  resultsCount: results.length
});
```

### Compare Metrics

| Metric | Vanilla JS | React | Goal |
|--------|-----------|-------|------|
| Initial Load | 1.2s | ? | < 1.5s |
| Search Speed | 800ms | ? | < 600ms |
| Bundle Size | 200KB | ? | < 300KB |
| User Satisfaction | Baseline | ? | +10% |

---

## Benefits of Side-by-Side Approach

### 1. **Zero Risk**
- Users always have working version
- Easy rollback if problems occur
- No "big bang" deployment fear

### 2. **Continuous Learning**
- Team learns React incrementally
- Identify issues early
- Improve with each page migration

### 3. **User Testing**
- Get feedback on React version
- A/B test features
- Validate improvements

### 4. **Development Flexibility**
- Continue shipping features in vanilla JS
- Migrate at comfortable pace
- No pressure to rush

### 5. **Technical Safety**
- Test in production with low traffic
- Monitor performance
- Validate bundle sizes

---

## Timeline Example

```
Month 1:
├── Week 1: Setup React project, configure nginx
├── Week 2: Build React search page
├── Week 3: Deploy side-by-side, test with 10% traffic
└── Week 4: Gather feedback, iterate

Month 2:
├── Week 5: Build React chat page
├── Week 6: Deploy chat (20% traffic)
├── Week 7: Increase to 50% traffic
└── Week 8: Full rollout of search + chat

Month 3:
├── Week 9: Migrate profile page
├── Week 10: Migrate admin dashboard
├── Week 11: Polish, optimize bundles
└── Week 12: Remove vanilla JS, simplify deployment

Total: 3 months to complete migration
```

---

## Cost Comparison

### Running Both Apps

**Infrastructure:**
- Same API server ✅
- Same database ✅
- Same container (both apps in one build) ✅
- **Extra Cost: $0** ❌

**Development:**
- Maintain two codebases temporarily
- Small overhead, but temporary
- **Extra Cost: Minimal** ✅

**Benefits:**
- Reduced risk
- Better user experience
- Team confidence
- **Value: Priceless** 💎

---

## FAQ

**Q: Will running both apps slow down the site?**
A: No. They're served from the same nginx instance. React app is only loaded when user visits `/react/*` routes.

**Q: Do I need two API servers?**
A: No. Both apps use the same FastAPI backend.

**Q: How do I share authentication?**
A: Both apps read/write from localStorage using the same keys.

**Q: Can I test React features before users see them?**
A: Yes! Use `/react/*` routes for internal testing before making them public.

**Q: What if users get confused by two versions?**
A: Add clear labels ("Beta" badge, toggle switch) and gradually increase React traffic %.

**Q: How long should I run both versions?**
A: 2-4 weeks per page is typical. Search page might only need 1 week if it goes well.

**Q: Can I migrate one page at a time?**
A: Yes! That's the recommended approach. Search → Chat → Profile → Admin.

---

## Conclusion

✅ **YES**, you can absolutely run React and vanilla JS side-by-side!

✅ It's the **recommended** approach for this migration.

✅ Provides **safety, flexibility, and confidence** throughout the process.

✅ **Zero extra infrastructure cost** (same nginx, same container).

✅ Allows **gradual rollout** with easy rollback.

Would you like me to set up the initial React project structure and nginx configuration to get started?
