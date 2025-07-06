from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.models import User
from app.models.schemas import UserResponse, UserCreate
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser
from datetime import datetime

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    
    # Check if user exists in our database
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    
    if not user:
        # Create user if doesn't exist
        user = User(
            firebase_uid=firebase_user.uid,
            email=firebase_user.email,
            display_name=firebase_user.name,
            photo_url=firebase_user.picture,
            last_login=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update last login
        user.last_login = datetime.utcnow()
        if firebase_user.name and user.display_name != firebase_user.name:
            user.display_name = firebase_user.name
        if firebase_user.picture and user.photo_url != firebase_user.picture:
            user.photo_url = firebase_user.picture
        db.commit()
        db.refresh(user)
    
    return user

@router.post("/register", response_model=UserResponse)
async def register_user(
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Register a new user (same as get_current_user, but explicit)"""
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if existing_user:
        return existing_user
    
    # Create new user
    user = User(
        firebase_uid=firebase_user.uid,
        email=firebase_user.email,
        display_name=firebase_user.name,
        photo_url=firebase_user.picture,
        last_login=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get user profile"""
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

@router.delete("/account")
async def delete_user_account(
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Delete user account and all associated data"""
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user (cascading will handle related records)
    db.delete(user)
    db.commit()
    
    return {"message": "Account deleted successfully"}
