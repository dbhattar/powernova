#!/bin/bash

# Test script for PowerNOVA User Profile System
# This script will verify that the backend API endpoints are working

echo "🧪 PowerNOVA User Profile System Test"
echo "====================================="

BACKEND_URL="http://localhost:3002"

echo "🔍 Testing backend connectivity..."

# Test health endpoint (no auth required)
echo -n "Health check: "
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health")
if [ "$response" = "200" ]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend not responding (HTTP $response)"
    echo "Make sure the backend server is running on port 3002"
    exit 1
fi

echo ""
echo "🔧 Manual Testing Steps:"
echo "========================"
echo ""
echo "1. Start the backend server:"
echo "   cd backend && npm start"
echo ""
echo "2. Start the React Native app:"
echo "   cd app && npm start"
echo ""
echo "3. Sign in with Google/Firebase"
echo ""
echo "4. Test Profile Features:"
echo "   • Tap on your name in the header → Profile screen should open"
echo "   • In sidebar, tap on your user info → Profile screen should open"
echo "   • Try updating your display name"
echo "   • Try changing notification settings"
echo "   • Try changing theme settings"
echo "   • Try changing voice speed"
echo ""
echo "5. Check Database (optional):"
echo "   • Connect to your PostgreSQL database"
echo "   • Check 'users' table for your user record"
echo "   • Check 'user_settings' table for your settings"
echo ""
echo "📋 Expected Behavior:"
echo "• Profile screen opens when tapping user name"
echo "• Settings save instantly when changed"
echo "• Profile updates reflect immediately"
echo "• No console errors in app or backend"
echo ""
echo "🔍 Debugging Tips:"
echo "• Check browser/app console for errors"
echo "• Check backend logs for API errors"
echo "• Verify Firebase authentication is working"
echo "• Ensure database migration was run successfully"
echo ""
echo "✅ Test script completed. Happy testing!"
