#!/bin/bash

# PowerNOVA Restart Script

echo "🔄 Restarting PowerNOVA services..."

# Stop services
./stop.sh

# Wait a moment
sleep 3

# Start services
./start.sh

echo "✅ PowerNOVA services restarted"
