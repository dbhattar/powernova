#!/bin/bash

# Backup Script for PowerNOVA

set -e

BACKUP_DIR="/opt/powernova/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Creating PowerNOVA backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found"
    exit 1
fi

# Backup Docker volumes
echo "🐳 Backing up Docker volumes..."
docker run --rm -v powernova_typesense_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/typesense_data_$DATE.tar.gz -C /data .
docker run --rm -v powernova_redis_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis_data_$DATE.tar.gz -C /data .

# Backup configuration files
echo "📁 Backing up configuration..."
tar czf $BACKUP_DIR/config_$DATE.tar.gz .env nginx/ systemd/

# Backup application logs
echo "📋 Backing up logs..."
if [ -d "/var/log/powernova" ]; then
    tar czf $BACKUP_DIR/logs_$DATE.tar.gz -C /var/log powernova/
fi

# Note about database backup
echo "📝 Note: Database backup should be done via Supabase dashboard"
echo "   or using pg_dump with your Supabase connection string"

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR"
echo "📁 Backup files:"
ls -la $BACKUP_DIR/*$DATE*
