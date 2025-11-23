# Chat Authentication Fix - November 22, 2025

## Problem

The `/api/chat/stream` endpoint was returning **401 Unauthorized** errors even for anonymous users, making the chat interface unusable without logging in.

### Error Message
```
Failed to load resource: the server responded with a status of 401 ()
Error calling API: Error: API error: 401
```

### Root Cause

In `api/routes/chat.py`, the endpoint was using:
```python
from services.auth import get_current_user

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)  # ❌ Not actually optional!
):
```

The issue: `get_current_user` uses `OAuth2PasswordBearer(tokenUrl="/api/auth/login")` which **requires** authentication. Setting the type as `Optional[User]` doesn't make it truly optional - it still raises a 401 error if no token is provided.

## Solution

### 1. Created Optional Authentication Function

Added `get_current_user_optional` to `api/services/auth.py`:

```python
# Optional OAuth2 scheme (doesn't raise 401 if token is missing)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get the current authenticated user from JWT token (optional)
    
    This version doesn't raise 401 if no token is provided.
    Returns None if no token or invalid token.
    """
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        
        if user_id_raw is None:
            return None
        
        # Handle both string and integer formats
        try:
            if isinstance(user_id_raw, int):
                user_id = user_id_raw
            else:
                user_id = int(user_id_raw)
        except (ValueError, TypeError):
            return None
            
    except JWTError:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        return None
    
    return user
```

**Key difference**: Uses `auto_error=False` which prevents raising HTTPException when token is missing.

### 2. Updated Chat Endpoint

Modified `api/routes/chat.py`:

```python
from services.auth import get_current_user_optional  # Changed import

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)  # ✅ Now truly optional!
):
    """
    Stream chat completion from OpenAI with optional RAG
    
    Authentication is OPTIONAL - the endpoint works for both authenticated and anonymous users.
    
    If conversation_id is provided and user is authenticated, saves messages to the database.
    """
```

## How It Works Now

### Anonymous Users (No Token)
- `current_user` = `None`
- Chat works normally
- RAG searches only platform documents
- Messages are NOT saved to database
- No conversation management

### Authenticated Users (Valid Token)
- `current_user` = `User` object
- Chat works normally
- RAG searches platform + user library + conversation documents
- Messages saved to database if `conversation_id` provided
- Full conversation management features

### Invalid Token
- `current_user` = `None` (gracefully degrades to anonymous mode)
- No error thrown
- Works like anonymous user

## Testing

### Test Anonymous Access
```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o-mini",
    "use_rag": false,
    "stream": true
  }'
```

**Expected**: Successful response with streaming content ✅

### Test Authenticated Access
```bash
# First get a token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=password" | jq -r .access_token)

# Use token in chat request
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "conversation_id": 1,
    "model": "gpt-4o-mini",
    "use_rag": true,
    "stream": true
  }'
```

**Expected**: Successful response with streaming content + messages saved to database ✅

## Files Modified

1. ✅ `api/services/auth.py` - Added `oauth2_scheme_optional` and `get_current_user_optional()`
2. ✅ `api/routes/chat.py` - Changed import and dependency to use optional auth

## Deployment

### Local
```bash
docker restart powernova-api
```

### Azure Production
```bash
./scripts/azure-deploy-api.sh --update
```

## Related Issues

This fix also addresses:
- Anonymous users can now use the chat interface
- Demo/trial users don't need to create accounts
- Graceful degradation when token is invalid or expired
- Better user experience for first-time visitors

## Benefits

1. **Lower barrier to entry** - Users can try chat without signing up
2. **Better UX** - No sudden 401 errors breaking the chat
3. **Graceful degradation** - Invalid tokens don't break the app
4. **Feature parity** - Authenticated users still get all features (conversation history, user documents, etc.)

## Future Enhancements

Consider rate limiting for anonymous users:
- Max 10 requests per IP per hour for anonymous
- Unlimited for authenticated users
- Implement using middleware or Redis

```python
# Example rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/chat/stream")
@limiter.limit("10/hour")  # Only applies if current_user is None
async def chat_stream(...):
    if not current_user:
        # Apply rate limit for anonymous
        pass
```

---

**Status**: ✅ Fixed and deployed locally  
**Production**: Pending deployment to Azure  
**Verified**: Working with both anonymous and authenticated users
