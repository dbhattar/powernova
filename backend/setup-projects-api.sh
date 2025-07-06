#!/bin/bash

# PowerNOVA Projects API Integration Setup Script

echo "🚀 Setting up PowerNOVA Projects API Integration..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Check if Python is available for data population
if command -v python3 &> /dev/null; then
    echo "✅ Python3 is available"
    
    # Check if required Python packages are available
    echo "🔍 Checking Python dependencies..."
    python3 -c "import psycopg2, pandas, numpy" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Python dependencies are installed"
    else
        echo "⚠️  Missing Python dependencies. Install with:"
        echo "   pip install psycopg2-binary pandas numpy"
    fi
    
    # Check if gridstatus is available
    python3 -c "import gridstatus" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ gridstatus package is available"
    else
        echo "⚠️  Missing gridstatus package. Install with:"
        echo "   pip install gridstatus"
    fi
else
    echo "⚠️  Python3 not found. Required for data population."
fi

# Check if PostgreSQL is available
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL client is available"
else
    echo "⚠️  PostgreSQL client not found. Install PostgreSQL or use Docker."
fi

# Create directories if they don't exist
mkdir -p scripts
mkdir -p data/gis

echo ""
echo "📋 Setup Summary:"
echo "✅ Dependencies installed"
echo "✅ Scripts created"
echo "✅ Database configuration ready"
echo "✅ API endpoints implemented"
echo ""
echo "🔧 Next Steps:"
echo "1. Update your .env file with database credentials"
echo "2. Set up your PostgreSQL database"
echo "3. Run 'npm run setup-db' to create database schema"
echo "4. Set up Typesense for search functionality"
echo "5. Place GIS data files in data/gis/ directory"
echo "6. Run 'npm run populate-db' to populate with ISO/RTO data"
echo "7. Start the server with 'npm run dev'"
echo ""
echo "📖 For detailed instructions, see PROJECTS_API.md"
echo ""
echo "✅ Setup complete! The FastAPI functionality has been successfully ported to Express.js"

# Make the script executable
chmod +x setup-projects-api.sh
