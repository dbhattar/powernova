#!/usr/bin/env python3
"""
Crawler Worker - Dedicated process for running web crawl jobs

This worker:
- Polls the database for PENDING/FAILED crawl jobs
- Auto-resumes interrupted crawl jobs on startup
- Runs crawlers in isolation from the API server
- Can be scaled independently

Environment Variables:
- DATABASE_URL: PostgreSQL connection string
- POLL_INTERVAL: Seconds between polls (default: 30)
- WORKER_ID: Optional unique identifier for this worker
"""

import os
import sys
import time
import logging
from datetime import datetime

# Add parent directory to Python path to import from api modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import SessionLocal, check_db_connection
from models import CrawlJob, CrawlStatus
from services.crawler import run_crawler

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [CRAWLER-WORKER] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class CrawlerWorker:
    """
    Crawler worker that polls for pending crawl jobs and executes them
    """
    
    def __init__(self, worker_id=None, poll_interval=30):
        """
        Initialize crawler worker
        
        Args:
            worker_id: Optional unique identifier for this worker
            poll_interval: Seconds to wait between polling for jobs
        """
        self.worker_id = worker_id or f"crawler-worker-{os.getpid()}"
        self.poll_interval = poll_interval
        self.running = True
        
        logger.info(f"Initializing Crawler Worker: {self.worker_id}")
        logger.info(f"Poll interval: {poll_interval}s")
    
    def auto_resume_interrupted_jobs(self):
        """
        Auto-resume crawl jobs that were interrupted (RUNNING or FAILED status)
        This runs once on startup
        """
        db = SessionLocal()
        try:
            # Find jobs that were running or failed
            interrupted_jobs = db.query(CrawlJob).filter(
                CrawlJob.status.in_([CrawlStatus.RUNNING, CrawlStatus.FAILED])
            ).all()
            
            if interrupted_jobs:
                logger.info(f"Found {len(interrupted_jobs)} interrupted crawl job(s), auto-resuming...")
                
                for job in interrupted_jobs:
                    logger.info(f"  → Resuming crawl job #{job.id}: {job.start_url} (was {job.status.value})")
                    
                    # Reset status to RUNNING
                    job.status = CrawlStatus.RUNNING
                    job.error_message = None
                    db.commit()
                    
                    # Run crawler (blocking call)
                    try:
                        run_crawler(job.id)
                    except Exception as e:
                        logger.error(f"  ✗ Failed to resume job #{job.id}: {e}")
                
                logger.info("✓ Auto-resume completed")
            else:
                logger.info("✓ No interrupted crawl jobs to resume")
        
        except Exception as e:
            logger.error(f"Error during auto-resume: {e}")
        
        finally:
            db.close()
    
    def poll_for_pending_jobs(self):
        """
        Poll the database for pending crawl jobs and execute them
        """
        db = SessionLocal()
        try:
            # Query for pending jobs (FIFO order)
            pending_jobs = db.query(CrawlJob).filter(
                CrawlJob.status == CrawlStatus.PENDING
            ).order_by(CrawlJob.created_at.asc()).limit(1).all()
            
            if not pending_jobs:
                return 0
            
            job = pending_jobs[0]
            logger.info(f"Found pending crawl job #{job.id}: {job.start_url}")
            
            # Mark as running
            job.status = CrawlStatus.RUNNING
            db.commit()
            
            # Execute crawler (blocking call)
            try:
                run_crawler(job.id)
                logger.info(f"✓ Completed crawl job #{job.id}")
                return 1
            
            except Exception as e:
                logger.error(f"✗ Failed to execute job #{job.id}: {e}")
                # Status will be updated to FAILED by the crawler itself
                return 0
        
        except Exception as e:
            logger.error(f"Error polling for jobs: {e}")
            return 0
        
        finally:
            db.close()
    
    def run(self):
        """
        Main worker loop - continuously poll for jobs
        """
        logger.info("=" * 60)
        logger.info(f"Starting Crawler Worker: {self.worker_id}")
        logger.info("=" * 60)
        
        # Check database connection
        if not check_db_connection():
            logger.error("✗ Database connection failed - exiting")
            sys.exit(1)
        
        logger.info("✓ Database connection successful")
        
        # Auto-resume interrupted jobs on startup
        logger.info("Checking for interrupted crawl jobs...")
        self.auto_resume_interrupted_jobs()
        
        # Main polling loop
        logger.info(f"Starting polling loop (interval: {self.poll_interval}s)")
        logger.info("Press Ctrl+C to stop")
        
        jobs_processed = 0
        
        try:
            while self.running:
                try:
                    processed = self.poll_for_pending_jobs()
                    jobs_processed += processed
                    
                    if processed > 0:
                        logger.info(f"Total jobs processed: {jobs_processed}")
                    
                    # Wait before next poll
                    time.sleep(self.poll_interval)
                
                except KeyboardInterrupt:
                    logger.info("Received interrupt signal - shutting down gracefully")
                    self.running = False
                    break
                
                except Exception as e:
                    logger.error(f"Error in polling loop: {e}")
                    # Wait a bit before retrying to avoid rapid error loops
                    time.sleep(min(self.poll_interval, 10))
        
        finally:
            logger.info(f"Crawler Worker stopped. Total jobs processed: {jobs_processed}")


def main():
    """
    Entry point for crawler worker
    """
    # Get configuration from environment
    worker_id = os.getenv("WORKER_ID")
    poll_interval = int(os.getenv("POLL_INTERVAL", "30"))
    
    # Create and run worker
    worker = CrawlerWorker(worker_id=worker_id, poll_interval=poll_interval)
    worker.run()


if __name__ == "__main__":
    main()
