# PostgreSQL Database Security Configuration

## Overview

The PostgreSQL database in the PowerNOVA docker-compose setup is **NOT exposed externally** for security reasons. It is only accessible via the internal Docker network.

## Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Host                         │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │         powernova-network (internal)              │  │
│  │                                                     │  │
│  │  ┌──────────────┐    ┌──────────────┐            │  │
│  │  │   Website    │    │   Chat App   │            │  │
│  │  │ localhost:   │    │ localhost:   │            │  │
│  │  │    8080      │    │    8081      │            │  │
│  │  └──────────────┘    └──────────────┘            │  │
│  │                                                     │  │
│  │  ┌──────────────┐                                  │  │
│  │  │     API      │                                  │  │
│  │  │ localhost:   │                                  │  │
│  │  │    8000      │◄────────────────────┐           │  │
│  │  └──────────────┘                     │           │  │
│  │         │                              │           │  │
│  │         │ Internal Network Only        │           │  │
│  │         │ (port 5432)                  │           │  │
│  │         ▼                              │           │  │
│  │  ┌──────────────┐                     │           │  │
│  │  │  PostgreSQL  │                     │           │  │
│  │  │   Database   │                     │           │  │
│  │  │ powernova-   │                     │           │  │
│  │  │  postgres    │                     │           │  │
│  │  │ NOT EXPOSED  │                     │           │  │
│  │  └──────────────┘                     │           │  │
│  │                                        │           │  │
│  └────────────────────────────────────────┼───────────┘  │
│                                           │              │
│  External Access:                         │              │
│  ✅ Website:   http://localhost:8080     │              │
│  ✅ Chat:      http://localhost:8081     │              │
│  ✅ API:       http://localhost:8000     │              │
│  ❌ Database:  NOT accessible from host  ◄───────────   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Security Configuration

### What Changed

**Before** (Insecure):
```yaml
powernova-postgres:
  ports:
    - "5432:5432"  # ❌ Database exposed to host machine
```

**After** (Secure):
```yaml
powernova-postgres:
  # NO external port mapping - database is private
  # ports:
  #   - "5432:5432"  # REMOVED
  networks:
    - powernova-network  # ✅ Only accessible via internal network
```

### Access Control

| Service | External Access | Database Access |
|---------|----------------|-----------------|
| `powernova-web` | ✅ localhost:8080 | ❌ No |
| `powernova-chat` | ✅ localhost:8081 | ❌ No |
| `powernova-api` | ✅ localhost:8000 | ✅ Yes (internal) |
| `powernova-postgres` | ❌ No external access | ✅ Internal only |

## How to Access Database

Since the database is not exposed externally, use these methods:

### Method 1: Debug Script (Recommended)

```bash
./scripts/debug-database.sh
```

This interactive script provides:
1. PostgreSQL shell (psql)
2. Connection testing
3. List databases/tables
4. Show schemas
5. Count records
6. Run custom SQL queries
7. Backup/restore
8. View logs
9. Connect from API container

### Method 2: Direct Docker Exec

```bash
# Connect to database container directly
docker exec -it powernova-postgres psql -U powernova -d powernova

# Connect from API container (simulates API connection)
docker exec -it powernova-api psql -h powernova-postgres -U powernova -d powernova
```

### Method 3: Run SQL Queries

```bash
# Execute a query directly
docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT * FROM users;"

# Run a SQL file
cat query.sql | docker exec -i powernova-postgres psql -U powernova -d powernova
```

## API Connection

The API service connects to the database using the **internal network hostname**:

```yaml
environment:
  - DATABASE_URL=postgresql://powernova:powernova_dev_2024@powernova-postgres:5432/powernova
```

Key points:
- **Host**: `powernova-postgres` (internal Docker hostname, not `localhost`)
- **Port**: `5432` (internal Docker network port)
- **Network**: `powernova-network` (shared internal network)

## Database Management

### Start Database Only

```bash
cd docker
docker-compose up -d powernova-postgres
```

### Start All Services

```bash
cd docker
docker-compose up -d
```

### View Database Logs

```bash
docker logs -f powernova-postgres

# Or use debug script
./scripts/debug-database.sh
# Select option 11
```

### Run Migrations

