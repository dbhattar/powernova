from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn
import os
from contextlib import asynccontextmanager

from app.core.config import settings
from app.routes import chat, documents, auth, substations
from app.models.database import create_tables

# Initialize security
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting FastAPI PowerNOVA Backend...")
    await create_tables()
    print("✅ Database tables created/verified")
    yield
    # Shutdown
    print("🛑 Shutting down FastAPI PowerNOVA Backend...")

app = FastAPI(
    title="PowerNOVA FastAPI Backend",
    description="Modern FastAPI backend for PowerNOVA with Firebase Auth integration",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat & Conversations"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(substations.router, prefix="/api/substations", tags=["Substations"])

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "PowerNOVA FastAPI Backend is running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),  # Use 8001 to avoid conflict with Django
        reload=True if settings.ENVIRONMENT == "development" else False,
        log_level="info"
    )
