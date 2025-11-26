#!/bin/bash

##############################################################################
# Azure PostgreSQL Configuration Fix Script
# 
# This script helps fix common Azure PostgreSQL configuration issues:
# 1. Install pgvector extension
# 2. Install uuid-ossp extension
# 3. Verify SSL settings
# 
# Usage:
#   ./fix-azure-database.sh [database-url]
##############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# URL encode function
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

print_header "Azure PostgreSQL Configuration Fix"

# Get database URL
DATABASE_URL="${1:-}"

if [ -z "$DATABASE_URL" ]; then
    if [ -n "$AZURE_DATABASE_URL" ]; then
        print_info "Using AZURE_DATABASE_URL from environment"
        DATABASE_URL="$AZURE_DATABASE_URL"
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
        
        # URL encode the password
        DB_PASSWORD_ENCODED=$(url_encode "$DB_PASSWORD")
        
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"
    fi
fi

echo ""

# Test connection
print_info "Testing connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
    print_error "Cannot connect to database"
    print_info "Check your credentials and firewall rules"
    exit 1
fi
print_success "Connected to database"

echo ""

##############################################################################
# Fix 1: Install pgvector Extension
##############################################################################

print_header "1. Installing pgvector Extension"

# Check if pgvector is available
PGVECTOR_AVAILABLE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'vector';" 2>/dev/null | xargs || echo "0")

if [ "$PGVECTOR_AVAILABLE" -eq 0 ]; then
    print_error "pgvector extension is not available on this server"
    print_info "You need to enable it in Azure Portal:"
    echo ""
    echo "  1. Go to Azure Portal"
    echo "  2. Navigate to your PostgreSQL server"
    echo "  3. Settings → Server parameters"
    echo "  4. Search for 'azure.extensions'"
    echo "  5. Add 'VECTOR' to the list"
    echo "  6. Save and restart the server"
    echo ""
else
    # Check if already installed
    PGVECTOR_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs || echo "0")
    
    if [ "$PGVECTOR_INSTALLED" -gt 0 ]; then
        print_success "pgvector extension is already installed"
    else
        print_info "Attempting to install pgvector extension..."
        
        if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 | tee /tmp/pgvector_install.log; then
            print_success "pgvector extension installed successfully"
        else
            print_error "Failed to install pgvector extension"
            
            # Check if it's a permission issue
            if grep -q "permission denied\|must be owner\|must be superuser" /tmp/pgvector_install.log; then
                print_warning "This appears to be a permission issue"
                print_info "You need admin/superuser privileges to install extensions"
                echo ""
                echo "Options:"
                echo "  1. Connect using the admin user you created during server setup"
                echo "  2. Grant your user permission (requires admin):"
                echo "     psql -U admin_user -c 'ALTER USER your_user WITH SUPERUSER;'"
                echo ""
            fi
        fi
    fi
fi

##############################################################################
# Fix 2: Install uuid-ossp Extension
##############################################################################

print_header "2. Installing uuid-ossp Extension"

UUID_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" 2>/dev/null | xargs || echo "0")

if [ "$UUID_INSTALLED" -gt 0 ]; then
    print_success "uuid-ossp extension is already installed"
else
    print_info "Attempting to install uuid-ossp extension..."
    
    if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>&1 | tee /tmp/uuid_install.log; then
        print_success "uuid-ossp extension installed successfully"
    else
        print_error "Failed to install uuid-ossp extension"
        
        if grep -q "permission denied\|must be owner\|must be superuser" /tmp/uuid_install.log; then
            print_warning "Permission issue - see notes above about admin user"
        fi
    fi
fi

##############################################################################
# Fix 3: Check SSL Configuration
##############################################################################

print_header "3. SSL/TLS Configuration"

SSL_MODE=$(psql "$DATABASE_URL" -t -c "SHOW ssl;" 2>/dev/null | xargs || echo "unknown")

if [ "$SSL_MODE" = "on" ]; then
    print_success "SSL/TLS is enabled on the server"
elif [ "$SSL_MODE" = "unknown" ]; then
    print_warning "Could not determine SSL status"
    print_info "Ensure your connection string includes: ?sslmode=require"
