#!/bin/bash

# Build React Native Web App Script

set -e

echo "📱 Building React Native Web App..."

# Check if app directory exists
if [ ! -d "app" ]; then
    echo "❌ App directory not found"
    exit 1
fi

cd app

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing app dependencies..."
    npm install
fi


# Build for web using npx for compatibility
echo "🔨 Building React Native app for web..."
npx expo export --platform web

# Move build output to expected location
if [ -d "dist" ]; then
    rm -rf web-build
    mv dist web-build
elif [ ! -d "web-build" ]; then
    echo "❌ Build failed - no output directory found"
    exit 1
fi

echo "✅ React Native web app built successfully"
echo "📁 Build output: $(pwd)/web-build"

cd ..

# Copy to deployment location if running in production
if [ "$NODE_ENV" = "production" ] || [ "$1" = "deploy" ]; then
    echo "🚀 Deploying to production location..."
    sudo mkdir -p /opt/powernova/app-build
    sudo cp -r app/web-build/* /opt/powernova/app-build/
    sudo chown -R www-data:www-data /opt/powernova/app-build
    echo "✅ App deployed to /opt/powernova/app-build"
fi
