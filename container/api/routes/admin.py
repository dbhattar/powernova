"""
Admin routes - Web crawling, document management, and user management
Requires admin key authentication
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header
from pydantic import BaseModel, Field, HttpUrl, EmailStr
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from database.session import get_db
from models import CrawlJob, CrawlStatus, Document, DocumentStatus, DocumentChunk, User, DocumentJob, DocumentJobStatus
from services.crawler import run_crawler
from services.azure_storage import get_storage_service
from services.auth import get_password_hash, generate_random_password
from services.embedding_processor import process_document_embedding
from services.document_job_processor import process_document_jobs_once, get_document_job_processor
from datetime import datetime
import os
import secrets
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# Get admin key from environment or generate a default one
ADMIN_KEY = os.getenv("ADMIN_KEY", "powernova-admin-key-change-me")

# Warn if using default key
if ADMIN_KEY == "powernova-admin-key-change-me":
    print("⚠️  WARNING: Using default ADMIN_KEY. Set ADMIN_KEY environment variable for security!")


async def verify_admin_key(x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")):
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
    max_pages: int = Field(default=100, ge=-1, le=1000, description="Maximum pages to crawl")
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
    
    # Start crawl job in background (don't pass db session - it will create its own)
    background_tasks.add_task(run_crawler, crawl_job.id)
    
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


@router.post("/crawl/{job_id}/restart", response_model=CrawlJobResponse)
async def restart_crawl_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Restart a failed or running crawl job.
    Resumes from where it left off using persisted state.
    """
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")
    
    # Allow restarting FAILED, RUNNING, or CANCELLED jobs
    if job.status not in [CrawlStatus.FAILED, CrawlStatus.RUNNING, CrawlStatus.CANCELLED]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot restart job in {job.status} status. Only FAILED, RUNNING, or CANCELLED jobs can be restarted."
        )
    
    # Reset status to PENDING (will be set to RUNNING by crawler)
    job.status = CrawlStatus.PENDING
    job.error_message = None
    job.completed_at = None
    db.commit()
    db.refresh(job)
    
    # Start crawler in background (it will load persisted state)
    from services.crawler import run_crawler
    background_tasks.add_task(run_crawler, job_id)
    
    return job


@router.get("/documents")
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
    
    total = query.count()
    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "documents": [{
            "id": doc.id,
            "url": doc.url,
            "title": doc.title,
            "document_type": doc.document_type.value if hasattr(doc.document_type, 'value') else str(doc.document_type),
            "file_path": doc.file_path,
            "blob_url": doc.blob_url,
            "file_size": doc.file_size,
            "status": doc.status.value if hasattr(doc.status, 'value') else str(doc.status),
            "error_message": doc.error_message,
            "crawl_job_id": doc.crawl_job_id,
            "embedding_generated": doc.embedding_generated,
            "chunk_count": doc.chunk_count,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at
        } for doc in documents],
        "total": total,
        "skip": skip,
        "limit": limit
    }


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
    
    # Delete from Azure Blob Storage
    if document.file_path:
        storage_service = get_storage_service()
        storage_service.delete_document(document.file_path)
    
    db.delete(document)
    db.commit()
    
    return None


