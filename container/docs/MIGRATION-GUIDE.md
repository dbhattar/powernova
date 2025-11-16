# Migration Guide - Project Reorganization

## What Changed?

The project structure has been reorganized for better maintainability and scalability. All Docker-related files have been moved to a `docker/` folder, and utility scripts to a `scripts/` folder.

## Old vs New Structure

### Before (v1.0.0)
```
container/
├── website/
├── Dockerfile
├── nginx.conf
├── docker-compose.yml
├── .dockerignore
├── docker-helper.sh
├── README.md
├── DEPLOYMENT.md
└── .github/
```

### After (v1.1.0)
```
container/
├── website/                    # Static website files (unchanged)
├── docker/                     # 🆕 Docker configuration folder
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── docker-compose.yml
│   └── .dockerignore
├── scripts/                    # 🆕 Utility scripts folder
│   └── docker-helper.sh
├── README.md
├── DEPLOYMENT.md
├── CHANGELOG.md
└── .github/
```

## Updated Commands

### Docker Compose

**Old:**
```bash
docker-compose up -d
docker-compose down
```

**New:**
```bash
cd docker
docker-compose up -d
docker-compose down
```

### Helper Script

**Old:**
```bash
./docker-helper.sh build
./docker-helper.sh run
```

**New:**
```bash
./scripts/docker-helper.sh build
./scripts/docker-helper.sh run
```

### Docker Build

**Old:**
```bash
docker build -t powernova-website .
```

**New:**
```bash
docker build -f docker/Dockerfile -t powernova-website .
```

### Azure Deployment

**Old:**
```bash
az acr build --registry $ACR_NAME --image powernova-website:latest --file Dockerfile .
```

**New:**
```bash
az acr build --registry $ACR_NAME --image powernova-website:latest --file docker/Dockerfile .
```

## What You Need to Do

### If You Were Using Docker Compose
```bash
# Navigate to the docker folder
cd docker

# Use docker-compose as before
docker-compose up -d
```

### If You Were Using the Helper Script
```bash
# Update your command to reference the scripts folder
./scripts/docker-helper.sh build
./scripts/docker-helper.sh run
```

### If You Have CI/CD Pipelines
Update your build commands to reference `docker/Dockerfile`:
```yaml
# GitHub Actions example
- name: Build Docker image
  run: docker build -f docker/Dockerfile -t myimage .

# Azure DevOps example
- task: Docker@2
  inputs:
    Dockerfile: 'docker/Dockerfile'
```

### If You're Using Azure ACR Build
```bash
az acr build \
  --registry $ACR_NAME \
  --image powernova-website:latest \
  --file docker/Dockerfile .
```

## Benefits of This Change

✅ **Cleaner Root Directory** - Less clutter, easier to navigate  
✅ **Better Organization** - Clear separation between code, config, and scripts  
✅ **Scalable Structure** - Ready to add more services (api/, database/, etc.)  
✅ **Industry Standard** - Follows common project organization patterns  
✅ **Easier Maintenance** - Grouped related files together  

## Backward Compatibility

⚠️ **Breaking Changes:**
- Direct references to `Dockerfile` will no longer work
- `docker-compose` must be run from the `docker/` directory or with `-f docker/docker-compose.yml`
- Helper script is now at `scripts/docker-helper.sh`

## Migration Checklist

- [ ] Update any local scripts that reference `Dockerfile` to use `docker/Dockerfile`
- [ ] Update CI/CD pipelines with new file paths
- [ ] Update any documentation or runbooks with new commands
- [ ] Test the build process with the new structure
- [ ] Update team members about the new structure

## Testing the New Structure

```bash
# Test with helper script
./scripts/docker-helper.sh build
./scripts/docker-helper.sh run
./scripts/docker-helper.sh test

# Test with docker-compose
cd docker
docker-compose up -d
docker-compose ps
docker-compose down

# Test direct Docker commands
docker build -f docker/Dockerfile -t powernova-website .
docker run -d -p 8080:80 powernova-website
```

## Need Help?

If you encounter any issues with the migration:
1. Check that you're using the correct file paths
2. Refer to the updated README.md for current commands
3. Review the CHANGELOG.md for all changes
4. Open an issue if you find any problems

---

**Version:** 1.1.0  
**Date:** November 15, 2025  
**Status:** ✅ Tested and Working
