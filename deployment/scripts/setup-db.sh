#!/bin/bash

# Database Migration and Setup Script

set -e

echo "🗄️ Setting up database and Typesense..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found"
    exit 1
fi

# Test database connection
echo "🔌 Testing database connection..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

# Run database migrations (if they exist)
if [ -f "backend/database_migration.sql" ]; then
    echo "🗄️ Running database migrations..."
    cd backend
    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -f database_migration.sql
    else
        echo "⚠️  psql not found. Please run migrations manually:"
        echo "psql \"$DATABASE_URL\" -f backend/database_migration.sql"
    fi
    cd ..
fi

# Setup Typesense
echo "🔍 Setting up Typesense..."
cd backend

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Run Typesense setup script if it exists
if [ -f "scripts/sync-typesense.js" ]; then
    echo "🔄 Syncing data to Typesense..."
    node scripts/sync-typesense.js
else
    echo "⚠️  Typesense sync script not found. You may need to run it manually."
fi

cd ..

echo "✅ Database and Typesense setup completed"
