#!/usr/bin/env python3
"""
Document Job Worker - Dedicated process for processing document jobs

This worker:
- Polls the database for PENDING document jobs
- Generates embeddings for document chunks
- Performs chunking and content processing
- Runs isolated from the API server for better responsiveness

Environment Variables:
- DATABASE_URL: PostgreSQL connection string
- DOC_PROCESSOR_POLL_INTERVAL: Seconds between polls (default: 10)
- DOC_PROCESSOR_BATCH_SIZE: Number of jobs to process per batch (default: 10)
- WORKER_ID: Optional unique identifier for this worker
"""

import os
import sys
import logging
from datetime import datetime

# Add parent directory to Python path to import from api modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import SessionLocal, check_db_connection
from services.document_job_processor import get_document_job_processor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [DOC-WORKER] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class DocumentJobWorker:
    """
    Document job worker that polls for pending document jobs and processes them
    """
    
    def __init__(self, worker_id=None, poll_interval=10, batch_size=10):
        """
        Initialize document job worker
        
        Args:
            worker_id: Optional unique identifier for this worker
            poll_interval: Seconds to wait between polling for jobs
            batch_size: Number of jobs to process per batch
        """
        self.worker_id = worker_id or f"doc-worker-{os.getpid()}"
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.running = True
        
        logger.info(f"Initializing Document Job Worker: {self.worker_id}")
        logger.info(f"Poll interval: {poll_interval}s")
        logger.info(f"Batch size: {batch_size}")
    
    def run(self):
        """
        Main worker loop - continuously poll for jobs and process them
        """
        logger.info("=" * 60)
        logger.info(f"Starting Document Job Worker: {self.worker_id}")
        logger.info("=" * 60)
        
        # Check database connection
        if not check_db_connection():
            logger.error("✗ Database connection failed - exiting")
            sys.exit(1)
        
        logger.info("✓ Database connection successful")
        
        # Get document job processor instance
        logger.info("Initializing document job processor...")
        processor = get_document_job_processor()
        
        # Create database session
        db = SessionLocal()
        
        try:
            logger.info(f"Starting continuous processing loop")
            logger.info(f"  - Poll interval: {self.poll_interval}s")
            logger.info(f"  - Batch size: {self.batch_size} jobs")
            logger.info("Press Ctrl+C to stop")
            
            # Run the continuous processor
            # This is a blocking call that runs forever
            processor.run_continuous(
                db=db,
                poll_interval=self.poll_interval,
                batch_size=self.batch_size
            )
        
        except KeyboardInterrupt:
            logger.info("Received interrupt signal - shutting down gracefully")
            self.running = False
        
        except Exception as e:
            logger.error(f"Fatal error in document job worker: {e}")
            raise
        
        finally:
            db.close()
            logger.info("Document Job Worker stopped")


def main():
    """
    Entry point for document job worker
    """
    # Get configuration from environment
    worker_id = os.getenv("WORKER_ID")
    poll_interval = int(os.getenv("DOC_PROCESSOR_POLL_INTERVAL", "10"))
    batch_size = int(os.getenv("DOC_PROCESSOR_BATCH_SIZE", "10"))
    
    # Create and run worker
    worker = DocumentJobWorker(
        worker_id=worker_id,
        poll_interval=poll_interval,
        batch_size=batch_size
    )
    worker.run()


if __name__ == "__main__":
    main()
