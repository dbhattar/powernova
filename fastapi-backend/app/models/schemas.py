from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Base schemas
class BaseResponse(BaseModel):
    id: int
    uuid: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# User schemas
class UserCreate(BaseModel):
    firebase_uid: str
    email: EmailStr
    display_name: Optional[str] = None
    photo_url: Optional[str] = None

class UserResponse(BaseResponse):
    firebase_uid: str
    email: str
    display_name: Optional[str]
    photo_url: Optional[str]
    is_active: bool
    last_login: Optional[datetime]

# Document schemas
class DocumentResponse(BaseResponse):
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    upload_status: str
    user_id: int

class DocumentUploadResponse(BaseModel):
    message: str
    document_id: int
    filename: str
    file_size: int

# Substation schemas
class CountyResponse(BaseResponse):
    name: str
    country: str
    state: str

class SubstationCreate(BaseModel):
    name: str
    code: Optional[str] = None
    voltage: Optional[float] = None
    county_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    study_region: Optional[str] = None
    utility_area: Optional[str] = None
    interconnecting_entity: Optional[str] = None
    substation_type: Optional[str] = "transmission"

class SubstationResponse(BaseResponse):
    name: str
    code: Optional[str]
    voltage: Optional[float]
    county_id: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    study_region: Optional[str]
    utility_area: Optional[str]
    interconnecting_entity: Optional[str]
    substation_type: str
    county: Optional[CountyResponse] = None

# API Response schemas
class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    status_code: int
