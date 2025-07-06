# Migration Guide: Django to FastAPI

This guide helps you migrate from your Django backend to the new FastAPI backend.

## Overview

The FastAPI backend focuses on core infrastructure functionality:
- **Authentication**: Firebase Auth integration  
- **Substations**: Power system infrastructure management
- **Core APIs**: Health checks and system status

Note: Chat and document management remain in the React Native backend.

## Phase 1: Setup FastAPI (Parallel to Django)

### 1. Install and Test FastAPI Backend

```bash
cd fastapi-backend
pip install -r requirements.txt
python test_setup.py
```

### 2. Configure Database

Create a new PostgreSQL database for FastAPI:

```sql
CREATE DATABASE powernova_fastapi;
CREATE USER powernova_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE powernova_fastapi TO powernova_user;
```

Update `.env`:
```env
DATABASE_URL=postgresql://powernova_user:your_password@localhost:5432/powernova_fastapi
```

### 3. Setup Firebase Service Account

1. Copy your Firebase service account JSON file to the fastapi-backend directory
2. Update `.env` with the correct path:
   ```env
   FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
   ```

### 4. Start FastAPI Backend

```bash
python main.py
```

FastAPI will run on port 8001 (Django presumably on 8000).

## Phase 2: Update React Native App

### 1. Update Backend URL

In your React Native app's `App.js`, add a flag to switch between backends:

```javascript
// In App.js
const USE_FASTAPI = true; // Set to true to test FastAPI

function getBackendApiUrl() {
  if (__DEV__) {
    return USE_FASTAPI ? 'http://localhost:8001/api' : 'http://localhost:3002/api';
  }
  return Constants.expoConfig.extra.backendUrl || 'https://your-backend-url.com/api';
}
```

### 2. Test API Endpoints

Test these endpoints in your React Native app:

1. **Authentication**: Should work automatically with Firebase tokens
2. **Chat**: `/api/chat/message` and `/api/chat/history`
3. **Documents**: `/api/documents/upload` and `/api/documents/`
4. **Health Check**: `/health`

### 3. Monitor API Docs

Visit http://localhost:8001/docs to see all available endpoints and test them.

## Phase 3: Data Migration (Optional)

If you have important data in Django, migrate it:

### 1. Export Django Data

```bash
cd prototype-backend
python manage.py dumpdata core.CgUser > users.json
python manage.py dumpdata core.conversations > conversations.json
# etc.
```

### 2. Create Migration Script

```python
# migrate_data.py
import json
import asyncio
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, engine
from app.models.models import User, Conversation, Document

async def migrate_users():
    with open('users.json') as f:
        django_users = json.load(f)
    
    db = SessionLocal()
    for user_data in django_users:
        # Convert Django user to FastAPI user
        user = User(
            firebase_uid=user_data['fields']['firebase_uid'],
            email=user_data['fields']['email'],
            # ... other fields
        )
        db.add(user)
    
    db.commit()
    db.close()

# Run migration
if __name__ == "__main__":
    asyncio.run(migrate_users())
```

## Phase 4: Gradual Migration

### Week 1: Testing
- Run both Django and FastAPI backends
- Test all endpoints with React Native app
- Compare response formats and fix any differences

### Week 2: Switch Endpoints
- Use FastAPI for new features
- Keep Django for critical existing functionality
- Monitor performance and error rates

### Week 3: Full Migration
- Switch all endpoints to FastAPI
- Keep Django backend as backup
- Monitor for any issues

### Week 4: Cleanup
- Remove Django backend once confident
- Update deployment scripts
- Document the new architecture

## API Endpoint Mapping

| Django Endpoint | FastAPI Endpoint | Status |
|----------------|------------------|---------|
| `/api/v1/login/` | Use Firebase Auth directly | ✅ |
| `/api/v1/chat/` | `/api/chat/message` | ✅ |
| `/api/v1/chat/history/` | `/api/chat/history` | ✅ |
| `/api/v1/documents/` | `/api/documents/` | ✅ |
| `/api/v1/substations/` | `/api/substations/` | ✅ |

## Performance Comparison

Expected improvements with FastAPI:

- **Response Time**: 50-70% faster
- **Throughput**: 2-3x more requests/second
- **Memory Usage**: 20-30% less
- **Developer Experience**: Significantly better with auto-docs

## Rollback Plan

If issues arise:

1. **Immediate**: Switch `USE_FASTAPI` flag to `false` in React Native
2. **Database**: FastAPI uses separate database, Django data is safe
3. **Firebase**: No changes to Firebase Auth setup
4. **Monitoring**: Both backends can run simultaneously

## Troubleshooting

### Common Issues:

1. **Import Errors**: Run `pip install -r requirements.txt`
2. **Database Connection**: Check DATABASE_URL in .env
3. **Firebase Auth**: Verify service account JSON path
4. **Port Conflicts**: FastAPI uses 8001, Django uses 8000

### Debug Mode:

```python
# In main.py, enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with reload
uvicorn main:app --reload --log-level debug
```

### Testing Endpoints:

```bash
# Test health
curl http://localhost:8001/health

# Test with Firebase token
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     http://localhost:8001/api/auth/me
```

## Success Metrics

Migration is successful when:

- [ ] All React Native features work with FastAPI
- [ ] Response times are improved
- [ ] Error rates are equal or lower
- [ ] Firebase authentication works seamlessly
- [ ] File uploads work correctly
- [ ] Chat functionality is preserved

## Next Steps After Migration

1. **Add Advanced Features**:
   - Vector search for documents
   - Real-time chat with WebSockets
   - Advanced analytics endpoints

2. **Optimize Performance**:
   - Add Redis caching
   - Database query optimization
   - CDN for file uploads

3. **Enhanced Security**:
   - Rate limiting
   - Request validation
   - Security headers

The FastAPI backend provides a solid foundation for these enhancements!
