"""
Admin routes - Web crawling and document management
Requires admin key authentication
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from database.session import get_db
from models import CrawlJob, CrawlStatus, Document, DocumentStatus
from datetime import datetime
import os
import secrets

router = APIRouter(prefix="/admin", tags=["admin"])

# Get admin key from environment or generate a default one
ADMIN_KEY = os.getenv("ADMIN_KEY", "powernova-admin-key-change-me")

# Warn if using default key
if ADMIN_KEY == "powernova-admin-key-change-me":
    print("⚠️  WARNING: Using default ADMIN_KEY. Set ADMIN_KEY environment variable for security!")


async def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    """
    Verify admin key from X-Admin-Key header
    
    Raises:
        HTTPException: If key is missing or invalid
    """
    if not x_admin_key:
        raise HTTPException(
            status_code=401,
            detail="Admin key required. Provide X-Admin-Key header."
        )
    
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid admin key"
        )
    
    return True


# Pydantic models for request/response validation
class CrawlJobCreate(BaseModel):
    """Request model for creating a new crawl job"""
    start_url: HttpUrl = Field(..., description="URL to start crawling from")
    max_depth: int = Field(default=2, ge=0, le=10, description="Maximum crawl depth (0 = only start URL)")
    max_pages: int = Field(default=100, ge=1, le=1000, description="Maximum pages to crawl")
    allowed_domains: List[str] = Field(default=[], description="List of allowed domains (empty = same domain only)")
    file_types: List[str] = Field(default=["html", "pdf"], description="File types to download")
    include_patterns: List[str] = Field(default=[], description="URL patterns to include (regex)")
    exclude_patterns: List[str] = Field(default=[], description="URL patterns to exclude (regex)")

class CrawlJobResponse(BaseModel):
    """Response model for crawl job"""
    id: int
    start_url: str
    max_depth: int
    max_pages: int
    allowed_domains: List[str]
    file_types: List[str]
    status: str
    pages_crawled: int
    documents_found: int
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    """Response model for document"""
    id: int
    url: str
    title: Optional[str]
    document_type: str
    file_path: Optional[str]
    blob_url: Optional[str]
    file_size: Optional[int]
    status: str
    error_message: Optional[str]
    crawl_job_id: Optional[int]
    embedding_generated: bool
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.post("/crawl", response_model=CrawlJobResponse, status_code=201)
async def create_crawl_job(
    job_data: CrawlJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Create a new web crawling job
    
    This endpoint creates a crawl job and starts it in the background.
    The job will crawl the specified URL up to the given depth and save
    documents to Azure Blob Storage.
    """
    # Create crawl job record
    crawl_job = CrawlJob(
        start_url=str(job_data.start_url),
        max_depth=job_data.max_depth,
        max_pages=job_data.max_pages,
        allowed_domains=job_data.allowed_domains,
        file_types=job_data.file_types,
        url_patterns={
            "include": job_data.include_patterns,
            "exclude": job_data.exclude_patterns
        },
        status=CrawlStatus.PENDING
    )
    
    db.add(crawl_job)
    db.commit()
    db.refresh(crawl_job)
    
    # Start crawl job in background
    # TODO: Implement actual crawler
    # background_tasks.add_task(run_crawler, crawl_job.id, db)
    
    return crawl_job


@router.get("/crawl", response_model=List[CrawlJobResponse])
async def list_crawl_jobs(
    skip: int = 0,
    limit: int = 50,
    status: Optional[CrawlStatus] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    List all crawl jobs with optional filtering by status
    """
    query = db.query(CrawlJob)
    
    if status:
        query = query.filter(CrawlJob.status == status)
    
    jobs = query.order_by(CrawlJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs


@router.get("/crawl/{job_id}", response_model=CrawlJobResponse)
async def get_crawl_job(
    job_id: int, 
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get details of a specific crawl job
    """
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")
    return job


@router.delete("/crawl/{job_id}", status_code=204)
async def delete_crawl_job(
    job_id: int, 
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Delete a crawl job and all associated documents
    """
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")
    
    # Delete associated documents
    db.query(Document).filter(Document.crawl_job_id == job_id).delete()
    
    # Delete job
    db.delete(job)
    db.commit()
    
    return None


@router.post("/crawl/{job_id}/cancel", response_model=CrawlJobResponse)
async def cancel_crawl_job(
    job_id: int, 
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Cancel a running crawl job
    """
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")
    
    if job.status not in [CrawlStatus.PENDING, CrawlStatus.RUNNING]:
        raise HTTPException(status_code=400, detail="Job is not running")
    
    job.status = CrawlStatus.CANCELLED
    job.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    
    return job


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    status: Optional[DocumentStatus] = None,
    crawl_job_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    List all documents with optional filtering
    """
    query = db.query(Document)
    
    if status:
        query = query.filter(Document.status == status)
    
    if crawl_job_id:
        query = query.filter(Document.crawl_job_id == crawl_job_id)
    
    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    return documents


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int, 
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get details of a specific document
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: int, 
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Delete a document (and remove from blob storage)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # TODO: Delete from Azure Blob Storage
    
    db.delete(document)
    db.commit()
    
    return None


@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get admin dashboard statistics
    """
    total_jobs = db.query(CrawlJob).count()
    running_jobs = db.query(CrawlJob).filter(CrawlJob.status == CrawlStatus.RUNNING).count()
    total_documents = db.query(Document).count()
    documents_with_embeddings = db.query(Document).filter(Document.embedding_generated == True).count()
    
    return {
        "crawl_jobs": {
            "total": total_jobs,
            "running": running_jobs,
            "pending": db.query(CrawlJob).filter(CrawlJob.status == CrawlStatus.PENDING).count(),
            "completed": db.query(CrawlJob).filter(CrawlJob.status == CrawlStatus.COMPLETED).count(),
            "failed": db.query(CrawlJob).filter(CrawlJob.status == CrawlStatus.FAILED).count()
        },
        "documents": {
            "total": total_documents,
            "with_embeddings": documents_with_embeddings,
            "pending": db.query(Document).filter(Document.status == DocumentStatus.PENDING).count(),
            "processing": db.query(Document).filter(Document.status == DocumentStatus.PROCESSING).count(),
            "completed": db.query(Document).filter(Document.status == DocumentStatus.COMPLETED).count(),
            "failed": db.query(Document).filter(Document.status == DocumentStatus.FAILED).count()
        }
    }
