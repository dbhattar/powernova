from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.models.database import Base

class BaseModel(Base):
    """Base model with common fields"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(BaseModel):
    """User model - simplified since we're using Firebase Auth"""
    __tablename__ = "users"
    
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    documents = relationship("Document", back_populates="user")

class Document(BaseModel):
    """Document model"""
    __tablename__ = "documents"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String, nullable=False)
    upload_status = Column(String, default="completed")  # completed, processing, failed
    processed_content = Column(Text, nullable=True)  # Extracted text content
    
    # Relationships
    user = relationship("User", back_populates="documents")

class County(BaseModel):
    """County model from Django"""
    __tablename__ = "counties"
    
    name = Column(String(150), unique=True, nullable=False)
    country = Column(String(2), default="US")
    state = Column(String(2), default="CA")
    
    # Relationships
    substations = relationship("Substation", back_populates="county")

class Substation(BaseModel):
    """Substation model from Django"""
    __tablename__ = "substations"
    
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=True)
    voltage = Column(Float, nullable=True)  # Voltage (kV)
    county_id = Column(Integer, ForeignKey("counties.id"), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    study_region = Column(String(255), nullable=True)
    utility_area = Column(String(255), nullable=True)
    interconnecting_entity = Column(String(255), nullable=True)
    substation_type = Column(String(50), default="transmission")  # transmission, distribution
    
    # Relationships
    county = relationship("County", back_populates="substations")
