#!/bin/bash
# Diagnostic script for Azure App Service container

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Azure App Service Container Diagnostics${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

RESOURCE_GROUP="powernova"
APP_NAME="powernovaapi"

# Check if Azure CLI is logged in
if ! az account show > /dev/null 2>&1; then
    echo -e "${RED}✗ Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "App Name: $APP_NAME"
echo ""

# Test 1: Check app status
echo -e "${BLUE}[1/10] Checking App Service status...${NC}"
APP_STATE=$(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query state -o tsv 2>/dev/null)
if [ "$APP_STATE" = "Running" ]; then
    echo -e "${GREEN}✓ App is running${NC}"
else
    echo -e "${YELLOW}⚠️  App state: $APP_STATE${NC}"
fi
echo ""

# Test 2: Check Python version
echo -e "${BLUE}[2/10] Checking Python version...${NC}"
PYTHON_VERSION=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "python --version" 2>/dev/null)
if [ -n "$PYTHON_VERSION" ]; then
    echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"
else
    echo -e "${RED}✗ Could not get Python version${NC}"
fi
echo ""

# Test 3: Check working directory
echo -e "${BLUE}[3/10] Checking working directory...${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "pwd && ls -la /app" 2>/dev/null | head -10
echo ""

# Test 4: Check environment variables
echo -e "${BLUE}[4/10] Checking environment variables...${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "env | grep -E '(DATABASE|OPENAI|PORT|ENVIRONMENT)' | sort" 2>/dev/null
echo ""

# Test 5: Check installed packages
echo -e "${BLUE}[5/10] Checking key packages...${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "pip list 2>/dev/null | grep -E '(alembic|sqlalchemy|fastapi|openai|uvicorn)'" 2>/dev/null
echo ""

# Test 6: Check database connection
echo -e "${BLUE}[6/10] Testing database connection...${NC}"
DB_CHECK=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "cd /app && python -c 'from database.session import check_db_connection; print(check_db_connection())'" 2>/dev/null)
if echo "$DB_CHECK" | grep -q "True"; then
    echo -e "${GREEN}✓ Database connected${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "$DB_CHECK"
fi
echo ""

# Test 7: Check Alembic migration status
echo -e "${BLUE}[7/10] Checking migration status...${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "cd /app && python -m alembic current" 2>/dev/null
echo ""

# Test 8: Check running processes
echo -e "${BLUE}[8/10] Checking running processes...${NC}"
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ps aux | grep -E '(python|uvicorn)'" 2>/dev/null | grep -v grep
echo ""

# Test 9: Check health endpoint
echo -e "${BLUE}[9/10] Testing health endpoint...${NC}"
APP_URL=$(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query defaultHostName -o tsv)
HEALTH_RESPONSE=$(curl -s https://$APP_URL/health 2>/dev/null)
if [ -n "$HEALTH_RESPONSE" ]; then
    echo -e "${GREEN}✓ Health endpoint responding${NC}"
    echo "$HEALTH_RESPONSE" | python -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health endpoint not responding${NC}"
fi
echo ""

# Test 10: Check recent logs
echo -e "${BLUE}[10/10] Checking recent logs...${NC}"
echo "Last 10 log entries:"
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME --provider application 2>/dev/null | head -20 &
sleep 3
pkill -P $$ tail > /dev/null 2>&1
echo ""

# Summary
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "App URL: https://$APP_URL"
echo "App State: $APP_STATE"
echo "Python: $PYTHON_VERSION"
echo ""
echo -e "${GREEN}Diagnostics complete!${NC}"
echo ""
echo "To SSH into container:"
echo "  ./scripts/ssh-azure.sh"
echo ""
echo "To view live logs:"
echo "  az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
