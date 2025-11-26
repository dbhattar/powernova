#!/bin/bash

##############################################################################
# Azure PostgreSQL Flexible Server Deployment Script
# 
# This script deploys a PostgreSQL Flexible Server using ARM template
# 
# Usage:
#   ./deploy-postgresql.sh [resource-group] [location]
#
# Examples:
#   ./deploy-postgresql.sh                    # Use defaults
#   ./deploy-postgresql.sh powernova westus2  # Specify resource group and location
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${1:-powernova}"
LOCATION="${2:-westus2}"
TEMPLATE_FILE="azure-postgresql-deployment.json"
PARAMETERS_FILE="azure-postgresql-deployment.parameters.json"

# Functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Main script
print_header "Azure PostgreSQL Flexible Server Deployment"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed"
    echo "Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi
print_success "Azure CLI is installed"

# Check if logged in
print_info "Checking Azure login status..."
if ! az account show &> /dev/null; then
    print_warning "Not logged in to Azure"
    print_info "Logging in..."
    az login
fi
print_success "Logged in to Azure"

# Show current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
print_info "Current subscription: $SUBSCRIPTION"
read -p "Continue with this subscription? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Available subscriptions:"
    az account list --query "[].{Name:name, ID:id, Default:isDefault}" -o table
    read -p "Enter subscription name or ID: " SUB_INPUT
    az account set --subscription "$SUB_INPUT"
    print_success "Switched to subscription: $(az account show --query name -o tsv)"
fi

# Check if resource group exists
print_info "Checking resource group '$RESOURCE_GROUP'..."
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    print_warning "Resource group '$RESOURCE_GROUP' does not exist"
    read -p "Create it in '$LOCATION'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
        print_success "Resource group created"
    else
        print_error "Deployment cancelled"
        exit 1
    fi
else
    print_success "Resource group exists"
fi

# Check if template files exist
if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi
print_success "Template file found"

if [ ! -f "$PARAMETERS_FILE" ]; then
    print_error "Parameters file not found: $PARAMETERS_FILE"
    exit 1
fi
print_success "Parameters file found"

# Validate parameters
print_info "Checking parameters file..."
PASSWORD=$(jq -r '.parameters.administratorLoginPassword.value' "$PARAMETERS_FILE")
if [ "$PASSWORD" == "CHANGE_ME_SecureP@ssw0rd123" ]; then
    print_error "Please change the default password in $PARAMETERS_FILE"
    print_info "The password must be at least 8 characters and contain:"
    print_info "  - Uppercase letters"
    print_info "  - Lowercase letters"
    print_info "  - Numbers"
    exit 1
fi
print_success "Password has been customized"

# Get client IP for firewall rule
print_info "Getting your public IP address..."
CLIENT_IP=$(curl -s ifconfig.me)
if [ -n "$CLIENT_IP" ]; then
    print_success "Your IP: $CLIENT_IP"
    
    # Check if IP is set in parameters
    PARAM_IP=$(jq -r '.parameters.allowedClientIP.value' "$PARAMETERS_FILE")
    if [ "$PARAM_IP" == "" ] || [ "$PARAM_IP" == "null" ]; then
        print_warning "No client IP set in parameters file"
        read -p "Add your IP ($CLIENT_IP) to firewall rules? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Update parameters file
            jq ".parameters.allowedClientIP.value = \"$CLIENT_IP\"" "$PARAMETERS_FILE" > "${PARAMETERS_FILE}.tmp"
            mv "${PARAMETERS_FILE}.tmp" "$PARAMETERS_FILE"
            print_success "Updated parameters file with your IP"
        fi
    fi
fi

# Show deployment configuration
print_header "Deployment Configuration"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Server Name: $(jq -r '.parameters.serverName.value' "$PARAMETERS_FILE")"
echo "Database Name: $(jq -r '.parameters.databaseName.value' "$PARAMETERS_FILE")"
echo "PostgreSQL Version: $(jq -r '.parameters.postgresVersion.value' "$PARAMETERS_FILE")"
echo "SKU: $(jq -r '.parameters.skuName.value' "$PARAMETERS_FILE")"
echo "Storage: $(jq -r '.parameters.storageSizeGB.value' "$PARAMETERS_FILE") GB"
echo "Backup Retention: $(jq -r '.parameters.backupRetentionDays.value' "$PARAMETERS_FILE") days"
echo ""

read -p "Proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Deploy template
print_header "Starting Deployment"
print_info "This may take 5-10 minutes..."

DEPLOYMENT_NAME="postgresql-deployment-$(date +%Y%m%d-%H%M%S)"

if az deployment group create \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAMETERS_FILE" \
    --output table; then
    
    print_success "Deployment completed successfully!"
    
    # Get outputs
    print_header "Deployment Outputs"
    
    SERVER_FQDN=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.serverFQDN.value -o tsv)
    
    DB_NAME=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.databaseName.value -o tsv)
    
    ADMIN_USER=$(jq -r '.parameters.administratorLogin.value' "$PARAMETERS_FILE")
    
    echo -e "${GREEN}Server FQDN:${NC} $SERVER_FQDN"
    echo -e "${GREEN}Database Name:${NC} $DB_NAME"
    echo -e "${GREEN}Admin Username:${NC} $ADMIN_USER"
    echo ""
    
    # Generate connection string
    print_header "Next Steps"
    
    echo "1. Test connection:"
    echo -e "${YELLOW}   psql \"postgresql://${ADMIN_USER}@${SERVER_FQDN}:5432/${DB_NAME}?sslmode=require\"${NC}"
    echo ""
    
    echo "2. Install pgvector extension:"
    echo -e "${YELLOW}   CREATE EXTENSION IF NOT EXISTS vector;${NC}"
    echo ""
    
    echo "3. Update DATABASE_URL environment variable:"
    echo -e "${YELLOW}   postgresql://${ADMIN_USER}:<PASSWORD>@${SERVER_FQDN}:5432/${DB_NAME}?sslmode=require${NC}"
    echo ""
    
    echo "4. Run database migrations:"
    echo -e "${YELLOW}   cd api && alembic upgrade head${NC}"
    echo ""
    
    print_info "For migration from Supabase, see: docs/SUPABASE-TO-AZURE-MIGRATION-PLAN.md"
    
else
    print_error "Deployment failed"
    print_info "Check the error messages above for details"
    exit 1
fi

print_header "Deployment Complete"
print_success "PostgreSQL Flexible Server is ready!"
