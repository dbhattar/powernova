# Workers-Only ACI Deployment

## Architecture Decision

We've simplified the deployment to **workers-only** on Azure Container Instances:

### Current Architecture

```
┌─────────────────────────────────────┐
│   Azure App Service (Existing)      │
│   ┌─────────────────────────────┐   │
│   │      API Server             │   │
│   │  - User requests            │   │
│   │  - Admin interface          │   │
│   │  - FastAPI/Uvicorn          │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 │
                 │ Database Connection
                 ▼
┌─────────────────────────────────────┐
│   Azure PostgreSQL                  │
│   - Crawl jobs                      │
│   - Document jobs                   │
│   - User data                       │
└─────────────────────────────────────┘
                 ▲
                 │ Database Connection
                 │
┌─────────────────────────────────────┐
│   Azure Container Instances (NEW)   │
│   ┌──────────────┬──────────────┐   │
│   │ Crawler      │ Doc Worker   │   │
│   │ Worker       │              │   │
│   │              │              │   │
│   │ - Polls DB   │ - Polls DB   │   │
│   │ - Crawls     │ - Processes  │   │
│   │   sites      │   documents  │   │
│   │ - Updates    │ - Generates  │   │
│   │   jobs       │   embeddings │   │
│   └──────────────┴──────────────┘   │
└─────────────────────────────────────┘
```

## Benefits

1. **Simplicity**: API stays on proven App Service infrastructure
2. **Zero Downtime**: No changes to existing API deployment
3. **Cost Effective**: Only pay for worker compute when needed
4. **Clean Separation**: Workers in ACI, API in App Service
5. **Easy Rollback**: Can delete ACI deployment without affecting API
6. **No Network Complexity**: No need for public IP on workers

## What Changed

### Removed from ACI
- ❌ API container (stays on App Service)
- ❌ Public IP address
- ❌ DNS label
- ❌ Port 8000 exposure
- ❌ Admin credentials (not needed by workers)
- ❌ JWT settings (not needed by workers)

### Kept in ACI
- ✅ Crawler worker container
- ✅ Doc worker container
- ✅ Database connection
- ✅ Azure Storage connection
- ✅ OpenAI API key (for embeddings)

## ARM Template Changes

**File**: `templates/aci-deployment.json`

### Removed Parameters
```json
// Removed:
- dnsLabel
- adminUsername
- adminPassword
- jwtSecret
- jwtAlgorithm
- jwtExpirationMinutes
```

### Removed Resources
```json
// Removed:
- API container definition
- ipAddress.type: "Public"
- ipAddress.dnsNameLabel
- ipAddress.ports[8000]
```

### Simplified Output
```json
// Before: Included fqdn and ipAddress
// After: Only containerGroupName
"outputs": {
  "containerGroupName": {
    "type": "string",
    "value": "[parameters('containerGroupName')]"
  }
}
```

## Deployment Script Changes

**File**: `scripts/deploy-workers-azure-aci.sh`

### Removed Variables
```bash
# Removed:
DNS_LABEL="..."
ADMIN_USERNAME="..."
ADMIN_PASSWORD="..."
JWT_SECRET="..."
JWT_ALGORITHM="..."
JWT_EXPIRATION_MINUTES="..."
```

### Simplified Output
```bash
# Before: Showed FQDN, IP, health endpoint
# After: Shows container statuses only

Container Statuses:
Name            State     StartTime
--------------  --------  ----------------------
crawler-worker  Running   2025-12-01T...
doc-worker      Running   2025-12-01T...
```

## Environment Variables per Container

### Crawler Worker
```bash
WORKER_ID=crawler-worker-aci-{environment}
POLL_INTERVAL=30
DATABASE_URL={secure}
AZURE_STORAGE_CONNECTION_STRING={secure}
AZURE_STORAGE_CONTAINER_NAME={value}
LOG_LEVEL=INFO
```

### Doc Worker
```bash
WORKER_ID=doc-worker-aci-{environment}
DOC_PROCESSOR_POLL_INTERVAL=10
DOC_PROCESSOR_BATCH_SIZE=10
DATABASE_URL={secure}
AZURE_STORAGE_CONNECTION_STRING={secure}
AZURE_STORAGE_CONTAINER_NAME={value}
OPENAI_API_KEY={secure}
LOG_LEVEL=INFO
```

