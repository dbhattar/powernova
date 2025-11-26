#!/bin/bash

##############################################################################
# Supabase Database Dump Script
# 
# This script dumps the entire database from Supabase for migration to Azure
# 
# Usage:
#   ./dump-supabase-database.sh [options]
#
# Options:
#   -o, --output    Output file path (default: supabase-backup-TIMESTAMP.sql)
#   -c, --compress  Compress output with gzip
#   -s, --schema    Dump only schema (no data)
#   -d, --data      Dump only data (no schema)
#   --use-docker    Use Docker to run pg_dump (recommended for version compatibility)
#   -h, --help      Show this help message
#
# Examples:
#   ./dump-supabase-database.sh --use-docker             # Full dump using Docker
#   ./dump-supabase-database.sh -c --use-docker          # Compressed dump using Docker
#   ./dump-supabase-database.sh -o my-backup.sql         # Custom filename
#   ./dump-supabase-database.sh -s                       # Schema only
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="supabase-backup-${TIMESTAMP}.sql"
COMPRESS=false
SCHEMA_ONLY=false
DATA_ONLY=false
USE_DOCKER=false

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
    head -n 25 "$0" | tail -n 22 | sed 's/^# //' | sed 's/^#//'
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        -s|--schema)
            SCHEMA_ONLY=true
            shift
            ;;
        -d|--data)
            DATA_ONLY=true
            shift
            ;;
        --use-docker)
            USE_DOCKER=true
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
print_header "Supabase Database Dump"

# Check requirements based on mode
if [ "$USE_DOCKER" = true ]; then
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not running"
        echo ""
        echo "Install Docker from: https://www.docker.com/get-started"
        echo ""
        exit 1
    fi
    print_info "Using Docker with PostgreSQL 17 for compatibility"
else
    # Check if pg_dump is installed
    if ! command -v pg_dump &> /dev/null; then
        print_error "pg_dump is not installed"
        echo ""
        echo "Install PostgreSQL client tools:"
        echo ""
        echo "  macOS:   brew install postgresql@17"
        echo "  Ubuntu:  sudo apt-get install postgresql-client-17"
        echo ""
        echo "Or use Docker mode: ./dump-supabase-database.sh --use-docker"
        echo ""
        exit 1
    fi
    
    # Check pg_dump version
    PG_DUMP_VERSION=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
    if [ "$PG_DUMP_VERSION" -lt 15 ]; then
        print_warning "Your pg_dump version ($PG_DUMP_VERSION) may be too old for Supabase (PostgreSQL 17)"
        print_warning "Consider using: ./dump-supabase-database.sh --use-docker"
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
fi
print_success "pg_dump is installed ($(pg_dump --version | head -n1))"

# Get Supabase connection details
print_info "Please provide your Supabase connection details"
echo ""

# Check if DATABASE_URL is set in environment
if [ -n "$SUPABASE_DATABASE_URL" ]; then
    print_info "Using SUPABASE_DATABASE_URL from environment"
    DATABASE_URL="$SUPABASE_DATABASE_URL"
    DB_NAME="postgres"
else
    # Prompt for connection details
    echo -e "${CYAN}You can find these details in Supabase Dashboard → Settings → Database${NC}"
    echo ""
    
    read -p "Supabase Project Host (e.g., db.xxx.supabase.co): " DB_HOST
    read -p "Database Name (default: postgres): " DB_NAME
    DB_NAME=${DB_NAME:-postgres}
    read -p "Database User (default: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    read -sp "Database Password: " DB_PASSWORD
    echo ""
    read -p "Database Port (6543 for pooler, 5432 for direct) [default: 6543]: " DB_PORT
    DB_PORT=${DB_PORT:-6543}
    
    # URL encode the password to handle special characters
    DB_PASSWORD_ENCODED=$(url_encode "$DB_PASSWORD")
    
    # Construct connection URL
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo ""

# Validate connection
print_info "Testing connection to Supabase..."
if psql "$DATABASE_URL" -c "SELECT version();" &> /dev/null; then
    print_success "Successfully connected to Supabase"
else
    print_error "Failed to connect to Supabase"
    print_info "Please check your connection details and try again"
    print_info "Make sure your IP is whitelisted in Supabase Dashboard → Settings → Database → Network Restrictions"
    exit 1
fi

# Get database size
print_info "Checking database size..."
DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | xargs)
print_info "Database size: $DB_SIZE"

# Get table count
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
print_info "Number of tables: $TABLE_COUNT"

echo ""

# Confirm before proceeding
if [ "$SCHEMA_ONLY" = true ]; then
    DUMP_TYPE="schema only"
elif [ "$DATA_ONLY" = true ]; then
    DUMP_TYPE="data only"
else
    DUMP_TYPE="full database (schema + data)"
fi

print_header "Dump Configuration"
echo "Dump type: $DUMP_TYPE"
echo "Output file: $OUTPUT_FILE"
if [ "$COMPRESS" = true ]; then
    echo "Compression: enabled (gzip)"
    OUTPUT_FILE="${OUTPUT_FILE}.gz"
else
    echo "Compression: disabled"
fi
echo "Database size: $DB_SIZE"
echo "Table count: $TABLE_COUNT"
echo ""

read -p "Proceed with dump? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Dump cancelled"
    exit 0
fi

# Build pg_dump command
print_header "Starting Database Dump"

