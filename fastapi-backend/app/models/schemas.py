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

# Transmission Line schemas
class TransmissionLineCreate(BaseModel):
    name: str
    voltage: float
    utility_area: Optional[str] = None
    circuit: Optional[str] = None
    line_type: Optional[str] = None

class TransmissionLineResponse(BaseResponse):
    name: str
    voltage: float
    utility_area: Optional[str]
    circuit: Optional[str]
    line_type: Optional[str]

# Average LMP schemas
class AverageLMPCreate(BaseModel):
    substation_id: int
    lmp_type: Optional[str] = "forecast"
    energy: Optional[float] = None
    congestion: Optional[float] = None
    loss: Optional[float] = None
    total_lmp: Optional[float] = None
    opening_price: Optional[float] = None
    closing_price: Optional[float] = None
    time: Optional[datetime] = None

class AverageLMPResponse(BaseResponse):
    substation_id: int
    lmp_type: str
    energy: Optional[float]
    congestion: Optional[float]
    loss: Optional[float]
    total_lmp: Optional[float]
    opening_price: Optional[float]
    closing_price: Optional[float]
    time: Optional[datetime]
    # Note: substation relationship loaded separately to avoid circular imports

# API Response schemas
class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    status_code: int

# Substation comparison schemas
class SubstationCompareResponse(BaseModel):
    data: List[SubstationResponse]

class SubstationMappingsResponse(BaseModel):
    data: dict
