# ACI Deployment Template

## Overview

Template for deploying PowerNOVA worker architecture to Azure Container Instances.

## File: `aci-deployment.yaml`

Multi-container group template with 3 containers:
- **API Container**: FastAPI server (WORKER_MODE=api)
- **Crawler Worker**: Background web crawler
- **Document Worker**: Embedding and chunking processor

## Parameters

Template uses `{{PARAMETER_NAME}}` placeholders replaced during deployment:

### Infrastructure
- `{{LOCATION}}` - Azure region (e.g., `eastus`)
- `{{CONTAINER_GROUP}}` - Container group name
- `{{ENVIRONMENT}}` - Environment (`prod`, `test`)
- `{{DNS_LABEL}}` - Public DNS label

### Container Registry
- `{{ACR_NAME}}` - Azure Container Registry name
- `{{ACR_USERNAME}}` - ACR username (from credentials)
- `{{ACR_PASSWORD}}` - ACR password (from credentials)
- `{{IMAGE_TAG}}` - Docker image tag (e.g., `latest`)

### Application Secrets
- `{{DATABASE_URL}}` - PostgreSQL connection string
- `{{AZURE_STORAGE_CONNECTION_STRING}}` - Blob storage connection
- `{{AZURE_STORAGE_CONTAINER_NAME}}` - Blob container name
- `{{OPENAI_API_KEY}}` - OpenAI API key
- `{{ADMIN_USERNAME}}` - Admin username
- `{{ADMIN_PASSWORD}}` - Admin password
- `{{JWT_SECRET}}` - JWT signing secret
- `{{JWT_ALGORITHM}}` - JWT algorithm (e.g., `HS256`)
- `{{JWT_EXPIRATION_MINUTES}}` - JWT expiration (e.g., `1440`)

## Container Resources

| Container | CPU | Memory | Port |
|-----------|-----|--------|------|
| API | 1.0 core | 2.0 GB | 8000 |
| Crawler Worker | 0.5 core | 1.0 GB | - |
| Doc Worker | 0.5 core | 1.0 GB | - |

**Total**: 2.0 CPU cores, 4.0 GB memory

## Usage

### Automated (Recommended)

```bash
# Deploy to test
./scripts/deploy-workers-azure-aci.sh --test

# Deploy to production
./scripts/deploy-workers-azure-aci.sh
```

### Manual

```bash
# Generate deployment YAML
sed -e "s|{{LOCATION}}|eastus|g" \
    -e "s|{{CONTAINER_GROUP}}|powernova-workers-test|g" \
    # ... all other parameters
    templates/aci-deployment.yaml > deployment.yaml

# Deploy
az container create --resource-group powernova --file deployment.yaml
```

## Customization

### Change Resources

Edit template:
```yaml
resources:
  requests:
    cpu: 2.0          # Increase CPU
    memoryInGb: 4.0   # Increase memory
```

### Adjust Poll Intervals

Edit environment variables:
```yaml
- name: POLL_INTERVAL
  value: '60'  # Crawler polls every 60s

- name: DOC_PROCESSOR_POLL_INTERVAL
  value: '20'  # Doc worker polls every 20s
```

### Add Environment Variables

```yaml
- name: NEW_VAR
  value: '{{NEW_VAR_PARAM}}'
```

Then update deployment script to replace `{{NEW_VAR_PARAM}}`.

## Security

- Template contains only placeholders (safe to commit)
- Deployment script generates YAML in `/tmp` and deletes after use
- Secrets use `secureValue` (not logged by Azure)

## Networking

- **Public IP**: Yes, with DNS label
- **Exposed Ports**: 8000 (API only)
- **URLs**:
  - Test: `http://powernova-workers-test.eastus.azurecontainer.io:8000`
  - Prod: `http://powernova-workers-prod.eastus.azurecontainer.io:8000`

## Monitoring

```bash
# Container status
az container show -g powernova -n powernova-workers-prod

# View logs
az container logs -g powernova -n powernova-workers-prod --container-name api
az container logs -g powernova -n powernova-workers-prod --container-name crawler-worker
az container logs -g powernova -n powernova-workers-prod --container-name doc-worker

# Follow logs
az container logs -g powernova -n powernova-workers-prod --container-name api --follow
```

## Related Files

- **Deployment Script**: `scripts/deploy-workers-azure-aci.sh`
- **Validation Script**: `scripts/validate-aci-deployment.sh`
- **Documentation**: `docs/WORKER-ARCHITECTURE.md`