if [ "$USE_DOCKER" = true ]; then
    # Use Docker to run pg_dump with PostgreSQL 17
    print_info "Running pg_dump inside Docker container (PostgreSQL 17)..."
    
    # Build Docker command
    DOCKER_CMD="docker run --rm -e PGPASSWORD='$DB_PASSWORD' postgres:17 pg_dump"
    DOCKER_CMD="$DOCKER_CMD -h '$DB_HOST' -p '$DB_PORT' -U '$DB_USER' -d '$DB_NAME'"
    
    # Add options based on flags
    if [ "$SCHEMA_ONLY" = true ]; then
        DOCKER_CMD="$DOCKER_CMD --schema-only"
    elif [ "$DATA_ONLY" = true ]; then
        DOCKER_CMD="$DOCKER_CMD --data-only"
    fi
    
    # Add common options
    DOCKER_CMD="$DOCKER_CMD --no-owner --no-acl --clean --if-exists --verbose"
    
    # Handle compression and output
    if [ "$COMPRESS" = true ]; then
        DOCKER_CMD="$DOCKER_CMD | gzip > \"$OUTPUT_FILE\""
    else
        DOCKER_CMD="$DOCKER_CMD > \"$OUTPUT_FILE\""
    fi
    
    PG_DUMP_CMD="$DOCKER_CMD"
else
    # Use local pg_dump
    PG_DUMP_CMD="pg_dump \"$DATABASE_URL\""

    # Add options based on flags
    if [ "$SCHEMA_ONLY" = true ]; then
        PG_DUMP_CMD="$PG_DUMP_CMD --schema-only"
    elif [ "$DATA_ONLY" = true ]; then
        PG_DUMP_CMD="$PG_DUMP_CMD --data-only"
    fi

    # Add common options for better compatibility
    PG_DUMP_CMD="$PG_DUMP_CMD --no-owner --no-acl --clean --if-exists"

    # Add format and verbose
    PG_DUMP_CMD="$PG_DUMP_CMD --verbose"

    # Handle compression
    if [ "$COMPRESS" = true ]; then
        PG_DUMP_CMD="$PG_DUMP_CMD | gzip > \"$OUTPUT_FILE\""
    else
        PG_DUMP_CMD="$PG_DUMP_CMD > \"$OUTPUT_FILE\""
    fi
fi

print_info "Running: pg_dump with options..."
echo ""

# Execute dump
START_TIME=$(date +%s)

if eval "$PG_DUMP_CMD" 2>&1 | grep -v "^pg_dump: last built-in OID" | grep -v "^pg_dump: reading" | grep -v "^pg_dump: implied"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    print_success "Database dump completed in ${DURATION} seconds"
    
    # Get file size
    if [ -f "$OUTPUT_FILE" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
        else
            # Linux
            FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        fi
        
        print_success "Backup file created: $OUTPUT_FILE"
        print_info "File size: $FILE_SIZE"
        
        # Calculate compression ratio if compressed
        if [ "$COMPRESS" = true ]; then
            UNCOMPRESSED_SIZE=$(gzip -l "$OUTPUT_FILE" | tail -n1 | awk '{print $2}')
            COMPRESSED_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE")
            RATIO=$(awk "BEGIN {printf \"%.1f\", ($UNCOMPRESSED_SIZE/$COMPRESSED_SIZE)}")
            print_info "Compression ratio: ${RATIO}x"
        fi
    else
        print_error "Backup file was not created"
        exit 1
    fi
else
    print_error "Database dump failed"
    exit 1
fi

# Verify dump integrity
print_header "Verifying Dump Integrity"

if [ "$COMPRESS" = true ]; then
    print_info "Testing gzip integrity..."
    if gzip -t "$OUTPUT_FILE" 2>/dev/null; then
        print_success "Compressed file is valid"
    else
        print_error "Compressed file is corrupted!"
        exit 1
    fi
fi

print_info "Checking SQL syntax (first 100 lines)..."
if [ "$COMPRESS" = true ]; then
    FIRST_LINES=$(gunzip -c "$OUTPUT_FILE" | head -n 100)
else
    FIRST_LINES=$(head -n 100 "$OUTPUT_FILE")
fi

if echo "$FIRST_LINES" | grep -q "PostgreSQL database dump"; then
    print_success "Dump file appears to be valid PostgreSQL backup"
else
    print_warning "Could not verify dump file format"
fi

# Show summary
print_header "Dump Summary"
echo "✓ Backup completed successfully"
echo ""
echo "File: $OUTPUT_FILE"
echo "Size: $FILE_SIZE"
echo "Duration: ${DURATION} seconds"
echo ""

print_info "Next steps:"
echo ""
echo "1. Transfer this file to a secure location:"
echo "   ${CYAN}scp $OUTPUT_FILE user@backup-server:/backups/${NC}"
echo ""
echo "2. Restore to Azure PostgreSQL:"
if [ "$COMPRESS" = true ]; then
    echo "   ${CYAN}gunzip -c $OUTPUT_FILE | psql \"\$AZURE_DATABASE_URL\"${NC}"
else
    echo "   ${CYAN}psql \"\$AZURE_DATABASE_URL\" < $OUTPUT_FILE${NC}"
fi
echo ""
echo "3. Or use the restore script:"
echo "   ${CYAN}./restore-to-azure.sh -i $OUTPUT_FILE${NC}"
echo ""

print_warning "Security reminder:"
echo "  • This file contains sensitive data"
echo "  • Store it securely and delete when no longer needed"
echo "  • Do not commit to version control"
echo ""

print_success "Dump completed successfully!"
