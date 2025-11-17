#!/bin/bash
# PowerNOVA API + PostgreSQL Sidecar Startup
# This script starts ONLY the API and database (no web/chat containers)
# Database is NOT exposed externally - only accessible to API via Docker network

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================="
echo "PowerNOVA API (Standalone Mode)"
echo -e "==================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Navigate to docker directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DOCKER_DIR="$SCRIPT_DIR/../docker"
cd "$DOCKER_DIR"

# Check if .env file exists
if [ ! -f "../api/.env" ]; then
    echo -e "${YELLOW}⚠ No .env file found. Creating from .env.example...${NC}"
    cp ../api/.env.example ../api/.env
    echo -e "${YELLOW}⚠ Please update ../api/.env with your OPENAI_API_KEY${NC}"
fi

# Load environment variables
if [ -f "../api/.env" ]; then
    export $(grep -v '^#' ../api/.env | xargs)
fi

# Stop existing containers
echo ""
echo "Stopping existing API containers..."
docker-compose -f docker-compose.api.yml down

# Start services
echo ""
echo -e "${BLUE}Starting API + PostgreSQL sidecar...${NC}"
docker-compose -f docker-compose.api.yml up -d

# Wait for PostgreSQL to be healthy
echo ""
echo "Waiting for PostgreSQL to be ready..."
COUNTER=0
MAX_TRIES=30
until docker exec powernova-db pg_isready -U powernova -d powernova_db > /dev/null 2>&1; do
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -gt $MAX_TRIES ]; then
        echo -e "${RED}✗ PostgreSQL failed to start after ${MAX_TRIES} seconds${NC}"
        docker logs powernova-db
        exit 1
    fi
    printf "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Wait for API to be ready
echo "Waiting for API to start..."
sleep 5

# Check API health
if docker exec powernova-api-standalone python -c "from database.session import check_db_connection; exit(0 if check_db_connection() else 1)" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API connected to database${NC}"
else
    echo -e "${YELLOW}⚠ API connection check failed (container might still be starting)${NC}"
fi

# Run database migrations
echo ""
echo "Running database migrations..."
if docker exec powernova-api-standalone alembic upgrade head 2>/dev/null; then
    echo -e "${GREEN}✓ Migrations completed successfully${NC}"
else
    echo -e "${YELLOW}⚠ Migrations might have failed or already applied${NC}"
fi

# Display information
echo ""
echo -e "${BLUE}=================================="
echo "API Deployment Information"
echo -e "==================================${NC}"
echo ""
echo -e "${GREEN}✓ API is running!${NC}"
echo ""
echo "API Endpoints:"
echo "  Health Check:  http://localhost:8000/health"
echo "  API Docs:      http://localhost:8000/docs"
echo "  ReDoc:         http://localhost:8000/redoc"
echo "  Chat API:      http://localhost:8000/api/chat"
echo ""
echo -e "${BLUE}Database Configuration:${NC}"
echo "  Status:        ${GREEN}Running as sidecar${NC}"
echo "  External Port: ${RED}NOT EXPOSED${NC} (secure configuration)"
echo "  Internal Host: powernova-db:5432"
echo "  Database:      powernova_db"
echo "  Username:      powernova"
echo ""
echo -e "${YELLOW}⚠ Database is only accessible from within the API container${NC}"
echo ""
echo "Useful Commands:"
echo "  View logs:          docker-compose -f docker-compose.api.yml logs -f"
echo "  View API logs:      docker logs -f powernova-api-standalone"
echo "  View DB logs:       docker logs -f powernova-db"
echo "  Stop services:      docker-compose -f docker-compose.api.yml down"
echo "  Restart:            docker-compose -f docker-compose.api.yml restart"
echo ""
echo "Database Access (from API container):"
echo "  docker exec -it powernova-api-standalone bash"
echo "  # Then inside container:"
echo "  psql postgresql://powernova:password@powernova-db:5432/powernova_db"
echo ""
echo "Management:"
echo "  Run migrations:     docker exec powernova-api-standalone alembic upgrade head"
echo "  Access Python:      docker exec -it powernova-api-standalone python"
echo "  Database shell:     docker exec -it powernova-db psql -U powernova -d powernova_db"
echo ""
echo -e "${GREEN}=================================="
echo "Deployment Complete! 🚀"
echo -e "==================================${NC}"
echo ""
echo "Test the API:"
echo "  curl http://localhost:8000/health"
echo ""
