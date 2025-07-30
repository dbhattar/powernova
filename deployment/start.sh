#!/bin/bash

# PowerNOVA Start Script

set -e

echo "🚀 Starting PowerNOVA services..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start Docker containers (Redis and Typesense)
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for containers to be ready
echo "⏳ Waiting for containers to be ready..."
sleep 10

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Docker containers failed to start"
    docker-compose logs
    exit 1
fi

# Install backend dependencies if node_modules doesn't exist
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Copy systemd service file
echo "🔧 Setting up systemd service..."
sudo cp systemd/powernova-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable powernova-backend

# Start backend service
echo "🚀 Starting backend service..."
sudo systemctl start powernova-backend

# Wait a moment for backend to start
sleep 5

# Check backend status
if sudo systemctl is-active --quiet powernova-backend; then
    echo "✅ Backend service started successfully"
else
    echo "❌ Backend service failed to start"
    sudo journalctl -u powernova-backend --no-pager -n 20
    exit 1
fi

# Setup website
echo "🌐 Setting up website..."
sudo mkdir -p /opt/powernova/website
sudo cp -r website/* /opt/powernova/website/
sudo chown -R www-data:www-data /opt/powernova/website

# Build and setup React Native app
echo "📱 Building and setting up React Native app..."
if [ ! -d "app/node_modules" ]; then
    echo "📦 Installing app dependencies..."
    cd app
    npm install
    cd ..
fi

echo "🔨 Building React Native web app..."
./scripts/build-app.sh deploy

echo "✅ PowerNOVA services started successfully!"
echo ""
echo "Services running:"
echo "- Backend API: http://localhost:3001"
echo "- Redis: localhost:6379"
echo "- Typesense: http://localhost:8108"
echo ""
echo "Next steps:"
echo "1. Configure NGINX: sudo ./configure-nginx.sh powernova.ai"
echo "2. Check status: ./scripts/status.sh"
echo "3. View logs: ./scripts/logs.sh"
echo ""
echo "Apps will be available at:"
echo "- Landing page: https://powernova.ai"
echo "- Main app: https://app.powernova.ai"
