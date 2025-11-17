#!/bin/bash
# Find and run Alembic migrations in Azure App Service container

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Azure App Service - Run Migrations${NC}"
echo -e "${BLUE}======================================${NC}"
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
echo ""

# Step 1: Find the application directory
echo -e "${BLUE}Step 1: Finding application directory...${NC}"
echo ""

echo "Checking common locations:"
echo ""

# Check /app
echo "Checking /app..."
APP_DIR=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "test -d /app && echo '/app' || echo ''" 2>/dev/null)

# Check /home/site/wwwroot
if [ -z "$APP_DIR" ]; then
    echo "Checking /home/site/wwwroot..."
    APP_DIR=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "test -d /home/site/wwwroot && echo '/home/site/wwwroot' || echo ''" 2>/dev/null)
fi

# Check /home
if [ -z "$APP_DIR" ]; then
    echo "Checking /home..."
    APP_DIR=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "test -d /home && echo '/home' || echo ''" 2>/dev/null)
fi

# Find using pwd
if [ -z "$APP_DIR" ]; then
    echo "Getting current working directory..."
    APP_DIR=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "pwd" 2>/dev/null)
fi

if [ -z "$APP_DIR" ]; then
    echo -e "${RED}✗ Could not determine application directory${NC}"
    echo ""
    echo "Manually checking directory structure:"
    az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la /"
    echo ""
    echo "Please SSH into container to investigate:"
    echo "  ./scripts/ssh-azure.sh"
    exit 1
fi

echo -e "${GREEN}✓ Found application directory: $APP_DIR${NC}"
echo ""

# Step 2: Check if alembic files exist
echo -e "${BLUE}Step 2: Checking for Alembic files...${NC}"
echo ""

ALEMBIC_CHECK=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la $APP_DIR/ | grep -E '(alembic|alembic.ini)'" 2>/dev/null)

if [ -z "$ALEMBIC_CHECK" ]; then
    # Try looking in subdirectories
    echo "Alembic not found in $APP_DIR, checking subdirectories..."
    FIND_ALEMBIC=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "find $APP_DIR -name 'alembic.ini' -type f 2>/dev/null | head -1" 2>/dev/null)
    
    if [ -n "$FIND_ALEMBIC" ]; then
        APP_DIR=$(dirname "$FIND_ALEMBIC")
        echo -e "${GREEN}✓ Found alembic.ini in: $APP_DIR${NC}"
    else
        echo -e "${RED}✗ Alembic files not found${NC}"
        echo ""
        echo "Directory structure of $APP_DIR:"
        az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "ls -la $APP_DIR"
        echo ""
        echo "This might be a deployment issue. Check if:"
        echo "  1. alembic/ directory is in your deployment"
        echo "  2. alembic.ini file exists"
        echo "  3. Files were copied correctly during build"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Alembic files found${NC}"
    echo "$ALEMBIC_CHECK"
fi
echo ""

# Step 3: Check Python and alembic package
echo -e "${BLUE}Step 3: Checking Python environment...${NC}"
echo ""

PYTHON_CHECK=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "python --version" 2>/dev/null)
echo "Python: $PYTHON_CHECK"

ALEMBIC_PKG=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "python -m alembic --version" 2>/dev/null)
if [ -n "$ALEMBIC_PKG" ]; then
    echo -e "${GREEN}✓ Alembic installed: $ALEMBIC_PKG${NC}"
else
    echo -e "${RED}✗ Alembic not installed${NC}"
    echo "Run: pip install alembic"
    exit 1
fi
echo ""

# Step 4: Check current migration status
echo -e "${BLUE}Step 4: Checking current migration status...${NC}"
echo ""

CURRENT_MIGRATION=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "cd $APP_DIR && python -m alembic current" 2>/dev/null)
echo "$CURRENT_MIGRATION"
echo ""

# Step 5: Run migrations
echo -e "${BLUE}Step 5: Running migrations...${NC}"
echo ""

echo -e "${YELLOW}⚠️  This will modify the database!${NC}"
echo "Database: Check your app settings for DATABASE_URL"
echo ""
read -p "Continue with migration? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "Running: python -m alembic upgrade head"
echo ""

MIGRATION_OUTPUT=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "cd $APP_DIR && python -m alembic upgrade head" 2>&1)
MIGRATION_EXIT=$?

echo "$MIGRATION_OUTPUT"
echo ""

if [ $MIGRATION_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations completed successfully!${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    echo ""
    echo "Check the output above for errors."
    echo "Common issues:"
    echo "  - Database connection failed (check DATABASE_URL)"
    echo "  - Migration files missing"
    echo "  - Database permissions"
    exit 1
fi

# Step 6: Verify tables were created
echo ""
echo -e "${BLUE}Step 6: Verifying table creation...${NC}"
echo ""

# Try to check tables using SQLAlchemy
VERIFY_TABLES=$(az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME --command "cd $APP_DIR && python -c \"
from database.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'Tables created: {len(tables)}')
for table in tables:
    print(f'  - {table}')
\"" 2>/dev/null)

if [ -n "$VERIFY_TABLES" ]; then
    echo "$VERIFY_TABLES"
    echo ""
    echo -e "${GREEN}✓ Tables verified in database${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify tables (but migration may have succeeded)${NC}"
fi

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Migration process complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Test your API endpoints"
echo "  2. Check database has expected tables"
echo "  3. View logs: az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
