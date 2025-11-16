#!/bin/bash

# PowerNOVA Docker Management Script
# Manage Redis and other services for development

REDIS_CONTAINER="powernova-redis"

show_help() {
    echo "PowerNOVA Docker Management"
    echo "=========================="
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start Redis container"
    echo "  stop      Stop Redis container"
    echo "  restart   Restart Redis container"
    echo "  status    Show container status"
    echo "  logs      Show Redis logs"
    echo "  clean     Remove Redis container and volumes"
    echo "  reset     Clean and recreate Redis container"
    echo "  help      Show this help message"
    echo ""
}

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
}

start_redis() {
    echo "🐳 Starting Redis container..."
    check_docker
    
    if docker ps | grep -q "$REDIS_CONTAINER"; then
        echo "✅ Redis container is already running"
        return 0
    fi
    
    if docker ps -a | grep -q "$REDIS_CONTAINER"; then
        echo "🔄 Starting existing Redis container..."
        docker start $REDIS_CONTAINER
    else
        echo "🆕 Creating new Redis container..."
        docker-compose up -d redis
    fi
    
    # Wait for Redis to be ready
    echo "⏳ Waiting for Redis to be ready..."
    for i in {1..30}; do
        if docker exec $REDIS_CONTAINER redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis is ready!"
            return 0
        fi
        sleep 1
    done
    
    echo "❌ Redis failed to start"
    return 1
}

stop_redis() {
    echo "🛑 Stopping Redis container..."
    check_docker
    
    if docker ps | grep -q "$REDIS_CONTAINER"; then
        docker stop $REDIS_CONTAINER
        echo "✅ Redis container stopped"
    else
        echo "ℹ️  Redis container is not running"
    fi
}

restart_redis() {
    echo "🔄 Restarting Redis container..."
    stop_redis
    sleep 2
    start_redis
}

show_status() {
    echo "📊 Container Status:"
    echo "==================="
    
    check_docker
    
    if docker ps | grep -q "$REDIS_CONTAINER"; then
        echo "✅ Redis: Running"
        echo ""
        echo "Container Details:"
        docker ps --filter "name=$REDIS_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    elif docker ps -a | grep -q "$REDIS_CONTAINER"; then
        echo "🛑 Redis: Stopped"
    else
        echo "❌ Redis: Not created"
    fi
    
    echo ""
    echo "Redis Connection Test:"
    if docker exec $REDIS_CONTAINER redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is accessible"
    else
        echo "❌ Redis is not accessible"
    fi
}

show_logs() {
    echo "📋 Redis Logs:"
    echo "=============="
    check_docker
    
    if docker ps -a | grep -q "$REDIS_CONTAINER"; then
        docker logs -f $REDIS_CONTAINER
    else
        echo "❌ Redis container does not exist"
    fi
}

clean_redis() {
    echo "🧹 Cleaning Redis container and data..."
    check_docker
    
    # Stop and remove container
    if docker ps -a | grep -q "$REDIS_CONTAINER"; then
        docker stop $REDIS_CONTAINER 2>/dev/null
        docker rm $REDIS_CONTAINER
        echo "✅ Redis container removed"
    fi
    
    # Remove volume
    if docker volume ls | grep -q "powernova_redis_data"; then
        docker volume rm powernova_redis_data
        echo "✅ Redis data volume removed"
    fi
    
    echo "✅ Cleanup complete"
}

reset_redis() {
    echo "🔄 Resetting Redis..."
    clean_redis
    sleep 2
    start_redis
}

# Main script logic
case "${1:-help}" in
    start)
        start_redis
        ;;
    stop)
        stop_redis
        ;;
    restart)
        restart_redis
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_redis
        ;;
    reset)
        reset_redis
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
