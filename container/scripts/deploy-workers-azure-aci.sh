#!/bin/bash
#
# Azure Container Instances (ACI) Deployment Script - Workers Only
# Deploys PowerNOVA worker containers for background job processing
#
# This script deploys a 2-container setup to Azure Container Instances:
# 1. Crawler Worker Container - Processes crawl jobs
# 2. Document Worker Container - Generates embeddings/chunks
#
# Note: API continues to run on Azure App Service (not part of this deployment)
#
# All containers share the same Azure PostgreSQL database
#
# Template: Uses templates/aci-deployment.json (ARM template)
# Parameters: Generated dynamically from environment variables
# Deployment: Azure CLI deployment group create
#
# Usage:
#   ./deploy-workers-azure-aci.sh [--test]
#
# Options:
#   --test    Deploy to test environment (powernova-workers-test)
#   (default) Deploy to production (powernova-workers-prod)
#

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="powernova"
LOCATION="westus2"
ACR_NAME="powernovaapiacr"  # Updated to match existing ACR
IMAGE_REPOSITORY="powernova-workers"  # Separate repository for worker containers
IMAGE_TAG="latest"

# Check if test mode
if [ "$1" == "--test" ]; then
    ENVIRONMENT="test"
    CONTAINER_GROUP="powernova-workers-test"
    echo -e "${YELLOW}Deploying to TEST environment${NC}"
else
    ENVIRONMENT="prod"
    CONTAINER_GROUP="powernova-workers-prod"
    echo -e "${BLUE}Deploying to PRODUCTION environment${NC}"
fi

echo "=" >&2
echo "Azure Container Instances Deployment (Workers Only)" >&2
echo "=" >&2
echo "Resource Group: $RESOURCE_GROUP" >&2
echo "Location: $LOCATION" >&2
echo "Container Group: $CONTAINER_GROUP" >&2
echo "=" >&2
echo "" >&2

# Step 1: Check Azure CLI
echo -e "${BLUE}[1/8] Checking Azure CLI...${NC}" >&2
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI not found. Please install it first.${NC}" >&2
    exit 1
fi
echo -e "${GREEN}✓ Azure CLI found${NC}" >&2
echo "" >&2

# Step 2: Login check
echo -e "${BLUE}[2/8] Checking Azure login...${NC}" >&2
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in. Please login:${NC}" >&2
    az login
fi
echo -e "${GREEN}✓ Logged in to Azure${NC}" >&2
echo "" >&2

# Step 3: Check resource group
echo -e "${BLUE}[3/8] Checking resource group...${NC}" >&2
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${YELLOW}Resource group not found. Creating...${NC}" >&2
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
fi
echo -e "${GREEN}✓ Resource group exists${NC}" >&2
echo "" >&2

# Step 4: Get Azure credentials from environment or .env file
echo -e "${BLUE}[4/8] Getting configuration...${NC}" >&2

# Try to load from .env file first
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    echo "Loading configuration from $ENV_FILE file..." >&2
    
    # Load environment variables from .env file (only if not already set)
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Only set if not already in environment
        if [ -z "${!key}" ]; then
            export "$key=$value"
            echo "  Loaded: $key" >&2
        else
            echo "  Using existing env: $key" >&2
        fi
    done < <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
    
    echo -e "${GREEN}✓ Configuration loaded from .env file${NC}" >&2
else
    echo -e "${YELLOW}No .env file found at $ENV_FILE${NC}" >&2
    echo "Using environment variables directly..." >&2
fi
echo "" >&2

# Validate required environment variables
echo "Validating required environment variables..." >&2

# Database URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL not set${NC}" >&2
    echo "Please set DATABASE_URL environment variable or add to .env" >&2
    echo "Example: export DATABASE_URL='postgresql://user:pass@host:5432/db'" >&2
    exit 1
fi

# Azure Storage
if [ -z "$AZURE_STORAGE_CONNECTION_STRING" ]; then
    echo -e "${RED}✗ AZURE_STORAGE_CONNECTION_STRING not set${NC}" >&2
    echo "Please set environment variable or add to .env" >&2
    exit 1
fi

if [ -z "$AZURE_STORAGE_CONTAINER_NAME" ]; then
    echo -e "${RED}✗ AZURE_STORAGE_CONTAINER_NAME not set${NC}" >&2
    echo "Please set environment variable or add to .env" >&2
    exit 1
fi

# Azure OpenAI configuration (required for doc worker and crawler)
# Check if using Azure OpenAI or standard OpenAI
USE_AZURE_OPENAI="${USE_AZURE_OPENAI:-true}"

