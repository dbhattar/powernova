"""
PowerNOVA API - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from routes import chat, admin
from database.session import check_db_connection

# Setup logging
logger = logging.getLogger(__name__)

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
        
        # Check if in maintenance mode
        maintenance_mode = os.getenv("MAINTENANCE_MODE", "false").lower() in ["true", "1", "yes"]
        
        if maintenance_mode:
            print("⚠ Maintenance mode enabled - skipping background task auto-resume")
            print("  Background crawl jobs will NOT be started automatically")
            print("  Document job processor will NOT be started automatically")
        else:
            # Auto-resume interrupted crawl jobs
            try:
                from database.session import SessionLocal
                from models import CrawlJob, CrawlStatus
                from services.crawler import run_crawler
                import threading
                
                db = SessionLocal()
                try:
                    # Find jobs that were running or failed (can be restarted)
                    interrupted_jobs = db.query(CrawlJob).filter(
                        CrawlJob.status.in_([CrawlStatus.RUNNING, CrawlStatus.FAILED])
                    ).all()
                    
                    if interrupted_jobs:
                        print(f"Found {len(interrupted_jobs)} interrupted crawl job(s), auto-resuming...")
                        for job in interrupted_jobs:
                            print(f"  → Resuming crawl job #{job.id}: {job.start_url} (was {job.status.value})")
                            # Reset status to RUNNING (will be updated by crawler)
                            job.status = CrawlStatus.RUNNING
                            job.error_message = None
                            db.commit()
                            
                            # Start crawler in background thread
                            thread = threading.Thread(target=run_crawler, args=(job.id,), daemon=True)
                            thread.start()
                        print("✓ Auto-resume initiated for interrupted crawl jobs")
                    else:
                        print("✓ No interrupted crawl jobs to resume")
                finally:
                    db.close()
            except Exception as e:
                print(f"✗ Warning: Failed to auto-resume crawl jobs: {e}")
            
            # Start document job processor in background
            try:
                from database.session import SessionLocal
                from services.document_job_processor import get_document_job_processor
                import threading
                
                print("Starting document job processor...")
                
                # Get configuration from environment variables
                poll_interval = int(os.getenv("DOC_PROCESSOR_POLL_INTERVAL", "10"))  # Default: 10 seconds
                batch_size = int(os.getenv("DOC_PROCESSOR_BATCH_SIZE", "10"))  # Default: 10 jobs per batch
                
                # Create processor instance
                processor = get_document_job_processor()
                db = SessionLocal()
                
                # Start processor in background thread
                processor_thread = threading.Thread(
                    target=processor.run_continuous,
                    args=(db, poll_interval, batch_size),
                    daemon=True,
                    name="DocumentJobProcessor"
                )
                processor_thread.start()
                
                print(f"✓ Document job processor started (poll_interval={poll_interval}s, batch_size={batch_size})")
                print(f"  Processor ID: {processor.processor_id}")
                print(f"  Thread: {processor_thread.name}")
            except Exception as e:
                print(f"✗ Warning: Failed to start document job processor: {e}")
                import traceback
                traceback.print_exc()
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

class MaintenanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware to block requests during maintenance mode.
    Checks MAINTENANCE_MODE environment variable.
    Allows health and maintenance status endpoints to pass through.
    """
    async def dispatch(self, request, call_next):
        # Allow health and maintenance status endpoints
        if request.url.path in ["/health", "/api/maintenance/status"]:
            return await call_next(request)
        
        # Check maintenance mode
        maintenance_mode = os.getenv("MAINTENANCE_MODE", "false").lower() in ["true", "1", "yes"]
        
        if maintenance_mode:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Service Unavailable",
                    "message": "PowerNOVA is currently undergoing scheduled maintenance. We'll be back shortly!",
                    "maintenance": True
                }
            )
        
        return await call_next(request)

app.add_middleware(OptionsMiddleware)
app.add_middleware(MaintenanceMiddleware)

# CORS Configuration
# Allow requests from frontend domains
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",                      # Production chat app (custom domain)
    "https://www.powernova.ai",                      # Production landing page
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

# Import and include monitoring router
from monitoring import router as monitoring_router
app.include_router(monitoring_router, tags=["Monitoring"])

# Import and include feedback router
from routes import feedback
app.include_router(feedback.router, prefix="/api", tags=["Feedback"])

# Import and include users router
from routes import users
app.include_router(users.router, prefix="/api/users", tags=["Users"])

# Import and include search router
from routes import search
app.include_router(search.router, prefix="/api", tags=["Search"])

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

# Maintenance status endpoint
@app.get("/api/maintenance/status")
async def maintenance_status():
    """
    Returns the current maintenance mode status.
    This endpoint is always accessible, even during maintenance mode.
    """
    # Read MAINTENANCE_MODE environment variable (defaults to false)
    maintenance_mode = os.getenv("MAINTENANCE_MODE", "false").lower() in ["true", "1", "yes"]
    
    if maintenance_mode:
        return JSONResponse(
            content={
                "maintenance": True,
                "message": "PowerNOVA is currently undergoing scheduled maintenance. We'll be back shortly!",
                "estimated_duration": "30-60 minutes"
            }
        )
    else:
        return JSONResponse(
            content={
                "maintenance": False,
                "message": "Service is operating normally"
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
