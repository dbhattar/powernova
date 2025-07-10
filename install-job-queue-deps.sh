#!/bin/bash

echo "🔧 Installing job queue dependencies..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install ioredis socket.io uuid
echo "✅ Backend dependencies installed"

# Install frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd ../app
npm install socket.io-client
echo "✅ Frontend dependencies installed"

echo "🎉 All dependencies installed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure Redis is running: redis-server"
echo "2. Update your .env file with REDIS_URL if needed"
echo "3. Run database migration: psql -f backend/database_schema.sql"
echo "4. Start backend: cd backend && npm run dev"
echo "5. Start frontend: cd app && npm start"
