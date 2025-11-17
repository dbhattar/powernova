#!/bin/bash
# Database debugging utilities for PowerNOVA
# Since PostgreSQL is not exposed externally, use these commands to interact with it

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}PowerNOVA Database Debug Tools${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if database container is running
if ! docker ps | grep -q powernova-postgres; then
    echo -e "${YELLOW}⚠️  Database container is not running${NC}"
    echo ""
    echo "Start the database with:"
    echo "  cd docker && docker-compose up -d powernova-postgres"
    exit 1
fi

echo -e "${GREEN}✓ Database container is running${NC}"
echo ""

# Menu
echo "Choose an option:"
echo ""
echo "  1) Open PostgreSQL shell (psql)"
echo "  2) Check database connection"
echo "  3) List all databases"
echo "  4) List all tables"
echo "  5) Show table schemas"
echo "  6) Count records in all tables"
echo "  7) Show recent migrations (alembic_version)"
echo "  8) Execute custom SQL query"
echo "  9) Backup database"
echo "  10) Restore database from backup"
echo "  11) View database logs"
echo "  12) Connect from API container"
echo ""
read -p "Select option (1-12): " choice

case $choice in
    1)
        echo -e "${BLUE}Opening PostgreSQL shell...${NC}"
        echo "Type \q to exit"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova
        ;;
    
    2)
        echo -e "${BLUE}Testing database connection...${NC}"
        if docker exec powernova-postgres pg_isready -U powernova -d powernova > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Database is ready and accepting connections${NC}"
        else
            echo -e "${YELLOW}⚠️  Database is not ready${NC}"
        fi
        ;;
    
    3)
        echo -e "${BLUE}Listing all databases:${NC}"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\l"
        ;;
    
    4)
        echo -e "${BLUE}Listing all tables:${NC}"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\dt"
        ;;
    
    5)
        echo -e "${BLUE}Showing table schemas:${NC}"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d+ users"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d+ conversations"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d+ messages"
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d+ artifacts"
        ;;
    
    6)
        echo -e "${BLUE}Counting records in all tables:${NC}"
        echo ""
        docker exec powernova-postgres psql -U powernova -d powernova -c "
            SELECT 
                'users' as table_name, 
                COUNT(*) as record_count 
            FROM users
            UNION ALL
            SELECT 
                'conversations' as table_name, 
                COUNT(*) as record_count 
            FROM conversations
            UNION ALL
            SELECT 
                'messages' as table_name, 
                COUNT(*) as record_count 
            FROM messages
            UNION ALL
            SELECT 
                'artifacts' as table_name, 
                COUNT(*) as record_count 
            FROM artifacts;
        "
        ;;
    
    7)
        echo -e "${BLUE}Showing migration history:${NC}"
        echo ""
        docker exec powernova-postgres psql -U powernova -d powernova -c "
            SELECT * FROM alembic_version;
        "
        ;;
    
    8)
        echo -e "${BLUE}Execute custom SQL query${NC}"
        echo ""
        read -p "Enter SQL query: " sql_query
        echo ""
        docker exec -it powernova-postgres psql -U powernova -d powernova -c "$sql_query"
        ;;
    
    9)
        echo -e "${BLUE}Backing up database...${NC}"
        BACKUP_FILE="backup-powernova-$(date +%Y%m%d-%H%M%S).sql"
        docker exec powernova-postgres pg_dump -U powernova -d powernova > "$BACKUP_FILE"
        echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
        ;;
    
    10)
        echo -e "${BLUE}Restore database from backup${NC}"
        echo ""
        echo "Available backup files:"
        ls -1 backup-powernova-*.sql 2>/dev/null || echo "No backup files found"
        echo ""
        read -p "Enter backup file name: " backup_file
        
        if [ ! -f "$backup_file" ]; then
            echo -e "${YELLOW}⚠️  Backup file not found${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}⚠️  This will overwrite the current database!${NC}"
        read -p "Continue? (y/N): " confirm
        
        if [[ $confirm =~ ^[Yy]$ ]]; then
            cat "$backup_file" | docker exec -i powernova-postgres psql -U powernova -d powernova
            echo -e "${GREEN}✓ Database restored from $backup_file${NC}"
        else
            echo "Restore cancelled"
        fi
        ;;
    
    11)
        echo -e "${BLUE}Viewing database logs...${NC}"
        echo "Press Ctrl+C to exit"
        echo ""
        docker logs -f powernova-postgres
        ;;
    
    12)
        echo -e "${BLUE}Connecting from API container...${NC}"
        echo ""
        if ! docker ps | grep -q powernova-api; then
            echo -e "${YELLOW}⚠️  API container is not running${NC}"
            echo "Start it with: cd docker && docker-compose up -d powernova-api"
            exit 1
        fi
        
        echo "Opening psql from API container..."
        echo "Type \q to exit"
        echo ""
        docker exec -it powernova-api psql -h powernova-postgres -U powernova -d powernova
        ;;
    
    *)
        echo -e "${YELLOW}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
