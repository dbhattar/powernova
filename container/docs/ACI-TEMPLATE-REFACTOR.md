# ACI Deployment Template - Change Summary

## What Changed

Refactored the Azure Container Instances deployment script to use a fixed template file instead of generating YAML inline.

## Changes Made

### 1. Created Template File
**File**: `templates/aci-deployment.yaml`

- Fixed YAML template with placeholder syntax `{{PARAMETER_NAME}}`
- Defines all 3 containers (API, crawler worker, doc worker)
- Includes resource limits, environment variables, networking
- Safe to commit (contains no secrets)

### 2. Updated Deployment Script
**File**: `scripts/deploy-workers-azure-aci.sh`

**Before**: Generated YAML inline using `cat > file <<EOF`
```bash
cat > /tmp/powernova-workers-aci.yaml <<EOF
apiVersion: '2021-09-01'
location: $LOCATION
# ... 150+ lines of inline YAML
EOF
```

**After**: Uses template with sed replacements
```bash
TEMPLATE_FILE="$SCRIPT_DIR/../templates/aci-deployment.yaml"

sed -e "s|{{LOCATION}}|$LOCATION|g" \
    -e "s|{{CONTAINER_GROUP}}|$CONTAINER_GROUP|g" \
    # ... replace all placeholders
    "$TEMPLATE_FILE" > /tmp/powernova-workers-aci.yaml
```

### 3. Added Template Documentation
**File**: `templates/ACI-TEMPLATE.md`

- Documents all template parameters
- Shows customization examples
- Includes usage instructions
- Lists monitoring commands

## Benefits

### ✅ Better Maintainability
- Template is easier to read and edit
- Changes visible in git diffs
- No shell escaping issues
- YAML syntax highlighting in editors

### ✅ Improved Testing
- Can validate template YAML syntax separately
- Can manually test with different parameters
- Template file can be used with other tools

### ✅ Version Control
- Template changes tracked in git
- Easy to see what changed in deployment config
- Can review template without running script

### ✅ Reusability
- Template can be used for manual deployments
- Can be imported into Azure Portal
- Compatible with Azure DevOps pipelines
- Can be used with Terraform/Bicep conversions

## Template Parameters

All parameters use double-brace syntax: `{{PARAMETER_NAME}}`

### Infrastructure Parameters
- `{{LOCATION}}` - Azure region
- `{{CONTAINER_GROUP}}` - Container group name
- `{{ENVIRONMENT}}` - Environment name (prod/test)
- `{{DNS_LABEL}}` - Public DNS label

### Container Registry
- `{{ACR_NAME}}` - Registry name
- `{{ACR_USERNAME}}` - Registry username
- `{{ACR_PASSWORD}}` - Registry password
- `{{IMAGE_TAG}}` - Image tag

### Application Configuration
- `{{DATABASE_URL}}` - Database connection
- `{{AZURE_STORAGE_CONNECTION_STRING}}` - Storage connection
- `{{AZURE_STORAGE_CONTAINER_NAME}}` - Storage container
- `{{OPENAI_API_KEY}}` - OpenAI key
- `{{ADMIN_USERNAME}}` - Admin user
- `{{ADMIN_PASSWORD}}` - Admin password
- `{{JWT_SECRET}}` - JWT secret
- `{{JWT_ALGORITHM}}` - JWT algorithm
- `{{JWT_EXPIRATION_MINUTES}}` - JWT expiration

## Usage (No Changes)

The deployment script usage remains the same:

```bash
# Deploy to test
./scripts/deploy-workers-azure-aci.sh --test

# Deploy to production
./scripts/deploy-workers-azure-aci.sh
```

## Customization Examples

### Change Container Resources

Edit `templates/aci-deployment.yaml`:
```yaml
# API Container - Increase resources
resources:
  requests:
    cpu: 2.0        # Was 1.0
    memoryInGb: 4.0 # Was 2.0

# Crawler Worker - Decrease resources  
resources:
  requests:
    cpu: 0.25       # Was 0.5
    memoryInGb: 0.5 # Was 1.0
```

### Add New Environment Variable

1. Add to template:
```yaml
environmentVariables:
- name: NEW_FEATURE_FLAG
  value: '{{NEW_FEATURE_FLAG}}'
```

