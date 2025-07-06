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
    # Note: Document management is handled by React Native backend

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

class TransmissionLine(BaseModel):
    """Transmission Line model from Django"""
    __tablename__ = "transmission_lines"
    
    name = Column(String(150), nullable=False)
    voltage = Column(Float, nullable=False)  # Voltage (kV)
    utility_area = Column(String(255), nullable=True)
    circuit = Column(String(50), nullable=True)
    line_type = Column(String(50), nullable=True)
    # Note: geo_coordinates stored as separate lat/lng columns for simplicity
    # In production, you might want to use PostGIS for proper LineString support

class AverageLMP(BaseModel):
    """Average LMP model from Django"""
    __tablename__ = "average_lmp"
    
    substation_id = Column(Integer, ForeignKey("substations.id"), nullable=False)
    lmp_type = Column(String(50), default="forecast")  # forecast, actual
    energy = Column(Float, nullable=True)  # Energy LMP ($/MWh)
    congestion = Column(Float, nullable=True)  # Congestion LMP ($/MWh)
    loss = Column(Float, nullable=True)  # Loss LMP ($/MWh)
    total_lmp = Column(Float, nullable=True)  # LMP ($/MWh)
    opening_price = Column(Float, nullable=True)  # Opening Price ($/MWh)
    closing_price = Column(Float, nullable=True)  # Closing Price ($/MWh)
    time = Column(DateTime, nullable=True)  # Time of the LMP data
    
    # Relationships
    substation = relationship("Substation")
