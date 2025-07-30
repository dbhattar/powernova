#!/bin/bash

# Health Check Script for PowerNOVA

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

echo "🏥 PowerNOVA Health Check"
echo "========================"

OVERALL_STATUS=0

# Check backend API
echo -n "🔧 Backend API: "
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
    OVERALL_STATUS=1
fi

# Check Typesense
echo -n "🔍 Typesense: "
if curl -s http://localhost:8108/health > /dev/null; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
    OVERALL_STATUS=1
fi

# Check Redis
echo -n "📊 Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Unhealthy${NC}"
    OVERALL_STATUS=1
fi

# Check database connection
echo -n "🗄️ Database: "
if [ -n "$DATABASE_URL" ]; then
    if timeout 10 bash -c "cat < /dev/null > /dev/tcp/$(echo $DATABASE_URL | cut -d'@' -f2 | cut -d'/' -f1 | cut -d':' -f1)/$(echo $DATABASE_URL | cut -d':' -f4 | cut -d'/' -f1)" 2>/dev/null; then
        echo -e "${GREEN}✅ Reachable${NC}"
    else
        echo -e "${RED}❌ Unreachable${NC}"
        OVERALL_STATUS=1
    fi
else
    echo -e "${YELLOW}⚠️ Not configured${NC}"
fi

# Check NGINX
echo -n "🌐 NGINX: "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
    OVERALL_STATUS=1
fi

# Check disk space
echo -n "💾 Disk Space: "
DISK_USAGE=$(df /opt/powernova | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo -e "${GREEN}✅ ${DISK_USAGE}% used${NC}"
elif [ $DISK_USAGE -lt 90 ]; then
    echo -e "${YELLOW}⚠️ ${DISK_USAGE}% used${NC}"
else
    echo -e "${RED}❌ ${DISK_USAGE}% used${NC}"
    OVERALL_STATUS=1
fi

# Check memory usage
echo -n "🧠 Memory: "
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ $MEMORY_USAGE -lt 80 ]; then
    echo -e "${GREEN}✅ ${MEMORY_USAGE}% used${NC}"
elif [ $MEMORY_USAGE -lt 90 ]; then
    echo -e "${YELLOW}⚠️ ${MEMORY_USAGE}% used${NC}"
else
    echo -e "${RED}❌ ${MEMORY_USAGE}% used${NC}"
    OVERALL_STATUS=1
fi

echo ""
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Overall Status: Healthy${NC}"
else
    echo -e "${RED}❌ Overall Status: Issues detected${NC}"
fi

exit $OVERALL_STATUS
