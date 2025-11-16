# Dual App Deployment Guide - Two App Services, One Plan

## 🏗️ Architecture Overview

```
Azure App Service Plan (powernova-plan) - $13/month
├── App Service 1: powernova-web
│   ├── Container: Landing Page (website/)
│   ├── URL: powernova-web.azurewebsites.net
│   └── Custom Domain: www.powernova.ai
│
└── App Service 2: powernova-chat
    ├── Container: Chat Interface (app/)
    ├── URL: powernova-chat.azurewebsites.net
    └── Custom Domain: app.powernova.ai

Azure Container Registry (ACR)
├── Image: powernova-website:latest
└── Image: powernova-chat-app:latest
```

## 💰 Cost Breakdown

**Shared Resources:**
- **App Service Plan (B1)**: ~$13/month
  - Includes: 1 core, 1.75GB RAM, 10GB storage
  - Both apps run on this plan at no extra cost

**Additional Resources:**
- **Azure Container Registry (Basic)**: ~$5/month
  - Stores both Docker images

**Total Monthly Cost: ~$18/month** for both applications

## 📋 Deployment Options

### **Option A: Deploy Both Apps Together (Recommended for First Time)**

Use the main deployment script which will:
1. Create all shared resources (Resource Group, ACR, App Service Plan)
2. Deploy landing page first
3. Deploy chat app using the same plan

### **Option B: Deploy Separately**

1. Deploy landing page first (creates shared resources)
2. Deploy chat app later (uses existing shared resources)

---

## 🚀 Deployment Steps

### **Step 1: Deploy Landing Page**

```bash
# Navigate to project root
cd /path/to/container

# Run landing page deployment
./scripts/azure-deploy.sh
```

**Configuration prompts:**
- Resource Group: `powernova-rg`
- Location: `eastus` (or your preferred region)
- ACR Name: `powernovaacr` (must be globally unique)
- App Service Plan: `powernova-plan`
- Web App Name: `powernova-web`
- SKU: `B1` (Basic tier, required for custom domains)

**What gets created:**
- ✅ Resource Group
- ✅ Azure Container Registry
- ✅ App Service Plan (B1)
- ✅ App Service for landing page
- ✅ Docker image built and deployed

**Result:**
- Landing page accessible at: `https://powernova-web.azurewebsites.net`

---

### **Step 2: Deploy Chat App**

```bash
# Run chat app deployment
./scripts/azure-deploy-chat.sh
```

**Configuration prompts:**
- Resource Group: `powernova-rg` (SAME as landing page)
- Location: `eastus` (SAME as landing page)
- ACR Name: `powernovaacr` (SAME as landing page)
- App Service Plan: `powernova-plan` (SAME as landing page - this is key!)
- Web App Name: `powernova-chat`
- SKU: `B1` (will use existing plan if same)

**What gets created:**
- ✅ App Service for chat (using existing plan)
- ✅ Docker image built and deployed to existing ACR

**What gets reused:**
- ♻️ Resource Group (already exists)
- ♻️ Azure Container Registry (already exists)
- ♻️ App Service Plan (already exists - no extra cost!)

**Result:**
- Chat app accessible at: `https://powernova-chat.azurewebsites.net`

---

## 🌐 DNS Configuration

After both apps are deployed, configure your DNS:

### **Step 1: Get Azure URLs**

```bash
# Get landing page URL
az webapp show --name powernova-web --resource-group powernova-rg --query defaultHostName -o tsv

# Get chat app URL
az webapp show --name powernova-chat --resource-group powernova-rg --query defaultHostName -o tsv
```

### **Step 2: Update DNS Records**

In your DNS provider (GoDaddy, Cloudflare, Route53, etc.):

**For www.powernova.ai:**
```
Type:  CNAME
Name:  www
Value: powernova-web.azurewebsites.net
TTL:   3600
```

**For app.powernova.ai:**
```
Type:  CNAME
Name:  app
Value: powernova-chat.azurewebsites.net
TTL:   3600
```

### **Step 3: Add Custom Domains to Azure**

**Wait 5-30 minutes for DNS propagation**, then run:

**For landing page:**
```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name powernova-web \
  --resource-group powernova-rg \
  --hostname www.powernova.ai

# Bind SSL certificate (free managed certificate)
az webapp config ssl bind \
  --name powernova-web \
  --resource-group powernova-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

**For chat app:**
```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name powernova-chat \
  --resource-group powernova-rg \
  --hostname app.powernova.ai

# Bind SSL certificate (free managed certificate)
az webapp config ssl bind \
  --name powernova-chat \
  --resource-group powernova-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

### **Step 4: Verify**

```bash
# Test landing page
curl -I https://www.powernova.ai

# Test chat app
curl -I https://app.powernova.ai
```

---

## 🔄 Updating Deployments

### **Update Landing Page Only**

```bash
# Make changes to website/ folder
# Then update deployment:
./scripts/azure-deploy.sh --update
```

### **Update Chat App Only**

```bash
# Make changes to app/ folder
# Then update deployment:
./scripts/azure-deploy-chat.sh --update
```

### **Update Both**

```bash
# Update landing page
./scripts/azure-deploy.sh --update

# Update chat app
./scripts/azure-deploy-chat.sh --update
```

---

## 📊 Resource Management

### **View All Resources**

```bash
# List all resources in resource group
az resource list --resource-group powernova-rg --output table
```

### **Check App Service Plan Usage**

```bash
# View plan details
az appservice plan show \
  --name powernova-plan \
  --resource-group powernova-rg

# List all apps on the plan
az webapp list \
  --resource-group powernova-rg \
  --query "[?appServicePlanId.contains(@, 'powernova-plan')].[name,state,hostNames]" \
  --output table
```

### **Monitor Applications**

