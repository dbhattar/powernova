# SSL Certificate Issue - Quick Fix Guide

## 🔍 Problem Summary

Your domains (`powernova.ai` and `www.powernova.ai`) are added to Azure App Service but have **NO SSL certificates** bound to them. This is likely due to a conflict with previous Let's Encrypt configuration.

## ✅ Solution Steps

### Step 1: Fix DNS Configuration

Go to your DNS provider (where you registered powernova.ai) and ensure you have these EXACT records:

```
Type    Name                    Value                               TTL
----    ----                    -----                               ---
CNAME   powernova.ai           powernova.azurewebsites.net         3600
CNAME   www                    powernova.azurewebsites.net         3600
TXT     asuid                  0BB56FAA1F901FCCFAF53DE965A174677FF3675E9F01EF4F54A0BA5F243682E8    3600
```

**IMPORTANT**: Remove any of these if they exist:
- `_acme-challenge.powernova.ai` (TXT record from Let's Encrypt)
- `_acme-challenge.www.powernova.ai` (TXT record from Let's Encrypt)
- Any `A` records for `powernova.ai` or `www`

### Step 2: Wait for DNS Propagation

After updating DNS, wait 5-15 minutes for propagation. Verify with:

```bash
nslookup powernova.ai
# Should show: canonical name = powernova.azurewebsites.net

nslookup www.powernova.ai  
# Should show: canonical name = powernova.azurewebsites.net
```

### Step 3: Run the Fix Script

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
./scripts/fix-ssl-certificates.sh
```

This script will:
1. Create Azure Managed Certificates for both domains
2. Bind the certificates to your App Service
3. Enable HTTPS-only mode
4. Verify the configuration

## 🎯 Manual Fix (If Script Fails)

If the automated script doesn't work, run these commands manually:

```bash
# Create certificates
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname powernova.ai

az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname www.powernova.ai

# Wait 60 seconds
sleep 60

# Get thumbprints
THUMB1=$(az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='powernova.ai'].thumbprint" -o tsv)

THUMB2=$(az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='www.powernova.ai'].thumbprint" -o tsv)

# Bind certificates
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint $THUMB1 \
  --ssl-type SNI

az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint $THUMB2 \
  --ssl-type SNI

# Enable HTTPS-only
az webapp update \
  --resource-group powernova \
  --name powernova \
  --https-only true
```

## 🔍 Verification

After running the fix, verify with:

```bash
# Check certificate bindings
az webapp config hostname list \
  --resource-group powernova \
  --webapp-name powernova \
  --query "[].{Hostname:name, SSL:sslState, Thumbprint:thumbprint}" -o table

# Should show:
# powernova.ai          SniEnabled    <thumbprint>
# www.powernova.ai      SniEnabled    <thumbprint>

# Test HTTPS
curl -I https://powernova.ai
curl -I https://www.powernova.ai
```

## 🐛 Troubleshooting

### Certificate Creation Fails

**Error**: "Cannot create managed certificate"

**Solution**:
1. Verify DNS records are correct (see Step 1)
2. Wait 15 minutes for DNS propagation
3. Check no conflicting `A` records exist
4. Remove any Let's Encrypt `_acme-challenge` TXT records

### Certificate Created But Can't Bind

**Error**: "Certificate not found" or "Invalid thumbprint"

**Solution**:
```bash
# List all certificates
az webapp config ssl list --resource-group powernova -o table

# If you see the certificate, get its exact thumbprint
az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='powernova.ai'].{Subject:subjectName, Thumbprint:thumbprint}" -o table

# Use the exact thumbprint to bind
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint <EXACT_THUMBPRINT> \
  --ssl-type SNI
```

### Domain Verification Fails

**Error**: "Unable to verify domain ownership"

**Solution**:
1. Make sure this TXT record exists in your DNS:
   ```
   Name:  asuid
   Value: 0BB56FAA1F901FCCFAF53DE965A174677FF3675E9F01EF4F54A0BA5F243682E8
   ```
2. Wait 15 minutes
3. Verify with: `nslookup -type=TXT asuid.powernova.ai`
4. Try certificate creation again

### Old Let's Encrypt Certificate Interfering

**Solution**:
```bash
# List all certificates
az webapp config ssl list --resource-group powernova

# Delete old Let's Encrypt certificate
az webapp config ssl delete \
  --resource-group powernova \
  --certificate-thumbprint <OLD_LETSENCRYPT_THUMBPRINT>

# Remove and re-add the domain
az webapp config hostname delete \
  --resource-group powernova \
  --webapp-name powernova \
  --hostname powernova.ai

# Wait 5 minutes

az webapp config hostname add \
  --resource-group powernova \
  --webapp-name powernova \
  --hostname powernova.ai

# Create new certificate
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname powernova.ai
```

## 📋 Pre-Flight Checklist

Before running the fix, ensure:

- [ ] DNS has CNAME records pointing to `powernova.azurewebsites.net`
- [ ] DNS has TXT record `asuid` with verification ID
- [ ] No `A` records for `powernova.ai` or `www.powernova.ai`
- [ ] No Let's Encrypt `_acme-challenge` TXT records
- [ ] DNS changes have propagated (use https://dnschecker.org)
- [ ] Azure CLI is logged in (`az account show`)
- [ ] You have permissions on the `powernova` resource group

## 🎉 Expected Result

After successful fix:

1. **Certificates Created**: Two managed certificates appear in your SSL settings
2. **HTTPS Enabled**: Both domains accessible via HTTPS
3. **Auto-Redirect**: HTTP automatically redirects to HTTPS
4. **Green Lock**: Browser shows secure connection
5. **Auto-Renewal**: Azure automatically renews certificates before expiration

Test URLs:
- ✅ https://powernova.ai
- ✅ https://www.powernova.ai
- ✅ http://powernova.ai → redirects to HTTPS
- ✅ http://www.powernova.ai → redirects to HTTPS

## 📞 Need Help?

**View detailed documentation:**
```bash
cat SSL-CERTIFICATE-FIX.md
```

**Check Azure Portal:**
1. Go to Azure Portal → App Services → powernova
2. Navigate to "Custom domains"
3. Look for error messages or warnings
4. Check SSL certificate status

**DNS Verification:**
- Use https://dnschecker.org to verify DNS globally
- Check with: `dig powernova.ai` or `nslookup powernova.ai`

**Still having issues?**
The problem is 99% likely to be:
1. DNS not configured correctly
2. DNS not propagated yet (wait 15 minutes)
3. Old Let's Encrypt records interfering

---

**Quick Start:**
```bash
./scripts/fix-ssl-certificates.sh
```

Good luck! 🚀