else
    print_warning "SSL status: $SSL_MODE"
    print_info "Azure PostgreSQL should have SSL enabled by default"
fi

# Check connection string SSL mode
if echo "$DATABASE_URL" | grep -q "sslmode=require"; then
    print_success "Connection string requires SSL (sslmode=require)"
elif echo "$DATABASE_URL" | grep -q "sslmode="; then
    SSL_PARAM=$(echo "$DATABASE_URL" | sed -n 's/.*sslmode=\([^&]*\).*/\1/p')
    print_warning "Connection string SSL mode: $SSL_PARAM"
    print_info "Recommended: Add '?sslmode=require' to your connection string"
else
    print_warning "Connection string does not specify SSL mode"
    print_info "Add '?sslmode=require' to your connection string:"
    echo ""
    echo "  postgresql://user:pass@host:5432/db?sslmode=require"
    echo ""
fi

##############################################################################
# Fix 4: Test Extension Functionality
##############################################################################

print_header "4. Testing Extension Functionality"

# Test pgvector if installed
PGVECTOR_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs || echo "0")

if [ "$PGVECTOR_INSTALLED" -gt 0 ]; then
    print_info "Testing pgvector functionality..."
    
    if psql "$DATABASE_URL" -c "SELECT '[1,2,3]'::vector;" &> /dev/null; then
        print_success "pgvector is working correctly"
    else
        print_error "pgvector test failed"
    fi
fi

# Test uuid-ossp if installed
UUID_INSTALLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" 2>/dev/null | xargs || echo "0")

if [ "$UUID_INSTALLED" -gt 0 ]; then
    print_info "Testing uuid-ossp functionality..."
    
    if psql "$DATABASE_URL" -c "SELECT uuid_generate_v4();" &> /dev/null; then
        print_success "uuid-ossp is working correctly"
    else
        print_error "uuid-ossp test failed"
    fi
fi

##############################################################################
# Summary
##############################################################################

print_header "Summary & Next Steps"

# Re-check all extensions
PGVECTOR_FINAL=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs || echo "0")
UUID_FINAL=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" 2>/dev/null | xargs || echo "0")

ISSUES_FIXED=0
ISSUES_REMAINING=0

if [ "$PGVECTOR_FINAL" -gt 0 ]; then
    echo -e "${GREEN}✓ pgvector extension: Installed${NC}"
    ((ISSUES_FIXED++))
else
    echo -e "${RED}✗ pgvector extension: Not installed${NC}"
    ((ISSUES_REMAINING++))
fi

if [ "$UUID_FINAL" -gt 0 ]; then
    echo -e "${GREEN}✓ uuid-ossp extension: Installed${NC}"
    ((ISSUES_FIXED++))
else
    echo -e "${YELLOW}⚠ uuid-ossp extension: Not installed (optional)${NC}"
fi

if echo "$DATABASE_URL" | grep -q "sslmode=require"; then
    echo -e "${GREEN}✓ SSL mode: Required in connection string${NC}"
    ((ISSUES_FIXED++))
else
    echo -e "${YELLOW}⚠ SSL mode: Not explicitly required${NC}"
fi

echo ""

if [ "$ISSUES_REMAINING" -eq 0 ]; then
    print_success "All critical issues resolved!"
    echo ""
    print_info "Next steps:"
    echo "  1. Run validation again: ./validate-azure-database.sh"
    echo "  2. Proceed with migration if validation passes"
else
    print_warning "$ISSUES_REMAINING issue(s) need attention"
    echo ""
    
    if [ "$PGVECTOR_FINAL" -eq 0 ]; then
        print_info "To fix pgvector installation:"
        echo ""
        echo "  Option 1: Connect as admin user"
        echo "    psql -U admin_user -d $DB_NAME -c 'CREATE EXTENSION vector;'"
        echo ""
        echo "  Option 2: Enable in Azure Portal (if not available)"
        echo "    Portal → PostgreSQL → Server parameters → azure.extensions → Add VECTOR"
        echo ""
    fi
fi

echo ""
print_info "For detailed status, run: ./validate-azure-database.sh"
