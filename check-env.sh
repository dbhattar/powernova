#!/bin/bash

# PowerNOVA Environment Checker
echo "🔍 PowerNOVA Environment Check"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_item() {
    if [ $2 -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

warn_item() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check Node.js
node --version > /dev/null 2>&1
check_item "Node.js installed" $?

# Check npm
npm --version > /dev/null 2>&1
check_item "npm installed" $?

# Check Expo CLI
expo --version > /dev/null 2>&1
check_item "Expo CLI installed" $?

# Check backend dependencies
if [ -d "backend/node_modules" ]; then
    check_item "Backend dependencies installed" 0
else
    check_item "Backend dependencies installed" 1
fi

# Check frontend dependencies
if [ -d "app/node_modules" ]; then
    check_item "Frontend dependencies installed" 0
else
    check_item "Frontend dependencies installed" 1
fi

# Check backend .env
if [ -f "backend/.env" ]; then
    check_item "Backend .env file exists" 0
    
    # Check for required variables
    if grep -q "OPENAI_API_KEY=" backend/.env && ! grep -q "OPENAI_API_KEY=sk-your-openai-api-key-here" backend/.env; then
        check_item "OpenAI API key configured" 0
    else
        warn_item "OpenAI API key needs to be configured in backend/.env"
    fi
    
    if grep -q "PINECONE_API_KEY=" backend/.env && ! grep -q "PINECONE_API_KEY=your-pinecone-api-key" backend/.env; then
        check_item "Pinecone API key configured" 0
    else
        warn_item "Pinecone API key needs to be configured in backend/.env"
    fi
    
    if grep -q "FIREBASE_PROJECT_ID=" backend/.env && ! grep -q "FIREBASE_PROJECT_ID=your-firebase-project-id" backend/.env; then
        check_item "Firebase configuration present" 0
    else
        warn_item "Firebase configuration needs to be updated in backend/.env"
    fi
else
    check_item "Backend .env file exists" 1
fi

# Check frontend firebase config
if [ -f "app/firebase.js" ]; then
    check_item "Frontend Firebase config exists" 0
    
    if grep -q "your-api-key" app/firebase.js; then
        warn_item "Firebase config needs to be updated in app/firebase.js"
    else
        check_item "Firebase config appears to be customized" 0
    fi
else
    check_item "Frontend Firebase config exists" 1
fi

echo ""
echo "🎯 Next Steps:"
echo "1. If any items are missing, run: ./setup.sh"
echo "2. Configure your API keys in backend/.env"
echo "3. Update Firebase config in app/firebase.js"
echo "4. Start development with: ./start.sh"
