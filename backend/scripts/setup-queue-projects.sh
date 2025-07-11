#!/bin/bash

# PowerNOVA Queue Projects Setup Script
# This script sets up the Python environment and populates ISO/RTO queue data

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
echo $"Script Directory: $SCRIPT_DIR"
echo $"Backend Directory: $BACKEND_DIR"
echo "🚀 PowerNOVA Queue Projects Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo "❌ Error: This script must be run from the backend directory"
    echo "Current directory: $(pwd)"
    echo "Expected backend directory: $BACKEND_DIR"
    exit 1
fi

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.8+ to continue"
    exit 1
fi

echo "✓ Found Python: $(python3 --version)"

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ Error: pip3 is not installed or not in PATH"
    echo "Please install pip3 to continue"
    exit 1
fi

# Create a virtual environment if it doesn't exist
VENV_DIR="$BACKEND_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "🔄 Activating Python virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if [ -f "$BACKEND_DIR/python-requirements.txt" ]; then
    pip install -r "$BACKEND_DIR/python-requirements.txt"
else
    echo "❌ Error: python-requirements.txt not found"
    exit 1
fi

echo "✓ Python dependencies installed successfully"

# Check environment variables
echo "🔍 Checking environment variables..."

# Load environment variables if .env exists
if [ -f "$BACKEND_DIR/.env" ]; then
    echo "📄 Loading environment variables from .env..."
    # Export all variables from .env
    set -a  # automatically export all variables
    source "$BACKEND_DIR/.env"
    set +a  # stop automatically exporting
fi

# Check required environment variables
REQUIRED_VARS=("POWERNOVA_HOST" "POWERNOVA_PORT" "POWERNOVA_DB" "POWERNOVA_USER" "POWERNOVA_PASSWORD")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  Warning: Some environment variables are not set:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Using default values where possible. For production, set these variables:"
    echo "export POWERNOVA_HOST=localhost"
    echo "export POWERNOVA_PORT=5432"
    echo "export POWERNOVA_DB=powernova"
    echo "export POWERNOVA_USER=postgres"
    echo "export POWERNOVA_PASSWORD=your_password"
    echo ""
fi

# Test database connection
echo "🔍 Testing database connection..."
if python3 "$SCRIPT_DIR/populate_queue_projects.py" test; then
    echo "✓ Database connection successful"
else
    echo "❌ Database connection failed"
    echo ""
    echo "Make sure:"
    echo "1. PostgreSQL is running"
    echo "2. Database 'powernova' exists"
    echo "3. Environment variables are correctly set"
    echo "4. Database migration has been run: npm run migrate"
    exit 1
fi

# Show available ISOs
echo ""
echo "📋 Available ISOs for data population:"
python3 "$SCRIPT_DIR/populate_queue_projects.py" list

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. To populate data for all ISOs:"
echo "   ./scripts/populate-queue-data.sh all"
echo ""
echo "2. To populate data for a specific ISO (e.g., CAISO):"
echo "   ./scripts/populate-queue-data.sh CAISO"
echo ""
echo "3. To test the populated data:"
echo "   curl 'http://localhost:3001/api/projects/projects' | jq"
echo ""

# Make populate script executable
chmod +x "$SCRIPT_DIR/populate-queue-data.sh" 2>/dev/null || true
