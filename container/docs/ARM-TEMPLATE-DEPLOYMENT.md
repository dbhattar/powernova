# ARM Template Deployment - Implementation Summary

## Overview

Converted the ACI deployment to use native Azure Resource Manager (ARM) templates instead of sed-based YAML generation. This provides better integration with Azure's deployment infrastructure.

## Architecture

**Previous Approach:**
```
Script → Generate YAML via sed → az container create --file
```

**New Approach:**
```
ARM Template (JSON) + Parameters (JSON) → az deployment group create
```

## Files Created

### 1. ARM Template
**File**: `templates/aci-deployment.json`

- Standard Azure ARM template format
- Defines all infrastructure resources
- Uses ARM template parameters (not placeholders)
- Includes proper schema and output sections
- Type-safe with parameter validation

### 2. Parameters Schema
**File**: `templates/aci-deployment.parameters.json`

- Template for parameter values
- Documents all required parameters
- Can be used for manual deployments
- Provides defaults where appropriate

### 3. Updated Deployment Script
**File**: `scripts/deploy-workers-azure-aci.sh`

- Generates parameters JSON dynamically
- Uses `az deployment group create` instead of `az container create`
- Gets outputs from deployment (FQDN, IP)
- Cleaner, more maintainable code

## Template Structure

### Parameters Section

All parameters defined with proper types and metadata:

```json
{
  "parameters": {
    "databaseUrl": {
      "type": "securestring",  // ← Secure parameters hidden in logs
      "metadata": {
        "description": "PostgreSQL connection string"
      }
    },
    "imageTag": {
      "type": "string",
      "defaultValue": "latest",  // ← Default values supported
      "metadata": {
        "description": "Docker image tag"
      }
    }
  }
}
```

### Resources Section

Standard ARM resource definition:

```json
{
  "resources": [
    {
      "type": "Microsoft.ContainerInstance/containerGroups",
      "apiVersion": "2021-09-01",
      "name": "[parameters('containerGroupName')]",
      "properties": {
        "containers": [ /* ... */ ]
      }
    }
  ]
}
```

### Outputs Section

Deployment outputs for easy access:

```json
{
  "outputs": {
    "fqdn": {
      "type": "string",
      "value": "[reference(...).ipAddress.fqdn]"
    },
    "ipAddress": {
      "type": "string",
      "value": "[reference(...).ipAddress.ip]"
    }
  }
}
```

## Benefits

### ✅ Azure Native

- Uses standard ARM template format
- Compatible with Azure Portal
- Works with Azure DevOps
- Integrates with Azure Resource Manager

### ✅ Better Validation

- Schema validation before deployment
- Type checking for parameters
- Proper error messages
- Parameter constraints supported

### ✅ Deployment History

- Tracked in Azure deployments
- Can view deployment details in portal
- Outputs stored in deployment
- Easier troubleshooting

### ✅ Reusability

- Can import template to Azure Portal
- Use with other deployment tools
- CI/CD friendly
- Infrastructure as Code best practices

### ✅ Maintainability

- No sed/string replacement
- JSON syntax validation
- IDE autocomplete support
- Clear parameter types

## Usage

### Automated Deployment (No Changes)

```bash
# Deploy to test
./scripts/deploy-workers-azure-aci.sh --test

# Deploy to production
./scripts/deploy-workers-azure-aci.sh
```

### Manual Deployment

1. **Edit parameters file:**
```bash
cp templates/aci-deployment.parameters.json my-params.json
# Edit my-params.json with your values
```

2. **Deploy:**
```bash
az deployment group create \
  --resource-group powernova \
  --name my-deployment \
  --template-file templates/aci-deployment.json \
  --parameters @my-params.json
```

3. **Get outputs:**
```bash
az deployment group show \
  --resource-group powernova \
  --name my-deployment \
  --query properties.outputs
```

### Azure Portal Deployment

1. Go to Azure Portal → Resource Groups → powernova
2. Click "+ Create" → "Template deployment"
3. Click "Build your own template in editor"
4. Paste contents of `aci-deployment.json`
5. Click "Save"
6. Fill in parameters in the form
7. Click "Review + create"

## Parameter Types

### Secure Parameters
Values hidden in logs and deployment history:
- `databaseUrl`
- `azureStorageConnectionString`
- `openaiApiKey`
- `adminPassword`
- `jwtSecret`
- `acrPassword`

### Regular Parameters
- `location`
- `containerGroupName`
- `environment`
- `dnsLabel`
- `acrName`
- `acrUsername`
- `imageTag`
- `azureStorageContainerName`
- `adminUsername`
- `jwtAlgorithm`
- `jwtExpirationMinutes`

### Parameters with Defaults
- `imageTag`: "latest"
- `adminUsername`: "admin"
- `jwtAlgorithm`: "HS256"
- `jwtExpirationMinutes`: "1440"

## ARM Template Functions

The template uses ARM template functions for dynamic values:

```json
// String concatenation
"image": "[concat(parameters('acrName'), '.azurecr.io/powernova-api:', parameters('imageTag'))]"

// Worker ID with environment
"value": "[concat('crawler-worker-aci-', parameters('environment'))]"

// Resource reference for outputs
"value": "[reference(resourceId('Microsoft.ContainerInstance/containerGroups', parameters('containerGroupName'))).ipAddress.fqdn]"
```