## Deployment

### Deploy to Test
```bash
./scripts/deploy-workers-azure-aci.sh --test
```

This creates:
- Container Group: `powernova-workers-test`
- 2 containers: `crawler-worker`, `doc-worker`
- No public IP (workers don't need external access)

### Deploy to Production
```bash
./scripts/deploy-workers-azure-aci.sh
```

This creates:
- Container Group: `powernova-workers-prod`
- 2 containers: `crawler-worker`, `doc-worker`
- No public IP

## Monitoring

### View Container Status
```bash
az container show -g powernova -n powernova-workers-test
```

### View Logs
```bash
# Crawler worker
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker

# Doc worker
az container logs -g powernova -n powernova-workers-test --container-name doc-worker
```

### Stream Logs
```bash
# Crawler worker
az container logs -g powernova -n powernova-workers-test --container-name crawler-worker --follow

# Doc worker
az container logs -g powernova -n powernova-workers-test --container-name doc-worker --follow
```

## Cleanup

### Delete Test Deployment
```bash
az container delete -g powernova -n powernova-workers-test --yes
```

### Delete Production Deployment
```bash
az container delete -g powernova -n powernova-workers-prod --yes
```

**Note**: Deleting workers does NOT affect your API on App Service.

## Resource Allocation

### Crawler Worker
- CPU: 0.5 cores
- Memory: 1.0 GB
- Restart Policy: Always

### Doc Worker
- CPU: 0.5 cores
- Memory: 1.0 GB
- Restart Policy: Always

**Total ACI Resources**: 1.0 CPU cores, 2.0 GB RAM

## Cost Estimate

Azure Container Instances pricing (approximate):
- CPU: ~$0.0000012 per vCPU-second
- Memory: ~$0.0000001333 per GB-second

Monthly cost (running 24/7):
- 1.0 CPU × 2,592,000 seconds × $0.0000012 = ~$3.11
- 2.0 GB × 2,592,000 seconds × $0.0000001333 = ~$0.69
- **Total: ~$3.80/month** (plus minimal egress)

Compare to App Service worker roles which would cost $50-100/month minimum.

## Migration Path

If you later want to move the API to ACI:

1. Keep this worker deployment running
2. Create new ACI deployment for API
3. Test API in ACI
4. Update DNS to point to ACI API
5. Delete App Service when confident

This architecture gives you flexibility without commitment.

## Troubleshooting

### Workers Not Processing Jobs

1. **Check container status**:
   ```bash
   az container show -g powernova -n powernova-workers-test \
     --query "containers[].{name:name, state:instanceView.currentState.state}" -o table
   ```

2. **Check logs for errors**:
   ```bash
   az container logs -g powernova -n powernova-workers-test --container-name crawler-worker --tail 50
   ```

3. **Verify database connection**:
   - Check if DATABASE_URL is correct
   - Verify PostgreSQL allows connections from ACI IP

4. **Check if jobs exist in database**:
   - Connect to PostgreSQL
   - Run: `SELECT * FROM crawl_jobs WHERE status = 'PENDING' LIMIT 10;`

### High Resource Usage

Monitor resource usage:
```bash
az monitor metrics list \
  --resource "/subscriptions/{subscription-id}/resourceGroups/powernova/providers/Microsoft.ContainerInstance/containerGroups/powernova-workers-test" \
  --metric "CpuUsage" \
  --start-time 2025-12-01T00:00:00Z \
  --end-time 2025-12-01T23:59:59Z
```

If needed, update resource limits in `templates/aci-deployment.json`.

## Related Documentation
- `docs/WORKER-ARCHITECTURE.md` - Original worker design
- `docs/SEPARATE-ACR-REPOSITORY.md` - ACR repository structure
- `docs/ACR-FIX.md` - ACR configuration fix
- `docs/SINGLE-IMAGE-ARCHITECTURE.md` - Single image pattern

## Date
December 1, 2025
