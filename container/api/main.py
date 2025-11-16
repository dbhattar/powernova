"""
PowerNOVA API - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from routes import chat

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="PowerNOVA API",
    description="Backend API for PowerNOVA chat interface with RAG capabilities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
# Allow requests from frontend domains
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",                      # Production chat app (custom domain)
    "https://www.powernova.ai",                      # Production landing page
    "https://powernova-chat-app.azurewebsites.net",  # Production chat app (Azure default domain)
    "http://localhost:8081",                          # Local chat app
    "http://localhost:8080",                          # Local landing page
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Log allowed origins for debugging
print("=" * 50)
print("CORS Configuration:")
print("Allowed Origins:")
for origin in ALLOWED_ORIGINS:
    print(f"  - {origin}")
print("=" * 50)

# Include routers
app.include_router(chat.router, prefix="/api", tags=["Chat"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint for Azure App Service
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "powernova-api",
            "version": "1.0.0"
        }
    )

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint - API information
    """
    return JSONResponse(
        content={
            "message": "PowerNOVA API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health"
        }
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True  # Enable auto-reload in development
    )
