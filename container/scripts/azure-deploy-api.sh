#!/bin/bash

##############################################################################
# PowerNOVA API - Azure Deployment Script
# 
# This script deploys the FastAPI backend (api.powernova.ai) to Azure
# as a separate App Service.
#
# Prerequisites:
# - Azure CLI installed and logged in
# - Docker installed
# - Existing Azure resources from landing page deployment
# - OpenAI API key
#
# Usage:
#   ./azure-deploy-api.sh              # Interactive deployment
#   ./azure-deploy-api.sh --update     # Update existing deployment
#   ./azure-deploy-api.sh --help       # Show help
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration file
CONFIG_FILE=".azure-api-deployment.conf"

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  PowerNOVA API Deployment${NC}"
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
PowerNOVA API - Azure Deployment Script

USAGE:
    ./azure-deploy-api.sh [OPTIONS]

OPTIONS:
    --update        Update existing deployment (skip resource creation)
    --help          Show this help message

DESCRIPTION:
    Deploys the PowerNOVA FastAPI backend to Azure App Service.
    
    This script will:
    1. Check prerequisites (Azure CLI, Docker)
    2. Prompt for configuration (or use existing)
    3. Use existing Azure resources (Resource Group, ACR, App Service Plan)
    4. Build and push Docker image to ACR
    5. Deploy FastAPI to App Service
    6. Configure environment variables (OPENAI_API_KEY)
    7. Set up custom domain (api.powernova.ai)

EXAMPLES:
    # First-time deployment
    ./azure-deploy-api.sh

    # Update existing deployment with new code
    ./azure-deploy-api.sh --update

CONFIGURATION:
    Configuration is saved to: $CONFIG_FILE
    This allows quick updates without re-entering values.

PREREQUISITES:
    - Azure CLI: az --version
    - Docker: docker --version
    - OpenAI API Key from https://platform.openai.com/api-keys
    - Existing PowerNOVA infrastructure (created by azure-deploy.sh)

NOTES:
    - The API runs on the same App Service Plan as other apps (no extra cost)
    - OpenAI API key is stored securely in App Service Configuration
    - CORS is configured to allow requests from app.powernova.ai
    
EOF
    exit 0
}

##############################################################################
# Parse command line arguments
##############################################################################

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

##############################################################################
# Pre-flight checks
##############################################################################

check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI not found. Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI installed"
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run: az login"
        exit 1
    fi
    print_success "Logged in to Azure"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker Desktop"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker Desktop"
        exit 1
    fi
    print_success "Docker daemon running"
}

##############################################################################
# Load or create configuration
##############################################################################

load_or_create_config() {
    print_section "Configuration"
    
    if [ -f "$CONFIG_FILE" ] && [ "$UPDATE_ONLY" = true ]; then
        print_info "Loading existing configuration from $CONFIG_FILE"
        source "$CONFIG_FILE"
        print_success "Configuration loaded"
        return
    fi
    
    if [ -f "$CONFIG_FILE" ]; then
        print_info "Found existing configuration"
        read -p "Use existing configuration? (y/n): " use_existing
        if [ "$use_existing" = "y" ] || [ "$use_existing" = "Y" ]; then
            source "$CONFIG_FILE"
            print_success "Configuration loaded"
            return
        fi
    fi
    
    # Prompt for configuration
    echo ""
    echo "Please provide the following information:"
    echo ""
    
    # Resource Group (should match landing page deployment)
    read -p "Resource Group name (e.g., powernova-rg): " RESOURCE_GROUP
    
    # Container Registry (should match landing page deployment)
    read -p "Container Registry name (e.g., powernovaacr): " ACR_NAME
    
    # App Service Plan (should match landing page deployment)
    read -p "App Service Plan name (e.g., powernova-plan): " APP_SERVICE_PLAN
    
    # App Service name for API
    read -p "API App Service name (e.g., powernova-api): " APP_SERVICE_NAME
    
    # Location
    read -p "Azure region (e.g., eastus): " LOCATION
    
    # OpenAI API Key
    echo ""
    print_warning "OpenAI API Key is required for the API to function"
    read -sp "OpenAI API Key: " OPENAI_API_KEY
    echo ""
    
    # Image name
    IMAGE_NAME="powernova-api"
    IMAGE_TAG="latest"
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
# PowerNOVA API Deployment Configuration
RESOURCE_GROUP="$RESOURCE_GROUP"
ACR_NAME="$ACR_NAME"
APP_SERVICE_PLAN="$APP_SERVICE_PLAN"
APP_SERVICE_NAME="$APP_SERVICE_NAME"
LOCATION="$LOCATION"
IMAGE_NAME="$IMAGE_NAME"
IMAGE_TAG="$IMAGE_TAG"
OPENAI_API_KEY="$OPENAI_API_KEY"
EOF
    
    print_success "Configuration saved to $CONFIG_FILE"
    print_warning "Keep this file secure (contains OpenAI API key)"
}

##############################################################################
# Verify or create Azure resources
##############################################################################

