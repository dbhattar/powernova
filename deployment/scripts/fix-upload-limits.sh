#!/bin/bash

# Script to update NGINX configuration for large file uploads
# Run this on your VPS

echo "🔧 Updating NGINX configuration for large file uploads..."

# Backup current config
sudo cp /etc/nginx/sites-available/powernova /etc/nginx/sites-available/powernova.backup.$(date +%Y%m%d_%H%M%S)

# Check if client_max_body_size is already set
if grep -q "client_max_body_size" /etc/nginx/sites-available/powernova; then
    echo "⚠️  client_max_body_size already configured. Please check manually."
    cat /etc/nginx/sites-available/powernova | grep -A 5 -B 5 "client_max_body_size"
else
    echo "📝 Adding client_max_body_size to NGINX config..."
    
    # Add client_max_body_size after the server { line
    sudo sed -i '/server {/a \    # Allow large file uploads\n    client_max_body_size 100M;\n    client_body_timeout 300s;\n    client_header_timeout 300s;' /etc/nginx/sites-available/powernova
fi

# Test NGINX configuration
echo "🧪 Testing NGINX configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ NGINX configuration is valid. Reloading..."
    sudo systemctl reload nginx
    echo "🎉 NGINX updated successfully!"
    echo ""
    echo "📋 Current upload limits:"
    echo "   - NGINX: 100MB"
    echo "   - Backend: 100MB"
    echo ""
    echo "🔗 Try uploading a file now at: https://app.powernova.ai"
else
    echo "❌ NGINX configuration test failed. Please fix manually."
    echo "💡 You can restore backup with:"
    echo "   sudo cp /etc/nginx/sites-available/powernova.backup.* /etc/nginx/sites-available/powernova"
fi
