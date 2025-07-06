from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/powernova_fastapi"
    
    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "path/to/firebase-service-account.json"
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "PowerNOVA FastAPI"
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:8081"]
    
    # Redis (for caching)
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    
    # OpenAI (if using for AI features)
    OPENAI_API_KEY: Optional[str] = None
    
    # Pinecone (for vector search)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()