@router.post("/documents/remove-duplicates")
async def remove_duplicate_documents(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Remove duplicate documents (same URL). Keeps the oldest document (lowest ID) for each URL.
    Also removes associated chunks and blob storage files for deleted duplicates.
    """
    
    # Find all URLs that have duplicates
    duplicates_query = db.query(
        Document.url, 
        func.count(Document.id).label('count')
    ).group_by(Document.url).having(func.count(Document.id) > 1).all()
    
    if not duplicates_query:
        return {
            "duplicates_removed": 0,
            "urls_affected": 0,
            "message": "No duplicate documents found"
        }
    
    total_removed = 0
    urls_affected = len(duplicates_query)
    storage_service = get_storage_service()
    blobs_deleted = 0
    blobs_failed = 0
    chunks_deleted = 0
    
    for url, count in duplicates_query:
        # Get all documents with this URL, ordered by ID (oldest first)
        docs = db.query(Document).filter(Document.url == url).order_by(Document.id).all()
        
        # Keep the first (oldest) document, delete the rest
        keep_doc = docs[0]
        duplicates_to_remove = docs[1:]
        
        logger.info(f"Found {len(duplicates_to_remove)} duplicates for URL: {url}")
        logger.info(f"  Keeping document ID: {keep_doc.id}, created: {keep_doc.created_at}")
        
        for duplicate_doc in duplicates_to_remove:
            logger.info(f"  Removing duplicate ID: {duplicate_doc.id}, created: {duplicate_doc.created_at}")
            
            # Delete associated chunks
            chunk_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == duplicate_doc.id).count()
            if chunk_count > 0:
                db.query(DocumentChunk).filter(DocumentChunk.document_id == duplicate_doc.id).delete()
                chunks_deleted += chunk_count
                logger.info(f"    Deleted {chunk_count} chunks")
            
            # Delete from Azure Blob Storage if exists
            if duplicate_doc.file_path:
                try:
                    logger.info(f"    Deleting blob: {duplicate_doc.file_path}")
                    storage_service.delete_document(duplicate_doc.file_path)
                    blobs_deleted += 1
                    logger.info(f"    ✓ Blob deleted successfully")
                except Exception as e:
                    blobs_failed += 1
                    logger.error(f"    ✗ Failed to delete blob for document {duplicate_doc.id}: {str(e)}")
            
            # Delete the document
            db.delete(duplicate_doc)
            total_removed += 1
    
    db.commit()
    
    logger.info(f"Duplicate removal complete: {total_removed} documents, {chunks_deleted} chunks, {blobs_deleted} blobs deleted")
    
    return {
        "duplicates_removed": total_removed,
        "urls_affected": urls_affected,
        "chunks_deleted": chunks_deleted,
        "blobs_deleted": blobs_deleted,
        "blobs_failed": blobs_failed,
        "message": f"Removed {total_removed} duplicate documents across {urls_affected} URLs"
    }


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
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    
    # Embedding/chunk statistics
    docs_with_chunks = db.query(Document).filter(
        Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    ).count()
    
    docs_with_old_embeddings = db.query(Document).filter(
        Document.embedding != None,
        ~Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    ).count()
    
    total_chunks = db.query(DocumentChunk).count()
    
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
        },
        "embeddings": {
            "documents_with_chunks": docs_with_chunks,
            "documents_with_old_embeddings": docs_with_old_embeddings,
            "total_chunks": total_chunks,
            "migration_progress": round((docs_with_chunks / total_documents * 100) if total_documents > 0 else 0, 2)
        },
        "users": {
            "total": total_users,
            "active": active_users
        }
    }




# ============================================================================
# DOCUMENT & EMBEDDING MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/embeddings/stats")
async def get_embedding_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get detailed statistics about documents and embeddings
    
    Returns:
    - Total documents
    - Documents with old embeddings (needs reprocessing)
    - Documents with chunks (new system)
    - Documents pending processing
    - Chunk statistics
    """
    # Get total documents
    total_documents = db.query(Document).count()
    
    # Documents with old embeddings (has embedding but no chunks)
    docs_with_old_embeddings_query = db.query(Document).filter(
        Document.embedding != None,
        ~Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    )
    docs_with_old_embeddings = docs_with_old_embeddings_query.count()
    
    # Documents with chunks (new system)
    docs_with_chunks_query = db.query(Document).filter(
        Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    )
    docs_with_chunks = docs_with_chunks_query.count()
    
    # Documents with no embeddings at all
    docs_no_embedding = db.query(Document).filter(
        Document.embedding == None,
        ~Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    ).count()
    
    # Total chunks
    total_chunks = db.query(DocumentChunk).count()
    
    # Average chunks per document (using subquery)
    avg_chunks_subquery = db.query(
        func.count(DocumentChunk.id).label('chunk_count')
    ).group_by(DocumentChunk.document_id).subquery()
    
    avg_chunks_result = db.query(func.avg(avg_chunks_subquery.c.chunk_count)).scalar()
    avg_chunks = float(avg_chunks_result) if avg_chunks_result else 0
    
    # Breakdown by document scope
    scope_stats = {}
    for scope in ['platform', 'user', 'conversation']:
        scope_total = db.query(Document).filter(Document.document_scope == scope).count()
        scope_with_chunks = db.query(Document).filter(
            Document.document_scope == scope,
            Document.id.in_(
                db.query(DocumentChunk.document_id).distinct()
            )
        ).count()
        scope_with_old = db.query(Document).filter(
            Document.document_scope == scope,
            Document.embedding != None,
            ~Document.id.in_(
                db.query(DocumentChunk.document_id).distinct()
            )
        ).count()
        
        scope_stats[scope] = {
            "total": scope_total,
            "with_chunks": scope_with_chunks,
            "with_old_embeddings": scope_with_old,
            "no_embedding": scope_total - scope_with_chunks - scope_with_old
        }
    
    return {
        "summary": {
            "total_documents": total_documents,
            "documents_with_chunks": docs_with_chunks,
            "documents_with_old_embeddings": docs_with_old_embeddings,
            "documents_no_embedding": docs_no_embedding,
            "total_chunks": total_chunks,
            "avg_chunks_per_document": round(avg_chunks, 2)
        },
        "by_scope": scope_stats,
        "migration_status": {
            "migrated_to_chunks": docs_with_chunks,
            "pending_migration": docs_with_old_embeddings,
            "migration_percentage": round((docs_with_chunks / total_documents * 100) if total_documents > 0 else 0, 2)
        }
    }


@router.get("/embeddings/token-anomalies")
async def get_token_anomalies(
    skip: int = 0,
    limit: int = 100,
    scope: Optional[str] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get documents with token anomalies (abnormal token-to-character ratios)
    
    These documents have encoding issues or corrupted content that causes
    token inflation, making them unsuitable for embedding generation.
    
    Query params:
    - skip: Pagination offset (default: 0)
    - limit: Max results (default: 100)
    - scope: Filter by document_scope ('platform', 'user', 'conversation')
    
    Returns:
    - List of anomalous documents with:
      - Document metadata (id, title, url, type)
      - Token/character statistics
      - Ratio information
      - Suggestions for fixing
    """
    # Query documents with token_anomaly=True
    query = db.query(Document).filter(Document.token_anomaly == True)
    
    if scope:
        query = query.filter(Document.document_scope == scope)
    
    total = query.count()
    documents = query.order_by(Document.token_to_char_ratio.desc()).offset(skip).limit(limit).all()
    
    # Also get stats
    avg_ratio = db.query(func.avg(Document.token_to_char_ratio)).filter(
        Document.token_anomaly == True
    ).scalar() or 0
    
    max_ratio = db.query(func.max(Document.token_to_char_ratio)).filter(
        Document.token_anomaly == True
    ).scalar() or 0
    
    # Count by document type
    type_breakdown = db.query(
        Document.document_type,
        func.count(Document.id).label('count')
    ).filter(
        Document.token_anomaly == True
    ).group_by(Document.document_type).all()
    
    return {
        "summary": {
            "total_anomalies": total,
            "avg_ratio": round(float(avg_ratio), 3),
            "max_ratio": round(float(max_ratio), 3),
            "threshold": 0.6,
            "normal_range": "0.3-0.5"
        },
        "by_type": {str(dtype): count for dtype, count in type_breakdown},
        "pagination": {
            "skip": skip,
            "limit": limit,
            "total": total
        },
        "documents": [{
            "id": doc.id,
            "title": doc.title,
            "url": doc.url,
            "document_type": doc.document_type.value if doc.document_type else None,
            "document_scope": doc.document_scope.value if doc.document_scope else None,
            "file_size": doc.file_size,
            "content_length": len(doc.content) if doc.content else 0,
            "token_to_char_ratio": round(float(doc.token_to_char_ratio), 3) if doc.token_to_char_ratio else None,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "crawl_job_id": doc.crawl_job_id,
            "severity": (
                "critical" if doc.token_to_char_ratio and doc.token_to_char_ratio > 2.0
                else "high" if doc.token_to_char_ratio and doc.token_to_char_ratio > 1.0
                else "medium"
            ),
            "suggestion": (
                "Severely corrupted encoding - likely binary data or malformed UTF-8. Consider excluding this URL pattern."
                if doc.token_to_char_ratio and doc.token_to_char_ratio > 2.0
                else "Moderately corrupted - may have special characters or encoding issues. Check source document."
                if doc.token_to_char_ratio and doc.token_to_char_ratio > 1.0
                else "Minor encoding issues - may be fixable with better text extraction."
            )
        } for doc in documents]
    }


@router.get("/embeddings/documents-needing-reprocessing")
async def list_documents_needing_reprocessing(
    skip: int = 0,
    limit: int = 50,
    scope: Optional[str] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    List documents that have old embeddings and need reprocessing
    
    These are documents with `embedding IS NOT NULL` but no chunks in document_chunks table
    """
    query = db.query(Document).filter(
        Document.embedding != None,
        ~Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    )
    
    if scope:
        query = query.filter(Document.document_scope == scope)
    
    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": query.count(),
        "skip": skip,
        "limit": limit,
        "documents": [{
            "id": doc.id,
            "title": doc.title,
            "url": doc.url,
            "document_type": doc.document_type,
            "document_scope": doc.document_scope,
            "has_old_embedding": doc.embedding is not None,
            "chunk_count": doc.chunk_count,
            "created_at": doc.created_at,
            "content_length": len(doc.content) if doc.content else 0
        } for doc in documents]
    }


@router.post("/embeddings/reprocess-document/{document_id}")
async def reprocess_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Reprocess a specific document to create chunks
    
    This will:
    1. Clear old embedding from documents table
    2. Delete any existing chunks
    3. Re-chunk the document
    4. Generate embeddings for each chunk
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Clear old embedding
    document.embedding = None
    document.embedding_generated = False
    document.chunk_count = 0
    
    # Delete existing chunks (if any)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    
    db.commit()
    
    # Reprocess in background
    background_tasks.add_task(process_document_embedding, document_id, db)
    
    logger.info(f"Queued document {document_id} for reprocessing")
    
    return {
        "message": "Document queued for reprocessing",
        "document_id": document_id,
        "title": document.title
    }


@router.post("/embeddings/reprocess-all")
async def reprocess_all_documents(
    background_tasks: BackgroundTasks,
    scope: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Reprocess all documents with old embeddings
    
    This will queue all documents with old embeddings for reprocessing.
    Use `limit` to process in batches.
    
    WARNING: This can be resource-intensive for large document collections
    """
    query = db.query(Document).filter(
        Document.embedding != None,
        ~Document.id.in_(
            db.query(DocumentChunk.document_id).distinct()
        )
    )
    
    if scope:
        query = query.filter(Document.document_scope == scope)
    
    if limit:
        query = query.limit(limit)
    
    documents = query.all()
    
    if not documents:
        return {
            "message": "No documents need reprocessing",
            "count": 0
        }
    
    # Clear old embeddings and chunks
    document_ids = [doc.id for doc in documents]
    
    for doc in documents:
        doc.embedding = None
        doc.embedding_generated = False
        doc.chunk_count = 0
    
    # Delete existing chunks
    db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(document_ids)).delete(synchronize_session=False)
    
    db.commit()
    
    # Queue for reprocessing
    for doc_id in document_ids:
        background_tasks.add_task(process_document_embedding, doc_id, db)
    
    logger.info(f"Queued {len(document_ids)} documents for reprocessing")
    
    return {
        "message": f"Queued {len(document_ids)} documents for reprocessing",
        "count": len(document_ids),
        "document_ids": document_ids[:20],  # Return first 20 IDs
        "total_queued": len(document_ids)
    }


@router.get("/embeddings/chunks/{document_id}")
async def get_document_chunks(
    document_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get all chunks for a specific document
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()
    
    return {
        "document_id": document_id,
        "title": document.title,
        "total_chunks": len(chunks),
        "chunks": [{
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
            "word_count": chunk.word_count,
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "has_embedding": chunk.embedding is not None,
            "embedding_generated": chunk.embedding_generated,
            "created_at": chunk.created_at
        } for chunk in chunks]
    }


@router.delete("/embeddings/chunks/{document_id}")
async def delete_document_chunks(
    document_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Delete all chunks for a specific document
    
    This will NOT delete the document itself, only its chunks.
    Useful for forcing a re-chunking without deleting the original document.
    """
    deleted_count = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).delete()
    
    # Update document
    document = db.query(Document).filter(Document.id == document_id).first()
    if document:
        document.chunk_count = 0
        document.embedding_generated = False
    
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} chunks for document {document_id}",
        "deleted_count": deleted_count,
        "document_id": document_id
    }


