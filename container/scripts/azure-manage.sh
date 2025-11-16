#!/bin/bash

# PowerNOVA Azure Management Script
# This script helps manage your deployed Azure resources

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
CONFIG_FILE="$PROJECT_ROOT/.azure-deployment.conf"

# Print functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  PowerNOVA Azure Management${NC}"
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

# Load deployment configuration
load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "No deployment configuration found"
        print_info "Run ./scripts/azure-deploy.sh first to deploy"
        exit 1
    fi
    source "$CONFIG_FILE"
}

# Show deployment status
show_status() {
    print_header
    echo ""
    load_config
    
    print_step "Fetching deployment status..."
    echo ""
    
    # Web App status
    STATUS=$(az webapp show \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query state -o tsv 2>/dev/null || echo "Not Found")
    
    if [ "$STATUS" = "Running" ]; then
        print_success "Web App is Running"
    elif [ "$STATUS" = "Stopped" ]; then
        print_error "Web App is Stopped"
    else
        print_error "Web App status: $STATUS"
    fi
    
    # Get URL
    URL="https://${WEBAPP_NAME}.azurewebsites.net"
    echo -e "${CYAN}Website URL:${NC} $URL"
    echo ""
    
    # Resource information
    echo -e "${CYAN}Resources:${NC}"
    echo "  Resource Group:     $RESOURCE_GROUP"
    echo "  Container Registry: $ACR_NAME"
    echo "  App Service Plan:   $APP_SERVICE_PLAN"
    echo "  Web App:            $WEBAPP_NAME"
    echo ""
    
    # Recent activity
    print_info "Recent deployments:"
    az webapp deployment list \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[0:3].{Status:status, Time:start_time, Id:id}" \
        --output table 2>/dev/null || echo "  No deployment history available"
}

# View logs
view_logs() {
    load_config
    print_header
    echo ""
    print_info "Streaming logs from $WEBAPP_NAME"
    print_info "Press Ctrl+C to stop"
    echo ""
    
    az webapp log tail \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP"
}

# Download logs
download_logs() {
    load_config
    print_header
    echo ""
    print_step "Downloading logs..."
    
    LOG_FILE="$PROJECT_ROOT/webapp-logs-$(date +%Y%m%d-%H%M%S).zip"
    
    az webapp log download \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --log-file "$LOG_FILE"
    
    print_success "Logs downloaded to: $LOG_FILE"
}

# Restart web app
restart_app() {
    load_config
    print_header
    echo ""
    print_step "Restarting $WEBAPP_NAME..."
    
    az webapp restart \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Web App restarted successfully"
    print_info "URL: https://${WEBAPP_NAME}.azurewebsites.net"
}

# Stop web app
stop_app() {
    load_config
    print_header
    echo ""
    print_step "Stopping $WEBAPP_NAME..."
    
    az webapp stop \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Web App stopped"
    print_info "Run './scripts/azure-manage.sh start' to start it again"
}

# Start web app
start_app() {
    load_config
    print_header
    echo ""
    print_step "Starting $WEBAPP_NAME..."
    
    az webapp start \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --output none
    
    print_success "Web App started"
    print_info "URL: https://${WEBAPP_NAME}.azurewebsites.net"
}

# Scale web app
scale_app() {
    load_config
    print_header
    echo ""
    
    echo "Available SKUs:"
    echo "  F1   - Free"
    echo "  B1   - Basic (\$13/month)"
    echo "  B2   - Basic (\$26/month)"
    echo "  S1   - Standard (\$70/month)"
    echo "  S2   - Standard (\$140/month)"
    echo "  P1V2 - Premium (\$146/month)"
    echo ""
    
    read -p "Enter new SKU [current: $SKU]: " NEW_SKU
    NEW_SKU=${NEW_SKU:-$SKU}
    
    print_step "Scaling App Service Plan to $NEW_SKU..."
    
    az appservice plan update \
        --name "$APP_SERVICE_PLAN" \
        --resource-group "$RESOURCE_GROUP" \
        --sku "$NEW_SKU" \
        --output none
    
    # Update config file
    sed -i '' "s/SKU=\".*\"/SKU=\"$NEW_SKU\"/" "$CONFIG_FILE"
    
    print_success "App Service Plan scaled to $NEW_SKU"
}

# Scale out (add instances)
scale_out() {
    load_config
    print_header
    echo ""
    
    CURRENT_INSTANCES=$(az appservice plan show \
        --name "$APP_SERVICE_PLAN" \
        --resource-group "$RESOURCE_GROUP" \
        --query sku.capacity -o tsv)
    
    echo "Current instances: $CURRENT_INSTANCES"
    read -p "Enter number of instances (1-10): " INSTANCES
    
    if [ -z "$INSTANCES" ] || [ "$INSTANCES" -lt 1 ] || [ "$INSTANCES" -gt 10 ]; then
        print_error "Invalid number of instances"
        exit 1
    fi
    
    print_step "Scaling to $INSTANCES instances..."
    
    az appservice plan update \
        --name "$APP_SERVICE_PLAN" \
        --resource-group "$RESOURCE_GROUP" \
        --number-of-workers "$INSTANCES" \
        --output none
    
    print_success "Scaled to $INSTANCES instances"
}

