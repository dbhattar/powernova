# Azure ARM Templates

This directory contains Azure Resource Manager (ARM) templates for deploying PowerNOVA infrastructure.

## PostgreSQL Flexible Server Deployment

### Files

- **azure-postgresql-deployment.json** - Main ARM template for PostgreSQL Flexible Server
- **azure-postgresql-deployment.parameters.json** - Parameters file with default values
- **deploy-postgresql.sh** - Helper script for deployment

### Quick Start

1. **Edit parameters file:**
   ```bash
   nano azure-postgresql-deployment.parameters.json
   ```
   
   Update the following:
   - `administratorLoginPassword` - Use a strong password
   - `allowedClientIP` - Your IP address (run `curl ifconfig.me` to get it)
   - `location` - Azure region (e.g., "westus2", "eastus")

2. **Deploy using Azure CLI:**
   ```bash
   # Login to Azure
   az login

   # Set your subscription (if you have multiple)
   az account set --subscription "YOUR_SUBSCRIPTION_NAME"

   # Create resource group (if it doesn't exist)
   az group create --name powernova --location westus2

   # Deploy the template
   az deployment group create \
     --resource-group powernova \
     --template-file azure-postgresql-deployment.json \
     --parameters azure-postgresql-deployment.parameters.json
   ```

3. **Get connection string:**
   ```bash
   # After deployment completes, get the outputs
   az deployment group show \
     --resource-group powernova \
     --name azure-postgresql-deployment \
     --query properties.outputs
   ```

### Template Parameters

| Parameter | Default | Description | Cost Impact |
|-----------|---------|-------------|-------------|
| **serverName** | powernova-db-server | Must be globally unique | - |
| **administratorLogin** | powernova_admin | Admin username | - |
| **administratorLoginPassword** | - | **REQUIRED** - Min 8 chars | - |
| **databaseName** | powernova_db | Database name | - |
| **location** | Resource group location | Azure region | Varies by region |
| **skuName** | Standard_B2s | Server size | **~$30-40/month** |
| **postgresVersion** | 15 | PostgreSQL version (13-16) | - |
| **storageSizeGB** | 32 | Storage size (32-16384) | ~$4.80/month per 32GB |
| **backupRetentionDays** | 7 | Backup retention (7-35) | Minimal |
| **geoRedundantBackup** | Disabled | Geographic backup redundancy | **+100% backup cost** |
| **highAvailability** | Disabled | Zone-redundant HA | **+100% compute cost** |
| **allowAzureServices** | true | Allow Azure service access | - |
| **allowedClientIP** | "" | Your IP for management | - |

### SKU Options & Pricing (Approximate)

**Burstable (Development/Small Workloads):**
- `Standard_B1ms` - 1 vCore, 2 GB RAM - ~$15/month
- `Standard_B2s` - 2 vCores, 4 GB RAM - **~$30/month** (recommended for start)

**General Purpose (Production):**
- `Standard_D2s_v3` - 2 vCores, 8 GB RAM - ~$150/month
- `Standard_D4s_v3` - 4 vCores, 16 GB RAM - ~$300/month

*Note: Prices are estimates and vary by region. Check [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for exact costs.*

### Template Features

✅ **Included:**
- PostgreSQL Flexible Server (latest stable)
- Database creation with UTF8 encoding
- Firewall rules (Azure services + your IP)
- Optimized configurations (max_connections, shared_buffers)
- Automated backups (7 day retention)
- SSL/TLS encryption enforced

❌ **Not Included (requires manual setup):**
- pgvector extension installation
- Database migrations (use Alembic)
- Virtual Network integration
- Private endpoints
- Advanced monitoring/alerts

### Post-Deployment Steps

1. **Install pgvector extension:**
   ```bash
   # Connect to the database
   psql "postgresql://powernova_admin@<SERVER_FQDN>:5432/powernova_db?sslmode=require"
   
   # Install extension
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Update DATABASE_URL environment variable:**
   ```bash
   # Format for Azure Container Apps
   postgresql://powernova_admin:<PASSWORD>@<SERVER_FQDN>:5432/powernova_db?sslmode=require
   ```

3. **Update firewall rules (if needed):**
   ```bash
   # Add additional IP addresses
   az postgres flexible-server firewall-rule create \
     --resource-group powernova \
     --name powernova-db-server \
     --rule-name "AllowDevMachine" \
     --start-ip-address "YOUR_IP" \
     --end-ip-address "YOUR_IP"
   ```

4. **Run database migrations:**
   ```bash
   # From your API directory
   cd api
   alembic upgrade head
   ```

### Monitoring & Management

**View server metrics:**
```bash
az postgres flexible-server show \
  --resource-group powernova \
  --name powernova-db-server
```

**View server logs:**
```bash
az postgres flexible-server logs list \
  --resource-group powernova \
  --name powernova-db-server
```

**Scale up/down:**
```bash
# Change SKU
az postgres flexible-server update \
  --resource-group powernova \
  --name powernova-db-server \
  --sku-name Standard_D2s_v3

# Increase storage
az postgres flexible-server update \
  --resource-group powernova \
  --name powernova-db-server \
  --storage-size 64
```

### Clean Up

**Delete the PostgreSQL server:**
```bash
az postgres flexible-server delete \
  --resource-group powernova \
  --name powernova-db-server \
  --yes
```

**Delete entire resource group (CAUTION):**
```bash
az group delete --name powernova --yes
```

### Troubleshooting

**Connection refused:**
- Check firewall rules: `az postgres flexible-server firewall-rule list`
- Verify your IP hasn't changed: `curl ifconfig.me`
- Ensure SSL mode is set: `?sslmode=require`

**Authentication failed:**
- Username format: `powernova_admin` (no @servername suffix for Flexible Server)
- Password complexity: Must include uppercase, lowercase, numbers

**Extension not found:**
- pgvector must be installed manually (see post-deployment steps)
- Connect as admin user to install extensions

**Performance issues:**
- Monitor connections: Check Azure Portal metrics
- Scale up if needed: Use larger SKU
- Review slow query logs

### Security Best Practices

1. **Use Azure Key Vault for secrets:**
   - Store `administratorLoginPassword` in Key Vault
   - Reference from Container Apps using managed identity

2. **Enable Private Endpoint (Production):**
   - Restricts access to Azure Virtual Network
   - Eliminates public internet exposure

3. **Regular backups:**
   - Automated daily backups (included)
   - Test restore process periodically

4. **Monitor access:**
   - Enable diagnostic logs
   - Set up alerts for failed login attempts

### Migration from Supabase

See [SUPABASE-TO-AZURE-MIGRATION-PLAN.md](../docs/SUPABASE-TO-AZURE-MIGRATION-PLAN.md) for detailed migration instructions.

**Quick migration:**
```bash
# 1. Deploy this template
# 2. Install pgvector extension
# 3. Dump Supabase data
pg_dump $SUPABASE_URL > backup.sql

# 4. Restore to Azure
psql $AZURE_DATABASE_URL < backup.sql

# 5. Update environment variables
# 6. Restart application
```

### Support

For issues or questions:
- Check [PostgreSQL Flexible Server Docs](https://learn.microsoft.com/azure/postgresql/flexible-server/)
- Review [Azure CLI Reference](https://learn.microsoft.com/cli/azure/postgres/flexible-server)
- See project docs in `/docs` directory
