#!/bin/bash

##############################################################################
# URL Encoding Test Script
# 
# This script tests the URL encoding function with various password patterns
##############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# URL encode function (same as in migration scripts)
url_encode() {
    local string="$1"
    local encoded=""
    local pos c o
    
    for ((pos=0; pos<${#string}; pos++)); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9])
                encoded+="$c"
                ;;
            *)
                printf -v o '%%%02X' "'$c"
                encoded+="$o"
                ;;
        esac
    done
    echo "$encoded"
}

echo -e "${BLUE}URL Encoding Test Suite${NC}\n"

# Test cases as separate arrays to avoid special character issues
test_passwords=(
    "SimplePass123"
    "MyP@ss/word#123"
    "user@domain.com"
    "pass:with:colons"
    "query?string"
    "hash#tag"
    "space in pass"
    "percent%sign"
    "plus+sign"
    "equal=sign"
    "ampersand&sign"
    "iivAPQsflo/4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o="
)

test_expected=(
    "SimplePass123"
    "MyP%40ss%2Fword%23123"
    "user%40domain.com"
    "pass%3Awith%3Acolons"
    "query%3Fstring"
    "hash%23tag"
    "space%20in%20pass"
    "percent%25sign"
    "plus%2Bsign"
    "equal%3Dsign"
    "ampersand%26sign"
    "iivAPQsflo%2F4aexvDh9IW8rSwhASbzxBOxeC3SVGn2o%3D"
)

passed=0
failed=0

for i in "${!test_passwords[@]}"; do
    password="${test_passwords[$i]}"
    expected="${test_expected[$i]}"
    result=$(url_encode "$password")
    
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} Pass: '$password'"
        echo -e "  → $result"
        ((passed++))
    else
        echo -e "${RED}✗${NC} Fail: '$password'"
        echo -e "  Expected: $expected"
        echo -e "  Got:      $result"
        ((failed++))
    fi
done

echo ""
echo "Results: $passed passed, $failed failed"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
