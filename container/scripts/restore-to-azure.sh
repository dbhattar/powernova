#!/bin/bash

##############################################################################
# Azure PostgreSQL Database Restore Script
# 
# This script restores a database dump to Azure PostgreSQL
# 
# Usage:
#   ./restore-to-azure.sh [options]
#
# Options:
#   -i, --input          Input SQL file path (required for restore)
#   -u, --url            Azure DATABASE_URL (optional, will prompt if not provided)
#   -v, --validate-only  Only validate the restored database (skip restore)
#   -h, --help           Show this help message
#
# Examples:
#   ./restore-to-azure.sh -i supabase-backup.sql
#   ./restore-to-azure.sh -i backup.sql.gz -u "$AZURE_DATABASE_URL"
#   ./restore-to-azure.sh --validate-only -u "$AZURE_DATABASE_URL"
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INPUT_FILE=""
DATABASE_URL=""
VALIDATE_ONLY=false

# Functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# URL encode function for passwords with special characters
url_encode() {
    local string="$1"
    local encoded=""
    local pos c o
    
    for ((pos=0; pos<${#string}; pos++)); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9])
                encoded+="$c"
                ;;
            *)
                printf -v o '%%%02X' "'$c"
                encoded+="$o"
                ;;
        esac
    done
    echo "$encoded"
}

show_help() {
    head -n 23 "$0" | tail -n 20 | sed 's/^# //' | sed 's/^#//'
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_FILE="$2"
            shift 2
            ;;
        -u|--url)
            DATABASE_URL="$2"
            shift 2
            ;;
        -v|--validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            ;;
    esac
done

# Main script
if [ "$VALIDATE_ONLY" = true ]; then
    print_header "Azure PostgreSQL Database Validation"
else
    print_header "Azure PostgreSQL Database Restore"
fi

# Validate input file (only if not in validate-only mode)
if [ "$VALIDATE_ONLY" = false ]; then
    if [ -z "$INPUT_FILE" ]; then
        print_error "Input file is required"
        echo "Usage: $0 -i <input-file> [-u <database-url>]"
        exit 1
    fi

    if [ ! -f "$INPUT_FILE" ]; then
        print_error "Input file not found: $INPUT_FILE"
        exit 1
    fi
    print_success "Input file found: $INPUT_FILE"

    # Check file size
    if [[ "$OSTYPE" == "darwin"* ]]; then
        FILE_SIZE=$(ls -lh "$INPUT_FILE" | awk '{print $5}')
    else
        FILE_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
    fi
    print_info "File size: $FILE_SIZE"

    # Check if file is compressed
    IS_COMPRESSED=false
    if [[ "$INPUT_FILE" == *.gz ]]; then
        IS_COMPRESSED=true
        print_info "File is compressed (gzip)"
        
        # Test gzip integrity
        print_info "Testing gzip integrity..."
        if gzip -t "$INPUT_FILE" 2>/dev/null; then
            print_success "Compressed file is valid"
        else
            print_error "Compressed file is corrupted!"
            exit 1
        fi
    fi
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed"
    echo ""
    echo "Install PostgreSQL client tools:"
    echo ""
    echo "  macOS:   brew install postgresql"
    echo "  Ubuntu:  sudo apt-get install postgresql-client"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi
print_success "psql is installed ($(psql --version | head -n1))"

# Get Azure database URL
if [ -z "$DATABASE_URL" ]; then
    if [ -n "$AZURE_DATABASE_URL" ]; then
        print_info "Using AZURE_DATABASE_URL from environment"
        DATABASE_URL="$AZURE_DATABASE_URL"
        DB_NAME="powernova_db"
    else
        print_info "Please provide your Azure PostgreSQL connection details"
        echo ""
        
        read -p "Azure Server Host (e.g., powernova-db.postgres.database.azure.com): " DB_HOST
        read -p "Database Name (default: powernova_db): " DB_NAME
        DB_NAME=${DB_NAME:-powernova_db}
        read -p "Database User (e.g., powernova): " DB_USER
        read -sp "Database Password: " DB_PASSWORD
        echo ""
        
        # URL encode the password to handle special characters
        DB_PASSWORD_ENCODED=$(url_encode "$DB_PASSWORD")
        
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"
    fi
fi

echo ""

# Test connection
print_info "Testing connection to Azure PostgreSQL..."
if psql "$DATABASE_URL" -c "SELECT version();" &> /dev/null; then
    print_success "Successfully connected to Azure PostgreSQL"
else
    print_error "Failed to connect to Azure PostgreSQL"
    print_info "Please check your connection details and try again"
    print_info "Make sure your IP is whitelisted in Azure firewall rules"
    exit 1
fi

# Check if database has existing data
print_info "Checking target database..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

if [ "$VALIDATE_ONLY" = false ]; then
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_warning "Target database has $TABLE_COUNT existing tables"
        echo ""
        read -p "This will DROP and recreate tables. Continue? (yes/no) " -r
        if [[ ! $REPLY == "yes" ]]; then
            print_warning "Restore cancelled"
            exit 0
        fi
    else
        print_info "Target database is empty"
    fi
else
    print_info "Database has $TABLE_COUNT tables"
fi

# Check if pgvector extension exists
print_info "Checking for pgvector extension..."
PGVECTOR_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" | xargs)

if [ "$PGVECTOR_EXISTS" -eq 0 ]; then
    print_warning "pgvector extension is not installed"
    
    if [ "$VALIDATE_ONLY" = false ]; then
        print_info "Attempting to install pgvector..."
        
        if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" &> /dev/null; then
            print_success "pgvector extension installed"
        else
            print_error "Failed to install pgvector extension"
            print_info "You may need to install it manually as a superuser"
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        print_warning "You may need to install pgvector extension before restoring"
    fi
else
    print_success "pgvector extension is already installed"
fi

# If validate-only mode, skip restore and jump to validation
if [ "$VALIDATE_ONLY" = true ]; then
    print_info "Skipping restore (validate-only mode)"
    # Jump to validation section
    START_TIME=$(date +%s)
    DURATION=0
    ERROR_COUNT=0
    WARNING_COUNT=0
else
    # Show restore configuration
    print_header "Restore Configuration"
    echo "Input file: $INPUT_FILE"
    echo "File size: $FILE_SIZE"
    echo "Compressed: $IS_COMPRESSED"
    echo "Target tables: $TABLE_COUNT (will be dropped and recreated)"
    echo ""

    read -p "Proceed with restore? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Restore cancelled"
        exit 0
    fi

    # Perform restore
    print_header "Starting Database Restore"

    START_TIME=$(date +%s)

    if [ "$IS_COMPRESSED" = true ]; then
        print_info "Decompressing and restoring..."
        if gunzip -c "$INPUT_FILE" | psql "$DATABASE_URL" 2>&1 | tee restore.log | grep -E "ERROR|WARNING" || true; then
            :
        fi
    else
        print_info "Restoring from SQL file..."
        if psql "$DATABASE_URL" < "$INPUT_FILE" 2>&1 | tee restore.log | grep -E "ERROR|WARNING" || true; then
            :
        fi
    fi

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo ""

    # Check for errors in log
    ERROR_COUNT=$(grep -c "ERROR" restore.log 2>/dev/null || echo "0")
    WARNING_COUNT=$(grep -c "WARNING" restore.log 2>/dev/null || echo "0")

    if [ "$ERROR_COUNT" -gt 0 ]; then
        print_warning "Restore completed with $ERROR_COUNT errors"
        print_info "Check restore.log for details"
    else
        print_success "Restore completed successfully in ${DURATION} seconds"
    fi

    if [ "$WARNING_COUNT" -gt 0 ]; then
        print_info "$WARNING_COUNT warnings encountered (this is often normal)"
    fi
fi

# Verify restore
print_header "Verifying Restore"

RESTORED_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
print_info "Tables in database: $RESTORED_TABLES"

# Check for specific PowerNOVA tables
EXPECTED_TABLES=("users" "conversations" "messages" "documents" "document_chunks" "crawl_jobs" "alembic_version" "artifacts" "feedback")
MISSING_TABLES=()

for table in "${EXPECTED_TABLES[@]}"; do
    TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" | xargs)
    if [ "$TABLE_EXISTS" -eq 1 ]; then
        # Get row count
        ROW_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | xargs || echo "0")
        print_success "Table '$table': $ROW_COUNT rows"
    else
        MISSING_TABLES+=("$table")
        print_warning "Table '$table': not found"
    fi
done

# Check pgvector functionality
print_info "Testing pgvector extension..."
if psql "$DATABASE_URL" -c "SELECT '[1,2,3]'::vector;" &> /dev/null; then
    print_success "pgvector is working correctly"
else
    print_error "pgvector test failed"
fi

# Summary
if [ "$VALIDATE_ONLY" = true ]; then
    print_header "Validation Summary"
else
    print_header "Restore Summary"
fi

if [ ${#MISSING_TABLES[@]} -eq 0 ] && [ "$ERROR_COUNT" -eq 0 ]; then
    if [ "$VALIDATE_ONLY" = true ]; then
        print_success "✓ All expected tables found and validated"
    else
        print_success "✓ All expected tables restored successfully"
    fi
    echo ""
    if [ "$VALIDATE_ONLY" = false ]; then
        echo "Duration: ${DURATION} seconds"
    fi
    echo "Tables: $RESTORED_TABLES"
    if [ "$VALIDATE_ONLY" = false ]; then
        echo "Errors: $ERROR_COUNT"
        echo "Warnings: $WARNING_COUNT"
    fi
    echo ""
    
    if [ "$VALIDATE_ONLY" = false ]; then
        print_info "Next steps:"
        echo ""
        echo "1. Update your application's DATABASE_URL to point to Azure:"
        echo "   ${CYAN}$DATABASE_URL${NC}"
        echo ""
        echo "2. Test your application:"
        echo "   ${CYAN}cd api && python main.py${NC}"
        echo ""
        echo "3. Run any pending migrations:"
        echo "   ${CYAN}cd api && alembic upgrade head${NC}"
        echo ""
        
        print_success "Restore completed successfully!"
    else
        print_success "Database validation completed successfully!"
        echo ""
        print_info "Database is ready for use. All PowerNOVA tables are present."
    fi
else
    if [ "$VALIDATE_ONLY" = true ]; then
        print_warning "Validation found issues"
    else
        print_warning "Restore completed with issues"
    fi
    
    if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
        echo ""
        print_warning "Missing tables: ${MISSING_TABLES[*]}"
    fi
    
    if [ "$ERROR_COUNT" -gt 0 ] && [ "$VALIDATE_ONLY" = false ]; then
        echo ""
        print_error "$ERROR_COUNT errors encountered"
        print_info "Review restore.log for details"
    fi
    
    echo ""
    print_info "You may need to:"
    if [ "$VALIDATE_ONLY" = true ]; then
        echo "  • Run the restore process first: ./restore-to-azure.sh -i backup.sql"
        echo "  • Check if data was migrated correctly"
        echo "  • Install missing extensions (e.g., pgvector)"
    else
        echo "  • Check the dump file contents"
        echo "  • Verify source database had all tables"
        echo "  • Review error messages in restore.log"
    fi
fi

# Cleanup
if [ -f "restore.log" ] && [ "$VALIDATE_ONLY" = false ]; then
    print_info "Full restore log saved to: restore.log"
fi
