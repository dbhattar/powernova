"""
User authentication routes
Handles login, logout, password changes, and user profile
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta

from database.session import get_db
from models import User
from services.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["authentication"])


# Pydantic models for request/response validation
class Token(BaseModel):
    """Token response model"""
    access_token: str
    token_type: str
    must_change_password: bool
    user: dict


class UserResponse(BaseModel):
    """User response model"""
    id: int
    email: str
    username: str
    is_active: bool
    is_verified: bool
    is_superuser: bool
    must_change_password: bool
    
    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    """Password change request model"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)


class PasswordChangeResponse(BaseModel):
    """Password change response model"""
    message: str
    access_token: str
    token_type: str


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    User login endpoint
    
    Authenticates user with email/username and password.
    Returns JWT token and user information.
    
    Note: OAuth2PasswordRequestForm uses 'username' field, but we accept email
    """
    # Try to authenticate with email
    user = authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_superuser": user.is_superuser,
            "must_change_password": user.must_change_password
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile
    
    Returns the authenticated user's information
    """
    return current_user


@router.post("/change-password", response_model=PasswordChangeResponse)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user password
    
    Allows users to change their password. 
    Also clears the must_change_password flag for first-time users.
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password is different
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password and clear must_change_password flag
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    db.commit()
    
    # Generate new token with updated must_change_password status
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.id, "email": current_user.email},
        expires_delta=access_token_expires
    )
    
    return {
        "message": "Password changed successfully",
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout():
    """
    User logout endpoint
    
    Note: Since we're using stateless JWT tokens, logout is handled client-side
    by removing the token from storage. This endpoint is here for consistency.
    """
    return {"message": "Logged out successfully"}
