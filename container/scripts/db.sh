#!/bin/bash
# Quick database access commands for PowerNOVA

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if database is running
if ! docker ps | grep -q powernova-postgres; then
    echo "❌ Database container is not running"
    echo "Start it with: cd docker && docker-compose up -d powernova-postgres"
    exit 1
fi

echo -e "${GREEN}✓ Database container is running${NC}"
echo ""
echo -e "${BLUE}Opening PostgreSQL shell...${NC}"
echo "Connected to: powernova database"
echo "Type \\q to exit"
echo ""
echo "Useful commands:"
echo "  \\dt           - List all tables"
echo "  \\d+ TABLE     - Describe table structure"
echo "  \\l            - List all databases"
echo "  \\du           - List all users"
echo "  \\q            - Quit"
echo ""

docker exec -it powernova-postgres psql -U powernova -d powernova
