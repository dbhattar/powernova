#!/bin/bash

# PowerNOVA Status Check Script

echo "📊 PowerNOVA Service Status"
echo "=========================="

# Check backend service
echo "🔧 Backend Service:"
if sudo systemctl is-active --quiet powernova-backend; then
    echo "✅ Running"
    echo "   Port: 3001"
    echo "   PID: $(sudo systemctl show -p MainPID powernova-backend | cut -d= -f2)"
else
    echo "❌ Not running"
fi

echo ""

# Check Docker containers
echo "🐳 Docker Containers:"
docker-compose ps

echo ""

# Check NGINX
echo "🌐 NGINX:"
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

echo ""

# Check ports
echo "🔌 Port Status:"
echo "Backend (3001): $(ss -tulpn | grep :3001 | wc -l) connections"
echo "Redis (6379): $(ss -tulpn | grep :6379 | wc -l) connections"
echo "Typesense (8108): $(ss -tulpn | grep :8108 | wc -l) connections"
echo "HTTP (80): $(ss -tulpn | grep :80 | wc -l) connections"
echo "HTTPS (443): $(ss -tulpn | grep :443 | wc -l) connections"

echo ""

# Check disk usage
echo "💾 Disk Usage:"
df -h /opt/powernova | tail -1

echo ""

# Check memory usage
echo "🧠 Memory Usage:"
free -h | grep Mem

echo ""

# Recent logs (last 5 lines)
echo "📋 Recent Backend Logs:"
sudo journalctl -u powernova-backend --no-pager -n 5 --output cat 2>/dev/null || echo "No logs available"