# Open in browser
open_browser() {
    load_config
    URL="https://${WEBAPP_NAME}.azurewebsites.net"
    
    print_info "Opening $URL"
    
    if command -v open &> /dev/null; then
        open "$URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$URL"
    else
        echo "Visit: $URL"
    fi
}

# SSH into container
ssh_container() {
    load_config
    print_header
    echo ""
    print_info "Opening SSH connection to container..."
    print_info "Type 'exit' to close the connection"
    echo ""
    
    az webapp ssh \
        --name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP"
}

# Get deployment costs
show_costs() {
    load_config
    print_header
    echo ""
    print_step "Fetching cost information..."
    echo ""
    
    # Get current month's costs
    az consumption usage list \
        --query "[?contains(instanceName, '$RESOURCE_GROUP')].{Resource:instanceName, Cost:pretaxCost, Currency:currency}" \
        --output table 2>/dev/null || {
        print_info "Cost data not available yet"
        echo ""
        echo "Estimated monthly costs:"
        case $SKU in
            F1)
                echo "  App Service (F1): \$0"
                ;;
            B1)
                echo "  App Service (B1): ~\$13"
                ;;
            B2)
                echo "  App Service (B2): ~\$26"
                ;;
            S1)
                echo "  App Service (S1): ~\$70"
                ;;
            S2)
                echo "  App Service (S2): ~\$140"
                ;;
            P1V2)
                echo "  App Service (P1V2): ~\$146"
                ;;
        esac
        echo "  Container Registry (Basic): ~\$5"
    }
}

# Configure custom domain
configure_domain() {
    load_config
    print_header
    echo ""
    
    read -p "Enter your custom domain (e.g., www.powernova.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    print_step "Configuring custom domain..."
    
    # Add custom domain
    az webapp config hostname add \
        --webapp-name "$WEBAPP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --hostname "$DOMAIN"
    
    print_success "Custom domain added"
    print_info "Configure your DNS to point to: ${WEBAPP_NAME}.azurewebsites.net"
}

# Delete deployment
delete_deployment() {
    load_config
    print_header
    echo ""
    print_error "WARNING: This will delete ALL resources in resource group: $RESOURCE_GROUP"
    echo ""
    echo "Resources to be deleted:"
    echo "  - Web App: $WEBAPP_NAME"
    echo "  - App Service Plan: $APP_SERVICE_PLAN"
    echo "  - Container Registry: $ACR_NAME"
    echo "  - All associated resources"
    echo ""
    
    read -p "Type 'DELETE' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "DELETE" ]; then
        print_info "Deletion cancelled"
        exit 0
    fi
    
    print_step "Deleting resource group..."
    
    az group delete \
        --name "$RESOURCE_GROUP" \
        --yes \
        --no-wait
    
    print_success "Deletion initiated (running in background)"
    print_info "Resources will be deleted in a few minutes"
    
    # Remove config file
    rm -f "$CONFIG_FILE"
    print_info "Local configuration removed"
}

# Show help
show_help() {
    print_header
    echo ""
    echo "Usage: ./azure-manage.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status        Show deployment status"
    echo "  logs          Stream live logs"
    echo "  download-logs Download logs to file"
    echo "  restart       Restart the web app"
    echo "  stop          Stop the web app"
    echo "  start         Start the web app"
    echo "  scale         Change App Service SKU"
    echo "  scale-out     Add/remove instances"
    echo "  open          Open website in browser"
    echo "  ssh           SSH into container"
    echo "  costs         Show estimated costs"
    echo "  domain        Configure custom domain"
    echo "  delete        Delete all Azure resources"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/azure-manage.sh status"
    echo "  ./scripts/azure-manage.sh logs"
    echo "  ./scripts/azure-manage.sh restart"
    echo ""
}

# Main function
case "$1" in
    status)
        show_status
        ;;
    logs)
        view_logs
        ;;
    download-logs)
        download_logs
        ;;
    restart)
        restart_app
        ;;
    stop)
        stop_app
        ;;
    start)
        start_app
        ;;
    scale)
        scale_app
        ;;
    scale-out)
        scale_out
        ;;
    open)
        open_browser
        ;;
    ssh)
        ssh_container
        ;;
    costs)
        show_costs
        ;;
    domain)
        configure_domain
        ;;
    delete)
        delete_deployment
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
