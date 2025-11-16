# PowerNOVA Deployment - Quick Reference Card

## 📋 Deployment Checklist

### Before You Start
- [ ] Azure CLI installed (`az --version`)
- [ ] Logged in to Azure (`az login`)
- [ ] Docker installed and running
- [ ] Navigate to project root: `cd /path/to/container`

### Phase 1: Deploy Landing Page
```bash
./scripts/azure-deploy.sh
```

**Configuration Values:**
| Setting | Value | Notes |
|---------|-------|-------|
| Resource Group | `powernova-rg` | Use EXACTLY this for both apps |
| Location | `eastus` | Use EXACTLY this for both apps |
| ACR Name | `powernovaacr` | Use EXACTLY this for both apps |
| App Service Plan | `powernova-plan` | Use EXACTLY this for both apps |
| Web App Name | `powernova-web` | Unique for landing page |
| SKU | `B1` | Required for custom domains |

**Result:** Landing page at `https://powernova-web.azurewebsites.net`

### Phase 2: Deploy Chat App
```bash
./scripts/azure-deploy-chat.sh
```

**Configuration Values:**
| Setting | Value | Notes |
|---------|-------|-------|
| Resource Group | `powernova-rg` | ⚠️ SAME as above |
| Location | `eastus` | ⚠️ SAME as above |
| ACR Name | `powernovaacr` | ⚠️ SAME as above |
| App Service Plan | `powernova-plan` | ⚠️ SAME as above |
| Web App Name | `powernova-chat` | Different name |
| SKU | `B1` | Will use existing plan |

**Result:** Chat app at `https://powernova-chat.azurewebsites.net`

### Phase 3: DNS Configuration

**Update DNS Records:**
```
Type: CNAME
Name: www
Value: powernova-web.azurewebsites.net
TTL: 3600

Type: CNAME
Name: app
Value: powernova-chat.azurewebsites.net
TTL: 3600
```

**Wait 5-30 minutes for DNS propagation**

Verify:
```bash
nslookup www.powernova.ai
nslookup app.powernova.ai
```

### Phase 4: Add Custom Domains to Azure

**Landing Page:**
```bash
az webapp config hostname add \
  --webapp-name powernova-web \
  --resource-group powernova-rg \
  --hostname www.powernova.ai

az webapp config ssl bind \
  --name powernova-web \
  --resource-group powernova-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

**Chat App:**
```bash
az webapp config hostname add \
  --webapp-name powernova-chat \
  --resource-group powernova-rg \
  --hostname app.powernova.ai

az webapp config ssl bind \
  --name powernova-chat \
  --resource-group powernova-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

### Phase 5: Verification

```bash
# Test landing page
curl -I https://www.powernova.ai

# Test chat app
curl -I https://app.powernova.ai

# Check both apps are on same plan
az webapp list \
  --resource-group powernova-rg \
  --query "[?appServicePlanId.contains(@, 'powernova-plan')].[name,state]" \
  --output table
```

---

## 🔄 Update Deployments

### Update Landing Page Code
```bash
# Make changes to website/ folder
./scripts/azure-deploy.sh --update
```

### Update Chat App Code
```bash
# Make changes to app/ folder
./scripts/azure-deploy-chat.sh --update
```

---

## 🔍 Troubleshooting Commands

### Check App Status
```bash
# Landing page
az webapp show --name powernova-web --resource-group powernova-rg --query state

# Chat app
az webapp show --name powernova-chat --resource-group powernova-rg --query state
```

### View Logs
```bash
# Landing page logs (real-time)
az webapp log tail --name powernova-web --resource-group powernova-rg

# Chat app logs (real-time)
az webapp log tail --name powernova-chat --resource-group powernova-rg
```

### Restart Apps
```bash
# Landing page
az webapp restart --name powernova-web --resource-group powernova-rg

# Chat app
az webapp restart --name powernova-chat --resource-group powernova-rg
```

### Check Container Images
```bash
# List images in ACR
az acr repository list --name powernovaacr --output table

# Show tags for specific image
az acr repository show-tags \
  --name powernovaacr \
  --repository powernova-website \
  --output table

az acr repository show-tags \
  --name powernovaacr \
  --repository powernova-chat-app \
  --output table
```

---

## 💰 Cost Monitoring

### View Current Costs
```bash
# Current month costs for resource group
az consumption usage list \
  --start-date $(date -u -d "1 month ago" '+%Y-%m-%d') \
  --end-date $(date -u '+%Y-%m-%d') \
  --query "[?contains(instanceId, 'powernova-rg')]" \
  --output table
```

### Resource Overview
```bash
# List all resources and their types
az resource list \
  --resource-group powernova-rg \
  --output table

# Should show:
# - 1 App Service Plan (powernova-plan)
# - 2 App Services (powernova-web, powernova-chat)
# - 1 Container Registry (powernovaacr)
```

---

## 🎯 Expected Costs (B1 Tier)

| Resource | Cost |
|----------|------|
| App Service Plan (B1) | ~$13/month |
| App Service #1 (web) | $0 (uses plan) |
| App Service #2 (chat) | $0 (uses plan) |
| Azure Container Registry (Basic) | ~$5/month |
| **Total** | **~$18/month** |

---

## 🔐 Security Checklist

After deployment, verify:

```bash
# Check HTTPS-only is enabled
az webapp show \
  --name powernova-web \
  --resource-group powernova-rg \
  --query httpsOnly

az webapp show \
  --name powernova-chat \
  --resource-group powernova-rg \
  --query httpsOnly

# Should return: true for both
```

```bash
# Check minimum TLS version
az webapp config show \
  --name powernova-web \
  --resource-group powernova-rg \
  --query minTlsVersion

az webapp config show \
  --name powernova-chat \
  --resource-group powernova-rg \
  --query minTlsVersion

# Should return: "1.2" for both
```

---

## 📞 Quick Help

| Issue | Command |
|-------|---------|
| App not loading | `az webapp restart --name <app-name> --resource-group powernova-rg` |
| Check if app is running | `az webapp show --name <app-name> --resource-group powernova-rg --query state` |
| View container logs | `az webapp log tail --name <app-name> --resource-group powernova-rg` |
| Test health endpoint | `curl https://<app-name>.azurewebsites.net/health` |
| Rebuild and redeploy | `./scripts/azure-deploy.sh --update` or `./scripts/azure-deploy-chat.sh --update` |

---

## 📚 Full Documentation

- [DUAL-APP-DEPLOYMENT.md](DUAL-APP-DEPLOYMENT.md) - Complete deployment guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Manual deployment steps
- [AZURE-SCRIPTS-GUIDE.md](AZURE-SCRIPTS-GUIDE.md) - Script documentation
- [README.md](../README.md) - Project overview

---

**Pro Tips:**
- ✅ Always use the SAME Resource Group, Location, ACR, and App Service Plan for both apps
- ✅ Use different Web App names (powernova-web vs powernova-chat)
- ✅ Save your configuration - scripts save to `.azure-deployment.conf` and `.azure-chat-deployment.conf`
- ✅ DNS propagation can take 5-30 minutes - be patient!
- ✅ Free Azure managed SSL certificates - no need to purchase
- ✅ Both apps on one plan = ONE cost, not two!
