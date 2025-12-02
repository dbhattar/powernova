#!/bin/bash
# Quick script to check vector index status in production

echo "🔍 Checking Vector Index Status in Production..."
echo "================================================"
echo ""

# Get container name from Azure
CONTAINER_NAME="powernova-api"  # Update if different
RESOURCE_GROUP="powernova-rg"    # Update if different

echo "Connecting to production database..."
echo ""

# Execute the check script
az container exec \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_NAME" \
  --exec-command "python /app/scripts/create_vector_index.py --check --progress --stats"

echo ""
echo "================================================"
echo "✅ Check complete!"
echo ""
echo "Next steps:"
echo "  - If index doesn't exist: Run 'python scripts/create_vector_index.py --create' in container"
echo "  - If index is being created: Wait for completion (check logs for progress)"
echo "  - If index exists: You're all set! Similarity search should be fast now"
