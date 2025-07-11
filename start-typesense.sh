#!/bin/bash

# PowerNOVA Typesense Start Script
# This script starts Typesense with the correct environment variables

export TYPESENSE_API_KEY=powernova-api-key

echo "🚀 Starting Typesense with API key: $TYPESENSE_API_KEY"

cd "$(dirname "$0")"

docker-compose up typesense -d

echo "✅ Typesense started successfully"
echo "💡 You can now run: npm run typesense:setup to initialize the collection"
