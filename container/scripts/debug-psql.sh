#!/bin/bash

# Quick debug script to test psql commands
# Run this to see which command is failing

DATABASE_URL="$1"

if [ -z "$DATABASE_URL" ]; then
    echo "Usage: $0 'postgresql://user:pass@host:5432/db'"
    exit 1
fi

echo "Testing psql commands..."
echo ""

echo "1. Testing SELECT 1..."
if psql "$DATABASE_URL" -c "SELECT 1;" 2>&1; then
    echo "✓ SELECT 1 works"
else
    echo "✗ SELECT 1 failed"
fi
echo ""

echo "2. Testing SHOW ssl..."
if psql "$DATABASE_URL" -t -c "SHOW ssl;" 2>&1; then
    echo "✓ SHOW ssl works"
else
    echo "✗ SHOW ssl failed"
fi
echo ""

echo "3. Testing SHOW server_version..."
if psql "$DATABASE_URL" -t -c "SHOW server_version;" 2>&1; then
    echo "✓ SHOW server_version works"
else
    echo "✗ SHOW server_version failed"
fi
echo ""

echo "4. Testing pg_available_extensions..."
if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'vector';" 2>&1; then
    echo "✓ pg_available_extensions works"
else
    echo "✗ pg_available_extensions failed"
fi
echo ""

echo "Done!"
