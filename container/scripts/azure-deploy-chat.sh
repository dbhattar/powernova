#!/bin/bash

##############################################################################
# PowerNOVA Chat App - Azure Deployment Script
# 
# This script deploys the chat application (app.powernova.ai) to Azure
# as a separate App Service from the landing page.
#
# Prerequisites:
# - Azure CLI installed and logged in
# - Docker installed
# - Existing Azure resources (or will create new ones)
#
# Usage:
#   ./azure-deploy-chat.sh              # Interactive deployment
#   ./azure-deploy-chat.sh --update     # Update existing deployment
#   ./azure-deploy-chat.sh --help       # Show help
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration file
CONFIG_FILE=".azure-chat-deployment.conf"

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  PowerNOVA Chat App Deployment${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}== $1 ==${NC}"
    echo ""
}

show_help() {
    cat << EOF
PowerNOVA Chat App - Azure Deployment Script

USAGE:
    ./azure-deploy-chat.sh [OPTIONS]

OPTIONS:
    --update        Update existing deployment (skip resource creation)
    --help          Show this help message

DESCRIPTION:
    Deploys the PowerNOVA chat application to Azure App Service.
    
    This script will:
    1. Check prerequisites (Azure CLI, Docker)
    2. Prompt for configuration (or use existing)
    3. Create Azure resources (if needed)
    4. Build and push Docker image to ACR
    5. Deploy to App Service
    6. Configure custom domain (app.powernova.ai)

EXAMPLES:
    # First-time deployment
    ./azure-deploy-chat.sh

    # Update existing deployment with new code
    ./azure-deploy-chat.sh --update

CONFIGURATION:
    Configuration is saved to: $CONFIG_FILE
    This allows quick updates without re-entering values.

CUSTOM DOMAIN:
    After deployment, configure DNS:
    
    1. Add CNAME record:
       app.powernova.ai → <webapp-name>.azurewebsites.net
    
    2. Run this script to bind the domain:
       az webapp config hostname add \\
         --webapp-name <webapp-name> \\
         --resource-group <resource-group> \\
         --hostname app.powernova.ai

EOF
    exit 0
}

##############################################################################
# Prerequisites Check
##############################################################################

check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        echo "Install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI installed"
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure"
        echo "Please run: az login"
        exit 1
    fi
    print_success "Logged in to Azure"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Install it from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running"
        echo "Please start Docker Desktop"
        exit 1
    fi
    print_success "Docker is running"
}

##############################################################################
# Configuration Management
##############################################################################

load_config() {
    if [ -f "$PROJECT_ROOT/$CONFIG_FILE" ]; then
        print_info "Loading existing configuration from $CONFIG_FILE"
        source "$PROJECT_ROOT/$CONFIG_FILE"
        return 0
    fi
    return 1
}

save_config() {
    cat > "$PROJECT_ROOT/$CONFIG_FILE" << EOF
# PowerNOVA Chat App Azure Deployment Configuration
# Generated: $(date)

RESOURCE_GROUP="$RESOURCE_GROUP"
LOCATION="$LOCATION"
ACR_NAME="$ACR_NAME"
APP_SERVICE_PLAN="$APP_SERVICE_PLAN"
WEBAPP_NAME="$WEBAPP_NAME"
SKU="$SKU"
EOF
    print_success "Configuration saved to $CONFIG_FILE"
}

##############################################################################
# Interactive Configuration
##############################################################################

