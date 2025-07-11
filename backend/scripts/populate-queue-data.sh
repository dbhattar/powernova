#!/bin/bash

# PowerNOVA Queue Data Population Script
# This script runs the queue data population with proper environment setup

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if virtual environment exists
VENV_DIR="$BACKEND_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Python virtual environment not found. Please run setup first:"
    echo "   ./scripts/setup-queue-projects.sh"
    exit 1
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Load environment variables if .env exists
if [ -f "$BACKEND_DIR/.env" ]; then
    # Export all variables from .env
    set -a  # automatically export all variables
    source "$BACKEND_DIR/.env"
    set +a  # stop automatically exporting
fi

# Default command
COMMAND="populate"
ISO_ARG=""

# Parse arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 <command> [iso]"
    echo ""
    echo "Commands:"
    echo "  test              - Test database connection"
    echo "  debug             - Show environment variables and config"
    echo "  inspect <iso>     - Inspect data structure for specific ISO"
    echo "  list              - List available ISOs"
    echo "  populate [iso]    - Populate data for specific ISO or all ISOs"
    echo "  all               - Populate data for all ISOs"
    echo ""
    echo "Examples:"
    echo "  $0 test"
    echo "  $0 debug"
    echo "  $0 inspect ERCOT"
    echo "  $0 list"
    echo "  $0 populate CAISO"
    echo "  $0 all"
    exit 1
fi

COMMAND="$1"

if [ "$COMMAND" == "all" ]; then
    COMMAND="populate-all"
elif [ "$COMMAND" == "inspect" ] && [ $# -gt 1 ]; then
    ISO_ARG="$2"
elif [ "$COMMAND" == "populate" ] && [ $# -gt 1 ]; then
    ISO_ARG="$2"
fi

echo "🚀 PowerNOVA Queue Data Population"
echo "=================================="
echo "Command: $COMMAND"
if [ -n "$ISO_ARG" ]; then
    echo "ISO: $ISO_ARG"
fi
echo ""

# Run the Python script
if [ -n "$ISO_ARG" ]; then
    python3 "$SCRIPT_DIR/populate_queue_projects.py" "$COMMAND" "$ISO_ARG"
else
    python3 "$SCRIPT_DIR/populate_queue_projects.py" "$COMMAND"
fi

if [ $? -eq 0 ] && [[ "$COMMAND" == "populate"* ]]; then
    echo ""
    echo "🎉 Data population completed!"
    echo ""
    echo "To verify the data was populated, you can:"
    echo "1. Check the database directly:"
    echo "   psql -h \$POWERNOVA_HOST -U \$POWERNOVA_USER -d \$POWERNOVA_DB -c \"SELECT IsoID, COUNT(*) FROM QueueInfo GROUP BY IsoID;\""
    echo ""
    echo "2. Test the API endpoints:"
    echo "   curl 'http://localhost:3001/api/projects/projects' | jq '.count'"
    echo "   curl 'http://localhost:3001/api/projects/projects/CAISO' | jq '.count'"
    echo ""
fi
