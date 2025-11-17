# PowerNOVA PostgreSQL Database Setup

## Overview
PostgreSQL has been set up as a sidecar container for the PowerNOVA API to store:
- **User information** (authentication, profiles)
- **Conversations** (chat sessions and history)
- **Messages** (individual chat messages with metadata)
- **Artifacts** (uploaded documents and files)

## Architecture

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) DEFAULT 'New Conversation',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Messages Table
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role ENUM('USER', 'ASSISTANT', 'SYSTEM'),
    content TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Artifacts Table
```sql
CREATE TABLE artifacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_type ENUM('PDF', 'DOCX', 'TXT', 'CSV', 'XLSX', 'IMAGE', 'OTHER'),
    file_size BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Local Development Setup

### 1. Start the Services
```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/docker
docker-compose up -d
```

This will start:
- **powernova-postgres**: PostgreSQL 16 on port 5432
- **powernova-api**: API server with database connection
- **powernova-web**: Landing page
- **powernova-chat**: Chat interface

### 2. Verify Database Connection
```bash
# Check PostgreSQL logs
docker logs powernova-postgres

# Check API logs for database connection
docker logs powernova-api
```

You should see:
```
✓ Database connection successful
```

### 3. Access PostgreSQL Directly
```bash
# Using docker exec
docker exec -it powernova-postgres psql -U powernova -d powernova_db

# Or using psql from host (if installed)
psql -h localhost -p 5432 -U powernova -d powernova_db
# Password: powernova_dev_2024
```

### 4. Run Database Migrations
```bash
# Enter the API container
docker exec -it powernova-api bash

# Run migrations
alembic upgrade head

# Check migration status
alembic current

# View migration history
alembic history
```

## Database Models

### User Model (`api/models/user.py`)
```python
from database.crud import create_user, get_user_by_email

# Create a user
user = create_user(
    db=db,
    email="user@example.com",
    username="John Doe",
    hashed_password="hashed_password_here"
)
```

### Conversation Model (`api/models/conversation.py`)
```python
from database.crud import create_conversation, create_message
from models.conversation import MessageRole

# Create a conversation
conversation = create_conversation(
    db=db,
    user_id=user.id,
    title="Chat about CAISO"
)

# Add messages
message = create_message(
    db=db,
    conversation_id=conversation.id,
    role=MessageRole.USER,
    content="What is CAISO?",
    token_count=5
)
```

### Artifact Model (`api/models/artifact.py`)
```python
from database.crud import create_artifact
from models.artifact import ArtifactType

# Create an artifact
artifact = create_artifact(
    db=db,
    user_id=user.id,
    filename="document.pdf",
    file_type=ArtifactType.PDF,
    file_size=1024000,
    storage_path="/uploads/user123/document.pdf"
)
```

## Using the Database in Routes

### Example: Save Chat Messages
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from database.crud import create_message, get_conversation
from models.conversation import MessageRole

router = APIRouter()

@router.post("/chat")
async def chat(
    user_message: str,
    conversation_id: int,
    db: Session = Depends(get_db)
):
    # Save user message
    create_message(
        db=db,
        conversation_id=conversation_id,
        role=MessageRole.USER,
        content=user_message
    )
    
    # Get AI response (existing logic)
    ai_response = await get_ai_response(user_message)
    
    # Save AI response
    create_message(
        db=db,
        conversation_id=conversation_id,
        role=MessageRole.ASSISTANT,
        content=ai_response,
        model="gpt-4o-mini"
    )
    
    return {"response": ai_response}
```

## Database Operations (CRUD)

All CRUD operations are in `api/database/crud.py`:

### User Operations
- `get_user_by_id(db, user_id)`
- `get_user_by_email(db, email)`
- `create_user(db, email, username, hashed_password)`
- `get_users(db, skip=0, limit=100)`

### Conversation Operations
- `create_conversation(db, user_id, title)`
- `get_conversation(db, conversation_id)`
- `get_user_conversations(db, user_id, skip=0, limit=50)`
- `update_conversation_title(db, conversation_id, title)`
- `delete_conversation(db, conversation_id)`

### Message Operations
- `create_message(db, conversation_id, role, content, token_count, model)`
- `get_conversation_messages(db, conversation_id)`
- `get_recent_messages(db, conversation_id, limit=10)`

### Artifact Operations
- `create_artifact(db, user_id, filename, file_type, file_size, storage_path)`
- `get_artifact(db, artifact_id)`
- `get_user_artifacts(db, user_id, skip=0, limit=100)`
- `update_artifact_status(db, artifact_id, status)`
- `delete_artifact(db, artifact_id)`

## Migrations

### Create a New Migration
```bash
# After modifying models
docker exec -it powernova-api alembic revision --autogenerate -m "Add new field to user"

# Apply migration
docker exec -it powernova-api alembic upgrade head
```

### Rollback Migration
```bash
# Rollback one migration
docker exec -it powernova-api alembic downgrade -1

# Rollback to specific revision
docker exec -it powernova-api alembic downgrade <revision_id>
```

### View Migration SQL (without applying)
```bash
docker exec -it powernova-api alembic upgrade head --sql
```

## Environment Variables

### Local Development (`.env`)
```bash
DATABASE_URL=postgresql://powernova:powernova_dev_2024@powernova-postgres:5432/powernova_db
```