prompt_config() {
    print_section "Configuration"
    
    # Resource Group
    read -p "Resource Group name (default: powernova-rg): " input
    RESOURCE_GROUP=${input:-powernova-rg}
    
    # Location
    echo ""
    print_info "Popular locations: eastus, westus2, westeurope, southeastasia"
    read -p "Azure Location (default: eastus): " input
    LOCATION=${input:-eastus}
    
    # Container Registry
    echo ""
    read -p "Azure Container Registry name (default: powernovachatacr): " input
    ACR_NAME=${input:-powernovachatacr}
    
    # App Service Plan
    echo ""
    print_info "You can use an existing App Service Plan to save costs"
    read -p "App Service Plan name (default: powernova-plan): " input
    APP_SERVICE_PLAN=${input:-powernova-plan}
    
    # Web App Name
    echo ""
    read -p "Web App name (must be globally unique, default: powernova-chat-app): " input
    WEBAPP_NAME=${input:-powernova-chat-app}
    
    # SKU Selection
    echo ""
    print_info "App Service Plan SKU (pricing tier):"
    echo "  F1  - Free tier (limited, no custom domains)"
    echo "  B1  - Basic (~\$13/month, custom domains supported)"
    echo "  S1  - Standard (~\$70/month)"
    echo "  P1V2 - Premium (~\$146/month)"
    read -p "Select SKU (default: B1): " input
    SKU=${input:-B1}
    
    # Confirmation
    echo ""
    print_section "Configuration Summary"
    echo "Resource Group:    $RESOURCE_GROUP"
    echo "Location:          $LOCATION"
    echo "ACR Name:          $ACR_NAME"
    echo "App Service Plan:  $APP_SERVICE_PLAN"
    echo "Web App Name:      $WEBAPP_NAME"
    echo "SKU:               $SKU"
    echo ""
    
    read -p "Proceed with this configuration? (y/n): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi
    
    save_config
}

##############################################################################
# Azure Resource Creation
##############################################################################

create_resource_group() {
    print_section "Creating Resource Group"
    
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        print_warning "Resource group '$RESOURCE_GROUP' already exists"
    else
        az group create \
            --name "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --output none
        print_success "Resource group created: $RESOURCE_GROUP"
    fi
}

create_container_registry() {
    print_section "Setting Up Azure Container Registry"
    
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null 2>&1; then
        print_warning "ACR '$ACR_NAME' already exists"
    else
        print_info "Creating Azure Container Registry (this may take a few minutes)..."
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku Basic \
            --admin-enabled true \
            --output none
        print_success "Container Registry created: $ACR_NAME"
    fi
}

create_app_service_plan() {
    print_section "Creating App Service Plan"
    
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null 2>&1; then
        print_warning "App Service Plan '$APP_SERVICE_PLAN' already exists"
        print_info "Will use existing plan (can host multiple apps)"
    else
        print_info "Creating App Service Plan with SKU: $SKU..."
        az appservice plan create \
            --name "$APP_SERVICE_PLAN" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --is-linux \
            --sku "$SKU" \
            --output none
        print_success "App Service Plan created: $APP_SERVICE_PLAN"
    fi
}

create_web_app() {
    print_section "Creating Web App"
    
    if az webapp show --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null 2>&1; then
        print_warning "Web App '$WEBAPP_NAME' already exists"
    else
        print_info "Creating Web App for chat application..."
        az webapp create \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN" \
            --name "$WEBAPP_NAME" \
            --deployment-container-image-name "nginx:alpine" \
            --output none
        print_success "Web App created: $WEBAPP_NAME"
    fi
}

##############################################################################
# Docker Image Build and Push
##############################################################################

build_and_push_image() {
    print_section "Building and Pushing Docker Image"
    
    cd "$PROJECT_ROOT"
    
    IMAGE_NAME="powernova-chat-app"
    IMAGE_TAG="latest"
    
    print_info "Building Docker image with ACR..."
    print_info "This may take a few minutes..."
    
    az acr build \
        --registry "$ACR_NAME" \
        --image "$IMAGE_NAME:$IMAGE_TAG" \
        --file docker/Dockerfile.app \
        . \
        --output table
    
    print_success "Docker image built and pushed to ACR"
}

##############################################################################
# Web App Configuration
##############################################################################

configure_web_app() {
    print_section "Configuring Web App"
    
    # Get ACR credentials
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    
    IMAGE_NAME="powernova-chat-app:latest"
    
    print_info "Configuring container settings..."
    
    # Configure container
    az webapp config container set \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "$ACR_LOGIN_SERVER/$IMAGE_NAME" \
        --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD" \
        --output none
    
    print_success "Container configuration updated"
    
    # Enable container logging
    print_info "Enabling container logging..."
    az webapp log config \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-container-logging filesystem \
        --output none
    
    print_success "Logging enabled"
    
    # Restart web app
    print_info "Restarting web app..."
    az webapp restart \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Web app restarted"
}

##############################################################################
# Security Configuration
##############################################################################

