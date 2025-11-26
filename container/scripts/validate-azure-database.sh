#!/bin/bash

##############################################################################
# Azure PostgreSQL Database Validation Script
# 
# This script validates that your Azure PostgreSQL database is properly
# configured and ready for the PowerNOVA application migration
# 
# Usage:
#   ./validate-azure-database.sh [database-url]
#
# Examples:
#   ./validate-azure-database.sh
#   ./validate-azure-database.sh "postgresql://user:pass@server:5432/db"
#   AZURE_DATABASE_URL="..." ./validate-azure-database.sh
##############################################################################

# Note: Not using 'set -e' because we handle errors explicitly for validation
# set -e would exit on first psql command failure, preventing full validation

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Validation results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Configuration
DATABASE_URL="${1:-}"
VERBOSE=false

# Functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_section() {
    echo -e "\n${CYAN}--- $1 ---${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_detail() {
    if [ "$VERBOSE" = true ]; then
        echo -e "  ${MAGENTA}→ $1${NC}"
    fi
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

# Main script
print_header "Azure PostgreSQL Database Validation"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed"
    echo ""
    echo "Install PostgreSQL client tools:"
    echo ""
    echo "  macOS:   brew install postgresql"
    echo "  Ubuntu:  sudo apt-get install postgresql-client"
    echo ""
    exit 1
fi
print_info "Using: $(psql --version | head -n1)"

# Get database URL
if [ -z "$DATABASE_URL" ]; then
    if [ -n "$AZURE_DATABASE_URL" ]; then
        print_info "Using AZURE_DATABASE_URL from environment"
        DATABASE_URL=$(url_encode "$AZURE_DATABASE_URL")
    else
        echo ""
        print_info "Please provide your Azure PostgreSQL connection details"
        echo ""
        
        read -p "Azure Server Host: " DB_HOST
        read -p "Database Name (default: powernova_db): " DB_NAME
        DB_NAME=${DB_NAME:-powernova_db}
        read -p "Database User: " DB_USER
        read -sp "Database Password: " DB_PASSWORD
        echo ""
        
        # URL encode the password to handle special characters
        DB_PASSWORD_ENCODED=$(url_encode "$DB_PASSWORD")
        
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"
    fi
fi

echo ""

# Extract connection details for display
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

print_info "Validating database: $DB_NAME on $DB_HOST"
echo ""print_info "Database URL: $DATABASE_URL"
print_info "Validating database: $DB_NAME on $DB_HOST"
echo ""

##############################################################################
# VALIDATION TESTS
##############################################################################

# Test 1: Connection
print_section "1. Connection Tests"

if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
    print_success "Database connection successful"
else
    print_error "Cannot connect to database"
    print_info "Check your credentials and firewall rules"
    exit 1
fi

# Test SSL connection (with timeout to prevent hanging)
SSL_MODE=$(timeout 10 psql "$DATABASE_URL" -t -c "SHOW ssl;" 2>/dev/null | xargs || echo "unknown")
if [ "$SSL_MODE" = "on" ]; then
    print_success "SSL/TLS encryption is enabled"
elif [ "$SSL_MODE" = "unknown" ]; then
    print_warning "Could not determine SSL/TLS status"
else
    print_warning "SSL/TLS encryption status: $SSL_MODE"
fi

# Test 2: PostgreSQL Version
print_section "2. PostgreSQL Version"

PG_VERSION=$(psql "$DATABASE_URL" -t -c "SHOW server_version;" 2>/dev/null | xargs || echo "unknown")
if [ "$PG_VERSION" = "unknown" ]; then
    print_error "Could not retrieve PostgreSQL version"
    print_info "Check database connection and permissions"
else
    print_detail "Version: $PG_VERSION"
    
    MAJOR_VERSION=$(echo "$PG_VERSION" | cut -d. -f1 | grep -o '[0-9]*' | head -n1)
    if [ -n "$MAJOR_VERSION" ] && [ "$MAJOR_VERSION" -ge 13 ]; then
        print_success "PostgreSQL version $MAJOR_VERSION is supported"
    elif [ -n "$MAJOR_VERSION" ]; then
        print_error "PostgreSQL version $MAJOR_VERSION is too old (need >= 13)"
    else
        print_warning "Could not parse PostgreSQL version number"
    fi
fi

# Test 3: Required Extensions
print_section "3. Extensions"

# Check if pgvector is available
PGVECTOR_AVAILABLE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'vector';" 2>/dev/null | xargs || echo "0")

if [ "$PGVECTOR_AVAILABLE" -gt 0 ]; then
    print_success "pgvector extension is available"
    
    # Check if installed
    PGVECTOR_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs || echo "0")
    if [ "$PGVECTOR_INSTALLED" -gt 0 ]; then
        VECTOR_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs || echo "unknown")
        print_success "pgvector extension is installed (version: $VECTOR_VERSION)"
    else
        print_warning "pgvector extension is available but not installed"
        print_info "Run: CREATE EXTENSION vector;"
    fi
