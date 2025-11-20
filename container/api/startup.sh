#!/bin/sh
set -e

echo "=========================================="
echo "PowerNOVA API - Startup Script"
echo "=========================================="

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
timeout=30
counter=0

until python -c "from database.session import check_db_connection; exit(0 if check_db_connection() else 1)" 2>/dev/null; do
  counter=$((counter + 1))
  if [ $counter -gt $timeout ]; then
    echo "❌ Database connection timeout after ${timeout} seconds"
    echo "⚠️  Starting API anyway (migrations may fail)"
    break
  fi
  echo "⏳ Waiting for database... (${counter}/${timeout})"
  sleep 1
done

if [ $counter -le $timeout ]; then
  echo "✅ Database is ready!"
  
  # Run database migrations
  echo ""
  echo "🔄 Running database migrations..."
  if alembic upgrade head; then
    echo "✅ Migrations completed successfully"
  else
    echo "⚠️  Migration failed, but continuing startup..."
    echo "    You may need to run migrations manually"
  fi
else
  echo "⚠️  Skipping migrations due to database connection timeout"
fi

echo ""
echo "=========================================="
echo "🚀 Starting FastAPI application..."
echo "=========================================="
echo ""

# Start the application
exec "$@"
