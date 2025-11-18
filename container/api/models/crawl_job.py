"""
CrawlJob model - Manages web crawling jobs
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .base import Base, TimestampMixin


class CrawlStatus(str, enum.Enum):
    """Crawl job status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CrawlJob(Base, TimestampMixin):
    """
    CrawlJob model - manages web crawling operations
    
    Attributes:
        id: Primary key
        start_url: URL to start crawling from
        max_depth: Maximum depth to crawl (0 = only start URL)
        max_pages: Maximum number of pages to crawl
        allowed_domains: List of allowed domains (JSON array)
        file_types: File types to download (pdf, docx, etc.)
        url_patterns: URL patterns to include/exclude (JSON)
        status: Current status of the job
        pages_crawled: Number of pages processed
        documents_found: Number of documents discovered
        error_message: Error details if failed
        config: Additional configuration (JSON)
        started_at: When the job started
        completed_at: When the job finished
    """
    __tablename__ = "crawl_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Crawl configuration
    start_url = Column(String(2048), nullable=False)
    max_depth = Column(Integer, default=2)
    max_pages = Column(Integer, default=100)
    allowed_domains = Column(JSON, default=[])  # List of allowed domains
    file_types = Column(JSON, default=["html", "pdf"])  # File types to download
    
    # URL filtering
    url_patterns = Column(JSON, default={
        "include": [],  # URL patterns to include
        "exclude": []   # URL patterns to exclude
    })
    
    # Status tracking
    status = Column(SQLEnum(CrawlStatus), nullable=False, default=CrawlStatus.PENDING)
    pages_crawled = Column(Integer, default=0)
    documents_found = Column(Integer, default=0)
    error_message = Column(Text)
    
    # Additional configuration
    config = Column(JSON, default={})
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<CrawlJob(id={self.id}, url='{self.start_url}', status='{self.status}')>"