if [ "$USE_AZURE_OPENAI" == "true" ]; then
    echo "Using Azure OpenAI configuration..." >&2
    
    if [ -z "$AZURE_OPENAI_ENDPOINT" ]; then
        echo -e "${RED}✗ AZURE_OPENAI_ENDPOINT not set${NC}" >&2
        echo "Please set environment variable or add to .env" >&2
        exit 1
    fi
    
    if [ -z "$AZURE_OPENAI_API_KEY" ]; then
        echo -e "${RED}✗ AZURE_OPENAI_API_KEY not set${NC}" >&2
        echo "Please set environment variable or add to .env" >&2
        exit 1
    fi
    
    if [ -z "$AZURE_OPENAI_CHAT_DEPLOYMENT" ]; then
        echo -e "${RED}✗ AZURE_OPENAI_CHAT_DEPLOYMENT not set${NC}" >&2
        echo "Please set environment variable or add to .env" >&2
        exit 1
    fi
    
    if [ -z "$AZURE_OPENAI_EMBEDDING_DEPLOYMENT" ]; then
        echo -e "${RED}✗ AZURE_OPENAI_EMBEDDING_DEPLOYMENT not set${NC}" >&2
        echo "Please set environment variable or add to .env" >&2
        exit 1
    fi
    
    # API version is optional with default
    AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2024-02-15-preview}"
else
    echo "Using OpenAI configuration..." >&2
    
    if [ -z "$OPENAI_API_KEY" ]; then
        echo -e "${RED}✗ OPENAI_API_KEY not set${NC}" >&2
        echo "Please set environment variable or add to .env" >&2
        exit 1
    fi
fi

# Print configuration summary (without sensitive values)
echo "" >&2
echo -e "${GREEN}✓ Configuration validated${NC}" >&2
echo "" >&2
echo "Configuration Summary:" >&2
echo "  Database: ${DATABASE_URL%%@*}@***" >&2
echo "  Storage Container: $AZURE_STORAGE_CONTAINER_NAME" >&2
if [ "$USE_AZURE_OPENAI" == "true" ]; then
    echo "  OpenAI Provider: Azure OpenAI" >&2
    echo "  Endpoint: $AZURE_OPENAI_ENDPOINT" >&2
    echo "  Chat Deployment: $AZURE_OPENAI_CHAT_DEPLOYMENT" >&2
    echo "  Embedding Deployment: $AZURE_OPENAI_EMBEDDING_DEPLOYMENT" >&2
    echo "  API Version: $AZURE_OPENAI_API_VERSION" >&2
else
    echo "  OpenAI Provider: Standard OpenAI" >&2
fi

echo -e "${GREEN}✓ Configuration loaded${NC}" >&2
echo "" >&2

# Step 5: Build and push Docker images
echo -e "${BLUE}[5/8] Building and pushing Docker images...${NC}" >&2

# Check if Docker is running
if docker info > /dev/null 2>&1; then
    echo "Docker is running. Building locally..." >&2
    
    # Login to ACR
    az acr login --name "$ACR_NAME"
    
    # Build API image locally for AMD64 (required for Azure Container Instances)
    echo "Building unified worker image for linux/amd64 (no cache)..." >&2
    cd "$(dirname "$0")/.."  # Go to project root
    docker build --no-cache --platform linux/amd64 -f docker/Dockerfile.api -t "$ACR_NAME.azurecr.io/$IMAGE_REPOSITORY:$IMAGE_TAG" .
    
    # Push to ACR
    echo "Pushing image to ACR..." >&2
    docker push "$ACR_NAME.azurecr.io/$IMAGE_REPOSITORY:$IMAGE_TAG"
else
    echo -e "${YELLOW}Docker is not running. Using Azure Container Registry build task...${NC}" >&2
    
    # Use ACR build task (no local Docker required)
    # Note: Worker containers (crawler, doc worker) use the same image
    #       but with different entry points defined in the ARM template:
    #       - Crawler: Runs workers/crawler_worker.py
    #       - Doc Worker: Runs workers/doc_worker.py
    echo "Building worker image in Azure..." >&2
    cd "$(dirname "$0")/.."  # Go to project root
    
    az acr build \
        --registry "$ACR_NAME" \
        --image "$IMAGE_REPOSITORY:$IMAGE_TAG" \
        --file docker/Dockerfile.api \
        --platform linux/amd64 \
        .
fi

echo -e "${GREEN}✓ Images built and pushed${NC}" >&2
echo "" >&2

# Step 6: Delete existing container group if exists
echo -e "${BLUE}[6/8] Checking for existing deployment...${NC}" >&2
if az container show --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_GROUP" &> /dev/null; then
    echo -e "${YELLOW}Existing container group found. Deleting...${NC}" >&2
    az container delete \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CONTAINER_GROUP" \
        --yes
    echo "Waiting for deletion to complete..." >&2
    sleep 10
fi
echo -e "${GREEN}✓ Ready for deployment${NC}" >&2
echo "" >&2

# Step 7: Deploy container group using ARM template
echo -e "${BLUE}[7/8] Deploying container group...${NC}" >&2

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../templates/aci-deployment.json"

# Check if template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}✗ Template file not found: $TEMPLATE_FILE${NC}" >&2
    exit 1