else
    print_error "pgvector extension is not available on this server"
    print_info "Contact Azure support to enable pgvector"
fi

# Check uuid-ossp extension
UUID_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" 2>/dev/null | xargs || echo "0")
if [ "$UUID_INSTALLED" -gt 0 ]; then
    print_success "uuid-ossp extension is installed"
else
    print_warning "uuid-ossp extension is not installed (may be needed)"
fi

# Test 4: Database Configuration
print_section "4. Database Configuration"

# Check encoding
ENCODING=$(psql "$DATABASE_URL" -t -c "SHOW server_encoding;" 2>/dev/null | xargs || echo "unknown")
if [ "$ENCODING" = "UTF8" ]; then
    print_success "Database encoding is UTF8"
elif [ "$ENCODING" = "unknown" ]; then
    print_warning "Could not retrieve database encoding"
else
    print_warning "Database encoding is $ENCODING (expected UTF8)"
fi

# Check locale
LC_COLLATE=$(psql "$DATABASE_URL" -t -c "SHOW lc_collate;" 2>/dev/null | xargs || echo "unknown")
if [ "$LC_COLLATE" != "unknown" ]; then
    print_detail "Collation: $LC_COLLATE"
    print_success "Locale configured: $LC_COLLATE"
else
    print_warning "Could not retrieve locale information"
fi

# Check timezone
TIMEZONE=$(psql "$DATABASE_URL" -t -c "SHOW timezone;" 2>/dev/null | xargs || echo "unknown")
if [ "$TIMEZONE" != "unknown" ]; then
    print_detail "Timezone: $TIMEZONE"
    print_success "Timezone configured: $TIMEZONE"
else
    print_warning "Could not retrieve timezone information"
fi

# Test 5: Connection Parameters
print_section "5. Connection & Performance Settings"

# Max connections
MAX_CONNECTIONS=$(psql "$DATABASE_URL" -t -c "SHOW max_connections;" 2>/dev/null | xargs || echo "0")
if [ "$MAX_CONNECTIONS" -gt 0 ]; then
    print_detail "Max connections: $MAX_CONNECTIONS"
    if [ "$MAX_CONNECTIONS" -ge 50 ]; then
        print_success "Max connections: $MAX_CONNECTIONS (sufficient)"
    else
        print_warning "Max connections: $MAX_CONNECTIONS (may be low for production)"
    fi
else
    print_warning "Could not retrieve max_connections setting"
fi

# Shared buffers
SHARED_BUFFERS=$(psql "$DATABASE_URL" -t -c "SHOW shared_buffers;" 2>/dev/null | xargs || echo "unknown")
if [ "$SHARED_BUFFERS" != "unknown" ]; then
    print_detail "Shared buffers: $SHARED_BUFFERS"
    print_success "Shared buffers configured: $SHARED_BUFFERS"
else
    print_warning "Could not retrieve shared_buffers setting"
fi

# Work mem
WORK_MEM=$(psql "$DATABASE_URL" -t -c "SHOW work_mem;" 2>/dev/null | xargs || echo "unknown")
if [ "$WORK_MEM" != "unknown" ]; then
    print_detail "Work mem: $WORK_MEM"
    print_success "Work memory configured: $WORK_MEM"
else
    print_warning "Could not retrieve work_mem setting"
fi

# Test 6: Database Size & Storage
print_section "6. Database Size & Storage"

DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs || echo "unknown")
if [ "$DB_SIZE" != "unknown" ]; then
    print_detail "Current size: $DB_SIZE"
    print_success "Database size: $DB_SIZE"
else
    print_warning "Could not retrieve database size"
fi

# Check table count
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "0")
print_detail "Tables in public schema: $TABLE_COUNT"
if [ "$TABLE_COUNT" -eq 0 ]; then
    print_info "Database is empty (ready for migration)"
else
    print_success "Database has $TABLE_COUNT tables"
fi

# Test 7: Permissions
print_section "7. User Permissions"

# Check if user can create tables
if psql "$DATABASE_URL" -c "CREATE TABLE __test_permissions (id SERIAL PRIMARY KEY);" &> /dev/null; then
    psql "$DATABASE_URL" -c "DROP TABLE __test_permissions;" &> /dev/null
    print_success "User has CREATE TABLE permission"
else
    print_error "User cannot create tables"
fi

# Check if user can create extensions
if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" &> /dev/null; then
    print_success "User has CREATE EXTENSION permission"
else
    print_warning "User may not have CREATE EXTENSION permission"
    print_info "Some extensions may require superuser access"
fi

# Test 8: Network & Performance
print_section "8. Network & Performance"

# Test query performance
START_TIME=$(date +%s%N)
psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null
END_TIME=$(date +%s%N)
LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

print_detail "Query latency: ${LATENCY}ms"
if [ "$LATENCY" -lt 100 ]; then
    print_success "Network latency is excellent (${LATENCY}ms)"
elif [ "$LATENCY" -lt 500 ]; then
    print_success "Network latency is good (${LATENCY}ms)"
