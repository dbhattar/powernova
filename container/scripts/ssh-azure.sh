#!/bin/bash
# SSH into Azure App Service container

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Azure App Service - Container SSH${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

RESOURCE_GROUP="powernova"
APP_NAME="powernovaapi"

# Check if Azure CLI is logged in
if ! az account show > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo "App Name: $APP_NAME"
echo ""
echo -e "${YELLOW}Connecting to container...${NC}"
echo ""
echo "Useful commands once connected:"
echo "  pwd                    # Current directory"
echo "  ls -la                # List files"
echo "  env | grep DATABASE   # Check environment variables"
echo "  python --version      # Check Python version"
echo "  pip list              # List installed packages"
echo "  python -m alembic current  # Check migrations"
echo "  exit                  # Disconnect"
echo ""
echo -e "${BLUE}======================================${NC}"
echo ""

az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME
