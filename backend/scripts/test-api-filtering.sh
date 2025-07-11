#!/bin/bash

# Test script to verify API endpoints work with ISO filtering

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

API_URL="http://localhost:3001"

echo "🧪 Testing API Endpoints for ISO Filtering"
echo "=========================================="

# Check if backend is running
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo "❌ Backend server is not running at ${API_URL}"
    echo "Please start the backend server:"
    echo "   cd backend && npm run dev"
    exit 1
fi

echo "✓ Backend server is running"

echo ""
echo "🔍 Testing projects endpoints..."

echo ""
echo "1. All projects (should show total count):"
curl -s "${API_URL}/api/projects/projects?limit=5" | jq '{count: .count, sample_projects: [.results[]? | {IsoID, QueueID, ProjectName}]}'

echo ""
echo "2. ERCOT projects (uppercase - should work now):"
curl -s "${API_URL}/api/projects/projects/ERCOT?limit=5" | jq '{count: .count, sample_projects: [.results[]? | {IsoID, QueueID, ProjectName}]}'

echo ""
echo "3. ercot projects (lowercase - should also work):"
curl -s "${API_URL}/api/projects/projects/ercot?limit=5" | jq '{count: .count, sample_projects: [.results[]? | {IsoID, QueueID, ProjectName}]}'

echo ""
echo "4. Ercot projects (mixed case - should also work):"
curl -s "${API_URL}/api/projects/projects/Ercot?limit=5" | jq '{count: .count, sample_projects: [.results[]? | {IsoID, QueueID, ProjectName}]}'

echo ""
echo "5. Project details (pick first ERCOT project):"
# Get first ERCOT project ID
FIRST_PROJECT=$(curl -s "${API_URL}/api/projects/projects/ERCOT?limit=1" | jq -r '.results[0] | "\(.IsoID)/\(.QueueID)"')
if [ "$FIRST_PROJECT" != "null/null" ] && [ "$FIRST_PROJECT" != "/" ]; then
    IFS='/' read -r ISO_ID QUEUE_ID <<< "$FIRST_PROJECT"
    echo "Testing project details for ISO: $ISO_ID, Queue: $QUEUE_ID"
    curl -s "${API_URL}/api/projects/project-details?isoId=${ISO_ID}&queueId=${QUEUE_ID}" | jq '{IsoID, QueueID, ProjectName, GenerationType, CapacityMW}'
else
    echo "❌ Could not get sample project for testing"
fi

echo ""
echo "✅ API testing complete!"