else
    print_warning "Network latency is high (${LATENCY}ms)"
    print_info "Consider deploying application in the same Azure region"
fi

# Test 9: PowerNOVA-Specific Requirements
print_section "9. PowerNOVA Application Requirements"

# Check if we can create vector columns
if [ "$PGVECTOR_INSTALLED" -gt 0 ]; then
    if psql "$DATABASE_URL" -c "CREATE TABLE __test_vector (id SERIAL, embedding vector(1536));" &> /dev/null; then
        psql "$DATABASE_URL" -c "DROP TABLE __test_vector;" &> /dev/null
        print_success "Can create vector columns (1536 dimensions)"
    else
        print_error "Cannot create vector columns"
    fi
else
    print_warning "Skipping vector column test (pgvector not installed)"
fi

# Check if we can handle JSON
if psql "$DATABASE_URL" -c "CREATE TABLE __test_json (id SERIAL, data JSONB); INSERT INTO __test_json (data) VALUES ('{\"test\": true}'); DROP TABLE __test_json;" &> /dev/null; then
    print_success "JSONB data type is supported"
else
    print_error "JSONB data type is not supported"
fi

# Test timestamp with timezone
if psql "$DATABASE_URL" -c "CREATE TABLE __test_timestamp (id SERIAL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()); DROP TABLE __test_timestamp;" &> /dev/null; then
    print_success "Timestamp with timezone is supported"
else
    print_error "Timestamp with timezone is not supported"
fi

# Test 10: Backup & Recovery
print_section "10. Backup Configuration"

# This information is from Azure, not queryable via SQL
print_info "Verify in Azure Portal:"
print_info "  • Backup retention period (recommended: 7+ days)"
print_info "  • Geo-redundant backup (optional)"
print_info "  • Point-in-time restore enabled"
((TOTAL_CHECKS++))

##############################################################################
# VALIDATION SUMMARY
##############################################################################

print_header "Validation Summary"

echo -e "${CYAN}Total checks: $TOTAL_CHECKS${NC}"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
echo ""

# Calculate percentage
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    PASS_PERCENTAGE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
else
    PASS_PERCENTAGE=0
fi

echo -e "Success rate: ${CYAN}${PASS_PERCENTAGE}%${NC}"
echo ""

# Overall status
if [ "$FAILED_CHECKS" -eq 0 ]; then
    if [ "$WARNING_CHECKS" -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ DATABASE IS READY FOR MIGRATION!   ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        echo ""
        print_info "Your Azure PostgreSQL database is properly configured"
        print_info "You can proceed with the migration"
        echo ""
        
        print_section "Next Steps"
        echo "1. Dump Supabase database:"
        echo -e "   ${CYAN}cd scripts && ./dump-supabase-database.sh -c${NC}"
        echo ""
        echo "2. Restore to Azure:"
        echo -e "   ${CYAN}./restore-to-azure.sh -i supabase-backup.sql.gz${NC}"
        echo ""
        echo "3. Update application DATABASE_URL to:"
        echo -e "   ${CYAN}$DATABASE_URL${NC}"
        echo ""
        
        exit 0
    else
        echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠ DATABASE IS READY WITH WARNINGS    ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
        echo ""
        print_info "Your database is functional but has some warnings"
        print_info "Review the warnings above before migrating"
        echo ""
        
        exit 0
    fi
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ DATABASE HAS CRITICAL ISSUES        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    print_error "$FAILED_CHECKS critical issue(s) found"
    print_info "Fix the errors above before proceeding with migration"
    echo ""
    
    print_section "Common Fixes"
    
    if [ "$PGVECTOR_INSTALLED" -eq 0 ] && [ "$PGVECTOR_AVAILABLE" -gt 0 ]; then
        echo "• Install pgvector extension:"
        echo -e "  ${CYAN}psql \"$DATABASE_URL\" -c 'CREATE EXTENSION vector;'${NC}"
        echo ""
    fi
    
    if [ "$PGVECTOR_AVAILABLE" -eq 0 ]; then
        echo "• Enable pgvector on Azure PostgreSQL:"
        echo "  1. Go to Azure Portal"
        echo "  2. Navigate to your PostgreSQL server"
        echo "  3. Settings → Server parameters"
        echo "  4. Search for 'azure.extensions'"
        echo "  5. Enable 'VECTOR'"
        echo "  6. Save and restart server"
        echo ""
    fi
    
    echo "• Add your IP to firewall:"
    echo -e "  ${CYAN}az postgres flexible-server firewall-rule create \\${NC}"
    echo -e "  ${CYAN}  --resource-group powernova \\${NC}"
    echo -e "  ${CYAN}  --name powernova-db-server \\${NC}"
    echo -e "  ${CYAN}  --rule-name MyIP \\${NC}"
    echo -e "  ${CYAN}  --start-ip-address \$(curl -s ifconfig.me) \\${NC}"
    echo -e "  ${CYAN}  --end-ip-address \$(curl -s ifconfig.me)${NC}"
    echo ""
    
    exit 1
fi