**Landing page:**
```bash
# View logs
az webapp log tail --name powernova-web --resource-group powernova-rg

# Check status
az webapp show --name powernova-web --resource-group powernova-rg --query state -o tsv

# Restart
az webapp restart --name powernova-web --resource-group powernova-rg
```

**Chat app:**
```bash
# View logs
az webapp log tail --name powernova-chat --resource-group powernova-rg

# Check status
az webapp show --name powernova-chat --resource-group powernova-rg --query state -o tsv

# Restart
az webapp restart --name powernova-chat --resource-group powernova-rg
```

---

## 🎯 Scaling Strategy

### **Same Plan (Current Setup)**

Both apps share resources:
- **Pros**: Cost-effective, simple
- **Cons**: Resource contention if chat gets heavy traffic

**When to use**: Perfect for early stage, low-to-medium traffic

### **Separate Plans (Future Growth)**

If chat app needs more resources:

```bash
# Create new plan for chat
az appservice plan create \
  --name powernova-chat-plan \
  --resource-group powernova-rg \
  --sku S1 \
  --is-linux

# Move chat app to new plan
az webapp update \
  --name powernova-chat \
  --resource-group powernova-rg \
  --plan powernova-chat-plan
```

**Cost Impact:**
- Landing page: $13/month (B1)
- Chat app: $70/month (S1) - more resources
- Total: $83/month

### **Auto-Scaling (Production)**

For production-level traffic:

```bash
# Enable autoscale for chat app plan
az monitor autoscale create \
  --resource-group powernova-rg \
  --resource powernova-chat-plan \
  --resource-type Microsoft.Web/serverfarms \
  --name chatapp-autoscale \
  --min-count 1 \
  --max-count 3 \
  --count 1

# Add CPU-based scaling rule
az monitor autoscale rule create \
  --resource-group powernova-rg \
  --autoscale-name chatapp-autoscale \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1
```

---

## 🔐 Security Checklist

After deployment, verify:

- [ ] HTTPS-only enabled on both apps
- [ ] Minimum TLS 1.2 configured
- [ ] Custom domains configured with SSL
- [ ] CORS configured if needed
- [ ] App Service authentication enabled (if required)
- [ ] Container registry credentials secured
- [ ] Resource locks enabled (prevent accidental deletion)

**Enable resource lock:**
```bash
az lock create \
  --name DoNotDelete \
  --resource-group powernova-rg \
  --lock-type CanNotDelete \
  --notes "Prevent accidental deletion of production resources"
```

---

## 🐛 Troubleshooting

### **Issue: Custom domain validation fails**

**Solution:**
```bash
# Verify DNS propagation
nslookup www.powernova.ai
nslookup app.powernova.ai

# Check domain ownership
az webapp config hostname add \
  --webapp-name powernova-web \
  --resource-group powernova-rg \
  --hostname www.powernova.ai \
  --dry-run
```

### **Issue: App not loading after deployment**

**Solution:**
```bash
# Check container logs
az webapp log tail --name powernova-chat --resource-group powernova-rg

# Verify container is running
az webapp config container show \
  --name powernova-chat \
  --resource-group powernova-rg

# Restart app
az webapp restart --name powernova-chat --resource-group powernova-rg
```

### **Issue: 502 Bad Gateway**

**Solution:**
```bash
# Container might be failing to start
# Check health endpoint
curl https://powernova-chat.azurewebsites.net/health

# Increase startup timeout
az webapp config set \
  --name powernova-chat \
  --resource-group powernova-rg \
  --startup-time 600
```

---

## 📈 Cost Optimization Tips

1. **Use same plan for both apps** ✅ (you're doing this)
2. **Use Basic tier only if you need custom domains** ✅
3. **Consider Free tier for dev/staging**
4. **Scale down during off-hours** (manual or scheduled)
5. **Monitor ACR storage usage** (clean old images)

**Clean old Docker images from ACR:**
```bash
# List all images
az acr repository list --name powernovaacr -o table

# Delete old tags
az acr repository show-tags \
  --name powernovaacr \
  --repository powernova-chat-app \
  --orderby time_desc \
  --output table

# Keep only latest 3, delete others
az acr repository purge \
  --name powernovaacr \
  --repository powernova-chat-app \
  --filter 'powernova-chat-app:.*' \
  --keep 3 \
  --yes
```

---

## 🎉 Success Checklist

After completing deployment:

- [ ] Landing page deployed to App Service
- [ ] Chat app deployed to separate App Service
- [ ] Both apps on same App Service Plan
- [ ] DNS CNAME records configured
- [ ] Custom domains added to both apps
- [ ] SSL certificates bound (HTTPS working)
- [ ] Health checks passing
- [ ] Both apps accessible at custom domains
- [ ] Deployment scripts saved configuration
- [ ] Resource group locked (optional but recommended)

---

## 📚 Quick Reference

**Resource Names (Example):**
- Resource Group: `powernova-rg`
- Location: `eastus`
- ACR: `powernovaacr`
- App Service Plan: `powernova-plan`
- Landing Page App: `powernova-web`
- Chat App: `powernova-chat`

**URLs:**
- Landing: `https://www.powernova.ai` → `powernova-web.azurewebsites.net`
- Chat: `https://app.powernova.ai` → `powernova-chat.azurewebsites.net`

**Scripts:**
- Deploy landing page: `./scripts/azure-deploy.sh`
- Deploy chat app: `./scripts/azure-deploy-chat.sh`
- Update landing page: `./scripts/azure-deploy.sh --update`
- Update chat app: `./scripts/azure-deploy-chat.sh --update`

---

**Last Updated**: November 15, 2025  
**Architecture**: Two App Services, One Plan  
**Estimated Cost**: ~$18/month (Basic tier + ACR)
