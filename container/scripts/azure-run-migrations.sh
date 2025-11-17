#!/bin/bash

##############################################################################
# Azure Container - Run Migrations Script
# 
# This script runs database migrations inside the Azure container
# It properly loads environment variables from Azure App Service settings
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

RESOURCE_GROUP="powernova"
APP_NAME="powernovaapi"

print_header() {
    echo ""
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  Run Migrations in Azure${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_header

print_info "This script will execute migrations inside the Azure container"
echo ""

# Get environment variables from Azure
print_info "Fetching environment variables from Azure App Service..."

DATABASE_URL=$(az webapp config appsettings list \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --query "[?name=='DATABASE_URL'].value" \
    -o tsv)

if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL not found in Azure App Service settings"
    exit 1
fi

print_success "DATABASE_URL found"

# Create a migration script that will run inside the container
MIGRATION_SCRIPT=$(cat <<'EOFSCRIPT'
#!/bin/bash
set -e

echo "=== Running Database Migrations ==="
echo ""

# Change to app directory
cd /app || cd /home/site/wwwroot || cd /home || { echo "Error: Cannot find app directory"; exit 1; }

echo "Current directory: $(pwd)"
echo ""

# Check if alembic.ini exists
if [ ! -f "alembic.ini" ]; then
    echo "Error: alembic.ini not found in $(pwd)"
    echo "Searching for alembic.ini..."
    find / -name "alembic.ini" -type f 2>/dev/null || echo "alembic.ini not found anywhere"
    exit 1
fi

echo "✓ Found alembic.ini"
echo ""

# Check Python version
echo "Python version: $(python --version)"
echo ""

# Check if alembic is installed
if ! python -c "import alembic" 2>/dev/null; then
    echo "Error: alembic package not installed"
    echo "Installed packages:"
    pip list | grep -i alembic || echo "No alembic package found"
    exit 1
fi

echo "✓ Alembic package installed"
echo ""

# Check database connection
echo "Testing database connection..."
python -c "
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print('Error: DATABASE_URL environment variable not set')
    exit(1)

print(f'Database URL: {db_url[:30]}...')

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text('SELECT 1'))
        print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    exit(1)
"

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Database connection test failed"
    echo "Please check your DATABASE_URL setting in Azure"
    exit 1
fi

echo ""

# Show current migration status
echo "Current migration status:"
python -m alembic current || echo "No migrations applied yet"
echo ""

# Run migrations
echo "Running migrations..."
python -m alembic upgrade head

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Migrations completed successfully!"
    echo ""
    
    # Verify tables were created
    echo "Verifying tables..."
    python -c "
from sqlalchemy import create_engine, inspect
import os

engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()

print(f'Tables created: {len(tables)}')
for table in sorted(tables):
    print(f'  - {table}')
"
    echo ""
    echo "=== Migration Complete ==="
else
    echo ""
    echo "✗ Migration failed"
    exit 1
fi
EOFSCRIPT
)

# Execute the migration script in the container with environment variables
print_info "Executing migrations in Azure container..."
echo ""

az webapp ssh --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" <<EOF
export DATABASE_URL="$DATABASE_URL"

# Create and run the migration script
cat > /tmp/run-migrations.sh << 'INNEREOF'
$MIGRATION_SCRIPT
INNEREOF

chmod +x /tmp/run-migrations.sh
/tmp/run-migrations.sh
EOF

echo ""
print_success "Migration execution completed!"
echo ""
print_info "You can verify the tables in your Supabase dashboard"
