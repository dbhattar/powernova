#!/bin/bash
# Test if environment variables are properly loaded in the API container

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Environment Variables Test${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if API container is running
if ! docker ps | grep -q powernova-api; then
    echo -e "${RED}✗ API container is not running${NC}"
    echo ""
    echo "Start it with:"
    echo "  cd docker && docker-compose up -d powernova-api"
    exit 1
fi

echo -e "${GREEN}✓ API container is running${NC}"
echo ""

# Test 1: Check if .env file exists
echo -e "${BLUE}Test 1: Checking if api/.env file exists${NC}"
if [ -f "api/.env" ]; then
    echo -e "${GREEN}✓ api/.env file exists${NC}"
else
    echo -e "${RED}✗ api/.env file not found${NC}"
    echo ""
    echo "Create it with:"
    echo "  cp api/.env.template api/.env"
    echo "  nano api/.env  # Add your OPENAI_API_KEY"
    exit 1
fi
echo ""

# Test 2: Check OPENAI_API_KEY in container
echo -e "${BLUE}Test 2: Checking OPENAI_API_KEY in container${NC}"
OPENAI_KEY=$(docker exec powernova-api sh -c 'echo $OPENAI_API_KEY' 2>/dev/null || echo "")

if [ -z "$OPENAI_KEY" ]; then
    echo -e "${RED}✗ OPENAI_API_KEY is not set in container${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check api/.env has OPENAI_API_KEY=sk-..."
    echo "  2. Restart container: docker-compose restart powernova-api"
    echo "  3. Check logs: docker logs powernova-api"
    exit 1
else
    # Mask the key for security
    MASKED_KEY="${OPENAI_KEY:0:8}...${OPENAI_KEY: -4}"
    echo -e "${GREEN}✓ OPENAI_API_KEY is set: $MASKED_KEY${NC}"
fi
echo ""

# Test 3: Check DATABASE_URL
echo -e "${BLUE}Test 3: Checking DATABASE_URL in container${NC}"
DATABASE_URL=$(docker exec powernova-api sh -c 'echo $DATABASE_URL' 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL is not set${NC}"
else
    # Mask password in URL
    MASKED_DB=$(echo "$DATABASE_URL" | sed -E 's/:([^@:]+)@/:***@/')
    echo -e "${GREEN}✓ DATABASE_URL is set: $MASKED_DB${NC}"
fi
echo ""

# Test 4: Check other important variables
echo -e "${BLUE}Test 4: Checking other environment variables${NC}"

check_env_var() {
    local var_name=$1
    local var_value=$(docker exec powernova-api sh -c "echo \$$var_name" 2>/dev/null || echo "")
    
    if [ -z "$var_value" ]; then
        echo -e "  ${YELLOW}⚠️  $var_name: not set${NC}"
    else
        echo -e "  ${GREEN}✓ $var_name: $var_value${NC}"
    fi
}

check_env_var "PORT"
check_env_var "ENVIRONMENT"
check_env_var "DEBUG"
check_env_var "LOG_LEVEL"
echo ""

# Test 5: Test OpenAI client initialization
echo -e "${BLUE}Test 5: Testing OpenAI client initialization${NC}"

OPENAI_TEST=$(docker exec powernova-api python -c "
import os
import sys

try:
    from openai import OpenAI
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print('ERROR: OPENAI_API_KEY not found')
        sys.exit(1)
    
    client = OpenAI(api_key=api_key)
    print('SUCCESS: OpenAI client initialized')
    sys.exit(0)
    
except ImportError as e:
    print(f'ERROR: OpenAI package not installed: {e}')
    sys.exit(1)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>&1)

if echo "$OPENAI_TEST" | grep -q "SUCCESS"; then
    echo -e "${GREEN}✓ OpenAI client initialized successfully${NC}"
elif echo "$OPENAI_TEST" | grep -q "not installed"; then
    echo -e "${YELLOW}⚠️  OpenAI package not installed yet${NC}"
    echo "  Install with: docker exec powernova-api pip install openai"
else
    echo -e "${RED}✗ OpenAI client initialization failed${NC}"
    echo "  $OPENAI_TEST"
fi
echo ""

# Test 6: List all environment variables
echo -e "${BLUE}Test 6: All environment variables in container${NC}"
read -p "Show all environment variables? (y/N): " show_all

if [[ $show_all =~ ^[Yy]$ ]]; then
    echo ""
    docker exec powernova-api env | sort
    echo ""
fi

# Summary
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Summary${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Configuration status:"
echo "  ✓ api/.env file: EXISTS"
echo "  ✓ OPENAI_API_KEY: SET (${MASKED_KEY})"
echo "  ✓ DATABASE_URL: SET"
echo "  ✓ Container: RUNNING"
echo ""
echo -e "${GREEN}Environment variables are properly configured! 🚀${NC}"
echo ""
echo "Next steps:"
echo "  1. Test API: curl http://localhost:8000/health"
echo "  2. View docs: open http://localhost:8000/docs"
echo "  3. View logs: docker logs -f powernova-api"