setup_azure_resources() {
    if [ "$UPDATE_ONLY" = true ]; then
        print_section "Verifying Existing Resources"
    else
        print_section "Setting Up Azure Resources"
    fi
    
    # Check/Create Resource Group
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        print_success "Resource Group exists: $RESOURCE_GROUP"
    else
        if [ "$UPDATE_ONLY" = true ]; then
            print_error "Resource Group not found: $RESOURCE_GROUP"
            exit 1
        fi
        print_info "Creating Resource Group: $RESOURCE_GROUP"
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
        print_success "Resource Group created"
    fi
    
    # Check/Create Container Registry
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_success "Container Registry exists: $ACR_NAME"
    else
        if [ "$UPDATE_ONLY" = true ]; then
            print_error "Container Registry not found: $ACR_NAME"
            print_info "Please run ./azure-deploy.sh first to create shared resources"
            exit 1
        fi
        print_info "Creating Container Registry: $ACR_NAME"
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku Basic \
            --location "$LOCATION" \
            --admin-enabled true
        print_success "Container Registry created"
    fi
    
    # Check/Create App Service Plan
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_success "App Service Plan exists: $APP_SERVICE_PLAN"
        
        # Verify it's a Linux plan
        PLAN_KIND=$(az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" --query kind -o tsv)
        if [[ ! "$PLAN_KIND" =~ "linux" ]]; then
            print_error "App Service Plan '$APP_SERVICE_PLAN' is not a Linux plan (kind: $PLAN_KIND)"
            print_error "The API requires a Linux App Service Plan for Docker containers"
            print_info "Please either:"
            print_info "  1. Delete the existing plan and re-run this script, or"
            print_info "  2. Specify a different Linux-based App Service Plan name"
            exit 1
        fi
    else
        if [ "$UPDATE_ONLY" = true ]; then
            print_error "App Service Plan not found: $APP_SERVICE_PLAN"
            print_info "Please run ./azure-deploy.sh first to create shared resources"
            exit 1
        fi
        print_info "Creating App Service Plan: $APP_SERVICE_PLAN"
        az appservice plan create \
            --name "$APP_SERVICE_PLAN" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --is-linux \
            --sku B1
        print_success "App Service Plan created"
    fi
    
    # Check/Create App Service for API
    if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_success "App Service exists: $APP_SERVICE_NAME"
    else
        print_info "Creating App Service: $APP_SERVICE_NAME"
        
        # Get ACR login server for initial image
        ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
        
        az webapp create \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN" \
            --name "$APP_SERVICE_NAME" \
            --deployment-container-image-name "$ACR_LOGIN_SERVER/powernova-api:latest"
        
        print_success "App Service created"
        
        # Configure container settings immediately
        print_info "Configuring initial container settings..."
        ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
        ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
        
        az webapp config container set \
            --name "$APP_SERVICE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --docker-custom-image-name "$ACR_LOGIN_SERVER/powernova-api:latest" \
            --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
            --docker-registry-server-user "$ACR_USERNAME" \
            --docker-registry-server-password "$ACR_PASSWORD"
        
        print_success "Container configured"
    fi
}

##############################################################################
# Build and push Docker image
##############################################################################

build_and_push_image() {
    print_section "Building and Pushing Docker Image"
    
    # Get ACR credentials
    print_info "Getting ACR credentials..."
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    
    # Build image
    print_info "Building Docker image: $IMAGE_NAME:$IMAGE_TAG"
    cd "$PROJECT_ROOT"
    docker build \
        --platform linux/amd64 \
        -t "$IMAGE_NAME:$IMAGE_TAG" \
        -f docker/Dockerfile.api \
        .
    print_success "Image built successfully"
    
    # Tag image for ACR
    print_info "Tagging image for ACR..."
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"
    print_success "Image tagged"
    
    # Login to ACR
    print_info "Logging in to ACR..."
    echo "$ACR_PASSWORD" | docker login "$ACR_LOGIN_SERVER" -u "$ACR_USERNAME" --password-stdin
    print_success "Logged in to ACR"
    
    # Push image
    print_info "Pushing image to ACR (this may take a few minutes)..."
    docker push "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"
    print_success "Image pushed to ACR"
}

##############################################################################
# Deploy to App Service
##############################################################################

deploy_to_app_service() {
    print_section "Deploying to App Service"
    
    # Get ACR credentials
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    
    # Configure container
    print_info "Configuring App Service container..."
    az webapp config container set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" \
        --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD"
    print_success "Container configured"
    
    # Set environment variables
    print_info "Setting environment variables..."
    az webapp config appsettings set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            OPENAI_API_KEY="$OPENAI_API_KEY" \
            PORT="8000" \
            ENVIRONMENT="production" \
            WEBSITES_PORT="8000" \
            WEBSITES_CONTAINER_START_TIME_LIMIT="600"
    print_success "Environment variables set"
    
    # Enable HTTPS only
    print_info "Configuring HTTPS..."
    az webapp update \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --https-only true
    print_success "HTTPS enabled"
    
    # Restart app service
    print_info "Restarting App Service..."
    az webapp restart \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP"
    print_success "App Service restarted"
}

##############################################################################
# Display deployment information
##############################################################################

show_deployment_info() {
    print_section "Deployment Complete!"
    
    APP_URL=$(az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    
    echo ""
    print_success "PowerNOVA API deployed successfully!"
    echo ""
    echo -e "  ${BLUE}API URL:${NC}      https://$APP_URL"
    echo -e "  ${BLUE}Health:${NC}       https://$APP_URL/health"
    echo -e "  ${BLUE}API Docs:${NC}     https://$APP_URL/docs"
    echo ""
    
    print_info "Next steps:"
    echo "  1. Test the API: curl https://$APP_URL/health"
    echo "  2. View API docs: open https://$APP_URL/docs"
    echo "  3. Configure custom domain (api.powernova.ai) in Azure Portal"
    echo "  4. Update frontend config to use: https://api.powernova.ai"
    echo ""
    
    print_warning "Remember to:"
    echo "  - Set up custom domain: api.powernova.ai"
    echo "  - Configure SSL certificate (free with Azure)"
    echo "  - Update CORS settings if needed"
    echo ""
}

##############################################################################
# Main execution
##############################################################################

main() {
    print_header
    
    # Run deployment steps
    check_prerequisites
    load_or_create_config
    setup_azure_resources
    build_and_push_image
    deploy_to_app_service
    show_deployment_info
    
    print_success "All done! 🚀"
    echo ""
}

# Run main function
main
