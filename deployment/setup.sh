#!/bin/bash

# PowerNOVA VPS Setup Script
# This script sets up a Ubuntu 22.04 VPS for PowerNOVA deployment

set -e

echo "🚀 PowerNOVA VPS Setup Starting..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y \
    curl \
    wget \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    htop \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
echo "🐳 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Add current user to docker group
echo "👤 Adding user to docker group..."
usermod -aG docker $SUDO_USER || usermod -aG docker $(whoami)

# Install PM2 globally
echo "🔧 Installing PM2..."
npm install -g pm2

# Create powernova user (if running as root)
if [ "$EUID" -eq 0 ]; then
    echo "👤 Creating powernova user..."
    useradd -m -s /bin/bash powernova || echo "User powernova already exists"
    usermod -aG docker powernova
    usermod -aG sudo powernova
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/powernova
mkdir -p /var/log/powernova
mkdir -p /var/lib/powernova

# Set permissions
chown -R powernova:powernova /opt/powernova /var/log/powernova /var/lib/powernova 2>/dev/null || true

# Configure firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

# Configure NGINX
echo "🌐 Configuring NGINX..."
systemctl enable nginx
systemctl start nginx

# Enable services
echo "🔧 Enabling services..."
systemctl enable docker
systemctl start docker

echo "✅ VPS setup completed!"
echo ""
echo "Next steps:"
echo "1. Copy your deployment files to /opt/powernova/"
echo "2. Configure environment variables in .env"
echo "3. Run ./start.sh to start services"
echo "4. Configure domain with ./configure-nginx.sh"
echo ""
echo "Important: Logout and login again for docker group changes to take effect"
