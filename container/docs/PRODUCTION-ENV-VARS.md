# Production Environment Variables - Best Practices Guide

## Quick Answer

**For your PowerNOVA API:** Use **Azure Key Vault** for the `OPENAI_API_KEY` (most secure).

## Three Approaches (Ranked by Security)

### 🥇 1. Azure Key Vault (RECOMMENDED - Highest Security)

**When to use:**
- Storing sensitive API keys (like OpenAI API key)
- Compliance requirements (SOC 2, HIPAA, PCI-DSS)
- Need for secret rotation
- Audit logging required

**Setup:**
```bash
cd scripts
./setup-keyvault.sh
```

**How it works:**
```
App Service → Managed Identity → Key Vault → Secret
```

**Advantages:**
- ✅ Secrets never stored in code/images
- ✅ Centralized secret management
- ✅ Automatic audit logging
- ✅ Secret rotation support
- ✅ Access control with Azure RBAC
- ✅ Encryption at rest and in transit
- ✅ No additional cost for basic usage

**App Service Configuration:**
```bash
# Stored in Key Vault, referenced in App Settings
OPENAI_API_KEY=@Microsoft.KeyVault(SecretUri=https://powernova-kv.vault.azure.net/secrets/OPENAI-API-KEY/)
```

**Cost:** Free for first 10,000 operations/month (plenty for your use case)

---

### 🥈 2. Azure App Service Application Settings (CURRENT - Good Security)

**When to use:**
- Non-critical configuration (PORT, ENVIRONMENT)
- Quick deployment
- Simple setups

**Your current implementation:**
```bash
az webapp config appsettings set \
    --name powernova-api \
    --resource-group powernova-rg \
    --settings \
        OPENAI_API_KEY="sk-..." \
        PORT="8000" \
        ENVIRONMENT="production"
```

**Advantages:**
- ✅ Not stored in code/Docker images
- ✅ Encrypted at rest
- ✅ Easy to update without rebuilding
- ✅ Environment-specific (can have staging/prod)
- ✅ No extra cost

**Limitations:**
- ⚠️ Visible to anyone with App Service access
- ⚠️ No audit logging
- ⚠️ No automatic rotation

---

### 🥉 3. Environment Files in Docker (NOT RECOMMENDED for Production)

**Why avoid:**
- ❌ Secrets stored in Docker images
- ❌ Visible in image layers
- ❌ Can leak via image registries
- ❌ Hard to rotate
- ❌ Security risk

