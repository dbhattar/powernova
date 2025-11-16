#!/bin/bash

# PowerNOVA Docker Helper Script
# This script provides easy commands for building, running, and managing the containerized website

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

IMAGE_NAME="powernova-website"
CONTAINER_NAME="powernova-web"
PORT="8080"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header() {
    echo -e "${BLUE}==================================${NC}"
    echo -e "${BLUE}  PowerNOVA Docker Manager${NC}"
    echo -e "${BLUE}==================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Build the Docker image
build() {
    print_header
    echo "Building Docker image..."
    docker build -f "$PROJECT_ROOT/docker/Dockerfile" -t $IMAGE_NAME "$PROJECT_ROOT"
    print_success "Image built successfully!"
}

# Run the container
run() {
    print_header
    
    # Check if container is already running
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        print_error "Container is already running!"
        print_info "Use './docker-helper.sh stop' to stop it first, or './docker-helper.sh restart'"
        exit 1
    fi
    
    echo "Starting container..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:80 \
        --restart unless-stopped \
        $IMAGE_NAME
    
    print_success "Container started successfully!"
    print_info "Website available at: http://localhost:$PORT"
}

# Stop the container
stop() {
    print_header
    echo "Stopping container..."
    
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        print_success "Container stopped and removed!"
    else
        print_info "Container is not running"
    fi
}

# Restart the container
restart() {
    print_header
    echo "Restarting container..."
    stop
    sleep 2
    run
}

# View logs
logs() {
    print_header
    echo "Showing container logs (Ctrl+C to exit)..."
    docker logs -f $CONTAINER_NAME
}

# Check container status
status() {
    print_header
    
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        print_success "Container is RUNNING"
        echo ""
        docker ps -f name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        print_info "Website: http://localhost:$PORT"
        print_info "Health check: http://localhost:$PORT/health"
    else
        print_info "Container is NOT running"
    fi
}

# Clean up (remove container and image)
clean() {
    print_header
    echo "Cleaning up Docker resources..."
    
    # Stop and remove container
    if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
        docker rm -f $CONTAINER_NAME 2>/dev/null || true
        print_success "Container removed"
    fi
    
    # Remove image
    if [ "$(docker images -q $IMAGE_NAME)" ]; then
        docker rmi $IMAGE_NAME
        print_success "Image removed"
    fi
    
    print_success "Cleanup complete!"
}

# Shell access to running container
shell() {
    print_header
    
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        print_info "Opening shell in container..."
        docker exec -it $CONTAINER_NAME /bin/sh
    else
        print_error "Container is not running!"
        print_info "Use './docker-helper.sh run' to start it first"
        exit 1
    fi
}

# Test the deployment
test() {
    print_header
    
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "Running tests..."
        echo ""
        
        # Test main page
        print_info "Testing main page..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200"; then
            print_success "Main page: OK"
        else
            print_error "Main page: FAILED"
        fi
        
        # Test health endpoint
        print_info "Testing health endpoint..."
        if curl -s http://localhost:$PORT/health | grep -q "healthy"; then
            print_success "Health check: OK"
        else
            print_error "Health check: FAILED"
        fi
        
        # Test static assets
        print_info "Testing CSS..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/css/styles.css | grep -q "200"; then
            print_success "CSS: OK"
        else
            print_error "CSS: FAILED"
        fi
        
        print_info "Testing JavaScript..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/js/script.js | grep -q "200"; then
            print_success "JavaScript: OK"
        else
            print_error "JavaScript: FAILED"
        fi
        
        echo ""
        print_success "All tests completed!"
    else
        print_error "Container is not running!"
        print_info "Use './docker-helper.sh run' to start it first"
        exit 1
    fi
}

# Show help
help() {
    print_header
    echo ""
    echo "Usage: ./docker-helper.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build      - Build the Docker image"
    echo "  run        - Run the container"
    echo "  stop       - Stop and remove the container"
    echo "  restart    - Restart the container"
    echo "  logs       - View container logs (live)"
    echo "  status     - Check container status"
    echo "  shell      - Open shell in running container"
    echo "  test       - Run basic tests on the deployment"
    echo "  clean      - Remove container and image"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./docker-helper.sh build && ./docker-helper.sh run"
    echo "  ./docker-helper.sh status"
    echo "  ./docker-helper.sh logs"
    echo ""
}

# Main command handler
case "$1" in
    build)
        build
        ;;
    run)
        run
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    shell)
        shell
        ;;
    test)
        test
        ;;
    clean)
        clean
        ;;
    help|--help|-h|"")
        help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        help
        exit 1
        ;;
esac