configure_security() {
    print_section "Configuring Security Settings"
    
    # HTTPS only
    print_info "Enabling HTTPS-only access..."
    az webapp update \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --https-only true \
        --output none
    
    print_success "HTTPS-only enabled"
    
    # Minimum TLS version
    print_info "Setting minimum TLS version to 1.2..."
    az webapp config set \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --min-tls-version 1.2 \
        --output none
    
    print_success "TLS 1.2 minimum set"
}

##############################################################################
# Custom Domain Instructions
##############################################################################

show_domain_instructions() {
    print_section "Custom Domain Configuration"
    
    WEBAPP_URL=$(az webapp show --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    
    print_info "Your chat app is deployed at: https://$WEBAPP_URL"
    echo ""
    
    print_warning "To configure app.powernova.ai custom domain:"
    echo ""
    echo "1. Add CNAME record in your DNS provider:"
    echo "   Type:  CNAME"
    echo "   Name:  app"
    echo "   Value: $WEBAPP_URL"
    echo "   TTL:   3600"
    echo ""
    echo "2. After DNS propagates (5-30 minutes), run:"
    echo "   ${BLUE}az webapp config hostname add \\${NC}"
    echo "   ${BLUE}  --webapp-name $WEBAPP_NAME \\${NC}"
    echo "   ${BLUE}  --resource-group $RESOURCE_GROUP \\${NC}"
    echo "   ${BLUE}  --hostname app.powernova.ai${NC}"
    echo ""
    echo "3. Enable SSL (free managed certificate):"
    echo "   ${BLUE}az webapp config ssl bind \\${NC}"
    echo "   ${BLUE}  --name $WEBAPP_NAME \\${NC}"
    echo "   ${BLUE}  --resource-group $RESOURCE_GROUP \\${NC}"
    echo "   ${BLUE}  --certificate-thumbprint auto \\${NC}"
    echo "   ${BLUE}  --ssl-type SNI${NC}"
    echo ""
}

##############################################################################
# Deployment Summary
##############################################################################

show_deployment_summary() {
    print_section "Deployment Summary"
    
    WEBAPP_URL=$(az webapp show --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    
    echo -e "${GREEN}✓ Chat app successfully deployed!${NC}"
    echo ""
    echo "Resource Details:"
    echo "  Resource Group:    $RESOURCE_GROUP"
    echo "  Location:          $LOCATION"
    echo "  ACR:               $ACR_NAME.azurecr.io"
    echo "  App Service Plan:  $APP_SERVICE_PLAN"
    echo "  Web App:           $WEBAPP_NAME"
    echo "  Default URL:       https://$WEBAPP_URL"
    echo ""
    echo "Next Steps:"
    echo "  1. Test app: https://$WEBAPP_URL"
    echo "  2. Configure custom domain: app.powernova.ai"
    echo "  3. Monitor logs: az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP"
    echo ""
    echo "Management Commands:"
    echo "  ./scripts/azure-manage.sh status   # Check status"
    echo "  ./scripts/azure-manage.sh logs     # View logs"
    echo "  ./scripts/azure-manage.sh restart  # Restart app"
    echo ""
}

##############################################################################
# Main Deployment Flow
##############################################################################

main() {
    print_header
    
    # Parse arguments
    UPDATE_ONLY=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --update)
                UPDATE_ONLY=true
                shift
                ;;
            --help)
                show_help
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    
    # Load or prompt for configuration
    if ! load_config || [ "$UPDATE_ONLY" = false ]; then
        prompt_config
    else
        print_info "Using existing configuration from $CONFIG_FILE"
    fi
    
    # Create resources (skip if update-only)
    if [ "$UPDATE_ONLY" = false ]; then
        create_resource_group
        create_container_registry
        create_app_service_plan
        create_web_app
    else
        print_warning "Skipping resource creation (update mode)"
    fi
    
    # Build and push image
    build_and_push_image
    
    # Configure web app
    configure_web_app
    
    # Configure security (skip if update-only)
    if [ "$UPDATE_ONLY" = false ]; then
        configure_security
        show_domain_instructions
    fi
    
    # Show summary
    show_deployment_summary
    
    print_success "Deployment complete!"
}

# Run main function
main "$@"
