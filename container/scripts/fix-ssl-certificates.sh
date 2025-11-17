#!/bin/bash
# Fix SSL Certificates for powernova.ai
# This script creates and binds Azure Managed Certificates

set -e

RESOURCE_GROUP="powernova"
APP_NAME="powernova"
DOMAIN_APEX="powernova.ai"
DOMAIN_WWW="www.powernova.ai"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================="
echo "SSL Certificate Fix for powernova.ai"
echo -e "==================================${NC}"
echo ""

# Check if Azure CLI is logged in
if ! az account show > /dev/null 2>&1; then
    echo -e "${RED}✗ Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}"
echo ""

# Show current state
echo -e "${BLUE}Current hostname bindings:${NC}"
az webapp config hostname list \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --query "[].{Hostname:name, SSL:sslState, Thumbprint:thumbprint}" -o table

echo ""
echo -e "${BLUE}Current SSL certificates:${NC}"
az webapp config ssl list --resource-group $RESOURCE_GROUP -o table || echo "No certificates found"

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Step 1: Creating Managed Certificates${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Create certificate for apex domain
echo -e "${BLUE}Creating certificate for $DOMAIN_APEX...${NC}"
if az webapp config ssl create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --hostname $DOMAIN_APEX 2>&1; then
  echo -e "${GREEN}✓ Certificate created for $DOMAIN_APEX${NC}"
else
  echo -e "${YELLOW}⚠️  Certificate creation failed or already exists for $DOMAIN_APEX${NC}"
fi

echo ""

# Create certificate for www subdomain
echo -e "${BLUE}Creating certificate for $DOMAIN_WWW...${NC}"
if az webapp config ssl create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --hostname $DOMAIN_WWW 2>&1; then
  echo -e "${GREEN}✓ Certificate created for $DOMAIN_WWW${NC}"
else
  echo -e "${YELLOW}⚠️  Certificate creation failed or already exists for $DOMAIN_WWW${NC}"
fi

echo ""
echo -e "${BLUE}Waiting 30 seconds for certificate provisioning...${NC}"
sleep 30

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Step 2: Binding Certificates${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Get and bind apex domain certificate
echo -e "${BLUE}Getting certificate thumbprint for $DOMAIN_APEX...${NC}"
THUMBPRINT_APEX=$(az webapp config ssl list \
  --resource-group $RESOURCE_GROUP \
  --query "[?subjectName=='$DOMAIN_APEX'].thumbprint" -o tsv | head -1)

if [ -n "$THUMBPRINT_APEX" ]; then
  echo -e "${GREEN}✓ Found certificate: $THUMBPRINT_APEX${NC}"
  echo -e "${BLUE}Binding certificate for $DOMAIN_APEX...${NC}"
  
  if az webapp config ssl bind \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --certificate-thumbprint $THUMBPRINT_APEX \
    --ssl-type SNI; then
    echo -e "${GREEN}✓ Certificate bound successfully for $DOMAIN_APEX${NC}"
  else
    echo -e "${RED}✗ Failed to bind certificate for $DOMAIN_APEX${NC}"
  fi
else
  echo -e "${RED}✗ No certificate found for $DOMAIN_APEX${NC}"
  echo -e "${YELLOW}This might mean:${NC}"
  echo "  1. DNS verification failed"
  echo "  2. Domain ownership not verified"
  echo "  3. Certificate issuance in progress"
  echo ""
  echo "Check DNS configuration:"
  nslookup $DOMAIN_APEX
fi

echo ""

# Get and bind www subdomain certificate
echo -e "${BLUE}Getting certificate thumbprint for $DOMAIN_WWW...${NC}"
THUMBPRINT_WWW=$(az webapp config ssl list \
  --resource-group $RESOURCE_GROUP \
  --query "[?subjectName=='$DOMAIN_WWW'].thumbprint" -o tsv | head -1)

if [ -n "$THUMBPRINT_WWW" ]; then
  echo -e "${GREEN}✓ Found certificate: $THUMBPRINT_WWW${NC}"
  echo -e "${BLUE}Binding certificate for $DOMAIN_WWW...${NC}"
  
  if az webapp config ssl bind \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --certificate-thumbprint $THUMBPRINT_WWW \
    --ssl-type SNI; then
    echo -e "${GREEN}✓ Certificate bound successfully for $DOMAIN_WWW${NC}"
  else
    echo -e "${RED}✗ Failed to bind certificate for $DOMAIN_WWW${NC}"
  fi
else
  echo -e "${RED}✗ No certificate found for $DOMAIN_WWW${NC}"
  echo -e "${YELLOW}This might mean:${NC}"
  echo "  1. DNS verification failed"
  echo "  2. Domain ownership not verified"
  echo "  3. Certificate issuance in progress"
  echo ""
  echo "Check DNS configuration:"
  nslookup $DOMAIN_WWW
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Step 3: Enabling HTTPS-Only${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

if az webapp update \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --https-only true > /dev/null 2>&1; then
  echo -e "${GREEN}✓ HTTPS-only mode enabled${NC}"
else
  echo -e "${YELLOW}⚠️  Could not enable HTTPS-only mode${NC}"
fi

echo ""
echo -e "${BLUE}=================================="
echo "Final Configuration"
echo -e "==================================${NC}"
echo ""

az webapp config hostname list \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --query "[].{Hostname:name, SSL:sslState, Thumbprint:thumbprint}" -o table

echo ""
echo -e "${BLUE}SSL Certificates:${NC}"
az webapp config ssl list \
  --resource-group $RESOURCE_GROUP \
  --query "[].{SubjectName:subjectName, Thumbprint:thumbprint, ExpirationDate:expirationDate}" -o table

echo ""
echo -e "${GREEN}=================================="
echo "✓ SSL Certificate Configuration Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "${BLUE}Test your sites:${NC}"
echo "  https://powernova.ai"
echo "  https://www.powernova.ai"
echo ""
echo -e "${BLUE}Quick test:${NC}"
echo "  curl -I https://powernova.ai"
echo "  curl -I https://www.powernova.ai"
echo ""

# Try to test
echo -e "${BLUE}Testing HTTPS connectivity...${NC}"
if curl -I https://powernova.ai 2>&1 | grep -q "200\|301\|302"; then
  echo -e "${GREEN}✓ https://powernova.ai is accessible${NC}"
else
  echo -e "${YELLOW}⚠️  https://powernova.ai might not be ready yet (wait 5-10 minutes)${NC}"
fi

if curl -I https://www.powernova.ai 2>&1 | grep -q "200\|301\|302"; then
  echo -e "${GREEN}✓ https://www.powernova.ai is accessible${NC}"
else
  echo -e "${YELLOW}⚠️  https://www.powernova.ai might not be ready yet (wait 5-10 minutes)${NC}"
fi

echo ""
echo -e "${YELLOW}NOTE: If certificates didn't bind, check:${NC}"
echo "  1. DNS is correctly configured (CNAME to powernova.azurewebsites.net)"
echo "  2. No Let's Encrypt validation records in DNS"
echo "  3. Domain verification TXT record exists (asuid.powernova)"
echo ""
echo "Get verification ID:"
echo "  az webapp show --resource-group powernova --name powernova --query customDomainVerificationId -o tsv"
echo ""
