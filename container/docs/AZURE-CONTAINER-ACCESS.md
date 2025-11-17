# How to Access Your Azure App Service Container

## Quick Reference

### SSH into Container (Recommended)
```bash
az webapp ssh --resource-group powernova --name powernovaapi
```

### Open SSH in Browser
```bash
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug/shell
```

---

## Method 1: Azure CLI SSH (Recommended)

### Prerequisites
```bash
# Ensure you're logged in
az login

# Set your subscription (if needed)
az account set --subscription "Your Subscription Name"
```

### Connect to Container
```bash
# SSH into the running container
az webapp ssh --resource-group powernova --name powernovaapi

# Once connected, you can:
pwd                    # Check current directory
ls -la                # List files
env | grep DATABASE   # Check environment variables
python --version      # Check Python version
pip list              # List installed packages
cat /app/main.py      # View files
python -m alembic current  # Check migrations
```

### Common Commands Inside Container
```bash
# Check application files
cd /app
ls -la

# Check environment variables
env

# Check if services are running
ps aux

# Check Python environment
which python
python --version
pip list | grep alembic

# Test database connection
python -c "from database.session import check_db_connection; print('DB Connected:', check_db_connection())"

# Check logs
tail -f /var/log/*.log

# Run alembic commands
python -m alembic current
python -m alembic history
```

---

## Method 2: Azure Portal SSH

### Steps:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App Services** → **powernovaapi**
3. In left menu, click **Development Tools** → **SSH**
4. Click **Go** button
5. Web-based terminal opens in browser

### Or use direct URL:
```
https://powernovaapi.scm.azurewebsites.net/webssh/host
```

---

## Method 3: Kudu Console (Advanced)

Kudu is Azure's diagnostic console for App Service.

### Access Kudu
```bash
# Open Kudu in browser
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug/shell

# Or direct URL
open https://powernovaapi.scm.azurewebsites.net
```

### Kudu Features:
- **Debug Console**: Shell access with file browser
- **Process Explorer**: See running processes
- **Environment**: View all environment variables
- **File Manager**: Browse and edit files
- **WebHooks**: Deployment hooks

### Useful Kudu URLs:
```bash
# Environment variables
https://powernovaapi.scm.azurewebsites.net/Env

# Process list
https://powernovaapi.scm.azurewebsites.net/ProcessExplorer

# File browser + console
https://powernovaapi.scm.azurewebsites.net/DebugConsole

# Site extensions
https://powernovaapi.scm.azurewebsites.net/SiteExtensions
```

---

## Method 4: Execute Remote Commands (No SSH)

Run commands without opening SSH session:

```bash
# Execute single command
az webapp ssh --resource-group powernova --name powernovaapi --command "ls -la /app"

# Check Python version
az webapp ssh --resource-group powernova --name powernovaapi --command "python --version"

# Check installed packages
az webapp ssh --resource-group powernova --name powernovaapi --command "pip list"

# Check environment variables
az webapp ssh --resource-group powernova --name powernovaapi --command "env | grep DATABASE"

# Check alembic status
az webapp ssh --resource-group powernova --name powernovaapi --command "cd /app && python -m alembic current"

# Test database connection
az webapp ssh --resource-group powernova --name powernovaapi --command "cd /app && python -c 'from database.session import check_db_connection; print(check_db_connection())'"
```

---

## Method 5: View Logs (Read-Only)

### Real-time Log Streaming
```bash
# Stream application logs
az webapp log tail --resource-group powernova --name powernovaapi

# Stream with specific log type
az webapp log tail --resource-group powernova --name powernovaapi --provider application

# Stream Docker container logs
az webapp log tail --resource-group powernova --name powernovaapi --provider container
```

### Download Logs
```bash
# Download all logs as ZIP
az webapp log download --resource-group powernova --name powernovaapi --log-file logs.zip

# Extract and view
unzip logs.zip
cat LogFiles/application/*.txt
```

### Configure Logging
```bash
# Enable application logging
az webapp log config --resource-group powernova --name powernovaapi \
  --application-logging filesystem \
  --detailed-error-messages true \
  --failed-request-tracing true \
  --web-server-logging filesystem

# Set log level
az webapp log config --resource-group powernova --name powernovaapi \
  --level information
```

---

## Method 6: Azure Portal - Log Stream

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App Services** → **powernovaapi**
3. Click **Monitoring** → **Log stream**
4. View real-time logs in browser

---

## Common Inspection Tasks

### 1. Check Environment Variables

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
env | sort

# Check specific variables
env | grep -E '(DATABASE|OPENAI|PORT|ENVIRONMENT)'

# Or remotely:
az webapp ssh --resource-group powernova --name powernovaapi --command "env | grep DATABASE"
```

### 2. Check Database Connection

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
cd /app
python -c "
from database.session import check_db_connection
result = check_db_connection()
print(f'Database connected: {result}')
"

# Or remotely:
az webapp ssh --resource-group powernova --name powernovaapi \
  --command "cd /app && python -c 'from database.session import check_db_connection; print(check_db_connection())'"
```

### 3. Check Installed Packages

```bash
# SSH method
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
pip list
pip show alembic
pip show sqlalchemy

# Or remotely:
az webapp ssh --resource-group powernova --name powernovaapi --command "pip list | grep -E '(alembic|sqlalchemy|fastapi|openai)'"
```

### 4. Run Alembic Migrations

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
cd /app
python -m alembic current
python -m alembic history
python -m alembic upgrade head

