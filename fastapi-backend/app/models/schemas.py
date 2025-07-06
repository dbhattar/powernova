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

# Conversation schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ConversationResponse(BaseResponse):
    title: str
    thread_id: str
    user_id: int

class ConversationWithMessages(ConversationResponse):
    messages: List["MessageResponse"] = []

# Message schemas
class MessageCreate(BaseModel):
    content: str
    message_type: Optional[str] = "text"
    audio_uri: Optional[str] = None

class MessageResponse(BaseResponse):
    conversation_id: int
    content: str
    response: Optional[str]
    message_type: str
    audio_uri: Optional[str]
    is_from_user: bool

# Chat schemas
class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    is_follow_up: Optional[bool] = False

class ChatResponse(BaseModel):
    response: str
    thread_id: str
    message_id: int
    conversation_id: int

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

# Update forward references
ConversationWithMessages.model_rebuild()
