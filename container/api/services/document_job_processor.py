"""
Document Job Processor - Processes pending document jobs asynchronously
"""
import logging
import time
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import Document, DocumentJob, DocumentJobStatus, DocumentStatus
from services.embedding_processor import process_document_embedding
from database.session import get_db

logger = logging.getLogger(__name__)


class DocumentJobProcessor:
    """
    Document job processor that polls for pending jobs and processes them
    
    This service runs independently from the crawler and processes documents
    asynchronously. It handles:
    - Chunking document content
    - Generating embeddings
    - Error handling and retries
    - Status tracking
    """
    
    def __init__(self, processor_id: Optional[str] = None, max_retries: int = 3):
        """
        Initialize document job processor
        
        Args:
            processor_id: Unique identifier for this processor instance (for distributed processing)
            max_retries: Maximum number of retry attempts for failed jobs
        """
        self.processor_id = processor_id or f"processor-{uuid.uuid4().hex[:8]}"
        self.max_retries = max_retries
        self.processed_count = 0
        self.failed_count = 0
        
        logger.info(f"Initialized DocumentJobProcessor: {self.processor_id}")
    
    def process_pending_jobs(self, db: Session, batch_size: int = 10) -> int:
        """
        Process a batch of pending document jobs
        
        Args:
            db: Database session
            batch_size: Maximum number of jobs to process in this batch
            
        Returns:
            Number of jobs processed
        """
        try:
            # Query for pending jobs with prioritization:
            # 1. User-uploaded documents (uploaded_by IS NOT NULL) - highest priority
            # 2. Crawled documents (uploaded_by IS NULL) - lower priority
            # Within each category, process oldest first (FIFO)
            pending_jobs = db.query(DocumentJob).join(
                Document, DocumentJob.document_id == Document.id
            ).filter(
                and_(
                    DocumentJob.status == DocumentJobStatus.PENDING,
                    DocumentJob.retry_count < self.max_retries
                )
            ).order_by(
                # Prioritize user uploads: NULL values sort last in PostgreSQL with NULLS LAST
                Document.uploaded_by.desc().nullslast(),
                DocumentJob.created_at.asc()
            ).limit(batch_size).all()
            
            if not pending_jobs:
                logger.debug("No pending document jobs found")
                return 0
            
            # Count user vs crawled documents for logging
            user_docs = sum(1 for job in pending_jobs if job.document.uploaded_by is not None)
            crawled_docs = len(pending_jobs) - user_docs
            
            logger.info(f"Found {len(pending_jobs)} pending document jobs ({user_docs} user-uploaded, {crawled_docs} crawled)")
            
            processed = 0
            for job in pending_jobs:
                try:
                    self._process_job(job, db)
                    processed += 1
                except Exception as e:
                    logger.error(f"Error processing job {job.id}: {e}")
                    self.failed_count += 1
                    # Continue processing other jobs even if one fails
            
            return processed
            
        except Exception as e:
            logger.error(f"Error in process_pending_jobs: {e}")
            return 0
    
    def _process_job(self, job: DocumentJob, db: Session):
        """
        Process a single document job
        
        Args:
            job: DocumentJob to process
            db: Database session
        """
        try:
            # Mark job as processing
            job.status = DocumentJobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            job.processor_id = self.processor_id
            job.retry_count += 1
            db.commit()
            
            # Get the document
            document = db.query(Document).filter(Document.id == job.document_id).first()
            if not document:
                raise ValueError(f"Document {job.document_id} not found")
            
            # Log with priority indicator
            doc_type = "USER-UPLOADED" if document.uploaded_by else "CRAWLED"
            logger.info(f"Processing {doc_type} document job {job.id} for document {job.document_id} (attempt {job.retry_count})")
            
            # Skip if document is not in completed status
            if document.status != DocumentStatus.COMPLETED:
                logger.warning(f"Document {job.document_id} is not in COMPLETED status, skipping")
                job.status = DocumentJobStatus.FAILED
                job.error_message = f"Document status is {document.status}, expected COMPLETED"
                job.completed_at = datetime.utcnow()
                db.commit()
                return
            
            # Process the document (chunking + embedding generation)
            success = process_document_embedding(job.document_id, db)
            
            if success:
                # Mark job as completed
                job.status = DocumentJobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                job.error_message = None
                db.commit()
                
                self.processed_count += 1
                logger.info(f"Successfully processed document job {job.id} for document {job.document_id}")
            else:
                # Mark as failed
                job.status = DocumentJobStatus.FAILED
                job.completed_at = datetime.utcnow()
                job.error_message = "Embedding processing returned False"
                db.commit()
                
                self.failed_count += 1
                logger.warning(f"Document job {job.id} failed for document {job.document_id}")
                
        except Exception as e:
            # Mark job as failed with error message
            job.status = DocumentJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)[:1000]  # Limit error message length
            db.commit()
            
            self.failed_count += 1
            logger.error(f"Failed to process document job {job.id}: {e}")
            
            # If max retries not reached, reset to pending for retry
            if job.retry_count < self.max_retries:
                job.status = DocumentJobStatus.PENDING
                job.started_at = None
                job.completed_at = None
                db.commit()
                logger.info(f"Reset job {job.id} to PENDING for retry (attempt {job.retry_count}/{self.max_retries})")
    
    def run_continuous(self, db: Session, poll_interval: int = 5, batch_size: int = 10):
        """
        Run the processor in continuous mode (polls for jobs at regular intervals)
        
        Args:
            db: Database session
            poll_interval: Seconds to wait between polling cycles
            batch_size: Maximum number of jobs to process per cycle
        """
        logger.info(f"Starting continuous document job processor (poll_interval={poll_interval}s, batch_size={batch_size})")
        
        try:
            while True:
                try:
                    processed = self.process_pending_jobs(db, batch_size)
                    
                    if processed > 0:
                        logger.info(f"Processed {processed} jobs. Total: {self.processed_count} processed, {self.failed_count} failed")
                    
                    # Wait before next poll
                    time.sleep(poll_interval)
                    
                except KeyboardInterrupt:
                    logger.info("Received interrupt signal, stopping processor")
                    break
                except Exception as e:
                    logger.error(f"Error in continuous processing loop: {e}")
                    time.sleep(poll_interval)  # Wait before retry
                    
        finally:
            logger.info(f"Document job processor stopped. Final stats: {self.processed_count} processed, {self.failed_count} failed")


