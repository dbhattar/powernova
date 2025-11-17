# SSH Setup for API Container

## What Was Changed

### 1. Updated `docker/Dockerfile.api`
- ✅ Installed `openssh-server` and `dialog` packages
- ✅ Configured SSH with root password "Docker!"
- ✅ Created `/run/sshd` directory for SSH daemon
- ✅ Copied `sshd_config` to `/etc/ssh/`
- ✅ Copied and made `entrypoint.sh` executable
- ✅ Exposed port 2222 for SSH (in addition to 8000 for API)
- ✅ Changed CMD to use entrypoint.sh
- ⚠️ **Note**: Running as root (required for SSH daemon)

### 2. Updated `docker/entrypoint.sh`
- ✅ Starts SSH daemon first: `/usr/sbin/sshd`
- ✅ Then starts FastAPI with uvicorn (replaced gunicorn)
- ✅ Added logging for better debugging

### 3. Existing Files Used
- ✅ `docker/sshd_config` - SSH server configuration (port 2222)
- ✅ `docker/entrypoint.sh` - Container startup script

---

## How to Deploy

### Option 1: Rebuild and Deploy Locally

```bash
# Navigate to api directory (build context)
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/api

# Build the image
docker build -f ../docker/Dockerfile.api -t powernovaapi:latest .

# Run the container
docker run -d \
  -p 8000:8000 \
  -p 2222:2222 \
  --env-file .env \
  powernovaapi:latest

# Test SSH connection
ssh root@localhost -p 2222
# Password: Docker!
```

### Option 2: Deploy to Azure

```bash
# Use your existing deployment script
./scripts/azure-deploy-api.sh --update
```

After deployment, Azure App Service will automatically expose port 2222 for SSH.

---

## Connecting via SSH

### Local Container

```bash
ssh root@localhost -p 2222
# Password: Docker!
```

### Azure App Service

```bash
# Method 1: Azure CLI (recommended)
az webapp ssh --resource-group powernova --name powernovaapi

# Method 2: Direct SSH (if enabled)
ssh root@powernovaapi.azurewebsites.net -p 2222
# Password: Docker!
```

---

## Important Security Notes

⚠️ **Security Considerations:**

1. **Root User**: The container now runs as root (required for SSH daemon). This is standard for Azure App Service containers but reduces security isolation.

2. **SSH Password**: The default password is "Docker!" which is hardcoded. For production:
   - Consider using SSH keys instead of password authentication
   - Or change the password during build: `RUN echo "root:YOUR_STRONG_PASSWORD" | chpasswd`

3. **Port Exposure**: Port 2222 is exposed. In production:
   - Azure App Service handles SSH access securely through the platform
   - Direct SSH access to the container should be restricted

---

## Troubleshooting

### SSH Daemon Not Starting

Check logs:
```bash
docker logs <container_id>
```

You should see:
```
Starting SSH daemon...
Starting FastAPI application...
```

### Can't Connect to SSH

Verify port is exposed:
```bash
docker ps
# Look for: 0.0.0.0:2222->2222/tcp
```

Check if SSH daemon is running:
```bash
docker exec <container_id> ps aux | grep sshd
```

### Permission Denied

Ensure entrypoint.sh is executable:
```bash
docker exec <container_id> ls -la /app/entrypoint.sh
# Should show: -rwxr-xr-x
```

---

## Files Modified

1. **`docker/Dockerfile.api`**
   - Added openssh-server installation
   - Added SSH configuration
   - Copied sshd_config and entrypoint.sh
   - Changed to run as root
   - Exposed port 2222
   - Changed CMD to entrypoint.sh

2. **`docker/entrypoint.sh`**
   - Updated to start sshd first
   - Changed from gunicorn to uvicorn
   - Added logging messages

3. **`docker/sshd_config`**
   - Already configured for port 2222
   - Allows root login
   - Password authentication enabled

---

## Running Migrations via SSH

Once SSH is enabled, you can easily run migrations:

```bash
# SSH into container
ssh root@localhost -p 2222  # Local
# or
az webapp ssh --resource-group powernova --name powernovaapi  # Azure

# Inside container
cd /app
python -m alembic upgrade head
```

---

## Next Steps

1. **Test Locally**:
   ```bash
   cd api
   docker build -f ../docker/Dockerfile.api -t powernovaapi:latest .
   docker run -d -p 8000:8000 -p 2222:2222 --env-file .env powernovaapi:latest
   ssh root@localhost -p 2222
   ```

2. **Deploy to Azure**:
   ```bash
   ./scripts/azure-deploy-api.sh --update
   ```

3. **Verify SSH Access**:
   ```bash
   az webapp ssh --resource-group powernova --name powernovaapi
   ```

4. **Run Migrations**:
   ```bash
   # Inside container via SSH
   python -m alembic upgrade head
   ```

5. **Update SSH Scripts**:
   The existing `./scripts/ssh-azure.sh` should now work without issues!

---

## Alternative: Use Azure's Built-in SSH

Azure App Service has built-in SSH support. If you prefer not to modify the Dockerfile:

1. Keep the Dockerfile minimal (without SSH)
2. Use Azure's SSH: `az webapp ssh --resource-group powernova --name powernovaapi`
3. Azure handles SSH tunneling automatically

However, having SSH in the container gives you more control and works in any environment (local, Azure, other clouds).

---

## Summary

✅ SSH is now enabled in the API container
✅ Port 2222 exposed for SSH access  
✅ Root password set to "Docker!"
✅ Entrypoint starts SSH daemon + FastAPI
✅ Ready to deploy and access via SSH

Deploy with: `./scripts/azure-deploy-api.sh --update`

Connect with: `az webapp ssh --resource-group powernova --name powernovaapi` 🚀
