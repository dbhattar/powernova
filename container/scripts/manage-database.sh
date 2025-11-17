#!/bin/bash
# Database Management Utility Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER_NAME="powernova-postgres"
API_CONTAINER="powernova-api"
DB_USER="powernova"
DB_NAME="powernova"

# Function to display menu
show_menu() {
    echo ""
    echo -e "${BLUE}=================================="
    echo "PowerNOVA Database Manager"
    echo -e "==================================${NC}"
    echo ""
    echo "1) View database status"
    echo "2) Access PostgreSQL CLI (psql)"
    echo "3) Run migrations"
    echo "4) Create new migration"
    echo "5) Rollback last migration"
    echo "6) View migration history"
    echo "7) Backup database"
    echo "8) Restore database from backup"
    echo "9) View database size and stats"
    echo "10) View tables"
    echo "11) Reset database (DANGEROUS)"
    echo "0) Exit"
    echo ""
    echo -n "Select an option: "
}

# Check if containers are running
check_containers() {
    if ! docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${RED}✗ PostgreSQL container is not running${NC}"
        echo "Start it with: cd docker && docker-compose up -d powernova-postgres"
        exit 1
    fi
}

# Function implementations
status() {
    echo -e "${BLUE}Database Status:${NC}"
    docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME
    echo ""
    echo -e "${BLUE}Container Status:${NC}"
    docker ps | grep $CONTAINER_NAME
}

psql_cli() {
    echo -e "${GREEN}Connecting to PostgreSQL...${NC}"
    echo -e "${YELLOW}Use \\q to exit${NC}"
    docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
}

run_migrations() {
    echo -e "${BLUE}Running migrations...${NC}"
    docker exec $API_CONTAINER python -m alembic upgrade head
    echo -e "${GREEN}✓ Migrations completed${NC}"
}

create_migration() {
    echo -n "Enter migration message: "
    read message
    echo -e "${BLUE}Creating migration: $message${NC}"
    docker exec $API_CONTAINER python -m alembic revision --autogenerate -m "$message"
    echo -e "${GREEN}✓ Migration created${NC}"
}

rollback_migration() {
    echo -e "${YELLOW}⚠ This will rollback the last migration${NC}"
    echo -n "Are you sure? (yes/no): "
    read confirm
    if [ "$confirm" = "yes" ]; then
        docker exec $API_CONTAINER python -m alembic downgrade -1
        echo -e "${GREEN}✓ Migration rolled back${NC}"
    else
        echo "Cancelled"
    fi
}

migration_history() {
    echo -e "${BLUE}Migration History:${NC}"
    docker exec $API_CONTAINER python -m alembic history
    echo ""
    echo -e "${BLUE}Current Version:${NC}"
    docker exec $API_CONTAINER python -m alembic current
}

backup_database() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo -e "${BLUE}Creating backup: $BACKUP_FILE${NC}"
    docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
}

restore_database() {
    echo "Available backup files:"
    ls -lh backup_*.sql 2>/dev/null || echo "No backup files found"
    echo ""
    echo -n "Enter backup file name: "
    read backup_file
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}✗ Backup file not found: $backup_file${NC}"
        return
    fi
    
    echo -e "${YELLOW}⚠ This will overwrite the current database${NC}"
    echo -n "Are you sure? (yes/no): "
    read confirm
    
    if [ "$confirm" = "yes" ]; then
        echo -e "${BLUE}Restoring database from $backup_file...${NC}"
        docker exec -i $CONTAINER_NAME psql -U $DB_USER $DB_NAME < "$backup_file"
        echo -e "${GREEN}✓ Database restored${NC}"
    else
        echo "Cancelled"
    fi
}

database_stats() {
    echo -e "${BLUE}Database Statistics:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;
    "
    
    echo ""
    echo -e "${BLUE}Table Sizes:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) as raw_size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY raw_size DESC;
    "
    
    echo ""
    echo -e "${BLUE}Active Connections:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT count(*) as active_connections FROM pg_stat_activity;
    "
}

view_tables() {
    echo -e "${BLUE}Database Tables:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "\dt"
    
    echo ""
    echo -e "${BLUE}Table Row Counts:${NC}"
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT 
            schemaname,
            relname as table_name,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
    "
}

reset_database() {
    echo -e "${RED}=================================="
    echo "⚠ WARNING: DANGEROUS OPERATION ⚠"
    echo -e "==================================${NC}"
    echo ""
    echo "This will:"
    echo "  1. Drop all tables"
    echo "  2. Delete all data"
    echo "  3. Re-run all migrations"
    echo ""
    echo "This action CANNOT be undone!"
    echo ""
    echo -n "Type 'DELETE EVERYTHING' to confirm: "
    read confirm
    
    if [ "$confirm" = "DELETE EVERYTHING" ]; then
        echo -e "${YELLOW}Creating emergency backup first...${NC}"
        backup_database
        
        echo -e "${RED}Resetting database...${NC}"
        docker exec $API_CONTAINER python -m alembic downgrade base
        docker exec $API_CONTAINER python -m alembic upgrade head
        echo -e "${GREEN}✓ Database reset complete${NC}"
    else
        echo "Cancelled (you entered: '$confirm')"
    fi
}

# Main loop
main() {
    while true; do
        show_menu
        read choice
        
        case $choice in
            1)
                check_containers
                status
                ;;
            2)
                check_containers
                psql_cli
                ;;
            3)
                check_containers
                run_migrations
                ;;
            4)
                check_containers
                create_migration
                ;;
            5)
                check_containers
                rollback_migration
                ;;
            6)
                check_containers
                migration_history
                ;;
            7)
                check_containers
                backup_database
                ;;
            8)
                check_containers
                restore_database
                ;;
            9)
                check_containers
                database_stats
                ;;
            10)
                check_containers
                view_tables
                ;;
            11)
                check_containers
                reset_database
                ;;
            0)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
    done
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Run main menu
main
