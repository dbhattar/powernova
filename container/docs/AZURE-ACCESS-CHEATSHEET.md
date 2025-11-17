# Azure Container Access - Quick Reference Card

## 🚀 Quick Start

### SSH into Container (Easiest)
```bash
./scripts/ssh-azure.sh
```

### Run Diagnostics
```bash
./scripts/diagnose-azure.sh
```

---

## 📝 Common Commands

### SSH Access
```bash
# Interactive SSH
az webapp ssh --resource-group powernova --name powernovaapi

# Run single command
az webapp ssh --resource-group powernova --name powernovaapi --command "env"

# Open in browser
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug/shell
```

### View Logs
```bash
# Stream logs
az webapp log tail --resource-group powernova --name powernovaapi

# Download logs
az webapp log download --resource-group powernova --name powernovaapi --log-file logs.zip
```

### App Management
```bash
# Check status
az webapp show --resource-group powernova --name powernovaapi --query state

# Restart app
az webapp restart --resource-group powernova --name powernovaapi

# Get URL
az webapp show --resource-group powernova --name powernovaapi --query defaultHostName -o tsv
```

---

## 🔍 Inside Container Commands

Once you're SSH'd in (`./scripts/ssh-azure.sh`):

### Navigation
```bash
pwd                    # Current directory
cd /app                # Go to app directory
ls -la                 # List files
```

### Environment
```bash
env                    # All environment variables
env | grep DATABASE    # Check database config
env | grep OPENAI      # Check OpenAI key
```

### Python
```bash
python --version       # Python version
pip list               # Installed packages
pip show alembic       # Check specific package
which python           # Python location
```

### Database
```bash
# Check connection
python -c "from database.session import check_db_connection; print(check_db_connection())"

# Check migrations
python -m alembic current
python -m alembic history

# Run migrations (careful!)
python -m alembic upgrade head
```

### Files
```bash
cat main.py            # View file
ls -la models/         # Check models
ls -la database/       # Check database files
find /app -name "*.py" # Find Python files
```

### Processes
```bash
ps aux                 # All processes
ps aux | grep python   # Python processes
ps aux | grep uvicorn  # Uvicorn processes
```

### Testing
```bash
# Install curl if needed
apt-get update && apt-get install -y curl

# Test health endpoint
curl http://localhost:8000/health

# Test API
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

---

## 🌐 Web Access

### Kudu Console
```
https://powernovaapi.scm.azurewebsites.net
```

### SSH (Browser)
```
https://powernovaapi.scm.azurewebsites.net/webssh/host
```

### Debug Console
```
https://powernovaapi.scm.azurewebsites.net/DebugConsole
```

### Environment Variables
```
https://powernovaapi.scm.azurewebsites.net/Env
```

---

## 🛠️ Troubleshooting

### Can't Connect to SSH
```bash
# Restart app
az webapp restart --resource-group powernova --name powernovaapi

# Check logs
az webapp log tail --resource-group powernova --name powernovaapi

# Use Kudu instead
az webapp browse --resource-group powernova --name powernovaapi --path /newui/kududebug
```

### Environment Variable Missing
```bash
# Check App Service settings
az webapp config appsettings list --resource-group powernova --name powernovaapi

# Set new variable
az webapp config appsettings set \
  --resource-group powernova \
  --name powernovaapi \
  --settings NEW_VAR="value"
```

### Database Connection Failed
```bash
# SSH into container
./scripts/ssh-azure.sh

# Inside container, test connection
python -c "
from database.session import engine
try:
    with engine.connect() as conn:
        print('✓ Connected')
except Exception as e:
    print(f'✗ Error: {e}')
"
```

---

## 📊 Diagnostic Checklist

Run this checklist when debugging:

```bash
# 1. App status
az webapp show --resource-group powernova --name powernovaapi --query state

# 2. Health endpoint
curl https://powernovaapi.azurewebsites.net/health

# 3. View logs
az webapp log tail --resource-group powernova --name powernovaapi

# 4. SSH diagnostics
./scripts/diagnose-azure.sh

# 5. Check settings
az webapp config appsettings list --resource-group powernova --name powernovaapi

# 6. SSH for manual inspection
./scripts/ssh-azure.sh
```

---

## 💾 Backup Before Changes

Always backup before making changes:

```bash
# Backup configuration
az webapp config appsettings list --resource-group powernova --name powernovaapi > app-settings-backup.json

# Backup database (if using PostgreSQL)
# SSH into container
./scripts/ssh-azure.sh

# Inside container
python -c "
from database import crud
from database.session import get_db
db = next(get_db())
users = crud.get_users(db)
print(f'Users: {len(users)}')
"
```

---

## ⚠️ Important Notes

- **Container is ephemeral**: Changes are lost on restart
- **Don't edit files**: Use CI/CD pipeline instead
- **Read-only inspection**: Preferred approach
- **Database changes**: Always backup first
- **Secrets**: Never expose in logs or commands

---

## 📚 Related Documentation

- **Full Guide**: `AZURE-CONTAINER-ACCESS.md`
- **SSH Script**: `scripts/ssh-azure.sh`
- **Diagnostics**: `scripts/diagnose-azure.sh`
- **Deployment**: `scripts/deploy-api-with-supabase.sh`

---

## 🆘 Need Help?

```bash
# Azure CLI help
az webapp ssh --help

# Get container info
az webapp show --resource-group powernova --name powernovaapi

# Check subscription
az account show
```

---

**Quick Access Commands:**

| Task | Command |
|------|---------|
| SSH | `./scripts/ssh-azure.sh` |
| Diagnostics | `./scripts/diagnose-azure.sh` |
| Logs | `az webapp log tail --resource-group powernova --name powernovaapi` |
| Restart | `az webapp restart --resource-group powernova --name powernovaapi` |
| Health | `curl https://powernovaapi.azurewebsites.net/health` |

Happy debugging! 🚀
