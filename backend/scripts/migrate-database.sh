#!/bin/bash

# PowerNOVA Database Migration Script
# This script runs the database migration with proper environment variable loading

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🗄️ PowerNOVA Database Migration"
echo "==============================="

# Load environment variables if .env exists
if [ -f "$BACKEND_DIR/.env" ]; then
    echo "📄 Loading environment variables from .env..."
    # Export all variables from .env
    set -a  # automatically export all variables
    source "$BACKEND_DIR/.env"
    set +a  # stop automatically exporting
else
    echo "⚠️  No .env file found, using default values"
fi

# Set default values if environment variables are not set
POWERNOVA_HOST="${POWERNOVA_HOST:-localhost}"
POWERNOVA_PORT="${POWERNOVA_PORT:-5432}"
POWERNOVA_DB="${POWERNOVA_DB:-powernova}"
POWERNOVA_USER="${POWERNOVA_USER:-postgres}"

echo "🔍 Database connection details:"
echo "  Host: $POWERNOVA_HOST"
echo "  Port: $POWERNOVA_PORT"
echo "  Database: $POWERNOVA_DB"
echo "  User: $POWERNOVA_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql (PostgreSQL client) is not installed or not in PATH"
    echo "Please install PostgreSQL client tools to continue"
    exit 1
fi

# Test database connection first
echo "🔍 Testing database connection..."
if ! PGPASSWORD="$POWERNOVA_PASSWORD" psql -h "$POWERNOVA_HOST" -p "$POWERNOVA_PORT" -U "$POWERNOVA_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to PostgreSQL server"
    echo ""
    echo "Please check:"
    echo "1. PostgreSQL is running"
    echo "2. Host, port, user, and password are correct"
    echo "3. Network connectivity to database server"
    echo ""
    echo "Connection details:"
    echo "  Host: $POWERNOVA_HOST"
    echo "  Port: $POWERNOVA_PORT" 
    echo "  User: $POWERNOVA_USER"
    echo "  Password: ${POWERNOVA_PASSWORD:+***} ${POWERNOVA_PASSWORD:-NOT SET}"
    exit 1
fi

echo "✓ Database connection successful"

# Check if database exists, create if not
echo "🔍 Checking if database '$POWERNOVA_DB' exists..."
if ! PGPASSWORD="$POWERNOVA_PASSWORD" psql -h "$POWERNOVA_HOST" -p "$POWERNOVA_PORT" -U "$POWERNOVA_USER" -lqt | cut -d \| -f 1 | grep -qw "$POWERNOVA_DB"; then
    echo "🏗️  Database '$POWERNOVA_DB' does not exist, creating it..."
    PGPASSWORD="$POWERNOVA_PASSWORD" createdb -h "$POWERNOVA_HOST" -p "$POWERNOVA_PORT" -U "$POWERNOVA_USER" "$POWERNOVA_DB"
    echo "✓ Database '$POWERNOVA_DB' created successfully"
else
    echo "✓ Database '$POWERNOVA_DB' exists"
fi

# Run the migration
echo "🚀 Running database migration..."
if PGPASSWORD="$POWERNOVA_PASSWORD" psql -h "$POWERNOVA_HOST" -p "$POWERNOVA_PORT" -U "$POWERNOVA_USER" -d "$POWERNOVA_DB" -f "$BACKEND_DIR/database_migration.sql"; then
    echo ""
    echo "🎉 Database migration completed successfully!"
    echo ""
    echo "📊 Checking created tables..."
    
    # List tables to verify migration
    PGPASSWORD="$POWERNOVA_PASSWORD" psql -h "$POWERNOVA_HOST" -p "$POWERNOVA_PORT" -U "$POWERNOVA_USER" -d "$POWERNOVA_DB" -c "
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    "
    
    echo ""
    echo "✅ Migration complete! You can now:"
    echo "1. Test the backend API connection"
    echo "2. Set up queue projects: npm run setup-queue-projects"
    echo "3. Populate queue data: npm run populate-all-isos"
else
    echo ""
    echo "❌ Database migration failed!"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi
