#!/bin/bash
# Deploy PowerNOVA API with Supabase PostgreSQL
# This uses Supabase free tier for production database

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================================"
echo "PowerNOVA API + Supabase PostgreSQL Deployment"
echo -e "========================================================${NC}"
echo ""

# Configuration
RESOURCE_GROUP="powernova"
APP_NAME="powernovaapi"

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

# Check for .env.production file
if [ ! -f ".env.production" ]; then
    echo -e "${RED}✗ .env.production file not found${NC}"
    echo ""
    echo "Please create .env.production file with your Supabase credentials:"
    echo "  1. Copy .env.production.template to .env.production"
    echo "  2. Fill in your Supabase connection details"
    echo "  3. Run this script again"
    echo ""
    echo "Quick setup:"
    echo "  cp .env.production.template .env.production"
    echo "  nano .env.production  # Edit with your credentials"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Found .env.production file${NC}"
echo ""

# Load environment variables from .env.production
echo -e "${YELLOW}Loading configuration from .env.production...${NC}"
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# Validate required variables
REQUIRED_VARS=("DATABASE_URL" "SUPABASE_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please update .env.production with all required values"
    exit 1
fi

echo -e "${GREEN}✓ All required variables found${NC}"
echo ""

# Display configuration (masked)
echo -e "${BLUE}Configuration:${NC}"
echo "  Supabase URL: $SUPABASE_URL"
echo "  Database: ${DATABASE_URL%%@*}@***"
echo "  App Service: $APP_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo ""

# Confirm before proceeding
read -p "Deploy to Azure App Service? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Step 1: Updating App Service Settings${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Update App Service configuration
echo "Updating environment variables..."

if az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        DATABASE_URL="$DATABASE_URL" \
        SUPABASE_URL="$SUPABASE_URL" \
        SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}" \
        SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}" \
        ENVIRONMENT="${ENVIRONMENT:-production}" \
        DEBUG="${DEBUG:-false}" \
        LOG_LEVEL="${LOG_LEVEL:-INFO}" \
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://powernova.ai,https://www.powernova.ai}" \
        SECRET_KEY="${SECRET_KEY:-}" \
        ALGORITHM="${ALGORITHM:-HS256}" \
        ACCESS_TOKEN_EXPIRE_MINUTES="${ACCESS_TOKEN_EXPIRE_MINUTES:-30}" \
        DB_POOL_SIZE="${DB_POOL_SIZE:-5}" \
        DB_MAX_OVERFLOW="${DB_MAX_OVERFLOW:-0}" \
        DB_POOL_TIMEOUT="${DB_POOL_TIMEOUT:-30}" \
        DB_POOL_RECYCLE="${DB_POOL_RECYCLE:-3600}" > /dev/null; then
    echo -e "${GREEN}✓ App Service configuration updated${NC}"
else
    echo -e "${RED}✗ Failed to update App Service${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Step 2: Database Migrations${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Check if DATABASE_URL_DIRECT is set for migrations
if [ -z "$DATABASE_URL_DIRECT" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL_DIRECT not set${NC}"
    echo "Using DATABASE_URL for migrations (this might not work with connection pooler)"
    MIGRATION_URL="$DATABASE_URL"
else
    echo -e "${GREEN}✓ Using direct connection for migrations${NC}"
    MIGRATION_URL="$DATABASE_URL_DIRECT"
fi

echo ""
echo "Running database migrations..."
echo ""

# Run migrations
if DATABASE_URL="$MIGRATION_URL" alembic upgrade head; then
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    echo ""
    echo "You can run migrations manually:"
    echo "  export DATABASE_URL='$MIGRATION_URL'"
    echo "  alembic upgrade head"
    echo ""
    read -p "Continue with deployment? (y/N): " continue_deploy
    if [[ ! $continue_deploy =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Step 3: Restarting App Service${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

echo "Restarting App Service..."
if az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME > /dev/null 2>&1; then
    echo -e "${GREEN}✓ App Service restarted${NC}"
else
    echo -e "${YELLOW}⚠️  Could not restart App Service${NC}"
fi

echo ""
echo -e "${YELLOW}Waiting for app to start...${NC}"
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_URL="https://$APP_NAME.azurewebsites.net/health"

for i in {1..5}; do
    if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is responding${NC}"
        break
    else
        if [ $i -eq 5 ]; then
            echo -e "${YELLOW}⚠️  API not responding yet (this is normal, may need more time)${NC}"
        else
            echo "  Attempt $i/5..."
            sleep 3
        fi
    fi
done

echo ""
echo -e "${GREEN}========================================================"
echo "✓ Deployment Complete!"
echo -e "========================================================${NC}"
echo ""
echo -e "${BLUE}Application Details:${NC}"
echo "  App Service: $APP_NAME"
echo "  URL: https://$APP_NAME.azurewebsites.net"
echo "  Health: https://$APP_NAME.azurewebsites.net/health"
echo "  API Docs: https://$APP_NAME.azurewebsites.net/docs"
echo ""
echo -e "${BLUE}Supabase Details:${NC}"
echo "  Project URL: $SUPABASE_URL"
echo "  Dashboard: https://app.supabase.com"
echo "  Database: Check Table Editor for migrated tables"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "  1. Verify API is running:"
echo "     curl https://$APP_NAME.azurewebsites.net/health"
echo ""
echo "  2. Check Supabase dashboard:"
echo "     - Go to Table Editor"
echo "     - Verify tables exist: users, conversations, messages, artifacts"
echo ""
echo "  3. View application logs:"
echo "     az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  4. Test database connectivity:"
echo "     Check logs for successful database connection"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo "  Check app status:"
echo "    az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query state"
echo ""
echo "  View app settings:"
echo "    az webapp config appsettings list --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  Run migrations again:"
echo "    export DATABASE_URL='$MIGRATION_URL'"
echo "    alembic upgrade head"
echo ""
echo "  Check Supabase database size:"
echo "    Go to Dashboard → Database → Usage"
echo ""
echo -e "${GREEN}Deployment successful! 🚀${NC}"
echo ""

# Save deployment info
DEPLOY_INFO="deployment-info-$(date +%Y%m%d-%H%M%S).txt"
cat > $DEPLOY_INFO << EOF
PowerNOVA Deployment Information
================================

Deployment Date: $(date)
App Service: $APP_NAME
Resource Group: $RESOURCE_GROUP
Supabase Project: $SUPABASE_URL

URLs:
  - API: https://$APP_NAME.azurewebsites.net
  - Health: https://$APP_NAME.azurewebsites.net/health
  - Docs: https://$APP_NAME.azurewebsites.net/docs
  - Supabase: https://app.supabase.com

Configuration:
  - Environment: ${ENVIRONMENT:-production}
  - Debug: ${DEBUG:-false}
  - Log Level: ${LOG_LEVEL:-INFO}
  - Database Pool Size: ${DB_POOL_SIZE:-5}
  - Database Max Overflow: ${DB_MAX_OVERFLOW:-0}

Next Steps:
  1. Test API health endpoint
  2. Verify database tables in Supabase
  3. Check application logs
  4. Monitor Supabase usage dashboard
EOF

echo -e "${BLUE}Deployment info saved to: $DEPLOY_INFO${NC}"
echo ""
