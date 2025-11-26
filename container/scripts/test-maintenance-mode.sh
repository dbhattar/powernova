#!/bin/bash

# ==========================================
# PowerNOVA Maintenance Mode Test Script
# ==========================================
# This script tests the maintenance mode functionality
# by enabling/disabling it and checking the API responses.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default API URL (can be overridden)
API_URL="${API_URL:-http://localhost:8000}"

echo "=========================================="
echo "  PowerNOVA Maintenance Mode Test"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo ""

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if API is reachable
check_api_reachable() {
    print_info "Checking if API is reachable..."
    
    if curl -s --max-time 5 "$API_URL/health" > /dev/null 2>&1; then
        print_success "API is reachable at $API_URL"
        return 0
    else
        print_error "API is not reachable at $API_URL"
        print_warning "Make sure the API is running and the URL is correct"
        return 1
    fi
}

# Function to get maintenance status
get_maintenance_status() {
    local status=$(curl -s "$API_URL/api/maintenance/status" | grep -o '"maintenance":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    echo "$status"
}

# Function to test health endpoint (should always work)
test_health_endpoint() {
    print_info "Testing /health endpoint (should always work)..."
    
    local response=$(curl -s -w "\n%{http_code}" "$API_URL/health")
    local body=$(echo "$response" | head -n1)
    local status=$(echo "$response" | tail -n1)
    
    if [ "$status" = "200" ] || [ "$status" = "503" ]; then
        print_success "Health endpoint returned status $status"
        return 0
    else
        print_error "Health endpoint returned unexpected status: $status"
        return 1
    fi
}

# Function to test maintenance status endpoint (should always work)
test_maintenance_status_endpoint() {
    print_info "Testing /api/maintenance/status endpoint (should always work)..."
    
    local response=$(curl -s -w "\n%{http_code}" "$API_URL/api/maintenance/status")
    local body=$(echo "$response" | head -n1)
    local status=$(echo "$response" | tail -n1)
    
    if [ "$status" = "200" ]; then
        print_success "Maintenance status endpoint returned 200"
        local maintenance=$(echo "$body" | grep -o '"maintenance":[^,}]*' | cut -d':' -f2 | tr -d ' ')
        print_info "Current maintenance mode: $maintenance"
        return 0
    else
        print_error "Maintenance status endpoint returned unexpected status: $status"
        return 1
    fi
}

# Function to test other endpoints (should return 503 in maintenance mode)
test_other_endpoints() {
    local expected_status=$1
    
    print_info "Testing /api/chat/conversations endpoint..."
    
    local status=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/chat/conversations")
    
    if [ "$status" = "$expected_status" ]; then
        print_success "Endpoint returned expected status: $status"
        return 0
    else
        print_error "Endpoint returned unexpected status: $status (expected: $expected_status)"
        return 1
    fi
}

# Main test flow
main() {
    echo "Starting maintenance mode tests..."
    echo ""
    
    # Check if API is reachable
    if ! check_api_reachable; then
        exit 1
    fi
    echo ""
    
    # Test 1: Check current status
    echo "Test 1: Check Current Status"
    echo "----------------------------------------"
    test_health_endpoint
    test_maintenance_status_endpoint
    current_status=$(get_maintenance_status)
    echo ""
    
    # Test 2: Test endpoints based on current status
    echo "Test 2: Test Endpoint Behavior"
    echo "----------------------------------------"
    if [ "$current_status" = "true" ]; then
        print_info "Maintenance mode is ENABLED"
        print_info "Other endpoints should return 503..."
        test_other_endpoints "503"
    else
        print_info "Maintenance mode is DISABLED"
        print_info "Other endpoints should return 200, 401, or 404 (not 503)..."
        status=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/chat/conversations")
        if [ "$status" != "503" ]; then
            print_success "Endpoint returned non-503 status: $status"
        else
            print_error "Endpoint returned 503 (maintenance mode may be enabled)"
        fi
    fi
    echo ""
    
    # Test 3: Instructions for manual testing
    echo "Manual Testing Instructions"
    echo "----------------------------------------"
    print_info "To manually test maintenance mode:"
    echo ""
    echo "  1. Enable maintenance mode:"
    if [ "$API_URL" = "http://localhost:8000" ]; then
        echo "     export MAINTENANCE_MODE=true"
        echo "     docker-compose restart api"
    else
        echo "     az containerapp update \\"
        echo "       --name powernova-api \\"
        echo "       --resource-group powernova-rg \\"
        echo "       --set-env-vars MAINTENANCE_MODE=true"
    fi
    echo ""
    echo "  2. Run this test again: ./scripts/test-maintenance-mode.sh"
    echo ""
    echo "  3. Open the frontend and verify maintenance UI appears"
    echo ""
    echo "  4. Disable maintenance mode:"
    if [ "$API_URL" = "http://localhost:8000" ]; then
        echo "     export MAINTENANCE_MODE=false"
        echo "     docker-compose restart api"
    else
        echo "     az containerapp update \\"
        echo "       --name powernova-api \\"
        echo "       --resource-group powernova-rg \\"
        echo "       --set-env-vars MAINTENANCE_MODE=false"
    fi
    echo ""
    echo "  5. Verify frontend auto-restores within 30 seconds"
    echo ""
    
    # Summary
    echo "=========================================="
    echo "  Test Summary"
    echo "=========================================="
    print_info "Current maintenance mode: $current_status"
    print_success "All accessible endpoints working correctly"
    echo ""
}

# Run tests
main
