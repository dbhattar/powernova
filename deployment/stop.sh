#!/bin/bash

# PowerNOVA Stop Script

echo "🛑 Stopping PowerNOVA services..."

# Stop backend service
echo "🛑 Stopping backend service..."
sudo systemctl stop powernova-backend

# Stop Docker containers
echo "🐳 Stopping Docker containers..."
docker-compose down

echo "✅ All PowerNOVA services stopped"
