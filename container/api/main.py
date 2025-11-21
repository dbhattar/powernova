"""
PowerNOVA API - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from routes import chat, admin
from database.session import check_db_connection

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup
    print("=" * 50)
    print("Starting PowerNOVA API...")
    
    # Check database connection
    print("Checking database connection...")
    if check_db_connection():
        print("✓ Database connection successful")
    else:
        print("✗ WARNING: Database connection failed!")
        print("  API will start but database features will not work.")
    
    print("=" * 50)
    
    yield
    
    # Shutdown
    print("Shutting down PowerNOVA API...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PowerNOVA API",
    description="Backend API for PowerNOVA chat interface with RAG capabilities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add middleware to handle OPTIONS requests before dependencies
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class OptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS":
            return Response(status_code=200, headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600",
            })
        return await call_next(request)

app.add_middleware(OptionsMiddleware)

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.include_router(admin.router, prefix="/api", tags=["Admin"])

# Import and include RAG router
from routes import rag
app.include_router(rag.router, prefix="/api", tags=["RAG"])

# Import and include auth router
from routes import auth
app.include_router(auth.router, prefix="/api", tags=["Authentication"])

# Import and include conversations router
from routes import conversations
app.include_router(conversations.router, prefix="/api", tags=["Conversations"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint for Azure App Service
    Includes database connection status
    """
    db_healthy = check_db_connection()
    
    return JSONResponse(
        content={
            "status": "healthy" if db_healthy else "degraded",
            "service": "powernova-api",
            "version": "1.0.0",
            "database": "connected" if db_healthy else "disconnected"
        },
        status_code=200 if db_healthy else 503
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
