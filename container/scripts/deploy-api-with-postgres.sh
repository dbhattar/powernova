#!/bin/bash
# Deploy PowerNOVA API with Azure Database for PostgreSQL
# This is the RECOMMENDED production deployment approach

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================================"
echo "PowerNOVA API + Azure PostgreSQL Deployment"
echo -e "========================================================${NC}"
echo ""

# Configuration
RESOURCE_GROUP="powernova"
LOCATION="westus2"
DB_SERVER_NAME="powernova-db-server"
DB_ADMIN_USER="powernova_admin"
DB_NAME="powernova_db"
APP_NAME="powernovaapi"
APP_PLAN="powernova-api-plan"

# Check if Azure CLI is logged in
if ! az account show > /dev/null 2>&1; then
    echo -e "${RED}✗ Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}"
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "Subscription: $SUBSCRIPTION"
echo ""

# Get database password
echo -e "${YELLOW}Database Configuration${NC}"
echo "====================="
echo ""

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${YELLOW}Enter a strong password for PostgreSQL admin user:${NC}"
    read -s POSTGRES_PASSWORD
    echo ""
    echo -e "${YELLOW}Confirm password:${NC}"
    read -s POSTGRES_PASSWORD_CONFIRM
    echo ""
    
    if [ "$POSTGRES_PASSWORD" != "$POSTGRES_PASSWORD_CONFIRM" ]; then
        echo -e "${RED}✗ Passwords don't match${NC}"
        exit 1
    fi
    
    if [ ${#POSTGRES_PASSWORD} -lt 12 ]; then
        echo -e "${RED}✗ Password must be at least 12 characters${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Password configured${NC}"
echo ""

# Check if PostgreSQL server already exists
echo -e "${BLUE}Checking if PostgreSQL server exists...${NC}"
if az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $DB_SERVER_NAME > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  PostgreSQL server '$DB_SERVER_NAME' already exists${NC}"
    echo ""
    echo "Options:"
    echo "  1. Use existing server (skip creation)"
    echo "  2. Delete and recreate"
    echo "  3. Create new server with different name"
    echo ""
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
        1)
            echo -e "${GREEN}✓ Using existing PostgreSQL server${NC}"
            SKIP_DB_CREATION=true
            ;;
        2)
            echo -e "${YELLOW}Deleting existing server...${NC}"
            az postgres flexible-server delete \
                --resource-group $RESOURCE_GROUP \
                --name $DB_SERVER_NAME \
                --yes
            echo -e "${GREEN}✓ Server deleted${NC}"
            SKIP_DB_CREATION=false
            ;;
        3)
            read -p "Enter new server name: " DB_SERVER_NAME
            SKIP_DB_CREATION=false
            ;;
        *)
            echo -e "${RED}✗ Invalid choice${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}✓ Server name available${NC}"
    SKIP_DB_CREATION=false
fi

echo ""

# Create PostgreSQL Flexible Server
if [ "$SKIP_DB_CREATION" != "true" ]; then
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW}Step 1: Creating PostgreSQL Server${NC}"
    echo -e "${YELLOW}======================================${NC}"
    echo ""
    echo "Server name: $DB_SERVER_NAME"
    echo "Location: $LOCATION"
    echo "SKU: Standard_B1ms (Burstable)"
    echo "Storage: 32 GB"
    echo "PostgreSQL version: 16"
    echo ""
    
    if az postgres flexible-server create \
        --resource-group $RESOURCE_GROUP \
        --name $DB_SERVER_NAME \
        --location $LOCATION \
        --admin-user $DB_ADMIN_USER \
        --admin-password "$POSTGRES_PASSWORD" \
        --sku-name Standard_B1ms \
        --tier Burstable \
        --version 16 \
        --storage-size 32 \
        --public-access 0.0.0.0 \
        --tags Environment=Production App=PowerNOVA; then
        echo -e "${GREEN}✓ PostgreSQL server created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create PostgreSQL server${NC}"
        exit 1
    fi
    
    echo ""
    
    # Configure firewall
    echo -e "${YELLOW}Configuring firewall rules...${NC}"
    az postgres flexible-server firewall-rule create \
        --resource-group $RESOURCE_GROUP \
        --name $DB_SERVER_NAME \
        --rule-name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0 > /dev/null
    
    echo -e "${GREEN}✓ Firewall configured${NC}"
    echo ""
    
    # Create database
    echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
    if az postgres flexible-server db create \
        --resource-group $RESOURCE_GROUP \
        --server-name $DB_SERVER_NAME \
        --database-name $DB_NAME; then
        echo -e "${GREEN}✓ Database created${NC}"
    else
        echo -e "${YELLOW}⚠️  Database might already exist${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Step 2: Updating App Service${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Build connection string
