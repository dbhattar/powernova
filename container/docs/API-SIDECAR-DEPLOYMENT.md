# API-Only Deployment with PostgreSQL Sidecar

## Overview

This configuration deploys **only the PowerNOVA API** with PostgreSQL as a true sidecar container. The database is **NOT exposed externally** for maximum security.

## 🎯 Key Features

### ✅ Security Benefits
- **No external database port** - PostgreSQL only accessible from API container
- **Isolated network** - API and database communicate via internal Docker network
- **Minimal attack surface** - No unnecessary services exposed
- **Container hardening** - Minimal capabilities, non-root users
- **Secret management** - Passwords via environment variables

### ✅ Deployment Advantages
- **Simple architecture** - Just 2 containers (API + DB)
- **Easy scaling** - Scale API containers independently
- **Portable** - Same configuration works everywhere
- **Lightweight** - No web/chat containers if not needed
- **Fast startup** - Minimal dependencies

### ✅ Development Benefits
- **Hot reload** - Code changes reflect immediately (dev mode)
- **Database migrations** - Alembic integrated
- **Easy debugging** - Direct container access
- **Clean separation** - API development isolated from frontend

## 📁 Configuration Files

### Development Mode
**File**: `docker/docker-compose.api.yml`
- Hot-reload enabled
- Volume mounted for live code changes
- Exposed port: 8000
- Database: Internal only

### Production Mode
**File**: `docker/docker-compose.api.prod.yml`
- Production-optimized Dockerfile
- Security hardening enabled
- Health checks configured
- Read-only filesystem
- Minimal capabilities

## 🚀 Quick Start

### Development Mode

```bash
# Start API + Database
./scripts/start-api-standalone.sh

# Or manually:
cd docker
docker-compose -f docker-compose.api.yml up -d
```

**Access:**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Production Mode

```bash
# Create .env file with production settings
cat > docker/.env.prod << EOF
POSTGRES_PASSWORD=your_secure_password_here
OPENAI_API_KEY=your_openai_key_here
POSTGRES_USER=powernova
POSTGRES_DB=powernova_db
ENVIRONMENT=production
LOG_LEVEL=INFO
EOF

# Start production deployment
cd docker
docker-compose -f docker-compose.api.prod.yml --env-file .env.prod up -d

# Run migrations
docker exec powernova-api-prod alembic upgrade head
```

## 🔧 Configuration

### Environment Variables

Create `docker/.env` (development) or `docker/.env.prod` (production):

```bash
# Required
OPENAI_API_KEY=sk-...
POSTGRES_PASSWORD=your_secure_password

# Optional
POSTGRES_USER=powernova
POSTGRES_DB=powernova_db
API_PORT=8000
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### Database Connection

The API connects to PostgreSQL using this connection string:
```
postgresql://powernova:password@powernova-db:5432/powernova_db
```

**Note**: `powernova-db` is the Docker service name, resolvable only within the Docker network.

## 🎛️ Operations

### Start Services
```bash
# Development
docker-compose -f docker-compose.api.yml up -d

# Production
docker-compose -f docker-compose.api.prod.yml up -d
```

### View Logs
```bash
# All logs
docker-compose -f docker-compose.api.yml logs -f

# API only
docker logs -f powernova-api-standalone

# Database only
docker logs -f powernova-db
```

### Stop Services
```bash
docker-compose -f docker-compose.api.yml down

# With volume removal (deletes database data)
docker-compose -f docker-compose.api.yml down -v
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.api.yml restart

# Restart API only
docker restart powernova-api-standalone

# Restart DB only
docker restart powernova-db
```

## 🗄️ Database Management

### Run Migrations
```bash
docker exec powernova-api-standalone alembic upgrade head
```

### Create Migration
```bash
docker exec powernova-api-standalone alembic revision --autogenerate -m "Add new table"
```

### Access Database (from API container)
```bash
# Enter API container
docker exec -it powernova-api-standalone bash

# Connect to PostgreSQL
psql postgresql://powernova:password@powernova-db:5432/powernova_db

# Or directly
docker exec -it powernova-db psql -U powernova -d powernova_db
```

### Backup Database
```bash
# Create backup
docker exec powernova-db pg_dump -U powernova powernova_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Production
docker exec powernova-db-prod pg_dump -U powernova powernova_db > backup.sql
```

### Restore Database
```bash
# Restore from backup
docker exec -i powernova-db psql -U powernova powernova_db < backup.sql

# Production
docker exec -i powernova-db-prod psql -U powernova powernova_db < backup.sql
```

## 🔐 Security Features

### Network Isolation

The database is on an **internal Docker network** and cannot be accessed from:
- Host machine (no port mapping)
- Other Docker networks
- External networks

Only the API container can access the database.

### Production Hardening

In `docker-compose.api.prod.yml`:
- ✅ No external database port
- ✅ Read-only root filesystem
- ✅ Minimal Linux capabilities
- ✅ Non-root user execution
- ✅ No privilege escalation
- ✅ Isolated network
- ✅ Health checks

### Environment Isolation

```bash
# Complete network isolation (no internet)
# Edit docker-compose.api.yml:
networks:
  api-internal:
    internal: true  # Blocks all external access