```bash
# From your local machine (connects via Docker)
export DATABASE_URL="postgresql://powernova:powernova_dev_2024@localhost:5432/powernova"

# Wait, this won't work because database is not exposed!
# Instead, run migrations from within the API container:

docker exec powernova-api alembic upgrade head
```

### Backup Database

```bash
# Using debug script (easiest)
./scripts/debug-database.sh
# Select option 9

# Or manually
docker exec powernova-postgres pg_dump -U powernova -d powernova > backup.sql
```

### Restore Database

```bash
# Using debug script
./scripts/debug-database.sh
# Select option 10

# Or manually
cat backup.sql | docker exec -i powernova-postgres psql -U powernova -d powernova
```

## Why This Configuration?

### Security Benefits

1. **No External Exposure**: Database cannot be accessed from outside Docker network
2. **Reduced Attack Surface**: Only API service can connect to database
3. **Network Isolation**: Database traffic stays within Docker network
4. **Production-like**: Mirrors production setup where database is not publicly accessible

### Development Considerations

- **Debugging**: Use provided debug script or `docker exec` commands
- **Migrations**: Run from within API container
- **Database Tools**: Connect via Docker exec instead of native tools
- **Port Conflicts**: No conflicts with other PostgreSQL instances on host

## Troubleshooting

### "Connection Refused" from Host

**Problem**: Can't connect to `localhost:5432`

**Solution**: This is expected! Database is not exposed. Use:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova
```

### API Can't Connect to Database

**Problem**: API shows database connection errors

**Solutions**:
1. Check database is running:
   ```bash
   docker ps | grep powernova-postgres
   ```

2. Check network exists:
   ```bash
   docker network ls | grep powernova-network
   ```

3. Verify API is on same network:
   ```bash
   docker inspect powernova-api | grep NetworkMode
   ```

4. Check API environment variables:
   ```bash
   docker exec powernova-api env | grep DATABASE_URL
   ```

### Need to Use pgAdmin or Other GUI Tools

**Problem**: GUI database tools can't connect

**Solutions**:

1. **Temporarily expose database** (development only):
   ```yaml
   powernova-postgres:
     ports:
       - "5432:5432"  # Add this line temporarily
   ```
   Then restart: `docker-compose restart powernova-postgres`
   
   **Remember to remove this before committing!**

2. **Use web-based tools inside Docker**:
   Add pgAdmin to docker-compose.yml:
   ```yaml
   pgadmin:
     image: dpage/pgadmin4
     environment:
       PGADMIN_DEFAULT_EMAIL: admin@powernova.local
       PGADMIN_DEFAULT_PASSWORD: admin
     ports:
       - "5050:80"
     networks:
       - powernova-network
   ```

### Run Migrations from Host

**Problem**: Alembic can't connect to database

**Solution**: Run migrations from inside API container:
```bash
docker exec powernova-api alembic upgrade head
```

Or add a temporary port mapping (not recommended):
```bash
# Add port mapping temporarily
# Then run: alembic upgrade head
# Then remove port mapping
```

## Quick Reference

```bash
# Interactive debug menu
./scripts/debug-database.sh

# Open psql shell
docker exec -it powernova-postgres psql -U powernova -d powernova

# Run SQL query
docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT * FROM users;"

# List tables
docker exec powernova-postgres psql -U powernova -d powernova -c "\dt"

# Check connection
docker exec powernova-postgres pg_isready -U powernova -d powernova

# View logs
docker logs -f powernova-postgres

# Backup database
docker exec powernova-postgres pg_dump -U powernova -d powernova > backup.sql

# Restore database
cat backup.sql | docker exec -i powernova-postgres psql -U powernova -d powernova

# Run migrations
docker exec powernova-api alembic upgrade head

# Connect from API container
docker exec -it powernova-api psql -h powernova-postgres -U powernova -d powernova
```

## Production Notes

This local development setup mirrors production security:

- **Azure App Service**: API connects to managed PostgreSQL via private endpoint
- **Supabase**: API connects via connection pooler, database not publicly accessible
- **Network Isolation**: Same principle - database only accessible by API

The key difference is that in production, managed databases have additional features:
- Automated backups
- High availability
- Monitoring and alerts
- SSL/TLS encryption
- Advanced security features

But the core principle remains: **database should never be directly exposed to the internet**.
