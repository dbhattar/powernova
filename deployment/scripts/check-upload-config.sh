#!/bin/bash

# Quick check script for VPS upload configuration
echo "🔍 PowerNOVA VPS Upload Configuration Check"
echo "=========================================="

echo ""
echo "📁 NGINX Configuration:"
echo "----------------------"
if [ -f /etc/nginx/sites-available/powernova ]; then
    echo "✅ PowerNOVA site config found"
    
    if grep -q "client_max_body_size" /etc/nginx/sites-available/powernova; then
        echo "✅ Upload limit configured:"
        grep "client_max_body_size" /etc/nginx/sites-available/powernova
    else
        echo "❌ No upload limit found - this is likely the issue!"
        echo "💡 Add this to your server block:"
        echo "   client_max_body_size 100M;"
    fi
else
    echo "❌ PowerNOVA config not found"
fi

echo ""
echo "🔧 Backend Status:"
echo "-----------------"
if systemctl is-active --quiet powernova-backend; then
    echo "✅ Backend service is running"
else
    echo "❌ Backend service is not running"
fi

echo ""
echo "🌐 NGINX Status:"
echo "---------------"
if systemctl is-active --quiet nginx; then
    echo "✅ NGINX is running"
else
    echo "❌ NGINX is not running"
fi

echo ""
echo "🧪 Quick Tests:"
echo "--------------"
echo "Test NGINX config: sudo nginx -t"
echo "Reload NGINX: sudo systemctl reload nginx"
echo "View logs: sudo tail -f /var/log/nginx/error.log"
