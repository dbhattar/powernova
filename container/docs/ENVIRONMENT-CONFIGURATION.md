# Environment Configuration

## Overview

PowerNOVA uses a **build-time configuration system** to ensure environment-specific settings are baked into Docker images during build. This approach provides security and simplicity by eliminating runtime environment detection.

## Architecture

### Configuration Files

```
website/
  js/
    config.js          # Production config (default)
    config.local.js    # Local development config
    
app/
  js/
    config.js          # Production config (default)
    config.local.js    # Local development config
```

### Dockerfiles

```
docker/
  Dockerfile              # Production build (uses config.js as-is)
  Dockerfile.local        # Local build (swaps config.local.js → config.js)
  Dockerfile.app          # Production build for chat app
  Dockerfile.app.local    # Local build for chat app
```

## How It Works

### Production Build

Production Dockerfiles use `config.js` files without modification:

```dockerfile
# docker/Dockerfile
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY website/ .
EXPOSE 80
```

**Result**: Production URLs (https://app.powernova.ai, https://api.powernova.ai)

### Local Development Build

Local Dockerfiles swap the configuration during build:

```dockerfile
# docker/Dockerfile.local
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY website/ .
RUN rm -f js/config.js && mv js/config.local.js js/config.js
EXPOSE 80
```

**Result**: Local URLs (http://localhost:8081, http://localhost:8000)

## Usage

### Local Development

```bash
# Uses Dockerfile.local and Dockerfile.app.local
cd docker
docker-compose up -d --build
```

Access:
- Landing page: http://localhost:8080
- Chat app: http://localhost:8081

### Production Deployment

```bash
# Uses production Dockerfiles (Dockerfile and Dockerfile.app)
./scripts/azure-deploy.sh
./scripts/azure-deploy-chat.sh
```

Access:
- Landing page: https://www.powernova.ai
- Chat app: https://app.powernova.ai

## Configuration Structure

### Landing Page Config (website/js/config.js)

```javascript
const config = {
    chatUrl: 'https://app.powernova.ai',
    apiUrl: 'https://api.powernova.ai',
    environment: 'production'
};
```

### Chat App Config (app/js/config.js)

```javascript
const config = {
    landingUrl: 'https://www.powernova.ai',
    apiUrl: 'https://api.powernova.ai',
    wsUrl: 'wss://api.powernova.ai',
    environment: 'production'
};
```

## Security Benefits

### No Runtime Detection

❌ **Avoided**: Runtime environment detection based on `window.location.hostname`
- Exposes all environment URLs in production code
- Visible in browser dev tools
- Security risk: reveals internal infrastructure

✅ **Implemented**: Build-time configuration selection
- Production code contains **only** production URLs
- No localhost references in production builds
- Clean separation of concerns

### .dockerignore Protection

The `.dockerignore` file prevents local configs from accidentally entering production builds:

```
# Local development config files
*.local.js
**/*.local.js
js/config.local.js
app/js/config.local.js
website/js/config.local.js
```

## Adding New Environment Settings

### Step 1: Add to Production Config

Edit `website/js/config.js` or `app/js/config.js`:

```javascript
const config = {
    chatUrl: 'https://app.powernova.ai',
    apiUrl: 'https://api.powernova.ai',
    newSetting: 'production-value',  // Add here
    environment: 'production'
};
```

### Step 2: Add to Local Config

Edit `website/js/config.local.js` or `app/js/config.local.js`:

```javascript
const config = {
    chatUrl: 'http://localhost:8081',
    apiUrl: 'http://localhost:8000',
    newSetting: 'local-value',  // Add here
    environment: 'local'
};
```

### Step 3: Rebuild

```bash
cd docker
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

### Verify Local Container Config

```bash
# Check landing page config
docker exec powernova-website cat /usr/share/nginx/html/js/config.js

# Check chat app config
docker exec powernova-chat-app cat /usr/share/nginx/html/js/config.js
```

Expected output: `environment: 'local'` and `localhost` URLs

### Verify Production Source Files

```bash
# Check source files (should have production URLs)
cat website/js/config.js
cat app/js/config.js
```

Expected output: `environment: 'production'` and `powernova.ai` URLs

### Check Browser Console

Open http://localhost:8080 and check console:

```
[PowerNOVA] 🏠 LOCAL DEVELOPMENT MODE
[PowerNOVA] Chat URL: http://localhost:8081
[PowerNOVA] API URL: http://localhost:8000
```

## Best Practices

1. **Never modify config.js directly for local testing**
   - Always use config.local.js for local changes
   - config.js should only contain production values

2. **Keep configs in sync**
   - When adding settings, update both config.js and config.local.js
   - Maintain same structure in both files

3. **Test both environments**
   - Test locally with docker-compose
   - Verify production URLs in source files before deploying

4. **Don't commit sensitive data**
   - Config files should not contain secrets/passwords
   - Use environment variables for sensitive data if needed

## File Reference

| File | Purpose | Used By |
|------|---------|---------|
| `website/js/config.js` | Production landing page config | Dockerfile, azure-deploy.sh |
| `website/js/config.local.js` | Local landing page config | Dockerfile.local, docker-compose |
| `app/js/config.js` | Production chat app config | Dockerfile.app, azure-deploy-chat.sh |
| `app/js/config.local.js` | Local chat app config | Dockerfile.app.local, docker-compose |
| `docker/Dockerfile` | Production landing build | azure-deploy.sh |
| `docker/Dockerfile.local` | Local landing build | docker-compose.yml |
| `docker/Dockerfile.app` | Production chat build | azure-deploy-chat.sh |
| `docker/Dockerfile.app.local` | Local chat build | docker-compose.yml |

## Related Documentation

- [Docker Compose Explained](./DOCKER-COMPOSE-EXPLAINED.md)
- [Dual App Deployment Guide](./DUAL-APP-DEPLOYMENT.md)
- [Deployment Quick Reference](./DEPLOYMENT-QUICK-REF.md)
