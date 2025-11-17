#!/bin/bash
# PowerNOVA Database Quick Start Script
# This script initializes the PostgreSQL database and runs migrations

set -e  # Exit on error

echo "=================================="
echo "PowerNOVA Database Initialization"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Stop existing containers
echo ""
echo "Stopping existing containers..."
docker-compose down

# Start PostgreSQL first
echo ""
echo "Starting PostgreSQL..."
docker-compose up -d powernova-postgres

# Wait for PostgreSQL to be healthy
echo "Waiting for PostgreSQL to be ready..."
COUNTER=0
MAX_TRIES=30
until docker exec powernova-postgres pg_isready -U powernova -d powernova_db > /dev/null 2>&1; do
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -gt $MAX_TRIES ]; then
        echo -e "${RED}✗ PostgreSQL failed to start after ${MAX_TRIES} seconds${NC}"
        docker logs powernova-postgres
        exit 1
    fi
    printf "."
    sleep 1
done

echo ""
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Start API container
echo ""
echo "Starting API container..."
docker-compose up -d powernova-api

# Wait for API to be ready
echo "Waiting for API to start..."
sleep 5

# Check API health
if docker exec powernova-api python -c "from database.session import check_db_connection; exit(0 if check_db_connection() else 1)" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API connected to database${NC}"
else
    echo -e "${RED}✗ API failed to connect to database${NC}"
    echo "Checking logs..."
    docker logs powernova-api | tail -20
    exit 1
fi

# Run database migrations
echo ""
echo "Running database migrations..."
if docker exec powernova-api alembic upgrade head; then
    echo -e "${GREEN}✓ Migrations completed successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

# Display database info
echo ""
echo "=================================="
echo "Database Information"
echo "=================================="
echo ""
echo "PostgreSQL:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: powernova_db"
echo "  Username: powernova"
echo "  Password: powernova_dev_2024"
echo ""
echo "Connection String:"
echo "  postgresql://powernova:powernova_dev_2024@localhost:5432/powernova_db"
echo ""
echo "Access PostgreSQL CLI:"
echo "  docker exec -it powernova-postgres psql -U powernova -d powernova_db"
echo ""
echo "API Health Check:"
echo "  http://localhost:8000/health"
echo ""

# Start remaining services
echo "Starting remaining services..."
docker-compose up -d

echo ""
echo "=================================="
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo "=================================="
echo ""
echo "Services running:"
echo "  - PowerNOVA Web:  http://localhost:8080"
echo "  - PowerNOVA Chat: http://localhost:8081"
echo "  - PowerNOVA API:  http://localhost:8000"
echo "  - API Docs:       http://localhost:8000/docs"
echo "  - PostgreSQL:     localhost:5432"
echo ""
echo "View logs:"
echo "  docker-compose logs -f"
echo ""
echo "Stop services:"
echo "  docker-compose down"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