# ============================================================================
# DOCUMENT JOB PROCESSING ENDPOINTS
# ============================================================================

@router.get("/document-jobs/stats")
async def get_document_job_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get document job statistics
    
    Returns counts by status and recent job information
    """
    # Count by status
    pending_count = db.query(DocumentJob).filter(DocumentJob.status == DocumentJobStatus.PENDING).count()
    processing_count = db.query(DocumentJob).filter(DocumentJob.status == DocumentJobStatus.PROCESSING).count()
    completed_count = db.query(DocumentJob).filter(DocumentJob.status == DocumentJobStatus.COMPLETED).count()
    failed_count = db.query(DocumentJob).filter(DocumentJob.status == DocumentJobStatus.FAILED).count()
    
    # Get recent jobs
    recent_jobs = db.query(DocumentJob).order_by(DocumentJob.created_at.desc()).limit(10).all()
    
    return {
        "summary": {
            "pending": pending_count,
            "processing": processing_count,
            "completed": completed_count,
            "failed": failed_count,
            "total": pending_count + processing_count + completed_count + failed_count
        },
        "recent_jobs": [{
            "id": job.id,
            "document_id": job.document_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "retry_count": job.retry_count,
            "error_message": job.error_message
        } for job in recent_jobs]
    }


@router.get("/document-jobs")
async def list_document_jobs(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    List document jobs with optional filtering
    
    Query Parameters:
      - status: Filter by job status (pending/processing/completed/failed)
      - skip: Number of records to skip (pagination)
      - limit: Maximum number of records to return
    """
    query = db.query(DocumentJob)
    
    if status:
        try:
            status_enum = DocumentJobStatus(status.upper())
            query = query.filter(DocumentJob.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    total = query.count()
    jobs = query.order_by(DocumentJob.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "jobs": [{
            "id": job.id,
            "document_id": job.document_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "retry_count": job.retry_count,
            "processor_id": job.processor_id,
            "error_message": job.error_message
        } for job in jobs]
    }


@router.post("/document-jobs/process")
async def trigger_document_job_processing(
    batch_size: int = 10,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Manually trigger document job processing
    
    This will process a batch of pending document jobs immediately.
    Useful for manual testing or on-demand processing.
    
    Query Parameters:
      - batch_size: Number of jobs to process (default: 10, max: 100)
    """
    if batch_size > 100:
        raise HTTPException(status_code=400, detail="batch_size cannot exceed 100")
    
    # Process jobs in background
    background_tasks.add_task(process_document_jobs_once, batch_size)
    
    # Get current pending count
    pending_count = db.query(DocumentJob).filter(DocumentJob.status == DocumentJobStatus.PENDING).count()
    
    return {
        "message": f"Queued processing of up to {batch_size} document jobs",
        "batch_size": batch_size,
        "pending_jobs": pending_count
    }


@router.post("/document-jobs/{job_id}/retry")
async def retry_failed_job(
    job_id: int,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Retry a failed document job
    
    Resets the job status to PENDING so it will be picked up by the processor
    """
    job = db.query(DocumentJob).filter(DocumentJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Document job not found")
    
    if job.status != DocumentJobStatus.FAILED:
        raise HTTPException(status_code=400, detail=f"Job is not in FAILED status (current: {job.status.value})")
    
    # Reset job to pending
    job.status = DocumentJobStatus.PENDING
    job.started_at = None
    job.completed_at = None
    job.error_message = None
    # Don't reset retry_count - keep it for tracking
    
    db.commit()
    
    # Trigger processing
    background_tasks.add_task(process_document_jobs_once, 1)
    
    return {
        "message": f"Reset job {job_id} to PENDING for retry",
        "job_id": job_id,
        "retry_count": job.retry_count
    }


@router.delete("/document-jobs/{job_id}")
async def delete_document_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Delete a document job
    
    WARNING: This does not delete the associated document, only the job record.
    Use this to clean up completed/failed jobs.
    """
    job = db.query(DocumentJob).filter(DocumentJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Document job not found")
    
    db.delete(job)
    db.commit()
    
    return {
        "message": f"Deleted document job {job_id}",
        "job_id": job_id
    }


# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

class UserCreate(BaseModel):
    """Request model for creating a new user"""
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=100, description="Display name")
    password: Optional[str] = Field(None, min_length=8, max_length=100, description="Optional password (random if not provided)")
    is_superuser: bool = Field(default=False, description="Grant admin privileges")


class UserResponse(BaseModel):
    """Response model for user"""
    id: int
    email: str
    username: str
    is_active: bool
    is_verified: bool
    is_superuser: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserCreateResponse(BaseModel):
    """Response model for user creation (includes temporary password)"""
    user: UserResponse
    temporary_password: Optional[str] = Field(None, description="Temporary password (only on creation)")


class UserPasswordReset(BaseModel):
    """Request model for password reset"""
    new_password: Optional[str] = Field(None, min_length=8, max_length=100, description="New password (random if not provided)")


@router.post("/users", response_model=UserCreateResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Create a new user
    
    Admin endpoint to create new users. If no password is provided,
    a random password is generated. Users must change their password
    on first login.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    # Generate password if not provided
    password = user_data.password or generate_random_password()
    hashed_password = get_password_hash(password)
    
    # Create user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        is_active=True,
        is_verified=False,
        is_superuser=user_data.is_superuser,
        must_change_password=True  # Always require password change on first login
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "user": new_user,
        "temporary_password": password if not user_data.password else None
    }


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    List all users with optional filtering
    """
    query = db.query(User)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Get details of a specific user
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users/{user_id}/reset-password", response_model=UserCreateResponse)
async def reset_user_password(
    user_id: int,
    password_data: UserPasswordReset,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Reset a user's password
    
    Admin endpoint to reset a user's password. If no new password is provided,
    a random password is generated. The user will be required to change it on next login.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate password if not provided
    new_password = password_data.new_password or generate_random_password()
    user.hashed_password = get_password_hash(new_password)
    user.must_change_password = True
    
    db.commit()
    db.refresh(user)
    
    return {
        "user": user,
        "temporary_password": new_password
    }


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Delete a user
    
    This will also delete all associated conversations and artifacts.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    
    return None


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_key)
):
    """
    Toggle user active status (activate/deactivate)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    
    return user
