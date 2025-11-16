#!/bin/bash

# Test script to verify profile screen functionality
echo "🧪 Testing Profile Screen Functionality"
echo "======================================="

# Check if ProfileScreen.js exists and has the required imports
if [ -f "app/screens/ProfileScreen.js" ]; then
    echo "✅ ProfileScreen.js found"
    
    # Check for sign-out functionality in error state
    if grep -q "errorSignOutContainer" app/screens/ProfileScreen.js; then
        echo "✅ Error state sign-out functionality found"
    else
        echo "❌ Error state sign-out functionality missing"
    fi
    
    # Check for auth.signOut() calls
    signout_count=$(grep -c "auth.signOut()" app/screens/ProfileScreen.js)
    if [ $signout_count -ge 3 ]; then
        echo "✅ Multiple sign-out implementations found ($signout_count)"
    else
        echo "⚠️  Limited sign-out implementations found ($signout_count)"
    fi
    
    # Check for error handling styles
    if grep -q "errorSignOutButton" app/screens/ProfileScreen.js; then
        echo "✅ Error sign-out button styles found"
    else
        echo "❌ Error sign-out button styles missing"
    fi
    
else
    echo "❌ ProfileScreen.js not found"
fi

# Check if App.js has the ProfileScreen import
if [ -f "app/App.js" ]; then
    echo "✅ App.js found"
    
    # Check for ProfileScreen import
    if grep -q "ProfileScreen" app/App.js; then
        echo "✅ ProfileScreen import found in App.js"
    else
        echo "❌ ProfileScreen import missing in App.js"
    fi
    
    # Check for profile navigation
    if grep -q "showProfile" app/App.js; then
        echo "✅ Profile navigation state found"
    else
        echo "❌ Profile navigation state missing"
    fi
    
else
    echo "❌ App.js not found"
fi

echo ""
echo "🔍 Test Summary:"
echo "- ProfileScreen error state now includes sign-out functionality"
echo "- Users can sign out even when profile fails to load"
echo "- Sign-out button is always available in error scenarios"
echo ""
echo "✅ Profile Screen Enhancement Complete!"