```

**Note**: This will prevent the API from calling external services (OpenAI, etc.)

## 📊 Monitoring

### Health Checks

```bash
# API health
curl http://localhost:8000/health

# Response:
{
  "status": "healthy",
  "service": "powernova-api",
  "version": "1.0.0",
  "database": "connected"
}
```

### Container Stats
```bash
docker stats powernova-api-standalone powernova-db
```

### Database Stats
```bash
docker exec powernova-db psql -U powernova -d powernova_db -c "
SELECT 
    pg_size_pretty(pg_database_size('powernova_db')) as db_size,
    count(*) as connections
FROM pg_stat_activity;
"
```

## 🚢 Deployment Scenarios

### Scenario 1: Local Development
- Use `docker-compose.api.yml`
- Hot-reload enabled
- Database for testing
- Full access for debugging

```bash
./scripts/start-api-standalone.sh
```

### Scenario 2: CI/CD Testing
- Use `docker-compose.api.yml`
- Ephemeral database
- Automated migrations
- Integration tests

```bash
docker-compose -f docker-compose.api.yml up -d
docker exec powernova-api-standalone alembic upgrade head
# Run tests
docker-compose -f docker-compose.api.yml down -v
```

### Scenario 3: Production Deployment
- Use `docker-compose.api.prod.yml`
- Persistent volumes
- Security hardened
- Auto-restart enabled

```bash
docker-compose -f docker-compose.api.prod.yml up -d
```

### Scenario 4: Behind Reverse Proxy
- Use production config
- Nginx/Traefik in front
- SSL termination at proxy
- Multiple API replicas

```bash
# Start multiple API containers
docker-compose -f docker-compose.api.prod.yml up -d --scale powernova-api=3
```

## 🔄 Migration from Full Stack

If you're currently using the full `docker-compose.yml`:

### Step 1: Backup Data
```bash
docker exec powernova-postgres pg_dump -U powernova powernova_db > backup.sql
```

### Step 2: Stop Full Stack
```bash
cd docker
docker-compose down
```

### Step 3: Start API-Only
```bash
docker-compose -f docker-compose.api.yml up -d
```

### Step 4: Restore Data (if needed)
```bash
docker exec -i powernova-db psql -U powernova powernova_db < backup.sql
```

### Step 5: Verify
```bash
curl http://localhost:8000/health
```

## 🐛 Troubleshooting

### API can't connect to database

**Check network:**
```bash
docker network inspect powernova-api-network
```

**Check database health:**
```bash
docker exec powernova-db pg_isready -U powernova -d powernova_db
```

**Check logs:**
```bash
docker logs powernova-db
docker logs powernova-api-standalone
```

### Database data lost after restart

**Check volume:**
```bash
docker volume ls | grep powernova
docker volume inspect powernova_api_postgres_data
```

**Ensure you didn't use `-v` flag:**
```bash
# Wrong (deletes data):
docker-compose down -v

# Correct (keeps data):
docker-compose down
```

### Port already in use

```bash
# Find what's using port 8000
lsof -i :8000

# Change port in .env
API_PORT=8001
```

### Migration errors

```bash
# Check current version
docker exec powernova-api-standalone alembic current

# View history
docker exec powernova-api-standalone alembic history

# Reset migrations (CAUTION: destroys data)
docker exec powernova-api-standalone alembic downgrade base
docker exec powernova-api-standalone alembic upgrade head
```

## 📈 Scaling

### Horizontal Scaling (Multiple API Instances)

```bash
# Start 3 API containers
docker-compose -f docker-compose.api.prod.yml up -d --scale powernova-api=3
```

**Requirements:**
- Load balancer in front (Nginx, Traefik, HAProxy)
- Shared database (already configured)
- Session storage (if using sessions)

### Vertical Scaling (Resource Limits)

Add to `docker-compose.api.prod.yml`:

```yaml
services:
  powernova-api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
          
  powernova-db:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## 🎯 Best Practices

### ✅ DO
- Use environment variables for secrets
- Regular database backups
- Monitor health endpoints
- Use production Dockerfile in prod
- Set resource limits
- Enable restart policies
- Use specific image tags (not `latest`)

### ❌ DON'T
- Expose database port externally
- Use default passwords in production
- Run as root user
- Store secrets in Dockerfile
- Use `-v` flag unless you want to delete data
- Share database between multiple deployments

## 📚 Additional Resources

- **Full Setup Guide**: `DATABASE-SETUP.md`
- **Quick Reference**: `DATABASE-QUICKREF.md`
- **Main README**: `DATABASE-README.md`
- **API Documentation**: http://localhost:8000/docs

## 🎉 Summary

You now have a **secure, isolated API deployment** with PostgreSQL as a true sidecar:

- ✅ Database not exposed externally
- ✅ Simple 2-container architecture
- ✅ Easy to deploy and manage
- ✅ Production-ready with security hardening
- ✅ Development-friendly with hot-reload

**Start developing:**
```bash
./scripts/start-api-standalone.sh
curl http://localhost:8000/health
```

Happy coding! 🚀