fi

# Create parameters JSON for deployment
echo "Generating deployment parameters..." >&2

# Build the parameters JSON with conditional OpenAI/Azure OpenAI settings
if [ "$USE_AZURE_OPENAI" == "true" ]; then
    cat > /tmp/powernova-workers-params.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "value": "$LOCATION"
    },
    "containerGroupName": {
      "value": "$CONTAINER_GROUP"
    },
    "environment": {
      "value": "$ENVIRONMENT"
    },
    "acrName": {
      "value": "$ACR_NAME"
    },
    "acrUsername": {
      "value": "$ACR_USERNAME"
    },
    "acrPassword": {
      "value": "$ACR_PASSWORD"
    },
    "imageRepository": {
      "value": "$IMAGE_REPOSITORY"
    },
    "imageTag": {
      "value": "$IMAGE_TAG"
    },
    "databaseUrl": {
      "value": "$DATABASE_URL"
    },
    "azureStorageConnectionString": {
      "value": "$AZURE_STORAGE_CONNECTION_STRING"
    },
    "azureStorageContainerName": {
      "value": "$AZURE_STORAGE_CONTAINER_NAME"
    },
    "useAzureOpenAI": {
      "value": "true"
    },
    "azureOpenAIEndpoint": {
      "value": "$AZURE_OPENAI_ENDPOINT"
    },
    "azureOpenAIApiKey": {
      "value": "$AZURE_OPENAI_API_KEY"
    },
    "azureOpenAIApiVersion": {
      "value": "$AZURE_OPENAI_API_VERSION"
    },
    "azureOpenAIChatDeployment": {
      "value": "$AZURE_OPENAI_CHAT_DEPLOYMENT"
    },
    "azureOpenAIEmbeddingDeployment": {
      "value": "$AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
    }
  }
}
EOF
else
    cat > /tmp/powernova-workers-params.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "value": "$LOCATION"
    },
    "containerGroupName": {
      "value": "$CONTAINER_GROUP"
    },
    "environment": {
      "value": "$ENVIRONMENT"
    },
    "acrName": {
      "value": "$ACR_NAME"
    },
    "acrUsername": {
      "value": "$ACR_USERNAME"
    },
    "acrPassword": {
      "value": "$ACR_PASSWORD"
    },
    "imageRepository": {
      "value": "$IMAGE_REPOSITORY"
    },
    "imageTag": {
      "value": "$IMAGE_TAG"
    },
    "databaseUrl": {
      "value": "$DATABASE_URL"
    },
    "azureStorageConnectionString": {
      "value": "$AZURE_STORAGE_CONNECTION_STRING"
    },
    "azureStorageContainerName": {
      "value": "$AZURE_STORAGE_CONTAINER_NAME"
    },
    "useAzureOpenAI": {
      "value": "false"
    },
    "openaiApiKey": {
      "value": "$OPENAI_API_KEY"
    }
  }
}
EOF
fi

# Deploy using ARM template
echo "Deploying container group using ARM template..." >&2
DEPLOYMENT_NAME="powernova-workers-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters @/tmp/powernova-workers-params.json

# Clean up parameters file
rm /tmp/powernova-workers-params.json

echo -e "${GREEN}✓ Container group deployed${NC}" >&2
echo "" >&2

# Step 8: Get deployment details
echo -e "${BLUE}[8/8] Getting deployment details...${NC}" >&2

# Wait for containers to start
echo "Waiting for containers to start..." >&2
sleep 15

# Get container statuses
echo "Getting container statuses..." >&2
CONTAINER_STATUS=$(az container show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --query "containers[].{name:name, state:instanceView.currentState.state, startTime:instanceView.currentState.startTime}" \
    -o table)

echo "" >&2
echo "=" >&2
echo -e "${GREEN}Deployment Complete!${NC}" >&2
echo "=" >&2
echo "" >&2
echo "Container Group: $CONTAINER_GROUP" >&2
echo "" >&2
echo "Container Statuses:" >&2
echo "$CONTAINER_STATUS" >&2
echo "" >&2
echo -e "${BLUE}View Logs:${NC}" >&2
echo "  Crawler Worker: az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name crawler-worker" >&2
echo "  Doc Worker:     az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name doc-worker" >&2
echo "" >&2
echo -e "${BLUE}Monitor Containers:${NC}" >&2
echo "  az container show -g $RESOURCE_GROUP -n $CONTAINER_GROUP" >&2
echo "" >&2
echo -e "${BLUE}Delete Deployment:${NC}" >&2
echo "  az container delete -g $RESOURCE_GROUP -n $CONTAINER_GROUP --yes" >&2
echo "" >&2
echo -e "${YELLOW}Note: API continues running on App Service${NC}" >&2
echo "=" >&2

echo "" >&2
echo -e "${GREEN}🎉 Worker deployment successful!${NC}" >&2
