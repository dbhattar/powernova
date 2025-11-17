# PostgreSQL Database - Quick Reference

## 🚀 Quick Start

### Start Database + Services
```bash
./scripts/start-database.sh
```

### Database Management Menu
```bash
./scripts/manage-database.sh
```

## 📦 What Was Added

### Files Created
```
api/
├── models/                      # Database models
│   ├── __init__.py
│   ├── base.py                  # Base model with timestamps
│   ├── user.py                  # User model
│   ├── conversation.py          # Conversation & Message models
│   └── artifact.py              # Artifact model
├── database/                    # Database configuration
│   ├── __init__.py
│   ├── session.py               # Connection & session management
│   └── crud.py                  # CRUD operations
├── alembic/                     # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py
├── alembic.ini                  # Alembic configuration
└── init-db.sql                  # PostgreSQL initialization

docker/
└── docker-compose.yml           # Updated with PostgreSQL service

scripts/
├── start-database.sh            # Quick start script
└── manage-database.sh           # Database management utility
```

## 🎯 Common Commands

### Access PostgreSQL CLI
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova_db
```

### Run Migrations
```bash
docker exec powernova-api alembic upgrade head
```

### Create New Migration
```bash
docker exec powernova-api alembic revision --autogenerate -m "Add new field"
```

### View Logs
```bash
# PostgreSQL logs
docker logs powernova-postgres

# API logs
docker logs powernova-api

# Follow logs
docker logs -f powernova-postgres
```

### Backup Database
```bash
docker exec powernova-postgres pg_dump -U powernova powernova_db > backup.sql
```

### Restore Database
```bash
docker exec -i powernova-postgres psql -U powernova powernova_db < backup.sql
```

## 📊 Database Schema

### Tables
- **users**: User authentication and profiles
- **conversations**: Chat sessions
- **messages**: Individual chat messages
- **artifacts**: Uploaded files and documents

### Relationships
```
users (1) ──→ (many) conversations
conversations (1) ──→ (many) messages
users (1) ──→ (many) artifacts
```

## 🔧 Configuration

### Local Development
- **Host**: localhost
- **Port**: 5432
- **Database**: powernova_db
- **Username**: powernova
- **Password**: powernova_dev_2024
- **Connection**: `postgresql://powernova:powernova_dev_2024@localhost:5432/powernova_db`

### Environment Variable
```bash
# In api/.env
DATABASE_URL=postgresql://powernova:powernova_dev_2024@powernova-postgres:5432/powernova_db
```

## 💡 Usage Examples

### Create User
```python
from database import get_db
from database.crud import create_user

db = next(get_db())
user = create_user(
    db=db,
    email="user@example.com",
    username="John Doe",
    hashed_password="hashed_password"
)
```

### Create Conversation
```python
from database.crud import create_conversation, create_message
from models.conversation import MessageRole

# Create conversation
conversation = create_conversation(
    db=db,
    user_id=user.id,
    title="Discussion about CAISO"
)

# Add message
message = create_message(
    db=db,
    conversation_id=conversation.id,
    role=MessageRole.USER,
    content="What is CAISO?",
    token_count=5
)
```

### Query Messages
```python
from database.crud import get_conversation_messages

messages = get_conversation_messages(db, conversation_id=1)
for msg in messages:
    print(f"{msg.role}: {msg.content}")
```

## 🔍 Useful SQL Queries

### Count Users
```sql
SELECT COUNT(*) FROM users;
```

### Recent Conversations
```sql
SELECT 
    c.id,
    c.title,
    u.email,
    COUNT(m.id) as message_count,
    c.updated_at
FROM conversations c
JOIN users u ON c.user_id = u.id
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, u.email
ORDER BY c.updated_at DESC
LIMIT 10;
```

### User Activity
```sql
SELECT 
    u.email,
    COUNT(DISTINCT c.id) as conversations,
    COUNT(m.id) as messages,
    MAX(m.created_at) as last_activity
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY u.id, u.email
ORDER BY last_activity DESC;
```

### Storage Usage
```sql
SELECT 
    u.email,
    COUNT(a.id) as file_count,
    pg_size_pretty(SUM(a.file_size)) as total_size
FROM users u
LEFT JOIN artifacts a ON a.user_id = u.id
GROUP BY u.id, u.email
ORDER BY SUM(a.file_size) DESC;
```

## 🚨 Troubleshooting

### Connection Failed
```bash
# Check if container is running
docker ps | grep postgres

# Check logs
docker logs powernova-postgres

# Restart container
docker-compose restart powernova-postgres
```

### Migrations Failed
```bash
# Check current version
docker exec powernova-api alembic current

# View migration history
docker exec powernova-api alembic history

# Downgrade and retry
docker exec powernova-api alembic downgrade -1
docker exec powernova-api alembic upgrade head
```

### Port Already in Use
```bash
# Find process using port 5432
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 on host
```

## 📚 Next Steps

1. **Integrate with Chat Routes**: Save conversations and messages
2. **Add Authentication**: Implement user login/register endpoints
3. **File Upload**: Add artifact upload functionality
4. **RAG Integration**: Use pgvector for embeddings
5. **Analytics**: Build usage dashboards

## 🔐 Production Checklist

- [ ] Change default password
- [ ] Use Azure Database for PostgreSQL
- [ ] Enable SSL connections
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Use Azure Key Vault for secrets
- [ ] Monitor database metrics
- [ ] Set up alerting
- [ ] Test backup/restore procedures

## 📖 Documentation

- Full Setup Guide: `DATABASE-SETUP.md`
- Models Documentation: `api/models/`
- CRUD Operations: `api/database/crud.py`
- Migrations: `api/alembic/versions/`

---

**Quick Links:**
- Local API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health
- Chat App: http://localhost:8081
