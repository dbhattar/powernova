# React App Environment Configuration

## Environment Files

The React app uses Vite's environment variables to configure the API URL based on the build mode.

### `.env.development` (Vite dev server)
```bash
# npm run dev
VITE_API_URL=http://localhost:8000
```

### `.env.local` (Local Docker builds)
```bash
# docker build with --mode development
VITE_API_URL=http://localhost:8000
```

### `.env.production` (Production builds)
```bash
# npm run build (production)
VITE_API_URL=https://api.powernova.ai
```

## How It Works

The `src/lib/config.ts` file reads the environment variable:

```typescript
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

Vite automatically loads the correct `.env.*` file based on the mode:

| Command | Mode | File Loaded | API_URL |
|---------|------|-------------|---------|
| `npm run dev` | development | `.env.development` | `http://localhost:8000` |
| `npm run build` | production | `.env.production` | `https://api.powernova.ai` |
| Custom build | custom | `.env.local` | `http://localhost:8000` |

## Build Commands

### Local Development (Vite dev server)
```bash
npm run dev
# Uses .env.development
# API calls go to http://localhost:8000
```

### Local Docker Build
```bash
# Option 1: Use .env.local
npm run build

# Option 2: Override with --mode
npm run build -- --mode development

# Both will use http://localhost:8000 for API calls
```

### Production Build
```bash
npm run build
# Uses .env.production
# API calls go to https://api.powernova.ai
```

## Docker Integration

### Dockerfile.app.dual.local
The local Docker build uses the default production build, but we can override it:

```dockerfile
# Current (uses .env.production)
RUN npm run build

# Alternative (use .env.local or .env.development)
RUN npm run build -- --mode development
```

### Recommended Approach

For the dual-app local Docker setup, update the Dockerfile to use development mode:

```dockerfile
# Stage 1: Build React app
FROM node:20-alpine AS react-builder

WORKDIR /app

# Copy React app files
COPY app-react/package*.json ./
RUN npm ci

COPY app-react/ ./

# Build React app for LOCAL development (uses .env.development)
RUN npm run build -- --mode development
```

This ensures the local Docker build points to `http://localhost:8000` instead of `https://api.powernova.ai`.

## Environment Variable Priority

Vite loads environment variables in this order (highest priority first):

1. `.env.[mode].local` (e.g., `.env.production.local`)
2. `.env.[mode]` (e.g., `.env.production`)
3. `.env.local`
4. `.env`

## Security Notes

- ✅ `.env.local` is gitignored (via `*.local` pattern)
- ✅ `.env.development` is committed (safe, local-only)
- ✅ `.env.production` is committed (public API endpoint, no secrets)
- ⚠️ Never commit API keys or secrets to environment files
- ⚠️ Vite exposes only `VITE_*` prefixed variables to the client

## Testing Configuration

To verify which API URL is being used:

```bash
# Development server
npm run dev
# Open browser console: console.log(import.meta.env.VITE_API_URL)
# Should show: http://localhost:8000

# Production build
npm run build
npm run preview
# Open browser console: console.log(import.meta.env.VITE_API_URL)
# Should show: https://api.powernova.ai
```

## Troubleshooting

### API calls fail in local Docker
**Problem:** React app in Docker can't reach `http://localhost:8000`

**Solution:** Update `Dockerfile.app.dual.local` to build with development mode:
```dockerfile
RUN npm run build -- --mode development
```

### API calls fail in production
**Problem:** CORS errors or API not reachable

**Solutions:**
1. Verify `https://api.powernova.ai` is accessible
2. Check CORS configuration on API server
3. Verify SSL certificate is valid
4. Check network/firewall settings

### Wrong API URL in build
**Problem:** Build uses wrong environment file

**Solution:** Check which mode Vite is using:
```bash
# Force development mode
npm run build -- --mode development

# Force production mode
npm run build -- --mode production
```

