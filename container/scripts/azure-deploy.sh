#!/bin/bash

# PowerNOVA Azure Deployment Script
# This script automates the deployment of the containerized website to Azure App Service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
DEFAULT_LOCATION="eastus"
DEFAULT_SKU="B1"
IMAGE_NAME="powernova-website"

# Print functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  PowerNOVA Azure Deployment${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

# Check if Azure CLI is installed
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        echo ""
        echo "Install Azure CLI:"
        echo "  macOS: brew install azure-cli"
        echo "  Or visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo ""
        echo "Install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    print_success "Prerequisites satisfied"
}

# Check if user is logged in to Azure
check_azure_login() {
    print_step "Checking Azure login status..."
    
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure"
        print_info "Logging you in..."
        az login
    fi
    
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    print_success "Logged in to Azure"
    print_info "Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
}

# Prompt for configuration
get_configuration() {
    print_step "Configuration setup..."
    echo ""
    
    # Resource Group
    read -p "Enter Resource Group name [powernova-rg]: " RESOURCE_GROUP
    RESOURCE_GROUP=${RESOURCE_GROUP:-powernova-rg}
    
    # Location
    read -p "Enter Azure location [eastus]: " LOCATION
    LOCATION=${LOCATION:-$DEFAULT_LOCATION}
    
    # Container Registry
    read -p "Enter Container Registry name (must be unique): " ACR_NAME
    while [ -z "$ACR_NAME" ]; do
        print_error "Container Registry name is required"
        read -p "Enter Container Registry name: " ACR_NAME
    done
    
    # App Service Plan
    read -p "Enter App Service Plan name [powernova-plan]: " APP_SERVICE_PLAN
    APP_SERVICE_PLAN=${APP_SERVICE_PLAN:-powernova-plan}
    
    # SKU
    echo ""
    echo "Available SKUs:"
    echo "  F1  - Free (limited, no custom domains)"
    echo "  B1  - Basic (\$13/month) - Recommended for dev/test"
    echo "  S1  - Standard (\$70/month) - Recommended for production"
    echo "  P1V2 - Premium (\$146/month) - High performance"
    read -p "Enter App Service SKU [B1]: " SKU
    SKU=${SKU:-$DEFAULT_SKU}
    
    # Web App
    read -p "Enter Web App name (must be globally unique): " WEBAPP_NAME
    while [ -z "$WEBAPP_NAME" ]; do
        print_error "Web App name is required"
        read -p "Enter Web App name: " WEBAPP_NAME
    done
    
    echo ""
    print_info "Configuration Summary:"
    echo "  Resource Group:      $RESOURCE_GROUP"
    echo "  Location:            $LOCATION"
    echo "  Container Registry:  $ACR_NAME"
    echo "  App Service Plan:    $APP_SERVICE_PLAN"
    echo "  SKU:                 $SKU"
    echo "  Web App Name:        $WEBAPP_NAME"
    echo ""
    
    read -p "Proceed with deployment? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi
}

# Create resource group
create_resource_group() {
    print_step "Creating resource group..."
    
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        print_info "Resource group already exists"
    else
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
        print_success "Resource group created"
    fi
}

# Create Azure Container Registry
create_container_registry() {
    print_step "Creating Azure Container Registry..."
    
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_info "Container Registry already exists"
    else
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku Basic \
            --admin-enabled true \
            --output none
        print_success "Container Registry created"
    fi
    
    # Get ACR login server
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    print_info "Registry URL: $ACR_LOGIN_SERVER"
}

# Build and push Docker image
build_and_push_image() {
    print_step "Building and pushing Docker image..."
    
    print_info "This may take a few minutes..."
    
    # Build image using ACR
    az acr build \
        --registry "$ACR_NAME" \
        --image "${IMAGE_NAME}:latest" \
        --image "${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)" \
        --file "$PROJECT_ROOT/docker/Dockerfile" \
        "$PROJECT_ROOT" \
        --output table
    
    print_success "Image built and pushed to ACR"
}

# Create App Service Plan
create_app_service_plan() {
    print_step "Creating App Service Plan..."
    
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_info "App Service Plan already exists"
    else
        az appservice plan create \
            --name "$APP_SERVICE_PLAN" \
            --resource-group "$RESOURCE_GROUP" \
            --is-linux \
            --sku "$SKU" \
            --output none
        print_success "App Service Plan created"
    fi
}

# Create Web App
create_web_app() {
    print_step "Creating Web App..."
    
    if az webapp show --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_info "Web App already exists, will update configuration"
    else
        az webapp create \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN" \
            --name "$WEBAPP_NAME" \
            --deployment-container-image-name "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest" \
            --output none
        print_success "Web App created"
    fi
}

# Configure Web App with ACR
configure_web_app() {
    print_step "Configuring Web App..."
    
    # Get ACR credentials
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
    
    # Configure container
    az webapp config container set \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest" \
        --docker-registry-server-url "https://${ACR_LOGIN_SERVER}" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD" \
        --output none
    
    print_success "Container configuration updated"
}

# Enable continuous deployment
enable_continuous_deployment() {
    print_step "Enabling continuous deployment..."
    
    az webapp deployment container config \
        --enable-cd true \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Continuous deployment enabled"
}

# Configure additional settings
configure_app_settings() {
    print_step "Configuring additional settings..."
    
    # Enable HTTPS only
    az webapp update \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --https-only true \
        --output none
    
    # Disable FTP
    az webapp config set \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --ftps-state Disabled \
        --output none
    
    # Configure always on (not available in Free tier)
    if [ "$SKU" != "F1" ]; then
        az webapp config set \
            --name "$WEBAPP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --always-on true \
            --output none
        print_success "Always On enabled"
    fi
    
    print_success "Security settings configured"
}

