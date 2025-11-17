"""
User model for authentication and profile management
"""
from sqlalchemy import Column, String, Boolean, Integer
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """
    User model for storing user information
    
    Fields:
    - id: Primary key
    - email: User email (unique)
    - username: Display name
    - hashed_password: Bcrypt hashed password
    - is_active: Account active status
    - is_verified: Email verification status
    - is_superuser: Admin status
    - created_at: Account creation timestamp
    - updated_at: Last update timestamp
    
    Relationships:
    - conversations: User's chat conversations
    - artifacts: User's uploaded files/documents
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Status flags
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', username='{self.username}')>"