2. Add to deployment script (after line 195):
```bash
-e "s|{{NEW_FEATURE_FLAG}}|${NEW_FEATURE_FLAG:-false}|g" \
```

3. Set environment variable before deploying:
```bash
export NEW_FEATURE_FLAG="true"
./scripts/deploy-workers-azure-aci.sh --test
```

### Change Poll Intervals

Edit template directly (no need to change script):
```yaml
# Crawler worker
- name: POLL_INTERVAL
  value: '60'  # Changed from 30 to 60 seconds

# Doc worker
- name: DOC_PROCESSOR_POLL_INTERVAL
  value: '20'  # Changed from 10 to 20 seconds
```

## Manual Deployment

You can now deploy manually using the template:

```bash
# 1. Set all environment variables
export LOCATION="eastus"
export CONTAINER_GROUP="powernova-workers-manual"
export ACR_NAME="powernovaregistry"
# ... set all other variables

# 2. Get ACR credentials
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

# 3. Generate deployment file
sed -e "s|{{LOCATION}}|$LOCATION|g" \
    -e "s|{{CONTAINER_GROUP}}|$CONTAINER_GROUP|g" \
    -e "s|{{ACR_NAME}}|$ACR_NAME|g" \
    -e "s|{{IMAGE_TAG}}|latest|g" \
    -e "s|{{DATABASE_URL}}|$DATABASE_URL|g" \
    -e "s|{{AZURE_STORAGE_CONNECTION_STRING}}|$AZURE_STORAGE_CONNECTION_STRING|g" \
    -e "s|{{AZURE_STORAGE_CONTAINER_NAME}}|$AZURE_STORAGE_CONTAINER_NAME|g" \
    -e "s|{{OPENAI_API_KEY}}|$OPENAI_API_KEY|g" \
    -e "s|{{ADMIN_USERNAME}}|$ADMIN_USERNAME|g" \
    -e "s|{{ADMIN_PASSWORD}}|$ADMIN_PASSWORD|g" \
    -e "s|{{JWT_SECRET}}|$JWT_SECRET|g" \
    -e "s|{{JWT_ALGORITHM}}|HS256|g" \
    -e "s|{{JWT_EXPIRATION_MINUTES}}|1440|g" \
    -e "s|{{ENVIRONMENT}}|manual|g" \
    -e "s|{{ACR_USERNAME}}|$ACR_USERNAME|g" \
    -e "s|{{ACR_PASSWORD}}|$ACR_PASSWORD|g" \
    -e "s|{{DNS_LABEL}}|powernova-manual|g" \
    templates/aci-deployment.yaml > my-deployment.yaml

# 4. Deploy
az container create --resource-group powernova --file my-deployment.yaml
```

## Validation

Template syntax can be validated before deployment:

```bash
# Install yq (YAML processor)
brew install yq

# Validate YAML syntax
yq eval templates/aci-deployment.yaml

# Check for required placeholders
grep -E '{{[A-Z_]+}}' templates/aci-deployment.yaml
```

## Integration with CI/CD

The template can be used in Azure DevOps or GitHub Actions:

```yaml
# Example GitHub Actions workflow
- name: Generate ACI Deployment
  run: |
    sed -e "s|{{LOCATION}}|${{ secrets.AZURE_LOCATION }}|g" \
        -e "s|{{DATABASE_URL}}|${{ secrets.DATABASE_URL }}|g" \
        # ... all parameters from secrets
        templates/aci-deployment.yaml > deployment.yaml

- name: Deploy to Azure
  run: |
    az container create \
      --resource-group powernova \
      --file deployment.yaml
```

## Files Changed

1. ✅ **Created**: `templates/aci-deployment.yaml` - Main template
2. ✅ **Created**: `templates/ACI-TEMPLATE.md` - Template documentation
3. ✅ **Modified**: `scripts/deploy-workers-azure-aci.sh` - Uses template instead of inline YAML

## Testing

The refactored script has been tested and works identically to the previous version:

```bash
# Test locally first
./scripts/test-workers-local.sh

# Deploy to Azure test environment
./scripts/deploy-workers-azure-aci.sh --test

# Validate deployment
./scripts/validate-aci-deployment.sh --test
```

## Backward Compatibility

✅ **Fully backward compatible**

- Same command-line interface
- Same environment variables required
- Same deployment behavior
- Only internal implementation changed

No changes needed to existing workflows or documentation!
