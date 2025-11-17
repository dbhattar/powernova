# Fixing SSL Certificate Issues for powernova.ai

## 🔍 Problem Identified

Your domains `powernova.ai` and `www.powernova.ai` are configured on the Azure App Service but have **NO SSL certificate** bound to them:

```json
"sslState": null,
"thumbprint": null
```

This is likely because:
1. You previously used Let's Encrypt (external certificate provider)
2. Azure App Service's built-in managed certificate is trying to issue
3. There's a conflict or the previous Let's Encrypt validation records are interfering

## ✅ Solution: Use Azure Managed Certificates

Azure App Service can automatically issue and manage free SSL certificates. Here's how to fix it:

### Step 1: Remove Old Let's Encrypt Configuration

If you have any TXT records or ACME challenge records from Let's Encrypt in your DNS, remove them:

**Check your DNS provider** (where you registered powernova.ai) for these records:
- `_acme-challenge.powernova.ai` (TXT record)
- `_acme-challenge.www.powernova.ai` (TXT record)
- Any other Let's Encrypt validation records

**Remove them** - they're no longer needed with Azure Managed Certificates.

### Step 2: Verify DNS Configuration

Make sure your DNS has these records:

```
Type    Name              Value                           TTL
----    ----              -----                           ---
CNAME   powernova.ai      powernova.azurewebsites.net     3600
CNAME   www               powernova.azurewebsites.net     3600
TXT     asuid.powernova   <your-custom-domain-verification-id>  3600
```

**Get your verification ID:**
```bash
az webapp show --resource-group powernova --name powernova --query customDomainVerificationId -o tsv
```

### Step 3: Create Managed Certificates

Run these commands to create Azure-managed SSL certificates:

```bash
# For powernova.ai
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname powernova.ai

# For www.powernova.ai
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname www.powernova.ai
```

### Step 4: Bind Certificates to Hostnames

After the certificates are created (takes 1-2 minutes):

```bash
# Get the certificate thumbprint for powernova.ai
THUMBPRINT_APEX=$(az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='powernova.ai'].thumbprint" -o tsv)

# Bind certificate to powernova.ai
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint $THUMBPRINT_APEX \
  --ssl-type SNI

# Get the certificate thumbprint for www.powernova.ai
THUMBPRINT_WWW=$(az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='www.powernova.ai'].thumbprint" -o tsv)

# Bind certificate to www.powernova.ai
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint $THUMBPRINT_WWW \
  --ssl-type SNI
```

### Step 5: Enable HTTPS Only

```bash
az webapp update \
  --resource-group powernova \
  --name powernova \
  --https-only true
```

## 🚨 If Automatic Certificate Creation Fails

If Azure can't automatically create the certificate, you might need to:

### Option A: Remove and Re-add Custom Domain

```bash
# Remove the custom domain
az webapp config hostname delete \
  --resource-group powernova \
  --webapp-name powernova \
  --hostname powernova.ai

# Wait 5 minutes for DNS propagation

# Add it back
az webapp config hostname add \
  --resource-group powernova \
  --webapp-name powernova \
  --hostname powernova.ai

# Create and bind certificate
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname powernova.ai

# Get thumbprint and bind
THUMBPRINT=$(az webapp config ssl list \
  --resource-group powernova \
  --query "[?subjectName=='powernova.ai'].thumbprint" -o tsv)

az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint $THUMBPRINT \
  --ssl-type SNI
```

Repeat for `www.powernova.ai`.

### Option B: Use App Service Certificate (Paid)

If managed certificates don't work, you can purchase an App Service Certificate:

```bash
# Create App Service Certificate (costs ~$75/year)
az appservice domain create \
  --resource-group powernova \
  --hostname powernova.ai \
  --contact-info @contact.json \
  --accept-terms
```

### Option C: Upload Your Own Certificate

If you have a certificate from another provider (GoDaddy, Namecheap, etc.):

```bash
# Upload PFX certificate
az webapp config ssl upload \
  --resource-group powernova \
  --name powernova \
  --certificate-file /path/to/certificate.pfx \
  --certificate-password <password>

# Bind it
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI
```

## 🔧 Complete Fix Script

Save this as `scripts/fix-ssl-certificates.sh`:

