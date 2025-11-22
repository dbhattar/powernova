"""
Crawl State Models - Track visited and queued URLs for crawl job resumption
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Boolean
from sqlalchemy.sql import func
from .base import Base


class CrawlVisitedUrl(Base):
    """
    Track URLs that have been visited during a crawl job.
    Allows resuming crawls without re-visiting pages.
    """
    __tablename__ = "crawl_visited_urls"
    
    id = Column(Integer, primary_key=True, index=True)
    crawl_job_id = Column(Integer, ForeignKey("crawl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(2048), nullable=False)
    status_code = Column(Integer)  # HTTP status code
    depth = Column(Integer, default=0)  # Depth at which this URL was found
    visited_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Composite index for fast lookups
    __table_args__ = (
        Index('idx_crawl_visited_url', 'crawl_job_id', 'url'),
    )
    
    def __repr__(self):
        return f"<CrawlVisitedUrl(job={self.crawl_job_id}, url='{self.url[:50]}...')>"


class CrawlQueuedUrl(Base):
    """
    Track URLs queued for crawling.
    Allows resuming crawls from the queue.
    """
    __tablename__ = "crawl_queued_urls"
    
    id = Column(Integer, primary_key=True, index=True)
    crawl_job_id = Column(Integer, ForeignKey("crawl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(2048), nullable=False)
    depth = Column(Integer, default=0)  # Depth for this URL
    priority = Column(Integer, default=0)  # For future priority-based crawling
    added_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Composite index for fast lookups and ordering
    __table_args__ = (
        Index('idx_crawl_queued_url', 'crawl_job_id', 'url'),
        Index('idx_crawl_queue_priority', 'crawl_job_id', 'priority', 'added_at'),
    )
    
    def __repr__(self):
        return f"<CrawlQueuedUrl(job={self.crawl_job_id}, url='{self.url[:50]}...', depth={self.depth})>"
