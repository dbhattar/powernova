#!/bin/bash
#
# Test Workers Locally
# Tests the separated worker architecture using docker-compose
#
# This script:
# 1. Starts all containers (web, chat, API, crawler worker, doc worker, postgres)
# 2. Waits for services to be ready
# 3. Runs basic health checks
# 4. Displays logs
#
# Usage:
#   ./test-workers-local.sh [--logs] [--stop] [--workers-only]
#
# Options:
#   --logs           Follow logs after starting (Ctrl+C to stop)
#   --stop           Stop and remove all containers
#   --workers-only   Start only API, workers, and database (skip web/chat)
#

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to docker directory
cd "$(dirname "$0")/../docker"

# Check for --stop flag
if [ "$1" == "--stop" ] || [ "$2" == "--stop" ]; then
    echo -e "${BLUE}Stopping all services...${NC}"
    docker-compose -f docker-compose.yml down
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
fi

# Check for --workers-only flag
WORKERS_ONLY=false
if [ "$1" == "--workers-only" ] || [ "$2" == "--workers-only" ]; then
    WORKERS_ONLY=true
    echo -e "${YELLOW}Running in workers-only mode (skipping web/chat)${NC}"
fi

echo "=" >&2
echo "Testing PowerNOVA Workers Locally" >&2
echo "=" >&2
echo "" >&2

# Step 1: Check environment variables
echo -e "${BLUE}[1/6] Checking environment variables...${NC}" >&2

required_vars=(
    "AZURE_STORAGE_CONNECTION_STRING"
    "AZURE_STORAGE_CONTAINER_NAME"
    "OPENAI_API_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}" >&2
    for var in "${missing_vars[@]}"; do
        echo "  - $var" >&2
    done
    echo "" >&2
    echo "Please set these variables and try again." >&2
    exit 1
fi

echo -e "${GREEN}✓ All required environment variables set${NC}" >&2
echo "" >&2

# Step 2: Stop existing containers
echo -e "${BLUE}[2/6] Cleaning up existing containers...${NC}" >&2
docker-compose -f docker-compose.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}" >&2
echo "" >&2

# Step 3: Build and start containers
echo -e "${BLUE}[3/6] Building and starting containers...${NC}" >&2
if [ "$WORKERS_ONLY" = true ]; then
    # Start only backend services (API, workers, postgres)
    docker-compose -f docker-compose.yml up --build -d powernova-postgres powernova-api powernova-crawler-worker powernova-doc-worker
else
    # Start all services
    docker-compose -f docker-compose.yml up --build -d
fi
echo -e "${GREEN}✓ Containers started${NC}" >&2
echo "" >&2

# Step 4: Wait for services to be ready
echo -e "${BLUE}[4/6] Waiting for services to be ready...${NC}" >&2

echo "Waiting for PostgreSQL..." >&2
for i in {1..30}; do
    if docker-compose -f docker-compose.yml exec -T powernova-postgres pg_isready -U powernova &>/dev/null; then
        echo -e "${GREEN}✓ PostgreSQL ready${NC}" >&2
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ PostgreSQL failed to start${NC}" >&2
        exit 1
    fi
    sleep 1
done

echo "Waiting for API..." >&2
for i in {1..30}; do
    if curl -f http://localhost:8000/health &>/dev/null; then
        echo -e "${GREEN}✓ API ready${NC}" >&2
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ API failed to start${NC}" >&2
        exit 1
    fi
    sleep 2
done

echo -e "${GREEN}✓ All services ready${NC}" >&2
echo "" >&2

# Step 5: Run health checks
echo -e "${BLUE}[5/6] Running health checks...${NC}" >&2

# Check API health
echo "Checking API health..." >&2
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ API health check passed${NC}" >&2
else
    echo -e "${RED}✗ API health check failed${NC}" >&2
fi

# Check container status
echo "" >&2
echo "Container Status:" >&2
docker-compose -f docker-compose.yml ps

echo "" >&2
echo -e "${GREEN}✓ Health checks complete${NC}" >&2
echo "" >&2

# Step 6: Display information
echo -e "${BLUE}[6/6] Deployment Information${NC}" >&2
echo "=" >&2
echo "" >&2
echo -e "${GREEN}🎉 Workers are running!${NC}" >&2
echo "" >&2
echo "Services:" >&2
if [ "$WORKERS_ONLY" = false ]; then
echo "  Website:        http://localhost:8080" >&2
echo "  Chat App:       http://localhost:8081" >&2
fi
echo "  API:            http://localhost:8000" >&2
echo "  Health:         http://localhost:8000/health" >&2
echo "  PostgreSQL:     powernova-postgres:5432 (internal only)" >&2
echo "" >&2
echo "Workers:" >&2
echo "  Crawler Worker: powernova-crawler-worker (background)" >&2
echo "  Doc Worker:     powernova-doc-worker (background)" >&2
echo "" >&2
echo "View Logs:" >&2
echo "  All:            docker-compose -f docker-compose.yml logs -f" >&2
echo "  API:            docker-compose -f docker-compose.yml logs -f powernova-api" >&2
echo "  Crawler Worker: docker-compose -f docker-compose.yml logs -f powernova-crawler-worker" >&2
echo "  Doc Worker:     docker-compose -f docker-compose.yml logs -f powernova-doc-worker" >&2
echo "  Or simpler:     docker logs -f powernova-crawler-worker" >&2
echo "" >&2
echo "Stop Services:" >&2
echo "  ./test-workers-local.sh --stop" >&2
echo "" >&2
echo "=" >&2

# Follow logs if --logs flag is set
if [ "$1" == "--logs" ] || [ "$2" == "--logs" ]; then
    echo "" >&2
    echo -e "${BLUE}Following logs (Ctrl+C to stop)...${NC}" >&2
    echo "" >&2
    if [ "$WORKERS_ONLY" = true ]; then
        # Follow only worker and API logs
        docker-compose -f docker-compose.yml logs -f powernova-api powernova-crawler-worker powernova-doc-worker
    else
        # Follow all logs
        docker-compose -f docker-compose.yml logs -f
    fi
fi
