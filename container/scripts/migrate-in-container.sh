#!/bin/bash

##############################################################################
# Quick Migration Script - Run this INSIDE the Azure container
# 
# Usage: After SSH'ing into the container, run:
#   curl -s https://raw.githubusercontent.com/... | bash
#   OR copy-paste this script
##############################################################################

set -e

echo "=== Azure Container Migration Script ==="
echo ""

# Find the app directory
echo "Finding app directory..."
if [ -d "/app" ]; then
    APP_DIR="/app"
elif [ -d "/home/site/wwwroot" ]; then
    APP_DIR="/home/site/wwwroot"
elif [ -d "/home" ]; then
    APP_DIR="/home"
else
    APP_DIR=$(pwd)
fi

echo "Using directory: $APP_DIR"
cd "$APP_DIR"
echo ""

# Load environment variables from Azure App Service
# These are injected by Azure but might not be in the SSH shell
echo "Loading environment variables..."

# Try to read from the process environment
if [ -z "$DATABASE_URL" ]; then
    # Try to get it from the running process
    PID=$(pgrep -f "uvicorn main:app" | head -1)
    if [ -n "$PID" ]; then
        echo "Found uvicorn process: $PID"
        # Read environment from the running process
        if [ -f "/proc/$PID/environ" ]; then
            export $(cat /proc/$PID/environ | tr '\0' '\n' | grep DATABASE_URL)
            export $(cat /proc/$PID/environ | tr '\0' '\n' | grep OPENAI_API_KEY)
        fi
    fi
fi

# Check if we have DATABASE_URL now
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not found in environment"
    echo ""
    echo "Please set it manually:"
    echo "  export DATABASE_URL='your-database-url'"
    echo ""
    echo "You can get it from Azure:"
    echo "  az webapp config appsettings list --resource-group powernova --name powernovaapi"
    exit 1
fi

echo "✓ DATABASE_URL loaded: ${DATABASE_URL:0:30}..."
echo ""

# Test database connection
echo "Testing database connection..."
python -c "
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL')
engine = create_engine(db_url)

try:
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('✓ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    exit(1)
"

if [ $? -ne 0 ]; then
    exit 1
fi

echo ""

# Check alembic
echo "Checking Alembic..."
if ! python -c "import alembic" 2>/dev/null; then
    echo "❌ Alembic not installed"
    exit 1
fi

if [ ! -f "alembic.ini" ]; then
    echo "❌ alembic.ini not found in $APP_DIR"
    exit 1
fi

echo "✓ Alembic ready"
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
    echo "✅ Migrations completed successfully!"
    echo ""
    
    # Verify tables
    echo "Tables in database:"
    python -c "
from sqlalchemy import create_engine, inspect
import os

engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()

print(f'Found {len(tables)} tables:')
for table in sorted(tables):
    print(f'  ✓ {table}')
"
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "=== Migration Complete! ==="
