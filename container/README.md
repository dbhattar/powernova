# PowerNOVA - Quick Reference

> 📚 **Complete Documentation**: See [docs/](docs/) folder for detailed guides
> - [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Comprehensive Azure deployment guide
> - [AZURE-SCRIPTS-GUIDE.md](docs/AZURE-SCRIPTS-GUIDE.md) - Azure deployment scripts guide
> - [MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md) - Project reorganization guide
> - [CHANGELOG.md](docs/CHANGELOG.md) - Version history and updates

## 📦 Project Structure

This repository contains two applications:

- **Landing Page** (`website/`) - Static marketing site for www.powernova.ai
- **Chat Interface** (`app/`) - AI-powered chat application for app.powernova.ai

## 🚀 Quick Start Commands

### Local Development with Docker

**Note:** Docker Compose is for **local testing only**. Azure deployment uses separate App Services (not docker-compose). See [DOCKER-COMPOSE-EXPLAINED.md](docs/DOCKER-COMPOSE-EXPLAINED.md) for details.

```bash
# Option 1: Using docker-compose (Recommended - runs both apps)
cd docker
docker-compose up -d          # Start both containers
docker-compose logs -f        # View logs for both
docker-compose ps            # Check status
docker-compose down          # Stop both containers

# Run individual services
docker-compose up -d powernova-web    # Only landing page
docker-compose up -d powernova-chat   # Only chat app

# Option 2: Using the helper script (for landing page only)
./scripts/docker-helper.sh build     # Build the image
./scripts/docker-helper.sh run       # Run the container
./scripts/docker-helper.sh status    # Check status
./scripts/docker-helper.sh logs      # View logs
./scripts/docker-helper.sh test      # Run tests
./scripts/docker-helper.sh stop      # Stop container

# Option 3: Using Docker directly (explicit, no compose)
# Landing page
docker build -f docker/Dockerfile -t powernova-website .
docker run -d -p 8080:80 --name powernova-web powernova-website

# Chat app
docker build -f docker/Dockerfile.app -t powernova-chat .
docker run -d -p 8081:80 --name powernova-chat-app powernova-chat
```

### Access Points

**Landing Page (www.powernova.ai locally)**
- Website: http://localhost:8080
- Health Check: http://localhost:8080/health

**Chat App (app.powernova.ai locally)**
- Chat Interface: http://localhost:8081
- Health Check: http://localhost:8081/health

## ☁️ Azure Deployment

### 🎯 Two Applications, One Plan Architecture

PowerNOVA uses **two separate App Services on one shared App Service Plan**:
- **Landing Page** → `www.powernova.ai` (powernova-web)
- **Chat Interface** → `app.powernova.ai` (powernova-chat)

**Cost**: ~$18/month total (both apps share one B1 plan + ACR)

📖 **Complete Guide**: See [DUAL-APP-DEPLOYMENT.md](docs/DUAL-APP-DEPLOYMENT.md)

### Quick Start: Deploy Both Applications

**Step 1: Deploy Landing Page**
```bash
./scripts/azure-deploy.sh
```

**Step 2: Deploy Chat App**
```bash
./scripts/azure-deploy-chat.sh
```

**Important**: Use the **SAME** configuration for both:
- Same Resource Group
- Same Location  
- Same ACR Name
- Same App Service Plan name
- Different Web App names

This ensures both apps share the same plan (no extra cost!).

### Automated Deployment Scripts

**Landing Page Deployment:**
```bash
# Full deployment (interactive prompts)
./scripts/azure-deploy.sh

# Update existing deployment
./scripts/azure-deploy.sh --update

# View help
./scripts/azure-deploy.sh --help
```

**Chat App Deployment:**
```bash
# Full deployment (interactive prompts)
./scripts/azure-deploy-chat.sh

# Update existing deployment
./scripts/azure-deploy-chat.sh --update

# View help
./scripts/azure-deploy-chat.sh --help
```

The scripts will:
- ✅ Check prerequisites (Azure CLI, Docker)
- ✅ Prompt for configuration (names, location, SKU)
- ✅ Create all Azure resources (or use existing)
- ✅ Build and push Docker images
- ✅ Configure web apps and security settings
- ✅ Save configuration for future updates

### Custom Domain Configuration

After deployment, configure your DNS:

**DNS Records:**
```
www.powernova.ai → CNAME → powernova-web.azurewebsites.net
app.powernova.ai → CNAME → powernova-chat.azurewebsites.net
```

**Add to Azure:**
```bash
# Landing page
az webapp config hostname add \
  --webapp-name powernova-web \
  --resource-group powernova-rg \
  --hostname www.powernova.ai

# Chat app
az webapp config hostname add \
  --webapp-name powernova-chat \
  --resource-group powernova-rg \
  --hostname app.powernova.ai
```

See [DUAL-APP-DEPLOYMENT.md](docs/DUAL-APP-DEPLOYMENT.md) for complete DNS setup instructions.

### Manual Deployment

For manual deployment steps, see [DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Prerequisites
```bash
# Install Azure CLI (if not already installed)
# macOS
brew install azure-cli

# Login to Azure
az login
```

### Full Deployment (Copy & Paste Ready)

```bash
# 1. Set your variables
export RESOURCE_GROUP="powernova-rg"
export LOCATION="eastus"
export ACR_NAME="powernovaacr$(date +%s)"  # Unique name with timestamp
export APP_SERVICE_PLAN="powernova-plan"
export WEBAPP_NAME="powernova-web-$(date +%s)"  # Unique name

# 2. Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 3. Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 4. Build and push image to ACR
az acr build \
  --registry $ACR_NAME \
  --image powernova-website:latest \
  --file docker/Dockerfile .

# 5. Create App Service Plan
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# 6. Create Web App
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEBAPP_NAME \
  --deployment-container-image-name $ACR_NAME.azurecr.io/powernova-website:latest

# 7. Configure ACR integration
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

az webapp config container set \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/powernova-website:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

# 8. Enable HTTPS only
az webapp update \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --https-only true

# 9. Get your website URL
echo "🎉 Your website is deployed at: https://$WEBAPP_NAME.azurewebsites.net"
```

## 🛠️ Managing Your Azure Deployment

After deploying, use the management script for common tasks:

```bash
# Check deployment status
./scripts/azure-manage.sh status

# Stream live logs
./scripts/azure-manage.sh logs

# Restart the app
./scripts/azure-manage.sh restart

# Stop the app (saves costs when not in use)
./scripts/azure-manage.sh stop

# Start the app
./scripts/azure-manage.sh start

# Scale to a different tier
./scripts/azure-manage.sh scale

# Scale out (add instances)
./scripts/azure-manage.sh scale-out

# Open website in browser
./scripts/azure-manage.sh open

# SSH into container
./scripts/azure-manage.sh ssh

# View estimated costs
./scripts/azure-manage.sh costs

# Configure custom domain
./scripts/azure-manage.sh domain

# Delete all resources
./scripts/azure-manage.sh delete

# View all commands
./scripts/azure-manage.sh help
```

### Update Deployment

```bash
# After making changes to your code:

# Option 1: Using deployment script (recommended)
./scripts/azure-deploy.sh --update

# Option 2: Manual update
az acr build \
  --registry $ACR_NAME \
  --image powernova-website:latest \
  --file docker/Dockerfile .

az webapp restart --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

### Monitoring & Troubleshooting

```bash
# View logs (using management script)
./scripts/azure-manage.sh logs

# Or use Azure CLI directly
az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Download logs
./scripts/azure-manage.sh download-logs

# Check container status
az webapp show \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "{state:state, healthCheckStatus:siteConfig.healthCheckPath}" \
  --output table

# SSH into container
az webapp ssh --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

### Cleanup

```bash
# Delete everything (saves costs)
az group delete --name $RESOURCE_GROUP --yes --no-wait

# Or stop just the web app (keeps resources)
az webapp stop --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

## 🔧 Common Tasks

### Local Testing Before Deployment

```bash
# Build and test locally
cd docker
docker-compose up -d

# Run tests (from project root)
cd ..
./scripts/docker-helper.sh test

# Check logs
cd docker
docker-compose logs -f

# Stop when satisfied
docker-compose down
```

### Viewing Container Internals

```bash
# Access container shell
docker exec -it powernova-web /bin/sh

# Inside container:
ls -la /usr/share/nginx/html/  # View website files
cat /etc/nginx/conf.d/default.conf  # View nginx config
nginx -t  # Test nginx configuration
```

### Performance Testing

```bash
# Install Apache Bench (if needed)
brew install httpd

# Run load test (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:8080/

# Or with curl
for i in {1..10}; do
  curl -s -o /dev/null -w "Response time: %{time_total}s\n" http://localhost:8080/
done
```

## 📊 Pricing Estimates

### Azure Resources Monthly Cost

| Tier | Specs | Cost/Month | Best For |
|------|-------|------------|----------|
| **B1 Basic** | 1 Core, 1.75 GB RAM | ~$13 | Development/Testing |
| **S1 Standard** | 1 Core, 1.75 GB RAM | ~$70 | Small Production |
| **P1v2 Premium** | 1 Core, 3.5 GB RAM | ~$146 | Production with SSL |
| **ACR Basic** | 10 GB storage | ~$5 | Image storage |

**Estimated Total**: $18-$151/month depending on tier

### Cost Saving Tips

```bash
# Stop when not in use (Dev/Test)
az webapp stop --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Scale down for lower traffic
az appservice plan update --name $APP_SERVICE_PLAN --resource-group $RESOURCE_GROUP --sku F1  # Free tier

# Delete resources when done
az group delete --name $RESOURCE_GROUP --yes
```

## 🔐 Security Checklist

- [ ] Enable HTTPS only (`--https-only true`)
- [ ] Disable FTP access
- [ ] Use managed identities instead of passwords (where possible)
- [ ] Enable Application Insights for monitoring
- [ ] Set up Azure Key Vault for secrets
- [ ] Configure custom domain with SSL certificate
- [ ] Enable Azure Front Door for DDoS protection
- [ ] Set up backup and disaster recovery

## 📚 File Structure Reference

```
container/
├── website/                    # Your static website files
│   ├── index.html
│   ├── css/styles.css
│   └── js/script.js
├── docker/                     # Docker configuration files
│   ├── Dockerfile             # Container definition
│   ├── nginx.conf             # Web server configuration
│   ├── docker-compose.yml     # Local development setup
│   └── .dockerignore          # Files to exclude from build
├── scripts/                    # Helper scripts
│   └── docker-helper.sh       # Convenience script for Docker operations
├── docs/                       # 📚 Documentation
│   ├── DEPLOYMENT.md          # Detailed deployment guide
│   ├── MIGRATION-GUIDE.md     # Project reorganization guide
│   └── CHANGELOG.md           # Version history
├── .gitignore                 # Git ignore rules
├── README.md                  # This file - Quick reference
└── .github/
    └── workflows/
        └── azure-deploy.yml   # CI/CD pipeline
```

## 🆘 Troubleshooting

### Container won't start
```bash
# Check Docker is running
docker info

# View build logs
docker build -f docker/Dockerfile -t powernova-website . --progress=plain --no-cache

# Check container logs
docker logs powernova-web
```

### Website not accessible
```bash
# Check if container is running
docker ps | grep powernova

# Check port binding
netstat -an | grep 8080

# Test health endpoint
curl http://localhost:8080/health
```

### Azure deployment fails
```bash
# Verify ACR image exists
az acr repository show --name $ACR_NAME --repository powernova-website

# Check web app configuration
az webapp config show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# View deployment logs
az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

## 🔄 Next Steps for Multi-Container

1. Add backend API service (FastAPI/Node.js)
2. Add PostgreSQL database
3. Add Redis for caching
4. Set up service-to-service communication
5. Consider Azure Container Instances or AKS for orchestration

Example expansion:
```yaml
# docker-compose.yml
services:
  web:
    build: ./website
    ports: ["80:80"]
    depends_on: [api]
  
  api:
    build: ./api
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://db:5432/powernova
  
  db:
    image: postgres:15-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
```

## 📞 Support

- **Documentation**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed guides
- **Migration Guide**: See [docs/MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md)
- **Version History**: See [docs/CHANGELOG.md](docs/CHANGELOG.md)
- **Issues**: Create GitHub issue
- **Email**: info@powernova.com

---

**PowerNOVA** - Power Generation Intelligence Platform
