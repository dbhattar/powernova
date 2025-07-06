import firebase_admin
from firebase_admin import auth, credentials
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from typing import Optional
from app.core.config import settings

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK if not already initialized"""
    if not firebase_admin._apps:
        try:
            # Try to use service account file
            if os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            else:
                # Use default credentials (for deployed environments)
                firebase_admin.initialize_app()
            print("✅ Firebase Admin SDK initialized")
        except Exception as e:
            print(f"❌ Failed to initialize Firebase: {e}")
            # For development, you might want to continue without Firebase
            pass

# Initialize Firebase on import
initialize_firebase()

# Security scheme
security = HTTPBearer()

class FirebaseUser:
    """Firebase user model"""
    def __init__(self, uid: str, email: str, name: Optional[str] = None, picture: Optional[str] = None):
        self.uid = uid
        self.email = email
        self.name = name
        self.picture = picture

async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> FirebaseUser:
    """
    Verify Firebase ID token and return user information
    """
    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(credentials.credentials)
        
        # Extract user information
        uid = decoded_token.get('uid')
        email = decoded_token.get('email')
        name = decoded_token.get('name')
        picture = decoded_token.get('picture')
        
        if not uid or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user information"
            )
        
        return FirebaseUser(uid=uid, email=email, name=name, picture=picture)
        
    except firebase_admin.auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except firebase_admin.auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired"
        )
    except Exception as e:
        print(f"Firebase auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

# Optional authentication (for endpoints that work with or without auth)
async def optional_firebase_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[FirebaseUser]:
    """
    Optional Firebase authentication - returns None if no token provided
    """
    if not credentials:
        return None
    
    try:
        return await verify_firebase_token(credentials)
    except HTTPException:
        return None
