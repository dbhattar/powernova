#!/bin/bash

# Firebase Service Account Setup Script
echo "🔧 Setting up Firebase Service Account for PowerNOVA Backend..."

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ This script must be run from the PowerNOVA root directory"
    exit 1
fi

# Check if service account file exists
if [ -f "backend/firebase-service-account.json" ]; then
    echo "✅ Service account file found!"
    
    # Validate the JSON file
    if node -e "JSON.parse(require('fs').readFileSync('backend/firebase-service-account.json', 'utf8'))" 2>/dev/null; then
        echo "✅ Service account file is valid JSON"
        
        # Extract project info
        PROJECT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('backend/firebase-service-account.json', 'utf8')).project_id)")
        CLIENT_EMAIL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('backend/firebase-service-account.json', 'utf8')).client_email)")
        
        echo "📋 Service Account Details:"
        echo "   Project ID: $PROJECT_ID"
        echo "   Client Email: $CLIENT_EMAIL"
        
        # Test Firebase initialization
        echo "🧪 Testing Firebase connection..."
        cd backend
        node -e "
        try {
          require('./src/config/firebase');
          console.log('✅ Firebase Admin SDK initialized successfully!');
        } catch (error) {
          console.error('❌ Firebase initialization failed:', error.message);
          process.exit(1);
        }
        "
        
        if [ $? -eq 0 ]; then
            echo "🎉 Firebase service account setup complete!"
            echo ""
            echo "📝 Next steps:"
            echo "   1. Start your backend: npm run dev"
            echo "   2. The backend will automatically use the service account file"
            echo "   3. No need to set FIREBASE_* environment variables"
        fi
        
    else
        echo "❌ Service account file is invalid JSON"
        exit 1
    fi
    
else
    echo "⚠️  Service account file not found!"
    echo ""
    echo "📋 To set up Firebase service account:"
    echo "   1. Go to https://console.firebase.google.com/"
    echo "   2. Select your project"
    echo "   3. Go to Project Settings → Service Accounts"
    echo "   4. Click 'Generate new private key'"
    echo "   5. Save the downloaded file as: backend/firebase-service-account.json"
    echo ""
    echo "🔄 Alternative: Use environment variables in backend/.env:"
    echo "   FIREBASE_PROJECT_ID=your-project-id"
    echo "   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
    echo "   FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\""
    
    # Check if environment variables are set
    if [ -f "backend/.env" ]; then
        cd backend
        if grep -q "FIREBASE_PROJECT_ID=" .env && grep -q "FIREBASE_CLIENT_EMAIL=" .env && grep -q "FIREBASE_PRIVATE_KEY=" .env; then
            echo ""
            echo "✅ Found Firebase environment variables in backend/.env"
            echo "🧪 Testing Firebase connection with environment variables..."
            
            node -e "
            require('dotenv').config();
            try {
              require('./src/config/firebase');
              console.log('✅ Firebase Admin SDK initialized with environment variables!');
            } catch (error) {
              console.error('❌ Firebase initialization failed:', error.message);
              process.exit(1);
            }
            "
            
            if [ $? -eq 0 ]; then
                echo "🎉 Firebase environment variables setup is working!"
                echo "💡 Consider downloading the service account file for easier management"
            fi
        else
            echo ""
            echo "❌ Firebase environment variables not found in backend/.env"
        fi
    fi
fi
