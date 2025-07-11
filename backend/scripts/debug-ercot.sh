#!/bin/bash

# Quick debug script for ERCOT data structure issue

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 ERCOT Data Structure Debug"
echo "============================="

# Activate virtual environment
VENV_DIR="$BACKEND_DIR/venv"
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
    echo "✓ Activated Python virtual environment"
else
    echo "❌ No virtual environment found"
    exit 1
fi

# Load environment variables
if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    source "$BACKEND_DIR/.env"
    set +a
    echo "✓ Loaded environment variables"
fi

echo ""
echo "🔍 Inspecting ERCOT data structure..."
python3 "$SCRIPT_DIR/populate_queue_projects.py" inspect ERCOT

echo ""
echo "🧪 Testing ERCOT data population with improved logic..."
python3 "$SCRIPT_DIR/populate_queue_projects.py" populate ERCOT