DB_HOST="${DB_SERVER_NAME}.postgres.database.azure.com"
DB_CONNECTION_STRING="postgresql://${DB_ADMIN_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"

echo "Updating App Service configuration..."

if az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        DATABASE_URL="$DB_CONNECTION_STRING" \
        POSTGRES_HOST="$DB_HOST" \
        POSTGRES_DB="$DB_NAME" \
        POSTGRES_USER="$DB_ADMIN_USER" > /dev/null; then
    echo -e "${GREEN}✓ App Service configuration updated${NC}"
else
    echo -e "${RED}✗ Failed to update App Service${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Step 3: Running Database Migrations${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

echo "Note: You'll need to run migrations manually after deployment:"
echo ""
echo "Option 1: Via App Service Console (Azure Portal)"
echo "  1. Go to Azure Portal → App Services → $APP_NAME"
echo "  2. Navigate to 'Console' or 'SSH'"
echo "  3. Run: alembic upgrade head"
echo ""
echo "Option 2: Via local connection"
echo "  1. Install psql locally"
echo "  2. Run migrations with connection string"
echo ""
echo -e "${BLUE}Migration command:${NC}"
echo "  export DATABASE_URL='$DB_CONNECTION_STRING'"
echo "  alembic upgrade head"
echo ""

# Restart App Service
echo -e "${YELLOW}Restarting App Service...${NC}"
if az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME > /dev/null 2>&1; then
    echo -e "${GREEN}✓ App Service restarted${NC}"
else
    echo -e "${YELLOW}⚠️  Could not restart App Service${NC}"
fi

echo ""
echo -e "${GREEN}========================================================"
echo "✓ Deployment Complete!"
echo -e "========================================================${NC}"
echo ""
echo -e "${BLUE}PostgreSQL Server Details:${NC}"
echo "  Server: $DB_HOST"
echo "  Database: $DB_NAME"
echo "  Username: $DB_ADMIN_USER"
echo "  SSL: Required"
echo ""
echo -e "${BLUE}Connection String (saved in App Service settings):${NC}"
echo "  $DB_CONNECTION_STRING"
echo ""
echo -e "${BLUE}App Service:${NC}"
echo "  Name: $APP_NAME"
echo "  URL: https://$APP_NAME.azurewebsites.net"
echo "  Health: https://$APP_NAME.azurewebsites.net/health"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify App Service is running:"
echo "     curl https://$APP_NAME.azurewebsites.net/health"
echo ""
echo "  2. Run database migrations (see instructions above)"
echo ""
echo "  3. Test database connectivity:"
echo "     Check logs for database connection status"
echo ""
echo "  4. Set up automated backups (recommended):"
echo "     az postgres flexible-server backup create \\"
echo "       --resource-group $RESOURCE_GROUP \\"
echo "       --name $DB_SERVER_NAME"
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo ""
echo "  View database logs:"
echo "    az postgres flexible-server server-logs list \\"
echo "      --resource-group $RESOURCE_GROUP \\"
echo "      --name $DB_SERVER_NAME"
echo ""
echo "  Connect to database:"
echo "    psql 'postgresql://${DB_ADMIN_USER}@${DB_HOST}:5432/${DB_NAME}?sslmode=require'"
echo ""
echo "  Monitor database:"
echo "    az monitor metrics list \\"
echo "      --resource /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DBforPostgreSQL/flexibleServers/$DB_SERVER_NAME \\"
echo "      --metric cpu_percent"
echo ""
echo -e "${GREEN}Deployment successful! 🚀${NC}"
echo ""

# Save connection details to file
CONNECTION_FILE="azure-postgres-connection.txt"
cat > $CONNECTION_FILE << EOF
PowerNOVA PostgreSQL Connection Details
========================================

Server: $DB_HOST
Database: $DB_NAME
Username: $DB_ADMIN_USER
Password: <saved in Azure App Service settings>
SSL Mode: require

Connection String:
$DB_CONNECTION_STRING

Azure Portal:
Resource Group: $RESOURCE_GROUP
PostgreSQL Server: $DB_SERVER_NAME
App Service: $APP_NAME

Created: $(date)
EOF

echo -e "${BLUE}Connection details saved to: $CONNECTION_FILE${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Keep the password secure!${NC}"
echo "Consider using Azure Key Vault for production secrets."
echo ""
