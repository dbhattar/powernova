#!/bin/bash
# Explore Azure App Service container structure

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Azure Container Structure Explorer${NC}"
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

echo -e "${GREEN}✓ Connected to Azure${NC}"
echo ""

echo -e "${BLUE}[1/6] Current working directory:${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "pwd"
echo ""

echo -e "${BLUE}[2/6] Directory contents (pwd):${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la"
echo ""

echo -e "${BLUE}[3/6] Checking common locations:${NC}"
echo ""
echo "--- /app ---"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la /app 2>/dev/null || echo 'Directory does not exist'"
echo ""
echo "--- /home/site/wwwroot ---"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la /home/site/wwwroot 2>/dev/null || echo 'Directory does not exist'"
echo ""
echo "--- /home ---"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la /home 2>/dev/null || echo 'Directory does not exist'"
echo ""

echo -e "${BLUE}[4/6] Finding Python files:${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "find / -name 'main.py' -type f 2>/dev/null | head -5"
echo ""

echo -e "${BLUE}[5/6] Finding alembic.ini:${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "find / -name 'alembic.ini' -type f 2>/dev/null | head -5"
echo ""

echo -e "${BLUE}[6/6] Python environment:${NC}"
echo "Python location:"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "which python"
echo ""
echo "Python version:"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "python --version"
echo ""
echo "Key packages:"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "pip list 2>/dev/null | grep -E '(alembic|fastapi|sqlalchemy)'"
echo ""

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Exploration complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Based on the output above, you should now know:"
echo "  - Where your application files are located"
echo "  - Where alembic.ini is located"
echo "  - If alembic is installed"
echo ""
echo "To run migrations, use:"
echo "  ./scripts/run-migrations-azure.sh"
echo ""
