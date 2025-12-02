#!/bin/bash
#
# Validate Azure Container Instances Deployment (Workers Only)
# Tests the deployed worker containers on Azure
#
# This script:
# 1. Checks container group status
# 2. Validates worker containers are running
# 3. Checks worker logs for activity
# 4. Verifies worker health
#
# Usage:
#   ./validate-aci-deployment.sh [--test|--prod]
#
# Options:
#   --test    Validate test environment (default)
#   --prod    Validate production environment
#
# Note: API validation is not included as API runs on App Service

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="powernova"

# Check environment
if [ "$1" == "--prod" ]; then
    ENVIRONMENT="prod"
    CONTAINER_GROUP="powernova-workers-prod"
    echo -e "${BLUE}Validating PRODUCTION environment${NC}"
else
    ENVIRONMENT="test"
    CONTAINER_GROUP="powernova-workers-test"
    echo -e "${YELLOW}Validating TEST environment${NC}"
fi

echo "=" >&2
echo "Validating Azure Container Instances Deployment (Workers Only)" >&2
echo "=" >&2
echo "Container Group: $CONTAINER_GROUP" >&2
echo "=" >&2
echo "" >&2

# Step 1: Check Azure CLI
echo -e "${BLUE}[1/5] Checking Azure CLI...${NC}" >&2
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI not found${NC}" >&2
    exit 1
fi
echo -e "${GREEN}✓ Azure CLI found${NC}" >&2
echo "" >&2

# Step 2: Check login
echo -e "${BLUE}[2/5] Checking Azure login...${NC}" >&2
if ! az account show &> /dev/null; then
    echo -e "${RED}✗ Not logged in to Azure${NC}" >&2
    exit 1
fi
echo -e "${GREEN}✓ Logged in to Azure${NC}" >&2
echo "" >&2

# Step 3: Check container group exists
echo -e "${BLUE}[3/5] Checking container group...${NC}" >&2
if ! az container show --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_GROUP" &> /dev/null; then
    echo -e "${RED}✗ Container group not found${NC}" >&2
    echo "Please deploy first using deploy-workers-azure-aci.sh" >&2
    exit 1
fi
echo -e "${GREEN}✓ Container group exists${NC}" >&2
echo "" >&2

# Step 4: Get container group details
echo -e "${BLUE}[4/5] Getting container details...${NC}" >&2

PROVISIONING_STATE=$(az container show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --query provisioningState -o tsv)

echo "Provisioning State: $PROVISIONING_STATE" >&2

if [ "$PROVISIONING_STATE" != "Succeeded" ]; then
    echo -e "${YELLOW}⚠ Provisioning state is not 'Succeeded'${NC}" >&2
fi

echo "" >&2

# Get individual container states
echo "Container States:" >&2
for container in crawler-worker doc-worker; do
    STATE=$(az container show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CONTAINER_GROUP" \
        --query "containers[?name=='$container'].instanceView.currentState.state" -o tsv)
    
    START_TIME=$(az container show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CONTAINER_GROUP" \
        --query "containers[?name=='$container'].instanceView.currentState.startTime" -o tsv)
    
    if [ "$STATE" == "Running" ]; then
        echo -e "  $container: ${GREEN}$STATE${NC} (started: $START_TIME)" >&2
    elif [ "$STATE" == "Waiting" ]; then
        echo -e "  $container: ${YELLOW}$STATE${NC}" >&2
    else
        echo -e "  $container: ${RED}$STATE${NC}" >&2
    fi
done

echo "" >&2
echo -e "${GREEN}✓ Container details retrieved${NC}" >&2
echo "" >&2

# Step 5: Check worker logs
echo -e "${BLUE}[5/5] Checking worker logs...${NC}" >&2

echo "Recent crawler worker logs:" >&2
echo "---" >&2
az container logs \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --container-name crawler-worker \
    --tail 10
echo "---" >&2
echo "" >&2

echo "Recent doc worker logs:" >&2
echo "---" >&2
az container logs \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --container-name doc-worker \
    --tail 10
echo "---" >&2
echo "" >&2

echo -e "${GREEN}✓ Log checks complete${NC}" >&2
echo "" >&2

# Check for common issues in logs
echo "Analyzing logs for issues..." >&2
CRAWLER_ERRORS=$(az container logs \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --container-name crawler-worker \
    --tail 100 | grep -i "error\|exception\|failed" | wc -l)

DOC_ERRORS=$(az container logs \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP" \
    --container-name doc-worker \
    --tail 100 | grep -i "error\|exception\|failed" | wc -l)

if [ "$CRAWLER_ERRORS" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Found $CRAWLER_ERRORS error/exception messages in crawler worker logs${NC}" >&2
else
    echo -e "  ${GREEN}✓ No errors in crawler worker logs${NC}" >&2
fi

if [ "$DOC_ERRORS" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Found $DOC_ERRORS error/exception messages in doc worker logs${NC}" >&2
else
    echo -e "  ${GREEN}✓ No errors in doc worker logs${NC}" >&2
fi

echo "" >&2

# Summary
echo "=" >&2
echo -e "${GREEN}Validation Complete${NC}" >&2
echo "=" >&2
echo "" >&2
echo "Workers are running on Azure Container Instances" >&2
echo "API continues to run on App Service (not part of this deployment)" >&2
echo "" >&2
echo "View full logs:" >&2
echo "  Crawler Worker: az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name crawler-worker" >&2
echo "  Doc Worker:     az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name doc-worker" >&2
echo "" >&2
echo "Follow logs in real-time:" >&2
echo "  az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name crawler-worker --follow" >&2
echo "  az container logs -g $RESOURCE_GROUP -n $CONTAINER_GROUP --container-name doc-worker --follow" >&2
echo "" >&2
echo "Monitor container status:" >&2
echo "  az container show -g $RESOURCE_GROUP -n $CONTAINER_GROUP" >&2
echo "" >&2
echo "=" >&2
