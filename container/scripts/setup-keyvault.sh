#!/bin/bash

##############################################################################
# PowerNOVA - Azure Key Vault Setup
# 
# Sets up Azure Key Vault for secure secret management
# This is a one-time setup script
#
# Usage:
#   ./setup-keyvault.sh
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Azure Key Vault Setup${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Load configuration
if [ ! -f ".azure-api-deployment.conf" ]; then
    echo "Error: .azure-api-deployment.conf not found"
    echo "Please run azure-deploy-api.sh first"
    exit 1
fi

source .azure-api-deployment.conf

# Configuration
KEYVAULT_NAME="powernova-kv-$(openssl rand -hex 4)"  # Random suffix for uniqueness
LOCATION="${LOCATION:-eastus}"

print_info "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Key Vault Name: $KEYVAULT_NAME"
echo "  Location: $LOCATION"
echo ""

read -p "Continue? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Aborted"
    exit 0
fi

# Create Key Vault
print_info "Creating Key Vault..."
az keyvault create \
    --name "$KEYVAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --enable-rbac-authorization false \
    --enabled-for-deployment true \
    --enabled-for-template-deployment true

print_success "Key Vault created: $KEYVAULT_NAME"

# Store OpenAI API Key
print_info "Storing OpenAI API Key in Key Vault..."
az keyvault secret set \
    --vault-name "$KEYVAULT_NAME" \
    --name "OPENAI-API-KEY" \
    --value "$OPENAI_API_KEY"

print_success "Secret stored securely"

# Enable managed identity for App Service
print_info "Enabling managed identity for App Service..."
PRINCIPAL_ID=$(az webapp identity assign \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query principalId -o tsv)

print_success "Managed identity enabled"

# Grant App Service access to Key Vault
print_info "Granting App Service access to Key Vault..."
az keyvault set-policy \
    --name "$KEYVAULT_NAME" \
    --object-id "$PRINCIPAL_ID" \
    --secret-permissions get list

print_success "Access granted"

# Get Key Vault secret URI
SECRET_URI=$(az keyvault secret show \
    --vault-name "$KEYVAULT_NAME" \
    --name "OPENAI-API-KEY" \
    --query id -o tsv)

print_info "Secret URI: $SECRET_URI"

# Update App Service to use Key Vault reference
print_info "Updating App Service configuration..."
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=$SECRET_URI)" \
        PORT="8000" \
        ENVIRONMENT="production" \
        WEBSITES_PORT="8000"

print_success "App Service configured to use Key Vault"

# Restart App Service
print_info "Restarting App Service..."
az webapp restart \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP"

print_success "App Service restarted"

echo ""
print_success "Key Vault setup complete! 🔒"
echo ""
echo "Summary:"
echo "  ✓ Key Vault created: $KEYVAULT_NAME"
echo "  ✓ OpenAI API Key stored securely"
echo "  ✓ Managed identity enabled"
echo "  ✓ App Service configured"
echo ""
print_info "Benefits:"
echo "  - API keys never stored in code or config files"
echo "  - Centralized secret management"
echo "  - Audit logging for all secret access"
echo "  - Easy secret rotation"
echo ""
print_warning "Save this for future reference:"
echo "  Key Vault: $KEYVAULT_NAME"
echo "  Secret URI: $SECRET_URI"
echo ""

# Update config file with Key Vault info
cat >> .azure-api-deployment.conf << EOF

# Key Vault Configuration
KEYVAULT_NAME="$KEYVAULT_NAME"
SECRET_URI="$SECRET_URI"
EOF

print_success "Configuration saved to .azure-api-deployment.conf"
