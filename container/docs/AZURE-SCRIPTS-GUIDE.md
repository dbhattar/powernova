# Azure Deployment Scripts Guide

Complete guide for deploying and managing PowerNOVA on Azure App Service using automated scripts.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Deployment Script](#deployment-script)
- [Management Script](#management-script)
- [Configuration File](#configuration-file)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Two powerful scripts are provided for Azure deployment:

1. **`azure-deploy.sh`** - Automated deployment and updates
2. **`azure-manage.sh`** - Post-deployment management

Both scripts are interactive, colorful, and guide you through the process.

## ✅ Prerequisites

### Required Software

```bash
# Azure CLI
brew install azure-cli  # macOS
# Or visit: https://docs.microsoft.com/cli/azure/install-azure-cli

# Docker (already installed for local dev)
# Verify: docker --version

# Login to Azure
az login
```

### Permissions

Ensure you have:
- Azure subscription with Contributor role
- Ability to create resources
- Sufficient quota for selected SKU

## 🚀 Deployment Script

### azure-deploy.sh

Interactive script that creates all necessary Azure resources.

### Usage

```bash
# Full deployment (interactive)
./scripts/azure-deploy.sh

# Update existing deployment
./scripts/azure-deploy.sh --update

# Show help
./scripts/azure-deploy.sh --help
```

### What It Does

#### Initial Deployment (`./scripts/azure-deploy.sh`)

1. **Prerequisites Check**
   - Verifies Azure CLI is installed
   - Verifies Docker is installed
   - Checks Azure login status

2. **Interactive Configuration**
   - Prompts for resource names
   - Prompts for Azure location
   - Prompts for SKU/pricing tier
   - Shows configuration summary

3. **Resource Creation**
   - Creates Resource Group
   - Creates Azure Container Registry (ACR)
   - Builds and pushes Docker image
   - Creates App Service Plan
   - Creates Web App
   - Configures container settings

4. **Security Configuration**
   - Enables HTTPS-only
   - Disables FTP access
   - Configures Always On (if not Free tier)
   - Optional: Enables Application Insights

5. **Completion**
   - Restarts web app
   - Saves configuration to `.azure-deployment.conf`
   - Displays deployment summary with URLs and costs

#### Update Deployment (`./scripts/azure-deploy.sh --update`)

1. Loads existing configuration from `.azure-deployment.conf`
2. Rebuilds Docker image with latest changes
3. Pushes to existing ACR
4. Restarts web app to pull new image

### Configuration Prompts

| Prompt | Example | Notes |
|--------|---------|-------|
| Resource Group | `powernova-rg` | Container for all resources |
| Location | `eastus` | Azure region (use `az account list-locations -o table`) |
| Container Registry | `powernovaacr123` | Must be globally unique, alphanumeric only |
| App Service Plan | `powernova-plan` | Name for the compute plan |
| SKU | `B1` | Pricing tier (F1/B1/S1/P1V2) |
| Web App Name | `powernova-web-123` | Must be globally unique |

### SKU Tiers Explained

| SKU | Name | RAM | Cost/Month | Best For |
|-----|------|-----|------------|----------|
| F1 | Free | 1 GB | $0 | Testing only (limitations apply) |
| B1 | Basic | 1.75 GB | ~$13 | Development/Testing |
| B2 | Basic | 3.5 GB | ~$26 | Small production |
| S1 | Standard | 1.75 GB | ~$70 | Production (includes staging slots) |
| S2 | Standard | 3.5 GB | ~$140 | Medium production |
| P1V2 | Premium | 3.5 GB | ~$146 | High performance |

### Output Example

```
========================================
  PowerNOVA Azure Deployment
========================================

Deployment completed successfully!

🌐 Website URL:
   https://powernova-web-123.azurewebsites.net

📦 Resources Created:
   Resource Group:     powernova-rg
   Container Registry: powernovaacr123
   App Service Plan:   powernova-plan (B1)
   Web App:            powernova-web-123

💰 Estimated Monthly Cost:
   Basic B1 - ~$13/month
   Container Registry (Basic) - ~$5/month

📝 Next Steps:
   1. Visit your website at the URL above
   2. Configure custom domain (optional)
   3. Set up SSL certificate (optional)
   4. Enable autoscaling (optional)
```

## 🛠️ Management Script

### azure-manage.sh

Comprehensive management tool for deployed resources.

### Usage

```bash
./scripts/azure-manage.sh [COMMAND]
```

### Available Commands

#### status
Shows current deployment status and information.

```bash
./scripts/azure-manage.sh status
```

Output:
- Web app running status
- Website URL
- Resource information
- Recent deployment history

#### logs
Stream live logs from the web app.

```bash
./scripts/azure-manage.sh logs
```

Press `Ctrl+C` to stop streaming.

#### download-logs
Download logs to a local zip file.

```bash
./scripts/azure-manage.sh download-logs
```

Creates: `webapp-logs-YYYYMMDD-HHMMSS.zip`

#### restart
Restart the web app.

```bash
./scripts/azure-manage.sh restart
```

Use when:
- Configuration changes made
- App is unresponsive
- After manual changes in Azure Portal

#### stop
Stop the web app (saves costs when not in use).

```bash
./scripts/azure-manage.sh stop
```

**Cost Savings**: Compute charges stop, but you still pay for App Service Plan.

#### start
Start a stopped web app.

```bash
./scripts/azure-manage.sh start
```

#### scale
Change the App Service Plan SKU (vertical scaling).

```bash
./scripts/azure-manage.sh scale
```

Interactive prompts for new SKU. Examples:
- Scale up for more performance: B1 → S1
- Scale down to save costs: S1 → B1

#### scale-out
Add or remove instances (horizontal scaling).

```bash
./scripts/azure-manage.sh scale-out
```

**Note**: Available for Standard and Premium tiers only.

#### open
Open the website in your default browser.

```bash
./scripts/azure-manage.sh open
```

Works on macOS and Linux with `xdg-open`.

#### ssh
Open SSH connection to the running container.

```bash
./scripts/azure-manage.sh ssh
```

Useful for:
- Debugging container issues
- Inspecting file system
- Running commands in container

Type `exit` to close connection.

#### costs
Show estimated costs for your deployment.

```bash
./scripts/azure-manage.sh costs
```

Displays monthly cost estimates based on current SKU.

#### domain
Configure a custom domain for your web app.

```bash
./scripts/azure-manage.sh domain
```

Interactive prompts for domain name. You'll need to:
1. Add domain in Azure
2. Configure DNS records
3. Optionally add SSL certificate

#### delete
Delete all Azure resources.

```bash
./scripts/azure-manage.sh delete
```

**⚠️ WARNING**: This is destructive!
- Requires typing `DELETE` to confirm
- Removes all resources in the resource group
- Cannot be undone
- Removes local configuration file

## 📄 Configuration File

### .azure-deployment.conf

Automatically created by deployment script. Stores:

```bash
RESOURCE_GROUP="powernova-rg"
LOCATION="eastus"
ACR_NAME="powernovaacr123"
APP_SERVICE_PLAN="powernova-plan"
SKU="B1"
WEBAPP_NAME="powernova-web-123"
IMAGE_NAME="powernova-website"
```

**Location**: Project root (excluded from git via `.gitignore`)

**Usage**: Enables `--update` deployments and all management commands.

## 🔄 Common Workflows

### Initial Deployment

```bash
# 1. Deploy to Azure
./scripts/azure-deploy.sh

# 2. Check status
./scripts/azure-manage.sh status

# 3. Open in browser
./scripts/azure-manage.sh open
```

### Update After Code Changes

```bash
# Make your code changes, then:

# 1. Update deployment
./scripts/azure-deploy.sh --update

# 2. Monitor logs for issues
./scripts/azure-manage.sh logs

# 3. Verify in browser
./scripts/azure-manage.sh open
```

### Development vs Production

#### Development Environment
```bash
# Deploy with Basic SKU
./scripts/azure-deploy.sh
# Choose: B1 SKU

# Stop when not in use to save costs
./scripts/azure-manage.sh stop

# Start when needed
./scripts/azure-manage.sh start
```

#### Production Environment
```bash
# Deploy with Standard or Premium SKU
./scripts/azure-deploy.sh
# Choose: S1 or P1V2 SKU

# Scale out for high availability
./scripts/azure-manage.sh scale-out
# Choose: 2-3 instances

# Configure custom domain
./scripts/azure-manage.sh domain
```

### Monitoring and Debugging

```bash
# Check status
./scripts/azure-manage.sh status

# Stream logs
./scripts/azure-manage.sh logs

# If issues, SSH into container
./scripts/azure-manage.sh ssh
# Inside container:
ls -la /usr/share/nginx/html/
cat /var/log/nginx/error.log

# Download logs for analysis
./scripts/azure-manage.sh download-logs
```

### Cost Optimization

```bash
# Stop dev environment over weekend
./scripts/azure-manage.sh stop

# Scale down if traffic is low
./scripts/azure-manage.sh scale
# Choose: Lower SKU

# Check costs
./scripts/azure-manage.sh costs

# Clean up test deployments
./scripts/azure-manage.sh delete
```

## 🔧 Troubleshooting

### "Not logged in to Azure"

```bash
az login
```

### "Container Registry name not available"

Registry names must be globally unique. Try adding numbers:
```
powernovaacr123456
```

### "Web App name not available"

App names must be globally unique. Try:
```
powernova-web-20251115
powernova-yourname-web
```

### "Deployment failed: insufficient quota"

Your subscription may have quota limits. Either:
1. Choose a different location
2. Choose a smaller SKU
3. Request quota increase in Azure Portal

### "Configuration file not found"

The management script requires `.azure-deployment.conf` created by the deployment script.

**Solution**: Deploy first:
```bash
./scripts/azure-deploy.sh
```

### "Image build failed"

1. Check Docker is running: `docker ps`
2. Verify Dockerfile syntax
3. Check build logs for errors
4. Ensure you're in project root directory

### "Web app not starting"

```bash
# Check logs
./scripts/azure-manage.sh logs

# Common issues:
# - Port configuration (should be 80)
# - Health check failing
# - Container image issues

# Restart app
./scripts/azure-manage.sh restart
```

### "Can't SSH into container"

SSH requires:
- Web app to be running
- App Service Plan with SSH support (not available in F1)
- Azure CLI authentication

```bash
# Verify status first
./scripts/azure-manage.sh status
```

## 📚 Additional Resources

- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [App Service Pricing](https://azure.microsoft.com/pricing/details/app-service/)
- [Azure Container Registry](https://docs.microsoft.com/azure/container-registry/)
- [Custom Domains](https://docs.microsoft.com/azure/app-service/app-service-web-tutorial-custom-domain)
- [SSL Certificates](https://docs.microsoft.com/azure/app-service/configure-ssl-certificate)

## 🎯 Best Practices

1. **Always use `--update` for code changes**
   - Faster than full redeployment
   - Preserves configuration

2. **Use appropriate SKU for environment**
   - Dev/Test: B1
   - Production: S1 or higher

3. **Monitor logs regularly**
   - Use `./scripts/azure-manage.sh logs`
   - Set up Application Insights

4. **Stop dev environments when not in use**
   - Saves costs
   - Easy to restart

5. **Use custom domains for production**
   - Professional appearance
   - Better for SEO

6. **Enable Application Insights**
   - Better monitoring
   - Performance tracking
   - Error detection

7. **Regular backups**
   - Export configuration
   - Document custom settings

---

**Version**: 1.2.0  
**Last Updated**: November 15, 2025  
**Scripts Location**: `scripts/azure-deploy.sh`, `scripts/azure-manage.sh`
