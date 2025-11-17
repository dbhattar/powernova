# Deploying PostgreSQL with API to Azure App Service

## ⚠️ IMPORTANT: Multi-Container Limitations

Azure App Service **does support** multi-container deployments, **BUT** there are critical limitations for PostgreSQL:

### 🔴 Critical Issues with PostgreSQL in App Service

1. **Ephemeral Storage** - Container volumes are **NOT persistent**
   - Data is **LOST** on app restart
   - Data is **LOST** on redeployment
   - Data is **LOST** on scaling operations

2. **No Horizontal Scaling** - Can't scale to multiple instances with a database sidecar

3. **Performance** - Not optimized for database workloads

4. **No Automated Backups** - You lose Azure's backup features

5. **Single Point of Failure** - If app crashes, database is unavailable

## ✅ RECOMMENDED: Use Azure Database for PostgreSQL

### Option 1: Azure Database for PostgreSQL (BEST)

**Pros:**
- ✅ Persistent storage
- ✅ Automated backups (point-in-time restore)
- ✅ High availability options
- ✅ Automatic scaling
- ✅ SSL connections
- ✅ Performance optimization
- ✅ Security features
- ✅ Can scale API independently

**Cost:** ~$15-30/month for basic tier

**Setup:**

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group powernova \
  --name powernova-db \
  --location westus2 \
  --admin-user powernova \
  --admin-password <strong-password> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --tags Environment=Production

# Configure firewall for Azure services
az postgres flexible-server firewall-rule create \
  --resource-group powernova \
  --name powernova-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group powernova \
  --server-name powernova-db \
  --database-name powernova_db

# Update App Service with connection string
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings DATABASE_URL="postgresql://powernova:<password>@powernova-db.postgres.database.azure.com:5432/powernova_db?sslmode=require"
```

### Option 2: Multi-Container App Service (NOT RECOMMENDED for Production)

**Only use this for:**
- ⚠️ Development/testing
- ⚠️ Proof of concept
- ⚠️ Non-critical data

**Setup:**

1. **Build and push images to ACR:**
```bash
# Build API image
docker build -f docker/Dockerfile.api -t powernovaacr.azurecr.io/powernova-api:latest ./api

# Push to ACR
docker push powernovaacr.azurecr.io/powernova-api:latest
```

2. **Create multi-container app:**
```bash
# Create App Service with multi-container support
az webapp create \
  --resource-group powernova \
  --plan powernova-api-plan \
  --name powernovaapi-multicontainer \
  --multicontainer-config-type compose \
  --multicontainer-config-file docker/docker-compose.azure.yml

# Set container registry credentials
az webapp config container set \
  --resource-group powernova \
  --name powernovaapi-multicontainer \
  --docker-registry-server-url https://powernovaacr.azurecr.io \
  --docker-registry-server-user <acr-username> \
  --docker-registry-server-password <acr-password>

# Set environment variables
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi-multicontainer \
  --settings \
    OPENAI_API_KEY="<your-key>" \
    POSTGRES_PASSWORD="<strong-password>" \
    ENVIRONMENT="production"
```

### Option 3: Azure Container Instances (Alternative)

Deploy both containers to Azure Container Instances with persistent volumes:

```bash
# Create file share for PostgreSQL data
az storage account create \
  --resource-group powernova \
  --name powernovastorage \
  --location westus2 \
  --sku Standard_LRS

az storage share create \
  --name postgres-data \
  --account-name powernovastorage

# Deploy with docker-compose (ACI)
docker context create aci powernovaaci --resource-group powernova
docker context use powernovaaci
docker compose -f docker-compose.api.prod.yml up
```

## 📊 Comparison Table

| Feature | Multi-Container App Service | Azure PostgreSQL | Container Instances |
|---------|----------------------------|------------------|---------------------|
| **Data Persistence** | ❌ Ephemeral | ✅ Persistent | ✅ With file share |
| **Automated Backups** | ❌ No | ✅ Yes | ❌ Manual only |
| **Scaling** | ❌ No (with DB) | ✅ Independent | ⚠️ Limited |
| **High Availability** | ❌ No | ✅ Yes | ❌ No |
| **Cost (monthly)** | ~$15 | ~$15-30 | ~$30-50 |
| **Complexity** | Low | Low | Medium |
| **Production Ready** | ❌ No | ✅ Yes | ⚠️ For some cases |

## 🎯 My Recommendation

### For Production: Azure Database for PostgreSQL

**Why:**
1. Your data is critical - don't risk losing it
2. Need backups and point-in-time restore
3. Better performance and security
4. Can scale API independently
5. Professional database management

**Steps:**
1. Create Azure PostgreSQL Flexible Server
2. Deploy API container to App Service (single container)
3. Connect API to managed PostgreSQL via connection string

### For Development/Testing: Multi-Container Locally

Use `docker-compose.api.yml` for local development:

```bash
# Local development
cd docker
docker-compose -f docker-compose.api.yml up -d
```

## 📝 Complete Setup Script (Recommended Approach)

I'll create a script that sets up Azure PostgreSQL + API:

```bash
#!/bin/bash
# Deploy API with Azure Database for PostgreSQL (RECOMMENDED)

RESOURCE_GROUP="powernova"
LOCATION="westus2"
DB_SERVER_NAME="powernova-db-$(date +%s)"
DB_ADMIN_USER="powernova"
DB_ADMIN_PASSWORD="<GENERATE_STRONG_PASSWORD>"
DB_NAME="powernova_db"
APP_NAME="powernovaapi"

# 1. Create PostgreSQL Flexible Server
echo "Creating PostgreSQL Flexible Server..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0

# 2. Allow Azure services to access database
echo "Configuring firewall..."
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 3. Create database
echo "Creating database..."
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME

# 4. Update App Service with database URL
echo "Updating App Service configuration..."
DB_CONNECTION_STRING="postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings DATABASE_URL="$DB_CONNECTION_STRING"

# 5. Restart app to apply changes
echo "Restarting App Service..."
az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME

echo "✅ Setup complete!"
echo ""
echo "Database Details:"
echo "  Server: $DB_SERVER_NAME.postgres.database.azure.com"
echo "  Database: $DB_NAME"
echo "  Username: $DB_ADMIN_USER"
echo ""
echo "Connection String:"
echo "  $DB_CONNECTION_STRING"
```

## 🚀 Quick Decision Guide

**Choose Azure PostgreSQL if:**
- ✅ Production environment
- ✅ Data is important
- ✅ Need backups
- ✅ Want to scale API independently
- ✅ Have budget (~$15-30/month)

**Choose Multi-Container App Service if:**
- ⚠️ Development/testing only
- ⚠️ Throwaway data
- ⚠️ Proof of concept
- ⚠️ Very tight budget

**Choose Container Instances if:**
- ⚠️ Need both containers together
- ⚠️ Don't want managed database
- ⚠️ Can handle manual backups
- ⚠️ Low traffic application

## 📚 Files Created

- `docker/docker-compose.azure.yml` - Multi-container config (with warnings)
- This guide - Explains all options

## 🎉 Next Steps

I recommend:
1. Create Azure Database for PostgreSQL
2. Keep API on App Service (single container)
3. Use existing deployment script with DATABASE_URL

Would you like me to create a script that sets up Azure PostgreSQL for you?
