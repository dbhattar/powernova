#!/bin/bash

echo "🚀 Starting PowerNOVA with Job Queue System..."

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to start Redis container
start_redis() {
    echo "🐳 Checking Docker and Redis container..."
    
    # Check if Docker is running
    check_docker
    
    # Check if Redis container exists and is running
    if docker ps | grep -q "powernova-redis"; then
        echo "✅ Redis container is already running"
        return 0
    fi
    
    # Check if Redis container exists but is stopped
    if docker ps -a | grep -q "powernova-redis"; then
        echo "🔄 Starting existing Redis container..."
        docker start powernova-redis
    else
        echo "🆕 Creating and starting Redis container..."
        docker-compose up -d redis
    fi
    
    # Wait for Redis to be ready
    echo "⏳ Waiting for Redis to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec powernova-redis redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis is ready!"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts - waiting for Redis..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "❌ Redis failed to start after $max_attempts attempts"
    return 1
}

# Start Redis container
if ! start_redis; then
    echo "❌ Failed to start Redis. Exiting..."
    exit 1
fi

# Alternative: Check if Redis is running locally (fallback)
if ! docker exec powernova-redis redis-cli ping > /dev/null 2>&1; then
    echo "🔄 Trying local Redis connection..."
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Neither Docker Redis nor local Redis is available"
        echo "💡 Options:"
        echo "   1. Make sure Docker is running: docker info"
        echo "   2. Start Redis with Docker: docker-compose up -d redis"
        echo "   3. Install local Redis: brew install redis && brew services start redis"
        exit 1
    else
        echo "✅ Using local Redis instance"
    fi
fi

# Check if PostgreSQL/Supabase is accessible (optional check)
echo "🔗 Checking database connection..."
if [ ! -z "$POWERNOVA_HOST" ]; then
    echo "✅ Database configuration found"
else
    echo "⚠️  Database configuration not found in environment"
fi

# Start backend with job queue
echo "🔄 Starting backend with vectorization worker..."
cd backend
npm run dev
