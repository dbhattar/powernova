"""
Document Job model - Tracks asynchronous document processing jobs
"""
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .base import Base, TimestampMixin


class DocumentJobStatus(str, enum.Enum):
    """Document job processing status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DocumentJob(Base, TimestampMixin):
    """
    Document Job model - tracks asynchronous document processing tasks
    
    This table acts as a job queue for document processing operations including:
    - Text extraction and cleaning
    - Language detection
    - Token anomaly detection
    - Chunking
    - Embedding generation
    
    Workflow:
    1. Crawler creates document record and DocumentJob with status=PENDING
    2. Document processor polls for PENDING jobs
    3. Processor sets status=PROCESSING and performs work
    4. On success: status=COMPLETED, completed_at set
    5. On failure: status=FAILED, error_message set, retry_count incremented
    
    Attributes:
        id: Primary key
        document_id: Foreign key to documents table
        status: Current job status (PENDING/PROCESSING/COMPLETED/FAILED)
        started_at: When processing started (NULL if not started)
        completed_at: When processing finished (NULL if not completed)
        error_message: Error details if failed
        retry_count: Number of processing attempts (for retry logic)
        processor_id: ID of the worker that processed this job (for debugging)
    """
    __tablename__ = "document_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    
    # Job status tracking
    status = Column(SQLEnum(DocumentJobStatus, values_callable=lambda x: [e.value for e in x]), 
                   nullable=False, default=DocumentJobStatus.PENDING, index=True)
    
    # Timing information
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Worker identification (optional, for distributed processing)
    processor_id = Column(String(100), nullable=True)
    
    # Relationships
    document = relationship("Document", foreign_keys=[document_id])
    
    def __repr__(self):
        return f"<DocumentJob(id={self.id}, document_id={self.document_id}, status={self.status.value})>"
