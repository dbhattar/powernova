# PowerNOVA Website - Containerized Deployment

This repository contains the containerized PowerNOVA landing page, ready for deployment to Azure App Service.

## 📦 Contents

- **website/** - Static HTML, CSS, and JavaScript files
- **docker/Dockerfile** - Multi-stage Docker build configuration
- **docker/nginx.conf** - Optimized Nginx configuration
- **docker/docker-compose.yml** - Local testing setup
- **scripts/docker-helper.sh** - Helper script for Docker operations
- **.github/workflows/** - CI/CD pipeline for Azure deployment

## 🚀 Quick Start - Local Testing

### Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)

### Run Locally

1. **Build and run with Docker Compose:**
   ```bash
   cd docker
   docker-compose up -d
   ```

2. **Access the website:**
   - Open your browser to http://localhost:8080

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the container:**
   ```bash
   docker-compose down
   ```

### Alternative: Run with Docker directly

```bash
# Build the image
docker build -f docker/Dockerfile -t powernova-website .

# Run the container
docker run -d -p 8080:80 --name powernova-web powernova-website

# Stop and remove
docker stop powernova-web
docker rm powernova-web
```

### Using the Helper Script

```bash
# Build the image
./scripts/docker-helper.sh build

# Run the container
./scripts/docker-helper.sh run

# Check status
./scripts/docker-helper.sh status

# Run tests
./scripts/docker-helper.sh test

# View logs
./scripts/docker-helper.sh logs

# Stop the container
./scripts/docker-helper.sh stop
```

## ☁️ Azure Deployment

### Option 1: Azure Portal (Manual Deployment)

#### Step 1: Create Azure Container Registry (ACR)

```bash
# Set variables
RESOURCE_GROUP="powernova-rg"
LOCATION="eastus"
ACR_NAME="powernovaacr"  # Must be globally unique

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get ACR credentials
az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP
```

#### Step 2: Build and Push Docker Image to ACR

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push image
docker build -f docker/Dockerfile -t $ACR_NAME.azurecr.io/powernova-website:latest .
docker push $ACR_NAME.azurecr.io/powernova-website:latest
```

#### Step 3: Create Azure App Service

```bash
# Set variables
APP_SERVICE_PLAN="powernova-plan"
WEBAPP_NAME="powernova-web"  # Must be globally unique

# Create App Service Plan (Linux)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# Create Web App with container
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEBAPP_NAME \
  --deployment-container-image-name $ACR_NAME.azurecr.io/powernova-website:latest

# Configure ACR credentials
az webapp config container set \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/powernova-website:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --docker-registry-server-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Enable continuous deployment
az webapp deployment container config \
  --enable-cd true \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP

# Get the webhook URL
az webapp deployment container show-cd-url \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP
```

#### Step 4: Access Your Website

```bash
# Get the URL
echo "https://$WEBAPP_NAME.azurewebsites.net"
```

### Option 2: Automated Deployment with GitHub Actions

#### Setup GitHub Secrets

1. **Create Azure Service Principal:**
   ```bash
   az ad sp create-for-rbac \
     --name "powernova-github-actions" \
     --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP \
     --sdk-auth
   ```
   Copy the entire JSON output.

2. **Add GitHub Secrets:**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `AZURE_CREDENTIALS`: Paste the JSON from step 1
     - `ACR_USERNAME`: Your ACR username (from ACR credentials)
     - `ACR_PASSWORD`: Your ACR password (from ACR credentials)

3. **Update Workflow File:**
   - Edit `.github/workflows/azure-deploy.yml`
   - Update `AZURE_WEBAPP_NAME` and `CONTAINER_REGISTRY` with your values

4. **Trigger Deployment:**
   - Push to `main` branch, or
   - Manually trigger from GitHub Actions tab

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         GitHub Repository               │
│  ┌───────────────────────────────────┐  │
│  │   Source Code (website/)          │  │
│  │   Dockerfile                      │  │
│  │   nginx.conf                      │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼──────────────────────┘
                   │
                   │ GitHub Actions
                   ↓
┌─────────────────────────────────────────┐
│   Azure Container Registry (ACR)        │
│  ┌───────────────────────────────────┐  │
│  │   Docker Image Repository         │  │
│  │   powernova-website:latest        │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼──────────────────────┘
                   │
                   │ Container Pull
                   ↓
┌─────────────────────────────────────────┐
│   Azure App Service (Linux)             │
│  ┌───────────────────────────────────┐  │
│  │   Container Instance              │  │
│  │   ┌─────────────────────────┐     │  │
│  │   │   Nginx:alpine          │     │  │
│  │   │   ├── index.html        │     │  │
│  │   │   ├── css/styles.css    │     │  │
│  │   │   └── js/script.js      │     │  │
│  │   └─────────────────────────┘     │  │
│  └───────────────────────────────────┘  │
│              Port 80/443                │
└─────────────────┬───────────────────────┘
                  │
                  │ HTTPS
                  ↓
          ┌───────────────┐
          │  End Users    │
          └───────────────┘
```

## 🔧 Configuration

### Environment Variables

You can configure the following environment variables in Azure App Service:

- `NGINX_PORT`: Port to listen on (default: 80)
- Custom app settings can be added via Azure Portal

### Scaling

#### Vertical Scaling (Scale Up)
```bash
az appservice plan update \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku S1
```

#### Horizontal Scaling (Scale Out)
```bash
az appservice plan update \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --number-of-workers 3
```

### Custom Domain

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname www.powernova.com

# Enable HTTPS with managed certificate
az webapp config ssl create \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname www.powernova.com
```

## 🔍 Monitoring & Troubleshooting

### View Logs

```bash
# Stream logs
az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Download logs
az webapp log download --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

### Health Check

The container includes a health check endpoint:
- URL: `https://your-app.azurewebsites.net/health`
- Expected response: `healthy`

### Common Issues

1. **Container fails to start:**
   - Check logs: `az webapp log tail`
   - Verify ACR credentials are correct
   - Ensure image exists in ACR

2. **Website not accessible:**
   - Check if container is running: `az webapp show`
   - Verify port configuration (should be 80)
   - Check Application Insights for errors

3. **Slow performance:**
   - Consider upgrading App Service Plan
   - Enable Azure CDN for static assets
   - Review Nginx caching configuration

## 📊 Cost Optimization

### Recommended Tiers for Different Scenarios

- **Development/Testing**: B1 Basic ($13/month)
- **Production**: S1 Standard ($70/month) - Includes custom domains, SSL
- **High Traffic**: P1V2 Premium ($146/month) - Better performance, auto-scaling

### Save Costs

```bash
# Stop the app when not in use (dev/test)
az webapp stop --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Start when needed
az webapp start --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Delete resources when done
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

## 🔒 Security Best Practices

1. **Enable HTTPS Only:**
   ```bash
   az webapp update \
     --name $WEBAPP_NAME \
     --resource-group $RESOURCE_GROUP \
     --https-only true
   ```

2. **Restrict FTP Access:**
   ```bash
   az webapp config set \
     --name $WEBAPP_NAME \
     --resource-group $RESOURCE_GROUP \
     --ftps-state Disabled
   ```

3. **Enable Application Insights:**
   ```bash
   az monitor app-insights component create \
     --app powernova-insights \
     --location $LOCATION \
     --resource-group $RESOURCE_GROUP
   ```

## 🚀 Next Steps for Multi-Container App

This is a starting point for your multi-container application. To expand:

1. **Add Backend API Service:**
   - Create a separate container for FastAPI/Node.js backend
   - Update docker-compose.yml with backend service
   - Configure networking between containers

2. **Add Database Service:**
   - Azure Database for PostgreSQL
   - Or containerized PostgreSQL in docker-compose

3. **Use Azure Container Instances or AKS:**
   - For more complex multi-container orchestration
   - Better suited for microservices architecture

Example multi-container docker-compose.yml:
```yaml
services:
  web:
    build: ./website
    ports:
      - "80:80"
    depends_on:
      - api
  
  api:
    build: ./api
    ports:
      - "8000:8000"
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: powernova
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

## 📝 Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Azure Container Registry](https://docs.microsoft.com/azure/container-registry/)

## 📧 Support

For issues or questions:
- Email: info@powernova.com
- Create an issue in this repository

---

**PowerNOVA** - Powering the future of energy intelligence
