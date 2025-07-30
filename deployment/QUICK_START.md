# PowerNOVA VPS Deployment Quick Start

## Upload to VPS

```bash
# From your local machine
tar czf powernova-deployment.tar.gz deployment/
scp powernova-deployment.tar.gz user@your-vps-ip:~/

# On your VPS
ssh user@your-vps-ip
tar xzf powernova-deployment.tar.gz
cd deployment
```

## Configure

```bash
# 1. Run initial setup
sudo ./setup.sh

# 2. Configure environment
cp .env.example .env
nano .env
# Fill in your credentials:
# - Supabase DATABASE_URL
# - Firebase credentials
# - Pinecone API key
# - OpenAI API key
# - Strong secrets for JWT_SECRET and TYPESENSE_API_KEY

# 3. Start services
./start.sh

# 4. Configure domain (optional)
sudo ./configure-nginx.sh your-domain.com
```

## Commands

- `./start.sh` - Start all services
- `./stop.sh` - Stop all services  
- `./restart.sh` - Restart all services
- `./scripts/status.sh` - Check status
- `./scripts/logs.sh` - View logs
- `./scripts/health-check.sh` - Health check
- `./scripts/backup.sh` - Create backup

## Ports

- Landing page: 80/443 (NGINX) → powernova.ai
- Main app: 80/443 (NGINX) → app.powernova.ai  
- Backend API: 3001 (internal)
- Typesense: 8108 (internal)
- Redis: 6379 (internal)

Your landing page will be available at your domain and the main app at app.your-domain!