```bash
#!/bin/bash
set -e

RESOURCE_GROUP="powernova"
APP_NAME="powernova"
DOMAIN_APEX="powernova.ai"
DOMAIN_WWW="www.powernova.ai"

echo "🔧 Fixing SSL Certificates for powernova.ai"
echo "=========================================="
echo ""

# Check if domains are already added
echo "Checking current hostname bindings..."
az webapp config hostname list \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --query "[].{Hostname:name, SSL:sslState}" -o table

echo ""
echo "Creating managed certificates..."

# Create certificate for apex domain
echo "Creating certificate for $DOMAIN_APEX..."
az webapp config ssl create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --hostname $DOMAIN_APEX || echo "Certificate might already exist"

# Create certificate for www subdomain
echo "Creating certificate for $DOMAIN_WWW..."
az webapp config ssl create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --hostname $DOMAIN_WWW || echo "Certificate might already exist"

echo ""
echo "Waiting 30 seconds for certificate provisioning..."
sleep 30

echo ""
echo "Binding certificates..."

# Get and bind apex domain certificate
THUMBPRINT_APEX=$(az webapp config ssl list \
  --resource-group $RESOURCE_GROUP \
  --query "[?subjectName=='$DOMAIN_APEX'].thumbprint" -o tsv | head -1)

if [ -n "$THUMBPRINT_APEX" ]; then
  echo "Binding certificate for $DOMAIN_APEX (thumbprint: $THUMBPRINT_APEX)"
  az webapp config ssl bind \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --certificate-thumbprint $THUMBPRINT_APEX \
    --ssl-type SNI
else
  echo "⚠️  No certificate found for $DOMAIN_APEX"
fi

# Get and bind www subdomain certificate
THUMBPRINT_WWW=$(az webapp config ssl list \
  --resource-group $RESOURCE_GROUP \
  --query "[?subjectName=='$DOMAIN_WWW'].thumbprint" -o tsv | head -1)

if [ -n "$THUMBPRINT_WWW" ]; then
  echo "Binding certificate for $DOMAIN_WWW (thumbprint: $THUMBPRINT_WWW)"
  az webapp config ssl bind \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --certificate-thumbprint $THUMBPRINT_WWW \
    --ssl-type SNI
else
  echo "⚠️  No certificate found for $DOMAIN_WWW"
fi

echo ""
echo "Enabling HTTPS-only..."
az webapp update \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --https-only true

echo ""
echo "✅ SSL Configuration Complete!"
echo ""
echo "Verifying..."
az webapp config hostname list \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --query "[].{Hostname:name, SSL:sslState, Thumbprint:thumbprint}" -o table

echo ""
echo "Test your sites:"
echo "  https://powernova.ai"
echo "  https://www.powernova.ai"
```

## 📋 DNS Requirements Checklist

Make sure your DNS provider has these records:

- [ ] `CNAME` for `powernova.ai` → `powernova.azurewebsites.net`
- [ ] `CNAME` for `www` → `powernova.azurewebsites.net`
- [ ] `TXT` for `asuid.powernova` → (get from `az webapp show --query customDomainVerificationId`)
- [ ] No conflicting `A` records
- [ ] No Let's Encrypt `_acme-challenge` TXT records
- [ ] No CAA records blocking Let's Encrypt/DigiCert

## 🐛 Troubleshooting

### Error: "Cannot create certificate"

**Cause**: DNS not properly configured or domain verification failing

**Fix**:
```bash
# Get verification ID
VERIFICATION_ID=$(az webapp show \
  --resource-group powernova \
  --name powernova \
  --query customDomainVerificationId -o tsv)

echo "Add this TXT record to your DNS:"
echo "  Name: asuid.powernova.ai"
echo "  Value: $VERIFICATION_ID"
```

### Error: "Domain validation failed"

**Cause**: DNS propagation not complete or wrong CNAME

**Fix**:
```bash
# Verify DNS
nslookup powernova.ai
nslookup www.powernova.ai

# Should point to: powernova.azurewebsites.net

# Wait 10-15 minutes for DNS propagation
# Try again
```

### Error: "Certificate already exists"

**Cause**: Old Let's Encrypt certificate in Azure

**Fix**:
```bash
# List all certificates
az webapp config ssl list --resource-group powernova

# Delete old certificate
az webapp config ssl delete \
  --resource-group powernova \
  --certificate-thumbprint <old-thumbprint>

# Create new one
az webapp config ssl create \
  --resource-group powernova \
  --name powernova \
  --hostname powernova.ai
```

### Certificate Created but Not Binding

**Cause**: Timing issue or permission problem

**Fix**:
```bash
# Wait 5 minutes after certificate creation
sleep 300

# Try binding again
az webapp config ssl bind \
  --resource-group powernova \
  --name powernova \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI
```

## 🎯 Quick Fix (Try This First)

Run these commands in order:

```bash
# 1. Create certificates
az webapp config ssl create --resource-group powernova --name powernova --hostname powernova.ai
az webapp config ssl create --resource-group powernova --name powernova --hostname www.powernova.ai

# 2. Wait 60 seconds
sleep 60

# 3. Get thumbprints
THUMB1=$(az webapp config ssl list --resource-group powernova --query "[?subjectName=='powernova.ai'].thumbprint" -o tsv)
THUMB2=$(az webapp config ssl list --resource-group powernova --query "[?subjectName=='www.powernova.ai'].thumbprint" -o tsv)

# 4. Bind certificates
az webapp config ssl bind --resource-group powernova --name powernova --certificate-thumbprint $THUMB1 --ssl-type SNI
az webapp config ssl bind --resource-group powernova --name powernova --certificate-thumbprint $THUMB2 --ssl-type SNI

# 5. Enable HTTPS
az webapp update --resource-group powernova --name powernova --https-only true

# 6. Verify
echo "Testing..."
curl -I https://powernova.ai
curl -I https://www.powernova.ai
```

## 📞 Still Having Issues?

If certificates still won't provision:

1. **Check Azure Portal**: Go to your App Service → Custom domains → Look for error messages
2. **Check DNS**: Use https://dnschecker.org to verify your DNS is correct globally
3. **Remove Let's Encrypt**: Make sure all Let's Encrypt validation records are gone
4. **Wait for DNS**: DNS changes can take up to 48 hours (usually 5-15 minutes)
5. **Contact Support**: Azure support can manually trigger certificate issuance

## ✅ Expected Final State

After fixing, you should see:

```bash
az webapp config hostname list --resource-group powernova --webapp-name powernova

# Output should show:
# powernova.ai          → sslState: SniEnabled
# www.powernova.ai      → sslState: SniEnabled
```

And your sites should work with HTTPS:
- ✅ https://powernova.ai
- ✅ https://www.powernova.ai

Good luck! 🚀