def get_document_job_processor(processor_id: Optional[str] = None, max_retries: int = 3) -> DocumentJobProcessor:
    """
    Get a document job processor instance
    
    Args:
        processor_id: Optional unique identifier for this processor
        max_retries: Maximum retry attempts for failed jobs
        
    Returns:
        DocumentJobProcessor instance
    """
    return DocumentJobProcessor(processor_id=processor_id, max_retries=max_retries)


def process_document_jobs_once(batch_size: int = 10) -> int:
    """
    Process pending document jobs once (for manual/scheduled runs)
    
    Args:
        batch_size: Maximum number of jobs to process
        
    Returns:
        Number of jobs processed
    """
    processor = get_document_job_processor()
    db = next(get_db())
    
    try:
        return processor.process_pending_jobs(db, batch_size)
    finally:
        db.close()


# For running as a standalone worker
if __name__ == "__main__":
    import sys
    
    # Get database session
    db = next(get_db())
    
    # Parse command line arguments
    mode = sys.argv[1] if len(sys.argv) > 1 else "continuous"
    
    processor = get_document_job_processor()
    
    if mode == "continuous":
        # Run in continuous mode
        poll_interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        batch_size = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        processor.run_continuous(db, poll_interval, batch_size)
    else:
        # Process once
        batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        processed = processor.process_pending_jobs(db, batch_size)
        print(f"Processed {processed} document jobs")
        db.close()
