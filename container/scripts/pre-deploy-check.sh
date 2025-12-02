#!/bin/bash
#
# Pre-deployment Validation Script
# Checks all prerequisites before deploying to ACI
#

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=" 
echo "Pre-Deployment Validation"
echo "="
echo ""

# Check 1: Azure CLI
echo -e "${BLUE}[1/10] Checking Azure CLI...${NC}"
if command -v az &> /dev/null; then
    AZ_VERSION=$(az version --query '"azure-cli"' -o tsv)
    echo -e "${GREEN}✓ Azure CLI installed (version: $AZ_VERSION)${NC}"
else
    echo -e "${RED}✗ Azure CLI not found${NC}"
    exit 1
fi
echo ""

# Check 2: Azure login
echo -e "${BLUE}[2/10] Checking Azure login...${NC}"
if az account show &> /dev/null; then
    ACCOUNT=$(az account show --query name -o tsv)
    echo -e "${GREEN}✓ Logged in to Azure (account: $ACCOUNT)${NC}"
else
    echo -e "${RED}✗ Not logged in to Azure${NC}"
    echo "Run: az login"
    exit 1
fi
echo ""

# Check 3: Resource group
echo -e "${BLUE}[3/10] Checking resource group...${NC}"
if az group show --name "powernova" &> /dev/null; then
    echo -e "${GREEN}✓ Resource group 'powernova' exists${NC}"
else
    echo -e "${RED}✗ Resource group 'powernova' not found${NC}"
    exit 1
fi
echo ""

# Check 4: ACR
echo -e "${BLUE}[4/10] Checking Azure Container Registry...${NC}"
if az acr show --name "powernovaapiacr" &> /dev/null; then
    echo -e "${GREEN}✓ ACR 'powernovaapiacr' exists${NC}"
else
    echo -e "${RED}✗ ACR 'powernovaapiacr' not found${NC}"
    exit 1
fi
echo ""

# Check 5: Template file
echo -e "${BLUE}[5/10] Checking ARM template...${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../templates/aci-deployment.json"
if [ -f "$TEMPLATE_FILE" ]; then
    echo -e "${GREEN}✓ Template file exists: $TEMPLATE_FILE${NC}"
    
    # Validate JSON syntax
    if jq empty "$TEMPLATE_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓ Template JSON is valid${NC}"
    else
        echo -e "${RED}✗ Template JSON is invalid${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Template file not found: $TEMPLATE_FILE${NC}"
    exit 1
fi
echo ""

# Check 6: Environment variables
echo -e "${BLUE}[6/10] Checking environment variables...${NC}"

MISSING_VARS=()

if [ -z "$DATABASE_URL" ]; then
    MISSING_VARS+=("DATABASE_URL")
fi

if [ -z "$AZURE_STORAGE_CONNECTION_STRING" ]; then
    MISSING_VARS+=("AZURE_STORAGE_CONNECTION_STRING")
fi

if [ -z "$AZURE_STORAGE_CONTAINER_NAME" ]; then
    MISSING_VARS+=("AZURE_STORAGE_CONTAINER_NAME")
fi

if [ -z "$OPENAI_API_KEY" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All required environment variables are set${NC}"
    echo "  - DATABASE_URL: ${DATABASE_URL:0:20}..."
    echo "  - AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING:0:20}..."
    echo "  - AZURE_STORAGE_CONTAINER_NAME: $AZURE_STORAGE_CONTAINER_NAME"
    echo "  - OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
else
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi
echo ""

# Check 7: Database connectivity (basic DNS check)
echo -e "${BLUE}[7/10] Checking database URL format...${NC}"
if [[ $DATABASE_URL =~ ^postgresql:// ]]; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    echo -e "${GREEN}✓ Database URL format is valid${NC}"
    echo "  Host: $DB_HOST"
    
    # Try DNS lookup
    if host "$DB_HOST" &> /dev/null; then
        echo -e "${GREEN}✓ Database host is reachable (DNS)${NC}"
    else
        echo -e "${YELLOW}⚠ Database host DNS lookup failed${NC}"
    fi
else
    echo -e "${RED}✗ DATABASE_URL format is invalid${NC}"
    echo "Expected format: postgresql://user:pass@host:port/db?sslmode=require"
    exit 1
fi
echo ""

# Check 8: Storage account
echo -e "${BLUE}[8/10] Checking Azure Storage connection...${NC}"
if [[ $AZURE_STORAGE_CONNECTION_STRING =~ AccountName=([^;]*) ]]; then
    STORAGE_ACCOUNT="${BASH_REMATCH[1]}"
    echo -e "${GREEN}✓ Storage connection string format is valid${NC}"
    echo "  Account: $STORAGE_ACCOUNT"
else
    echo -e "${YELLOW}⚠ Could not parse storage account name${NC}"
fi
echo ""

# Check 9: Docker (optional)
echo -e "${BLUE}[9/10] Checking Docker...${NC}"
if docker info > /dev/null 2>&1; then
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Docker is running (version: $DOCKER_VERSION)${NC}"
    echo "  Will build image locally"
else
    echo -e "${YELLOW}⚠ Docker is not running${NC}"
    echo "  Will use Azure ACR Build Task (slower but works without Docker)"
fi
echo ""

# Check 10: Existing deployment
echo -e "${BLUE}[10/10] Checking for existing deployment...${NC}"
if az container show --resource-group "powernova" --name "powernova-workers-test" &> /dev/null; then
    echo -e "${YELLOW}⚠ Existing test deployment found${NC}"
    echo "  Will be deleted and recreated"
else
    echo -e "${GREEN}✓ No existing test deployment${NC}"
fi

if az container show --resource-group "powernova" --name "powernova-workers-prod" &> /dev/null; then
    echo -e "${YELLOW}⚠ Existing production deployment found${NC}"
    echo "  Will be deleted and recreated"
else
    echo -e "${GREEN}✓ No existing production deployment${NC}"
fi
echo ""

# Summary
echo "="
echo -e "${GREEN}Pre-Deployment Validation Complete${NC}"
echo "="
echo ""
echo "You can now deploy using:"
echo "  ./scripts/deploy-workers-azure-aci.sh --test    # For test environment"
echo "  ./scripts/deploy-workers-azure-aci.sh           # For production"
echo ""
