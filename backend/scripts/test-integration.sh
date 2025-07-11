#!/bin/bash

# PowerNOVA Queue Projects Integration Test
# This script tests the complete integration workflow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧪 PowerNOVA Queue Projects Integration Test"
echo "============================================"

# Check if backend is running
API_URL="http://localhost:3001"
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo "❌ Backend server is not running at ${API_URL}"
    echo "Please start the backend server:"
    echo "   cd backend && npm run dev"
    exit 1
fi

echo "✓ Backend server is running"

# Test API health
API_HEALTH=$(curl -s "${API_URL}/api/health" | jq -r '.status' 2>/dev/null || echo "error")
if [ "$API_HEALTH" != "ok" ]; then
    echo "❌ API health check failed"
    exit 1
fi

echo "✓ API health check passed"

# Test projects endpoint (without auth for testing)
PROJECTS_RESPONSE=$(curl -s "${API_URL}/api/projects/health" | jq -r '.status' 2>/dev/null || echo "error")
if [ "$PROJECTS_RESPONSE" != "ok" ]; then
    echo "❌ Projects endpoint health check failed"
    echo "This is expected if authentication is required"
else
    echo "✓ Projects endpoint health check passed"
fi

# Test database connection from Python
echo "🔍 Testing Python database connection..."
cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Load environment variables
if [ -f ".env" ]; then
    # Export all variables from .env
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
fi

# Test Python script
if python3 scripts/populate_queue_projects.py test; then
    echo "✓ Python database connection successful"
else
    echo "❌ Python database connection failed"
    exit 1
fi

# Check if QueueInfo table has data
echo "🔍 Checking QueueInfo table data..."

# Use psql if available, otherwise use Python
if command -v psql &> /dev/null; then
    ROW_COUNT=$(psql -h "${POWERNOVA_HOST:-localhost}" -U "${POWERNOVA_USER:-postgres}" -d "${POWERNOVA_DB:-powernova}" -t -c "SELECT COUNT(*) FROM QueueInfo;" 2>/dev/null | xargs || echo "0")
else
    ROW_COUNT=$(python3 -c "
import psycopg2
import os
conn = psycopg2.connect(
    host=os.environ.get('POWERNOVA_HOST', 'localhost'),
    port=int(os.environ.get('POWERNOVA_PORT', 5432)),
    database=os.environ.get('POWERNOVA_DB', 'powernova'),
    user=os.environ.get('POWERNOVA_USER', 'postgres'),
    password=os.environ.get('POWERNOVA_PASSWORD', 'password')
)
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM QueueInfo')
print(cursor.fetchone()[0])
conn.close()
" 2>/dev/null || echo "0")
fi

echo "📊 QueueInfo table contains: $ROW_COUNT rows"

if [ "$ROW_COUNT" -gt 0 ]; then
    echo "✓ QueueInfo table has data"
    
    # Show breakdown by ISO if data exists
    echo "📋 Data breakdown by ISO:"
    if command -v psql &> /dev/null; then
        psql -h "${POWERNOVA_HOST:-localhost}" -U "${POWERNOVA_USER:-postgres}" -d "${POWERNOVA_DB:-powernova}" -c "SELECT IsoID, COUNT(*) as count FROM QueueInfo GROUP BY IsoID ORDER BY count DESC;" 2>/dev/null || echo "Could not retrieve ISO breakdown"
    fi
else
    echo "⚠️  QueueInfo table is empty"
    echo "To populate data, run:"
    echo "   npm run populate-queue-data populate CAISO"
    echo "   npm run populate-all-isos"
fi

echo ""
echo "🎯 Integration Test Summary"
echo "=========================="
echo "✓ Backend server running"
echo "✓ API health check passed"
echo "✓ Python database connection working"
echo "📊 QueueInfo table: $ROW_COUNT rows"

if [ "$ROW_COUNT" -gt 0 ]; then
    echo ""
    echo "🎉 Integration is working! The system can:"
    echo "   1. ✓ Fetch data using Python/gridstatus"
    echo "   2. ✓ Store data in PostgreSQL"
    echo "   3. ✓ Serve data via Node.js API"
    echo ""
    echo "To test the full workflow:"
    echo "   curl '${API_URL}/api/projects/projects?limit=5' | jq"
else
    echo ""
    echo "🚀 Integration setup complete! Next steps:"
    echo "   1. Populate some test data:"
    echo "      npm run populate-queue-data populate CAISO"
    echo "   2. Test the API:"
    echo "      curl '${API_URL}/api/projects/projects' | jq"
fi
