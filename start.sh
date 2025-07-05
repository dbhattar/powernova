#!/bin/bash

# PowerNOVA Quick Start Script
echo "🚀 PowerNOVA Quick Start"
echo "======================="

# Check if setup has been run
if [ ! -f "backend/.env" ]; then
    echo "⚠️  First time setup required"
    echo "Running setup script..."
    chmod +x setup.sh
    ./setup.sh
else
    echo "✅ Setup already complete"
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ] || [ ! -d "app/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install:all
fi

# Start the application
echo "🎉 Starting PowerNOVA..."
echo "Backend will run on: http://localhost:3001"
echo "Frontend will run on: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

npm run dev