# Enable Application Insights (optional)
enable_app_insights() {
    read -p "Enable Application Insights for monitoring? (y/n): " ENABLE_INSIGHTS
    
    if [ "$ENABLE_INSIGHTS" = "y" ] || [ "$ENABLE_INSIGHTS" = "Y" ]; then
        print_step "Enabling Application Insights..."
        
        INSIGHTS_NAME="${WEBAPP_NAME}-insights"
        
        # Create Application Insights
        az monitor app-insights component create \
            --app "$INSIGHTS_NAME" \
            --location "$LOCATION" \
            --resource-group "$RESOURCE_GROUP" \
            --output none
        
        # Get instrumentation key
        INSIGHTS_KEY=$(az monitor app-insights component show \
            --app "$INSIGHTS_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --query instrumentationKey -o tsv)
        
        # Configure web app
        az webapp config appsettings set \
            --name "$WEBAPP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY" \
            --output none
        
        print_success "Application Insights enabled"
    fi
}

# Restart web app
restart_web_app() {
    print_step "Restarting Web App..."
    
    az webapp restart \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Web App restarted"
}

# Display deployment information
show_deployment_info() {
    print_header
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    echo -e "${CYAN}Deployment Information:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🌐 Website URL:${NC}"
    echo "   https://${WEBAPP_NAME}.azurewebsites.net"
    echo ""
    echo -e "${GREEN}📦 Resources Created:${NC}"
    echo "   Resource Group:     $RESOURCE_GROUP"
    echo "   Container Registry: $ACR_NAME"
    echo "   App Service Plan:   $APP_SERVICE_PLAN ($SKU)"
    echo "   Web App:            $WEBAPP_NAME"
    echo ""
    echo -e "${GREEN}💰 Estimated Monthly Cost:${NC}"
    case $SKU in
        F1)
            echo "   Free tier - \$0/month"
            ;;
        B1)
            echo "   Basic B1 - ~\$13/month"
            ;;
        S1)
            echo "   Standard S1 - ~\$70/month"
            ;;
        P1V2)
            echo "   Premium P1V2 - ~\$146/month"
            ;;
        *)
            echo "   Check Azure pricing for $SKU tier"
            ;;
    esac
    echo "   Container Registry (Basic) - ~\$5/month"
    echo ""
    echo -e "${GREEN}📝 Next Steps:${NC}"
    echo "   1. Visit your website at the URL above"
    echo "   2. Configure custom domain (optional)"
    echo "   3. Set up SSL certificate (optional)"
    echo "   4. Enable autoscaling (optional)"
    echo ""
    echo -e "${GREEN}🔧 Useful Commands:${NC}"
    echo "   View logs:"
    echo "   az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP"
    echo ""
    echo "   Restart app:"
    echo "   az webapp restart --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP"
    echo ""
    echo "   Update deployment:"
    echo "   ./scripts/azure-deploy.sh --update"
    echo ""
    echo "   Delete resources:"
    echo "   az group delete --name $RESOURCE_GROUP --yes"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Save deployment configuration
save_deployment_config() {
    CONFIG_FILE="$PROJECT_ROOT/.azure-deployment.conf"
    
    cat > "$CONFIG_FILE" << EOF
# Azure Deployment Configuration
# Generated on $(date)

RESOURCE_GROUP="$RESOURCE_GROUP"
LOCATION="$LOCATION"
ACR_NAME="$ACR_NAME"
APP_SERVICE_PLAN="$APP_SERVICE_PLAN"
SKU="$SKU"
WEBAPP_NAME="$WEBAPP_NAME"
IMAGE_NAME="$IMAGE_NAME"
EOF

    print_info "Configuration saved to .azure-deployment.conf"
}

# Load existing configuration
load_deployment_config() {
    CONFIG_FILE="$PROJECT_ROOT/.azure-deployment.conf"
    
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        print_info "Loaded existing configuration"
        return 0
    fi
    return 1
}

# Update existing deployment
update_deployment() {
    print_header
    echo ""
    
    if ! load_deployment_config; then
        print_error "No existing deployment configuration found"
        print_info "Run without --update flag for initial deployment"
        exit 1
    fi
    
    print_info "Updating existing deployment: $WEBAPP_NAME"
    echo ""
    
    check_prerequisites
    check_azure_login
    
    print_step "Rebuilding and pushing image..."
    build_and_push_image
    
    print_step "Restarting web app..."
    restart_web_app
    
    echo ""
    print_success "Deployment updated successfully!"
    print_info "Website: https://${WEBAPP_NAME}.azurewebsites.net"
}

# Main deployment flow
main() {
    print_header
    echo ""
    
    # Check for update flag
    if [ "$1" = "--update" ] || [ "$1" = "-u" ]; then
        update_deployment
        exit 0
    fi
    
    # Full deployment
    check_prerequisites
    check_azure_login
    get_configuration
    
    echo ""
    print_step "Starting deployment..."
    echo ""
    
    create_resource_group
    create_container_registry
    build_and_push_image
    create_app_service_plan
    create_web_app
    configure_web_app
    enable_continuous_deployment
    configure_app_settings
    enable_app_insights
    restart_web_app
    
    save_deployment_config
    
    echo ""
    show_deployment_info
}

# Handle script interruption
trap 'echo ""; print_error "Deployment interrupted"; exit 1' INT TERM

# Help message
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    print_header
    echo ""
    echo "Usage: ./azure-deploy.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  (no flags)    Full deployment - creates all resources"
    echo "  --update, -u  Update existing deployment (rebuild and redeploy)"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/azure-deploy.sh           # Initial deployment"
    echo "  ./scripts/azure-deploy.sh --update  # Update existing deployment"
    echo ""
    exit 0
fi

# Run main function
main "$@"