### Production (Azure)
For Azure deployment, use Azure Database for PostgreSQL:

```bash
# Example Azure PostgreSQL connection
DATABASE_URL=postgresql://adminuser@myserver:password@myserver.postgres.database.azure.com:5432/powernova_db?sslmode=require
```

**Azure Setup:**
1. Create Azure Database for PostgreSQL Flexible Server
2. Configure firewall to allow Azure App Service
3. Enable SSL connections
4. Set `DATABASE_URL` in App Service Configuration

## Database Backups

### Local Backup
```bash
# Backup database
docker exec powernova-postgres pg_dump -U powernova powernova_db > backup.sql

# Restore database
docker exec -i powernova-postgres psql -U powernova powernova_db < backup.sql
```

### Production Backup (Azure)
```bash
# Using pg_dump with Azure
pg_dump -h myserver.postgres.database.azure.com -U adminuser@myserver -d powernova_db > backup.sql

# Or use Azure automated backups (recommended)
# Configure in Azure Portal: Database > Backup and Restore
```

## Troubleshooting

### Connection Issues

**Problem**: `FATAL: password authentication failed`
```bash
# Check environment variable
docker exec powernova-api env | grep DATABASE_URL

# Verify PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs powernova-postgres
```

**Problem**: `could not connect to server`
```bash
# Ensure containers are on same network
docker network inspect powernova-network

# Check if postgres container is healthy
docker ps --filter "name=powernova-postgres"
```

### Migration Issues

**Problem**: `Target database is not up to date`
```bash
# Check current revision
docker exec -it powernova-api alembic current

# Upgrade to latest
docker exec -it powernova-api alembic upgrade head
```

**Problem**: `Can't locate revision identified by 'xyz'`
```bash
# This means migration files are out of sync
# Reset migrations (CAUTION: drops all data)
docker exec -it powernova-api alembic downgrade base
docker exec -it powernova-api alembic upgrade head
```

### Performance Issues

**Problem**: Slow queries
```bash
# Enable query logging
docker exec -it powernova-postgres psql -U powernova -d powernova_db

# In psql:
ALTER DATABASE powernova_db SET log_min_duration_statement = 1000;  -- Log queries > 1s

# Check slow queries in logs
docker logs powernova-postgres | grep duration
```

**Problem**: Too many connections
```bash
# Check current connections
docker exec -it powernova-postgres psql -U powernova -d powernova_db -c "SELECT count(*) FROM pg_stat_activity;"

# Adjust pool size in api/database/session.py
# pool_size=5, max_overflow=10
```

## Data Persistence

### Volume Location
The PostgreSQL data is stored in a Docker volume:
```bash
# List volumes
docker volume ls | grep powernova

# Inspect volume
docker volume inspect powernova_postgres_data

# Location (usually):
# /var/lib/docker/volumes/powernova_postgres_data/_data
```

### Removing Data (CAUTION)
```bash
# Stop services
docker-compose down

# Remove volume (deletes ALL data)
docker volume rm powernova_postgres_data

# Start fresh
docker-compose up -d
```

## Security Best Practices

### Production Checklist
- [ ] Use strong passwords (not `powernova_dev_2024`)
- [ ] Enable SSL connections (`sslmode=require`)
- [ ] Use Azure Key Vault for DATABASE_URL
- [ ] Restrict database firewall rules
- [ ] Enable Azure AD authentication
- [ ] Set up automated backups
- [ ] Monitor database metrics
- [ ] Use connection pooling (already configured)
- [ ] Implement rate limiting on API endpoints
- [ ] Encrypt sensitive data at rest

### Password Hashing
The User model stores `hashed_password`. Use bcrypt:
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password
hashed = pwd_context.hash("user_password")

# Verify password
is_valid = pwd_context.verify("user_password", hashed)
```

## Monitoring

### Database Metrics
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size('powernova_db'));

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Application Metrics
Add to `main.py`:
```python
from prometheus_client import Counter, Histogram

db_query_duration = Histogram('db_query_duration_seconds', 'Database query duration')
db_errors = Counter('db_errors_total', 'Total database errors')
```

## Next Steps

### Immediate Integration
1. **Update chat route** to save conversations and messages
2. **Add authentication** routes (login, register)
3. **Implement user sessions** with JWT tokens
4. **Add artifact upload** endpoint

### Future Enhancements
1. **Full-text search** on messages for conversation search
2. **Vector embeddings** for RAG (using pgvector extension)
3. **Caching layer** with Redis for frequent queries
4. **Analytics** dashboard for user insights
5. **Multi-tenancy** support for organizations

## Resources

- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **Alembic Docs**: https://alembic.sqlalchemy.org/
- **FastAPI + Databases**: https://fastapi.tiangolo.com/tutorial/sql-databases/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/16/

## Summary

✅ **Completed Setup:**
- PostgreSQL 16 sidecar container
- SQLAlchemy models (User, Conversation, Message, Artifact)
- Database connection with pooling
- Alembic migrations configured
- CRUD operations for all models
- Docker Compose networking
- Health checks and monitoring

✅ **Ready for:**
- User authentication implementation
- Conversation history storage
- File upload and artifact management
- RAG integration with vector embeddings

The database is now fully set up and ready to use! 🚀
