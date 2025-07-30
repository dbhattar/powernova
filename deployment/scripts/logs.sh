#!/bin/bash

# PowerNOVA Logs Viewer Script

echo "📋 PowerNOVA Service Logs"
echo "========================"

# Function to show logs
show_logs() {
    local service=$1
    local lines=${2:-50}
    
    echo ""
    echo "--- $service Logs (last $lines lines) ---"
    
    case $service in
        "backend")
            sudo journalctl -u powernova-backend --no-pager -n $lines
            ;;
        "docker")
            docker-compose logs --tail=$lines
            ;;
        "nginx")
            echo "Access logs:"
            sudo tail -n $lines /var/log/nginx/powernova_access.log 2>/dev/null || echo "No access logs found"
            echo ""
            echo "Error logs:"
            sudo tail -n $lines /var/log/nginx/powernova_error.log 2>/dev/null || echo "No error logs found"
            ;;
        "system")
            sudo journalctl --no-pager -n $lines
            ;;
    esac
}

# Parse command line arguments
SERVICE=${1:-all}
LINES=${2:-50}

case $SERVICE in
    "backend")
        show_logs "backend" $LINES
        ;;
    "docker")
        show_logs "docker" $LINES
        ;;
    "nginx")
        show_logs "nginx" $LINES
        ;;
    "system")
        show_logs "system" $LINES
        ;;
    "all")
        show_logs "backend" $LINES
        show_logs "docker" $LINES
        show_logs "nginx" $LINES
        ;;
    "follow")
        echo "Following backend logs (Ctrl+C to stop):"
        sudo journalctl -u powernova-backend -f
        ;;
    *)
        echo "Usage: $0 [service] [lines]"
        echo ""
        echo "Services:"
        echo "  backend  - Backend service logs"
        echo "  docker   - Docker container logs"
        echo "  nginx    - NGINX logs"
        echo "  system   - System logs"
        echo "  all      - All service logs (default)"
        echo "  follow   - Follow backend logs in real-time"
        echo ""
        echo "Examples:"
        echo "  $0                    # Show all logs (50 lines each)"
        echo "  $0 backend           # Show backend logs (50 lines)"
        echo "  $0 backend 100       # Show backend logs (100 lines)"
        echo "  $0 follow            # Follow backend logs in real-time"
        ;;
esac
