#!/bin/bash

# Test script to verify environment variable export
# This script helps debug environment variable loading issues

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Environment Variable Debug Test"
echo "================================="
echo "Backend Directory: $BACKEND_DIR"
echo ""

# Check if .env exists
if [ -f "$BACKEND_DIR/.env" ]; then
    echo "✓ Found .env file"
    echo ""
    echo "📄 Contents of .env (passwords hidden):"
    cat "$BACKEND_DIR/.env" | sed 's/PASSWORD=.*/PASSWORD=***/'
    echo ""
else
    echo "❌ No .env file found at $BACKEND_DIR/.env"
    echo "Please create one with your database configuration"
    exit 1
fi

echo "🔄 Loading environment variables..."

# Load and export environment variables
set -a  # automatically export all variables
source "$BACKEND_DIR/.env"
set +a  # stop automatically exporting

echo "✓ Environment variables loaded"
echo ""

echo "📋 PowerNOVA environment variables seen by this script:"
for var in POWERNOVA_HOST POWERNOVA_PORT POWERNOVA_DB POWERNOVA_USER POWERNOVA_PASSWORD; do
    value="${!var}"
    if [[ "$var" == *"PASSWORD"* ]] && [ -n "$value" ]; then
        echo "  $var = ***"
    else
        echo "  $var = ${value:-NOT SET}"
    fi
done

echo ""
echo "🐍 Testing Python script environment variable access..."

# Activate virtual environment if it exists
VENV_DIR="$BACKEND_DIR/venv"
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
    echo "✓ Activated Python virtual environment"
else
    echo "⚠️  No virtual environment found - using system Python"
fi

# Run the debug command in Python script
if python3 "$SCRIPT_DIR/populate_queue_projects.py" debug; then
    echo ""
    echo "✓ Python script can access environment variables correctly"
else
    echo ""
    echo "❌ Python script cannot access environment variables"
    echo ""
    echo "This suggests the environment variables are not being properly exported."
    echo "Make sure you're using 'set -a; source .env; set +a' instead of just 'source .env'"
fi

echo ""
echo "🧪 Testing database connection..."
python3 "$SCRIPT_DIR/populate_queue_projects.py" test
