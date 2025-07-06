#!/bin/bash

# PowerNOVA FastAPI Backend Setup and Start Script

echo "🚀 Setting up PowerNOVA FastAPI Backend..."

# Check if Python 3.8+ is available
python_version=$(python3 --version 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1,2)
if [[ ! $python_version =~ ^3\.[8-9]|^3\.[1-9][0-9] ]]; then
    echo "❌ Python 3.8+ is required. Current version: $python_version"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual configuration!"
fi

# Create uploads directory
mkdir -p uploads

# Run database migrations (if using Alembic)
# echo "🗄️  Running database migrations..."
# alembic upgrade head

echo "✅ Setup complete!"
echo ""
echo "🏃 Starting FastAPI server..."
echo "📍 API Documentation will be available at: http://localhost:8001/docs"
echo "📍 Health check: http://localhost:8001/health"
echo ""

# Start the server
python main.py
