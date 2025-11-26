# Using Docker for pg_dump - Version Compatibility Guide

## Problem

When your local `pg_dump` version is older than the PostgreSQL server version, you'll see errors like:

```
pg_dump: error: server version: 17.4; pg_dump version: 14.18 (Homebrew)
pg_dump: error: aborting because of server version mismatch
```

**Rule**: Your `pg_dump` version should be **equal to or newer** than the database server version.

## Solutions

### ✅ Solution 1: Use Docker (Recommended)

This is the **easiest and most reliable** solution - no need to upgrade your local PostgreSQL!

#### Quick Start

Just add the `--use-docker` flag to the dump script:

```bash
./dump-supabase-database.sh --use-docker -c
```

That's it! The script will automatically:
- Pull the PostgreSQL 17 Docker image (if not already present)
- Run `pg_dump` inside the container with the correct version
- Save the output to your local filesystem

#### Manual Docker Command

If you want to run the Docker command directly:

```bash
# Set your database credentials
export DB_HOST="aws-0-us-east-1.pooler.supabase.com"
export DB_PORT="6543"
export DB_NAME="postgres"
export DB_USER="postgres.your-project-ref"
export DB_PASSWORD="your-password"

# Run pg_dump in Docker
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  postgres:17 \
  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > supabase-backup.sql

# Or with compression
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  postgres:17 \
  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > supabase-backup.sql.gz
```

#### Advantages of Docker Method

✅ **No local installation needed** - Just need Docker  
✅ **Always use correct version** - Matches server exactly  
✅ **No version conflicts** - Isolated from your system PostgreSQL  
✅ **Works on any OS** - macOS, Linux, Windows  
✅ **No cleanup needed** - Container is removed after dump  

---

### 🔧 Solution 2: Upgrade Local PostgreSQL (Alternative)

If you prefer to use local tools, upgrade your PostgreSQL client:

#### macOS (Homebrew)

```bash
# Uninstall old version
brew uninstall postgresql

# Install PostgreSQL 17
brew install postgresql@17

# Link it
brew link postgresql@17 --force

# Verify version
pg_dump --version
# Should show: pg_dump (PostgreSQL) 17.x
```

#### Ubuntu/Debian

```bash
# Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update and install
sudo apt-get update
sudo apt-get install postgresql-client-17

# Verify version
pg_dump --version
```

#### After Upgrading

Then use the regular dump command:

```bash
./dump-supabase-database.sh -c
```

---

## Comparison

| Method | Pros | Cons |
|--------|------|------|
| **Docker** | ✅ Easy<br>✅ Always correct version<br>✅ No system changes | ⚠️ Requires Docker |
| **Upgrade Local** | ✅ Faster (no container overhead)<br>✅ Works offline | ⚠️ May conflict with other tools<br>⚠️ OS-specific steps |

## Troubleshooting

### Docker: "Cannot connect to the Docker daemon"

**Problem**: Docker is not running

**Solution**:
```bash
# macOS: Start Docker Desktop application
open -a Docker

# Linux: Start Docker service
sudo systemctl start docker
```

### Docker: "Unable to find image 'postgres:17'"

**Problem**: First time running, needs to download image (~100MB)

**Solution**: Just wait - it will download automatically. You'll see:
```
Unable to find image 'postgres:17' locally
17: Pulling from library/postgres
...
```

### Local: "command not found: pg_dump"

**Problem**: PostgreSQL client tools not installed

**Solution**: Use Docker method instead:
```bash
./dump-supabase-database.sh --use-docker -c
```

### Version Mismatch Persists After Upgrade

**Problem**: Multiple PostgreSQL versions installed

**Solution**: Check which `pg_dump` is being used:
```bash
which pg_dump
# Should point to the new version

# If not, update PATH or use full path:
/opt/homebrew/opt/postgresql@17/bin/pg_dump --version
```

## Recommended Workflow

For **migration from Supabase to Azure**, we recommend:

```bash
# 1. Use Docker for maximum compatibility
./dump-supabase-database.sh --use-docker -c

# 2. Verify the dump was created
ls -lh supabase-backup-*.sql.gz

# 3. Test the dump integrity
gzip -t supabase-backup-*.sql.gz

# 4. Proceed with restoration
./restore-to-azure.sh --use-docker -i supabase-backup-*.sql.gz
```

## See Also

- [Supabase Database Dump Script](dump-supabase-database.sh)
- [Azure Database Restore Script](restore-to-azure.sh)
- [Migration Scripts README](MIGRATION-SCRIPTS-README.md)
- [Docker PostgreSQL Documentation](https://hub.docker.com/_/postgres)