# Or remotely (risky for migrations):
az webapp ssh --resource-group powernova --name powernovaapi \
  --command "cd /app && python -m alembic current"
```

### 5. Check Application Files

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
ls -la /app
cat /app/main.py
ls -la /app/database
ls -la /app/models

# Check if all files are present
find /app -name "*.py" | head -20
```

### 6. Test API Endpoints Internally

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
# Install curl if not available
apt-get update && apt-get install -y curl

# Test health endpoint
curl http://localhost:8000/health

# Test API
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### 7. Check Running Processes

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
ps aux
ps aux | grep python
ps aux | grep uvicorn

# Check network connections
netstat -tuln
```

### 8. Check Disk Usage

```bash
# SSH into container
az webapp ssh --resource-group powernova --name powernovaapi

# Inside container:
df -h
du -sh /app
du -sh /app/* | sort -hr
```

---

## Troubleshooting Common Issues

### Issue: SSH Doesn't Work

**Solution 1: Enable SSH**
```bash
# Restart app
az webapp restart --resource-group powernova --name powernovaapi

# Try again
az webapp ssh --resource-group powernova --name powernovaapi
```

**Solution 2: Use Kudu Instead**
```bash
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug/shell
```

**Solution 3: Check Container Logs**
```bash
az webapp log tail --resource-group powernova --name powernovaapi
```

### Issue: Can't Find Files

```bash
# Check current directory
pwd

# Go to app directory
cd /app

# Or use absolute paths
ls -la /app
ls -la /home/site/wwwroot
```

### Issue: Environment Variables Not Set

```bash
# List all environment variables
env

# Check specific variable
echo $DATABASE_URL

# If not set, check App Service settings
az webapp config appsettings list --resource-group powernova --name powernovaapi
```

### Issue: Python Module Not Found

```bash
# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Check installed packages
pip list

# Check if package exists
python -c "import sqlalchemy; print(sqlalchemy.__version__)"

# Reinstall if needed (not recommended in production)
pip install alembic
```

---

## Quick Diagnostic Script

Create a script to run diagnostics:

```bash
#!/bin/bash
# diagnose-azure-container.sh

echo "=== Azure App Service Container Diagnostics ==="
echo ""

echo "1. Checking Python version..."
az webapp ssh --resource-group powernova --name powernovaapi --command "python --version"

echo ""
echo "2. Checking working directory..."
az webapp ssh --resource-group powernova --name powernovaapi --command "pwd && ls -la"

echo ""
echo "3. Checking environment variables..."
az webapp ssh --resource-group powernova --name powernovaapi --command "env | grep -E '(DATABASE|OPENAI|PORT|ENVIRONMENT)'"

echo ""
echo "4. Checking installed packages..."
az webapp ssh --resource-group powernova --name powernovaapi --command "pip list | grep -E '(alembic|sqlalchemy|fastapi|openai)'"

echo ""
echo "5. Checking database connection..."
az webapp ssh --resource-group powernova --name powernovaapi --command "cd /app && python -c 'from database.session import check_db_connection; print(check_db_connection())'"

echo ""
echo "6. Checking alembic status..."
az webapp ssh --resource-group powernova --name powernovaapi --command "cd /app && python -m alembic current"

echo ""
echo "7. Checking running processes..."
az webapp ssh --resource-group powernova --name powernovaapi --command "ps aux | grep -E '(python|uvicorn)'"

echo ""
echo "=== Diagnostics Complete ==="
```

---

## Best Practices

### ✅ Do's

- Use `az webapp ssh` for interactive debugging
- Check logs regularly with `az webapp log tail`
- Run read-only commands to inspect state
- Use Kudu for file browsing
- Document any manual changes made in container

### ❌ Don'ts

- Don't make permanent changes in running container (they'll be lost on restart)
- Don't store secrets in container (use App Service settings)
- Don't install packages manually (update Dockerfile instead)
- Don't edit files directly (use CI/CD pipeline)
- Don't run destructive database commands without backup

---

## Quick Reference Commands

```bash
# Connect to container
az webapp ssh --resource-group powernova --name powernovaapi

# Stream logs
az webapp log tail --resource-group powernova --name powernovaapi

# Run single command
az webapp ssh --resource-group powernova --name powernovaapi --command "env"

# Open Kudu
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug

# Restart app
az webapp restart --resource-group powernova --name powernovaapi

# Check app status
az webapp show --resource-group powernova --name powernovaapi --query state

# Get app URL
az webapp show --resource-group powernova --name powernovaapi --query defaultHostName -o tsv
```

---

## Save This Script

Create a helper script `scripts/ssh-azure.sh`:

```bash
#!/bin/bash
# SSH into Azure App Service container

echo "Connecting to Azure App Service container..."
echo ""
echo "Resource Group: powernova"
echo "App Name: powernovaapi"
echo ""

az webapp ssh --resource-group powernova --name powernovaapi
```

Make it executable:
```bash
chmod +x scripts/ssh-azure.sh
```

Use it:
```bash
./scripts/ssh-azure.sh
```

---

## Summary

**Easiest Method**: 
```bash
az webapp ssh --resource-group powernova --name powernovaapi
```

**For File Browsing**: Use Kudu Console  
**For Logs**: `az webapp log tail`  
**For Quick Checks**: `az webapp ssh --command`  
**For Visual Interface**: Azure Portal SSH

Happy debugging! 🚀
