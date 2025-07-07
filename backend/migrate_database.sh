#!/bin/bash

# Database Migration Script for PowerNOVA User Profile System
# This script will create the necessary tables for user profiles and settings

echo "🔧 PowerNOVA Database Migration - User Profile System"
echo "=================================================="

# Check if environment variables are set
if [ -z "$POWERNOVA_HOST" ] || [ -z "$POWERNOVA_DB" ] || [ -z "$POWERNOVA_USER" ]; then
    echo "❌ Error: Required environment variables are not set"
    echo "Please set: POWERNOVA_HOST, POWERNOVA_DB, POWERNOVA_USER, POWERNOVA_PASSWORD"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed or not in PATH"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo "📡 Connecting to database: $POWERNOVA_DB@$POWERNOVA_HOST"

# Run the migration
PGPASSWORD=$POWERNOVA_PASSWORD psql \
    -h $POWERNOVA_HOST \
    -U $POWERNOVA_USER \
    -d $POWERNOVA_DB \
    -f database_migration.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo ""
    echo "📋 Created tables:"
    echo "   - users (for user profiles)"
    echo "   - user_settings (for user preferences)"
    echo ""
    echo "🔗 API endpoints available:"
    echo "   GET  /api/user/profile - Get user profile and settings"
    echo "   PUT  /api/user/profile - Update user profile"
    echo "   PUT  /api/user/settings - Update user settings"
    echo "   DELETE /api/user/account - Delete user account"
    echo ""
    echo "🎉 You can now use the user profile system in your React Native app!"
else
    echo "❌ Database migration failed!"
    exit 1
fi