**Only use for:** Local development (you're already doing this correctly with `.env.local`)

---

## Recommended Setup for PowerNOVA

### For Sensitive Data (API Keys):
```
OpenAI API Key → Azure Key Vault
```

### For Non-Sensitive Config:
```
PORT, ENVIRONMENT → App Service Application Settings
```

### Implementation Steps

#### Step 1: Setup Key Vault (One-time)
```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/scripts
./setup-keyvault.sh
```

This will:
1. Create Azure Key Vault
2. Store OPENAI_API_KEY securely
3. Enable Managed Identity for your App Service
4. Grant access permissions
5. Update App Service configuration

#### Step 2: Update Deployment Script (Optional)

If you want future deployments to use Key Vault, update `azure-deploy-api.sh`:

```bash
# Instead of storing API key directly
OPENAI_API_KEY="sk-..."

# Reference Key Vault
OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=https://powernova-kv.vault.azure.net/secrets/OPENAI-API-KEY/)"
```

#### Step 3: Verify Configuration

```bash
# Check App Service settings
az webapp config appsettings list \
    --name powernova-api \
    --resource-group powernova-rg

# Test API health
curl https://powernova-api.azurewebsites.net/health
```

---

## Environment Variable Hierarchy

Your FastAPI app reads environment variables in this order:

1. **Azure App Service Settings** (highest priority)
   - Set via Azure Portal or CLI
   - Automatically injected as environment variables

2. **Container Environment**
   - Set in Dockerfile (fallback)
   - Used if App Service settings not found

3. **Code Defaults**
   - Hardcoded in `api/main.py`
   - Last resort

---

## Security Best Practices

### ✅ DO:
- Store API keys in Azure Key Vault
- Use Managed Identity (no passwords needed)
- Enable HTTPS-only (already done in your script)
- Rotate secrets regularly
- Use different keys for staging/production
- Audit Key Vault access logs

### ❌ DON'T:
- Commit secrets to Git
- Store secrets in Docker images
- Share API keys via email/Slack
- Use production keys in development
- Log secrets to console

---

## Cost Breakdown

| Solution | Cost | Notes |
|----------|------|-------|
| **Key Vault** | **Free** | 10,000 operations/month free, then $0.03/10,000 |
| **App Settings** | **Free** | Included with App Service |
| **Managed Identity** | **Free** | No additional cost |

**Your estimated cost:** $0/month (well within free tier)

---

## Local vs Production Environment Variables

### Local Development (Current Setup ✅)
```bash
# docker-compose.yml
environment:
  - OPENAI_API_KEY=${OPENAI_API_KEY:-}  # From .env or shell
  - ENVIRONMENT=development
```

### Production (Recommended ✅)
```bash
# Azure App Service
OPENAI_API_KEY=@Microsoft.KeyVault(...)  # From Key Vault
ENVIRONMENT=production
PORT=8000
WEBSITES_PORT=8000
```

---

## Rotating Secrets

### With Key Vault (Easy):
```bash
# Update secret in Key Vault
az keyvault secret set \
    --vault-name powernova-kv \
    --name OPENAI-API-KEY \
    --value "sk-new-key"

# Restart app to pick up new value
az webapp restart \
    --name powernova-api \
    --resource-group powernova-rg
```

No code changes, no Docker rebuild needed!

### With App Settings (Manual):
```bash
# Update setting
az webapp config appsettings set \
    --name powernova-api \
    --resource-group powernova-rg \
    --settings OPENAI_API_KEY="sk-new-key"

# Restart app
az webapp restart \
    --name powernova-api \
    --resource-group powernova-rg
```

---

## Troubleshooting

### Issue: App can't read Key Vault secret

**Check 1: Managed Identity enabled?**
```bash
az webapp identity show \
    --name powernova-api \
    --resource-group powernova-rg
```

**Check 2: Access policy set?**
```bash
az keyvault show \
    --name powernova-kv \
    --query properties.accessPolicies
```

**Check 3: Correct secret URI?**
```bash
az keyvault secret show \
    --vault-name powernova-kv \
    --name OPENAI-API-KEY \
    --query id
```

### Issue: App Service can't connect to OpenAI

**Check environment variables:**
```bash
# View App Service logs
az webapp log tail \
    --name powernova-api \
    --resource-group powernova-rg
```

**Check if OPENAI_API_KEY is set:**
```bash
# SSH into container
az webapp ssh --name powernova-api --resource-group powernova-rg

# Inside container
echo $OPENAI_API_KEY  # Should show: sk-...
```

---

## Migration Path

### Current State (Your Setup):
```
✅ Local: .env file
✅ Production: App Service Settings
```

### Recommended Upgrade:
```
1. Run setup-keyvault.sh
2. Verify API still works
3. Remove OPENAI_API_KEY from .azure-api-deployment.conf
4. Document in README
```

**Time:** 5 minutes  
**Downtime:** < 30 seconds (during restart)  
**Risk:** Low (can rollback by changing App Setting)

---

## Quick Reference Commands

### View current settings:
```bash
az webapp config appsettings list \
    --name powernova-api \
    --resource-group powernova-rg \
    --output table
```

### Add new setting:
```bash
az webapp config appsettings set \
    --name powernova-api \
    --resource-group powernova-rg \
    --settings NEW_VAR="value"
```

### Delete setting:
```bash
az webapp config appsettings delete \
    --name powernova-api \
    --resource-group powernova-rg \
    --setting-names NEW_VAR
```

### List Key Vault secrets:
```bash
az keyvault secret list \
    --vault-name powernova-kv \
    --output table
```

---

## Summary

**For OPENAI_API_KEY:** Use Azure Key Vault  
**For other config:** Use App Service Settings  
**For local dev:** Use docker-compose environment variables  

**Next action:**
```bash
cd scripts
./setup-keyvault.sh
```

This gives you enterprise-grade security at no additional cost! 🔒