## Deployment Tracking

### View Deployment History

```bash
# List all deployments
az deployment group list \
  --resource-group powernova \
  --output table

# Show specific deployment
az deployment group show \
  --resource-group powernova \
  --name powernova-workers-test-20251201-120000
```

### Get Deployment Outputs

```bash
# Get all outputs
az deployment group show \
  --resource-group powernova \
  --name powernova-workers-test-20251201-120000 \
  --query properties.outputs

# Get specific output
az deployment group show \
  --resource-group powernova \
  --name powernova-workers-test-20251201-120000 \
  --query properties.outputs.fqdn.value -o tsv
```

### Deployment in Azure Portal

1. Go to Resource Groups → powernova → Deployments
2. See all deployments with timestamps
3. Click deployment to see:
   - Parameters used
   - Outputs
   - Deployment logs
   - Resource changes

## Customization

### Change Container Resources

Edit `templates/aci-deployment.json`:

```json
{
  "resources": {
    "requests": {
      "cpu": 2.0,        // Change CPU cores
      "memoryInGb": 4.0  // Change memory
    }
  }
}
```

### Add New Parameter

1. **Add to template parameters:**
```json
{
  "parameters": {
    "newParameter": {
      "type": "string",
      "defaultValue": "default-value",
      "metadata": {
        "description": "Description of new parameter"
      }
    }
  }
}
```

2. **Use in resource:**
```json
{
  "environmentVariables": [
    {
      "name": "NEW_ENV_VAR",
      "value": "[parameters('newParameter')]"
    }
  ]
}
```

3. **Update deployment script:**
```bash
# Add to parameters JSON generation
"newParameter": {
  "value": "$NEW_PARAMETER_VALUE"
}
```

### Change Default Values

Edit parameter defaults in template:

```json
{
  "imageTag": {
    "type": "string",
    "defaultValue": "v1.2.3",  // Changed from "latest"
    "metadata": {
      "description": "Docker image tag"
    }
  }
}
```

## Validation

### Validate Template

```bash
# Validate template syntax and parameters
az deployment group validate \
  --resource-group powernova \
  --template-file templates/aci-deployment.json \
  --parameters @templates/aci-deployment.parameters.json
```

### What-If Analysis

```bash
# See what would change without actually deploying
az deployment group what-if \
  --resource-group powernova \
  --template-file templates/aci-deployment.json \
  --parameters @my-params.json
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Deploy to Azure
  run: |
    az deployment group create \
      --resource-group powernova \
      --name "powernova-${{ github.run_number }}" \
      --template-file templates/aci-deployment.json \
      --parameters \
        location=${{ vars.AZURE_LOCATION }} \
        containerGroupName=powernova-workers-prod \
        databaseUrl=${{ secrets.DATABASE_URL }} \
        openaiApiKey=${{ secrets.OPENAI_API_KEY }} \
        # ... other parameters from secrets/vars
```

### Azure DevOps Example

```yaml
- task: AzureResourceManagerTemplateDeployment@3
  inputs:
    deploymentScope: 'Resource Group'
    azureResourceManagerConnection: 'Azure Connection'
    resourceGroupName: 'powernova'
    location: 'East US'
    templateLocation: 'Linked artifact'
    csmFile: 'templates/aci-deployment.json'
    csmParametersFile: 'templates/aci-deployment.parameters.json'
    overrideParameters: |
      -databaseUrl $(DATABASE_URL) 
      -openaiApiKey $(OPENAI_API_KEY)
```

## Comparison: Old vs New

### Old Approach (sed + YAML)
```bash
# Generate YAML with sed
sed -e "s|{{PARAM}}|$VALUE|g" template.yaml > output.yaml

# Deploy container directly
az container create --file output.yaml
```

**Issues:**
- No validation before deployment
- String replacement fragile
- No deployment tracking
- Shell escaping required
- Not Azure-native

### New Approach (ARM Template)
```bash
# Create parameters JSON
cat > params.json <<EOF
{"parameters": {"param": {"value": "$VALUE"}}}
EOF

# Deploy using ARM
az deployment group create \
  --template-file template.json \
  --parameters @params.json
```

**Benefits:**
- Schema validation
- Type checking
- Deployment history
- Azure Portal integration
- Standard ARM format

## Migration Notes

**Backward Compatible:** ✅

- Script interface unchanged
- Environment variables same
- Outputs identical
- Only internal implementation changed

**Testing:**
```bash
# Test locally first
./scripts/test-workers-local.sh

# Deploy to test environment
./scripts/deploy-workers-azure-aci.sh --test

# Validate
./scripts/validate-aci-deployment.sh --test
```

## Related Files

- **Template**: `templates/aci-deployment.json`
- **Parameters Schema**: `templates/aci-deployment.parameters.json`
- **Deployment Script**: `scripts/deploy-workers-azure-aci.sh`
- **Documentation**: `docs/WORKER-ARCHITECTURE.md`

## Summary

✅ **Converted to ARM template format**
✅ **Separated template and parameters**
✅ **Added proper validation and outputs**
✅ **Maintained backward compatibility**
✅ **Improved Azure integration**
✅ **Better deployment tracking**
