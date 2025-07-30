#!/bin/bash

# NGINX and SSL Configuration Script
# Usage: ./configure-nginx.sh powernova.ai

if [ $# -eq 0 ]; then
    echo "Usage: $0 <domain-name>"
    echo "Example: $0 powernova.ai"
    exit 1
fi

DOMAIN=$1

echo "🌐 Configuring NGINX for domain: $DOMAIN"

# Replace domain placeholder in NGINX configs
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/powernova.conf > /tmp/powernova.conf
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/app.powernova.conf > /tmp/app.powernova.conf

# Copy NGINX configurations
sudo cp /tmp/powernova.conf /etc/nginx/sites-available/powernova
sudo cp /tmp/app.powernova.conf /etc/nginx/sites-available/app.powernova
sudo ln -sf /etc/nginx/sites-available/powernova /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/app.powernova /etc/nginx/sites-enabled/

# Remove default NGINX site
sudo rm -f /etc/nginx/sites-enabled/default

# Test NGINX configuration
echo "🔧 Testing NGINX configuration..."
sudo nginx -t

if [ $? -ne 0 ]; then
    echo "❌ NGINX configuration test failed"
    exit 1
fi

# Reload NGINX
echo "🔄 Reloading NGINX..."
sudo systemctl reload nginx

# Obtain SSL certificate with Certbot
echo "🔒 Obtaining SSL certificate for $DOMAIN and app.$DOMAIN..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d app.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully"
    echo "✅ NGINX configured with HTTPS for $DOMAIN and app.$DOMAIN"
    echo ""
    echo "Your sites should now be accessible at:"
    echo "Landing page: https://$DOMAIN"
    echo "Landing page: https://www.$DOMAIN"
    echo "Main app: https://app.$DOMAIN"
else
    echo "⚠️  SSL certificate generation failed, but HTTP is still available"
    echo "Your sites are accessible at:"
    echo "Landing page: http://$DOMAIN"
    echo "Main app: http://app.$DOMAIN"
    echo ""
    echo "To retry SSL later: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d app.$DOMAIN"
fi

# Clean up
rm -f /tmp/powernova.conf /tmp/app.powernova.conf

echo "✅ NGINX configuration completed"
