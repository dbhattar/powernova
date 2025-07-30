# PowerNOVA VPS Deployment Guide

This deployment package contains everything needed to deploy PowerNOVA to a VPS with:
- Backend (Node.js/Express)
- Static Website
- Typesense (Docker)
- Redis (Docker)
- Supabase (PostgreSQL - managed)
- Firebase (managed)
- Pinecone (managed)

## Prerequisites

- Ubuntu 22.04 LTS VPS
- Domain name (optional but recommended)
- Supabase account with database setup
- Firebase project setup
- Pinecone account setup

## Quick Start

1. Copy this entire `deployment` folder to your VPS
2. Run the setup script: `sudo ./setup.sh`
3. Configure environment variables in `.env`
4. Start services: `./start.sh`
5. Configure NGINX and SSL: `./configure-nginx.sh your-domain.com`

## Directory Structure

```
deployment/
├── README.md                 # This file
├── QUICK_START.md           # Quick setup instructions
├── setup.sh                 # Initial VPS setup script
├── start.sh                 # Start all services
├── stop.sh                  # Stop all services
├── restart.sh               # Restart all services
├── configure-nginx.sh       # NGINX and SSL setup
├── docker-compose.yml       # Typesense and Redis containers
├── .env.example             # Environment variables template
├── backend/                 # Backend application
├── website/                 # Static landing page files
├── app/                     # React Native frontend app
├── nginx/
│   ├── powernova.conf       # Landing page NGINX config
│   └── app.powernova.conf   # App subdomain NGINX config
├── systemd/                 # Systemd service files
└── scripts/
    ├── status.sh            # Service status check
    ├── logs.sh              # View logs
    ├── setup-db.sh          # Database/Typesense setup
    ├── build-app.sh         # Build React Native web app
    ├── backup.sh            # Backup script
    └── health-check.sh      # Health monitoring
```

## Deployment Steps

### 1. Initial Setup
```bash
# Upload deployment folder to VPS
scp -r deployment/ user@your-vps-ip:~/

# SSH into VPS
ssh user@your-vps-ip

# Navigate to deployment folder
cd ~/deployment

# Make scripts executable
chmod +x *.sh scripts/*.sh

# Run initial setup
sudo ./setup.sh
```

### 2. Configure Environment
```bash
# Copy and edit environment variables
cp .env.example .env
nano .env
# Fill in your Supabase, Firebase, Pinecone, and other credentials
```

### 3. Start Services
```bash
# Start all services
./start.sh

# Check status
./scripts/status.sh
```

### 4. Configure Domain (Optional)
```bash
# Configure NGINX with your domain
sudo ./configure-nginx.sh your-domain.com
```

## Service Management

- **Start all**: `./start.sh`
- **Stop all**: `./stop.sh`
- **Restart all**: `./restart.sh`
- **Check status**: `./scripts/status.sh`
- **View logs**: `./scripts/logs.sh`

## Ports

- Landing page: 80/443 (via NGINX) → powernova.ai
- Main app: 80/443 (via NGINX) → app.powernova.ai
- Backend API: 3001 (internal)
- Typesense: 8108 (internal)
- Redis: 6379 (internal)

## Monitoring

- Backend logs: `journalctl -u powernova-backend -f`
- Docker logs: `docker-compose logs -f`
- NGINX logs: `sudo tail -f /var/log/nginx/error.log`

## Troubleshooting

1. **Backend won't start**: Check `journalctl -u powernova-backend -f`
2. **Database connection issues**: Verify Supabase credentials in `.env`
3. **Docker containers won't start**: Check `docker-compose logs`
4. **Website not accessible**: Check NGINX status and configuration

## Security Notes

- Change all default passwords
- Use strong API keys
- Keep the system updated
- Consider setting up a firewall
- Regular backups of your data

## Support

For issues, check the logs and ensure all credentials are correctly configured.
