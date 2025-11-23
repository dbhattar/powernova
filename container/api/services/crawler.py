"""
Web crawler service
Crawls websites and downloads documents for RAG indexing
"""
import logging
import requests
from typing import Set, List, Optional, Dict
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime
from sqlalchemy.orm import Session

from models import CrawlJob, CrawlStatus, Document, DocumentType, DocumentStatus
from models.crawl_state import CrawlVisitedUrl, CrawlQueuedUrl
from services.azure_storage import get_storage_service
from services.document_processor import get_document_processor

logger = logging.getLogger(__name__)


class WebCrawler:
    """
    Web crawler that follows links and downloads documents
    """
    
    def __init__(self, job_id: int, db: Session):
        """
        Initialize crawler
        
        Args:
            job_id: Database ID of the crawl job
            db: Database session
        """
        self.job_id = job_id
        self.db = db
        self.storage_service = get_storage_service()
        self.document_processor = get_document_processor()
        
        # Load job configuration
        self.job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if not self.job:
            raise ValueError(f"Crawl job {job_id} not found")
        
        self.start_url = self.job.start_url
        self.max_depth = self.job.max_depth
        self.max_pages = self.job.max_pages
        self.file_types = self.job.file_types
        self.allowed_domains = set(self.job.allowed_domains) if self.job.allowed_domains else set()
        
        # URL patterns
        self.include_patterns = [re.compile(p) for p in self.job.url_patterns.get('include', [])]
        self.exclude_patterns = [re.compile(p) for p in self.job.url_patterns.get('exclude', [])]
        
        # Crawl state - Load from database if resuming
        self.visited_urls: Set[str] = set()  # URLs we've already crawled
        self.queued_urls: Set[str] = set()  # URLs we've queued but not yet crawled
        self.to_visit: List[tuple] = []  # (url, depth)
        self.documents_found = 0
        self.pages_crawled = 0
        
        # Load existing state if job is being resumed
        self._load_crawl_state()
        
        # If no queued URLs (fresh start), add start URL
        if not self.to_visit:
            self.to_visit.append((self.start_url, 0))
        
        # robots.txt parsers cache (one per domain)
        self.robots_parsers: Dict[str, RobotFileParser] = {}
        
        # Request settings
        self.session = requests.Session()
        # Identify as a legitimate bot with contact information
        # Format follows best practices: BotName/version (+URL for more info)
        self.user_agent = 'PowerNOVA-Crawler/1.0 bot for document indexing)'
        self.session.headers.update({
            'User-Agent': self.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        })
        self.request_delay = 1.0  # Polite crawling delay (1 second between requests)
    
    def _load_crawl_state(self):
        """
        Load crawl state from database if resuming a job.
        This allows resuming interrupted crawls without re-visiting pages.
        """
        # Load visited URLs
        visited = self.db.query(CrawlVisitedUrl).filter(
            CrawlVisitedUrl.crawl_job_id == self.job_id
        ).all()
        
        for v in visited:
            self.visited_urls.add(v.url)
        
        if visited:
            logger.info(f"Loaded {len(visited)} visited URLs from database")
        
        # Load queued URLs
        queued = self.db.query(CrawlQueuedUrl).filter(
            CrawlQueuedUrl.crawl_job_id == self.job_id
        ).order_by(CrawlQueuedUrl.priority.desc(), CrawlQueuedUrl.added_at).all()
        
        for q in queued:
            self.to_visit.append((q.url, q.depth))
            self.queued_urls.add(q.url)
        
        if queued:
            logger.info(f"Loaded {len(queued)} queued URLs from database")
        
        # Set counters from job
        self.pages_crawled = self.job.pages_crawled
        self.documents_found = self.job.documents_found
    
    def _save_visited_url(self, url: str, status_code: int, depth: int):
        """
        Save a visited URL to the database.
        
        Args:
            url: The URL that was visited
            status_code: HTTP status code received
            depth: Depth at which this URL was crawled
        """
        try:
            visited = CrawlVisitedUrl(
                crawl_job_id=self.job_id,
                url=url,
                status_code=status_code,
                depth=depth
            )
            self.db.add(visited)
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to save visited URL {url}: {e}")
            self.db.rollback()
    
    def _save_queued_url(self, url: str, depth: int, priority: int = 0):
        """
        Save a queued URL to the database.
        
        Args:
            url: The URL to queue
            depth: Depth for this URL
            priority: Priority (higher = crawled sooner)
        """
        try:
            queued = CrawlQueuedUrl(
                crawl_job_id=self.job_id,
                url=url,
                depth=depth,
                priority=priority
            )
            self.db.add(queued)
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to save queued URL {url}: {e}")
            self.db.rollback()
    
    def _remove_queued_url(self, url: str):
        """
        Remove a URL from the queue in the database (when it's being crawled).
        
        Args:
            url: The URL to remove from queue
        """
        try:
            self.db.query(CrawlQueuedUrl).filter(
                CrawlQueuedUrl.crawl_job_id == self.job_id,
                CrawlQueuedUrl.url == url
            ).delete()
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to remove queued URL {url}: {e}")
            self.db.rollback()
    
    def _clear_queued_urls(self):
        """
        Clear all queued URLs for this job from the database.
        Called when job completes successfully.
        """
        try:
            self.db.query(CrawlQueuedUrl).filter(
                CrawlQueuedUrl.crawl_job_id == self.job_id
            ).delete()
            self.db.commit()
            logger.info(f"Cleared queued URLs for job {self.job_id}")
        except Exception as e:
            logger.warning(f"Failed to clear queued URLs: {e}")
            self.db.rollback()
    
    def _is_allowed_domain(self, url: str) -> bool:
        """Check if URL domain is allowed"""
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # If no allowed domains specified, only allow same domain as start URL
        if not self.allowed_domains:
            start_domain = urlparse(self.start_url).netloc
            return domain == start_domain
        
        # Check if domain matches any allowed domain
        # Support both exact match and subdomain match
        # e.g., if allowed domain is "example.com", allow both "example.com" and "www.example.com"
        for allowed_domain in self.allowed_domains:
            # Exact match
            if domain == allowed_domain:
                return True
            
            # Subdomain match: domain ends with .allowed_domain
            if domain.endswith('.' + allowed_domain):
                return True
            
            # Reverse check: if allowed_domain is a subdomain of domain
            # e.g., allowed="www.example.com" should match domain="example.com"
            if allowed_domain.endswith('.' + domain):
                return True
        
        return False
    
    def _get_robots_parser(self, url: str) -> Optional[RobotFileParser]:
        """
        Get or create robots.txt parser for a domain
        
        Args:
            url: URL to get parser for
            
        Returns:
            RobotFileParser instance or None if robots.txt is inaccessible
        """
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        
        # Return cached parser if exists
        if domain in self.robots_parsers:
            return self.robots_parsers[domain]
        
        # Create new parser
        robots_url = f"{domain}/robots.txt"
        parser = RobotFileParser()
        parser.set_url(robots_url)
        
        try:
            parser.read()
            self.robots_parsers[domain] = parser
            logger.info(f"Loaded robots.txt from {robots_url}")
            return parser
        except Exception as e:
            # If robots.txt doesn't exist or is inaccessible, assume we can crawl
            logger.debug(f"Could not read robots.txt from {robots_url}: {e}")
            # Cache a permissive parser
            parser.allow_all = True
            self.robots_parsers[domain] = parser
            return parser
    
    def _is_allowed_by_robots(self, url: str) -> bool:
        """
        Check if URL is allowed by robots.txt
        
        Args:
            url: URL to check
            
        Returns:
            True if allowed, False otherwise
        """
        parser = self._get_robots_parser(url)
        if parser is None:
            # If we can't get parser, be conservative and allow
            return True
        
        # Check if our user agent can fetch this URL
        allowed = parser.can_fetch(self.user_agent, url)
        
        if not allowed:
            logger.info(f"Blocked by robots.txt: {url}")
        
        return allowed
    
    def _matches_patterns(self, url: str) -> bool:
        """Check if URL matches include/exclude patterns"""
        # If include patterns exist, URL must match at least one
        if self.include_patterns:
            if not any(pattern.search(url) for pattern in self.include_patterns):
                return False
        
        # URL must not match any exclude pattern
        if self.exclude_patterns:
            if any(pattern.search(url) for pattern in self.exclude_patterns):
                return False
        
        return True
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL (remove fragments, trailing slashes)"""
        parsed = urlparse(url)
        # Remove fragment
        normalized = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path.rstrip('/') if parsed.path != '/' else '/',
            parsed.params,
            parsed.query,
            ''  # Remove fragment
        ))
        return normalized
    
    def _get_file_extension(self, url: str) -> Optional[str]:
        """Extract file extension from URL"""
        parsed = urlparse(url)
        path = parsed.path
        
        if '.' in path:
            ext = path.rsplit('.', 1)[-1].lower()
            # Remove query params from extension
            ext = ext.split('?')[0]
            return ext
        
        return None
    
    def _is_document_url(self, url: str) -> bool:
        """Check if URL points to a downloadable document"""
        ext = self._get_file_extension(url)
        return ext in self.file_types if ext else False
    
    def _download_and_save_document(self, url: str, depth: int) -> bool:
        """
        Download a document and save to Azure Storage
        
        Args:
            url: URL of the document
            depth: Crawl depth
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Downloading document: {url}")
            
            # Download document
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            content = response.content
            file_ext = self._get_file_extension(url) or 'html'
            
            # Determine document type
            doc_type_map = {
                'pdf': DocumentType.PDF,
                'html': DocumentType.HTML,
                'htm': DocumentType.HTML,
                'txt': DocumentType.TEXT,
                'md': DocumentType.MARKDOWN,
                'docx': DocumentType.DOCX,
                'doc': DocumentType.DOCX
            }
            doc_type = doc_type_map.get(file_ext, DocumentType.OTHER)
            
            # Upload to Azure Storage
            blob_path, blob_url, file_size = self.storage_service.upload_document(
                content=content,
                url=url,
                file_extension=file_ext,
                job_id=self.job_id,
                content_type=response.headers.get('Content-Type')
            )
            
            # Extract text content
            title, text_content, metadata = self.document_processor.process_document(
                content, file_ext, url
            )
            
            # Create document record
            document = Document(
                url=url,
                title=title,
                content=text_content,
                document_type=doc_type,
                file_path=blob_path,
                blob_url=blob_url,
                file_size=file_size,
                status=DocumentStatus.COMPLETED,
                doc_metadata=metadata,
                crawl_job_id=self.job_id,
                embedding_generated=False,
                chunk_count=0
            )
            
            self.db.add(document)
            self.db.commit()
            
            self.documents_found += 1
            logger.info(f"Saved document: {title} ({file_size} bytes)")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to download document {url}: {e}")
            
            # Create failed document record
            document = Document(
                url=url,
                title=url,
                document_type=DocumentType.OTHER,
                status=DocumentStatus.FAILED,
                error_message=str(e),
                crawl_job_id=self.job_id
            )
            self.db.add(document)
            self.db.commit()
            
            return False
    
    def _save_fetched_document(self, url: str, content: bytes, file_ext: str, content_type: str, depth: int) -> bool:
        """
        Save an already-fetched document to Azure Storage
        
        Args:
            url: URL of the document
            content: Document content as bytes
            file_ext: File extension
            content_type: Content-Type header value
            depth: Crawl depth
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if document with this URL already exists
            existing_doc = self.db.query(Document).filter(Document.url == url).first()
            if existing_doc:
                logger.info(f"Document already exists (ID: {existing_doc.id}), skipping: {url}")
                # Still count it as found if it wasn't from this crawl job
                if existing_doc.crawl_job_id != self.job_id:
                    self.documents_found += 1
                return True
            
            logger.info(f"Saving {file_ext} document: {url}")
            
            # Determine document type
            doc_type_map = {
                'pdf': DocumentType.PDF,
                'html': DocumentType.HTML,
                'htm': DocumentType.HTML,
                'txt': DocumentType.TEXT,
                'md': DocumentType.MARKDOWN,
                'docx': DocumentType.DOCX,
                'doc': DocumentType.DOCX
            }
            doc_type = doc_type_map.get(file_ext, DocumentType.OTHER)
            
            # Upload to Azure Storage
            blob_path, blob_url, file_size = self.storage_service.upload_document(
                content=content,
                url=url,
                file_extension=file_ext,
                job_id=self.job_id,
                content_type=content_type
            )
            
            # Extract text content
            title, text_content, metadata = self.document_processor.process_document(
                content, file_ext, url
            )
            
            # Create document record
            document = Document(
                url=url,
                title=title,
                content=text_content,
                document_type=doc_type,
                file_path=blob_path,
                blob_url=blob_url,
                file_size=file_size,
                status=DocumentStatus.COMPLETED,
                doc_metadata=metadata,
                crawl_job_id=self.job_id,
                embedding_generated=False,
                chunk_count=0
            )
            
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)  # Get the document ID
            
            self.documents_found += 1
            logger.info(f"Saved {file_ext} document: {title} ({file_size} bytes)")
            
            # Generate embedding in background
            # Note: In production, consider using a queue for this
            try:
                from services.embedding_processor import process_document_embedding
                process_document_embedding(document.id, self.db)
            except Exception as e:
                logger.warning(f"Failed to generate embedding for document {document.id}: {e}")
                # Don't fail the whole crawl if embedding generation fails
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to save document {url}: {e}")
            
            # Create failed document record
            document = Document(
                url=url,
                title=url,
                document_type=DocumentType.OTHER,
                status=DocumentStatus.FAILED,
                error_message=str(e),
                crawl_job_id=self.job_id
            )
            self.db.add(document)
            self.db.commit()
            
            return False
    
    def _crawl_page(self, url: str, depth: int):
        """
        Crawl a single page and extract links
        
        Args:
            url: URL to crawl
            depth: Current depth
        """
        try:
            # Check robots.txt before crawling
            if not self._is_allowed_by_robots(url):
                logger.info(f"Skipping {url} - disallowed by robots.txt")
                return
            
            # Mark as visited now that we're actually crawling it
            self.visited_urls.add(url)
            self.pages_crawled += 1
            
            # Remove from queue in database
            self._remove_queued_url(url)
            
            logger.info(f"Crawling page {self.pages_crawled}/{self.max_pages}: {url} (depth: {depth})")
            
            # Polite delay between requests
            if self.pages_crawled > 1:
                time.sleep(self.request_delay)
            
            # Fetch the page/document
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Save visited URL to database with status code
            self._save_visited_url(url, response.status_code, depth)
            
            content_type = response.headers.get('Content-Type', '').lower()
            
            # Determine if this is a document we should save based on content type
            should_save = False
            file_ext = self._get_file_extension(url)
            
            # Check content type to determine document type
            if 'text/html' in content_type:
                should_save = 'html' in self.file_types
                file_ext = file_ext or 'html'
            elif 'application/pdf' in content_type:
                should_save = 'pdf' in self.file_types
                file_ext = file_ext or 'pdf'
            elif 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type:
                should_save = 'docx' in self.file_types
                file_ext = file_ext or 'docx'
            elif 'application/msword' in content_type:
                should_save = 'doc' in self.file_types or 'docx' in self.file_types
                file_ext = file_ext or 'doc'
            elif 'text/plain' in content_type:
                should_save = 'txt' in self.file_types or 'text' in self.file_types
                file_ext = file_ext or 'txt'
            elif 'text/markdown' in content_type:
                should_save = 'md' in self.file_types or 'markdown' in self.file_types
                file_ext = file_ext or 'md'
            else:
                # Check if URL has a file extension we care about
                if file_ext and file_ext in self.file_types:
                    should_save = True
                else:
                    logger.debug(f"Skipping unsupported content type: {content_type} for {url}")
                    return
            
            if should_save:
                # Save document directly with the response we already fetched
                self._save_fetched_document(url, response.content, file_ext, content_type, depth)
            
            # Only extract links from HTML pages
            if 'text/html' in content_type:
                # If we've reached max depth, don't extract links
                if depth >= self.max_depth:
                    logger.debug(f"Reached max depth {self.max_depth}, not extracting links from {url}")
                    return
                
                # Parse HTML and extract links
                soup = BeautifulSoup(response.content, 'html.parser')
                
                links_found = 0
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    
                    # Resolve relative URLs
                    absolute_url = urljoin(url, href)
                    normalized_url = self._normalize_url(absolute_url)
                    
                    # Skip if already visited or queued
                    if normalized_url in self.visited_urls or normalized_url in self.queued_urls:
                        continue
                    
                    # Check domain, patterns, etc.
                    if not self._is_allowed_domain(normalized_url):
                        continue
                    
                    if not self._matches_patterns(normalized_url):
                        continue
                    
                    # Check robots.txt before adding to queue
                    if not self._is_allowed_by_robots(normalized_url):
                        continue
                    
                    # Add to queue (both memory and database)
                    self.to_visit.append((normalized_url, depth + 1))
                    self.queued_urls.add(normalized_url)
                    self._save_queued_url(normalized_url, depth + 1)
                    links_found += 1
                
                logger.info(f"Found {links_found} new links on {url}")
            
        except Exception as e:
            logger.error(f"Failed to crawl {url}: {e}")
    
    def run(self):
        """
        Run the crawler
        """
        try:
            # Update job status
            self.job.status = CrawlStatus.RUNNING
            self.job.started_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Starting crawl job {self.job_id}: {self.start_url}")
            logger.info(f"Max depth: {self.max_depth}, Max pages: {self.max_pages if self.max_pages != -1 else 'unlimited'}")
            
            # Mark start URL as queued
            normalized_start = self._normalize_url(self.start_url)
            self.queued_urls.add(normalized_start)
            
            # Crawl loop - continue while we have URLs to visit AND haven't hit max pages
            # If max_pages is -1, crawl until no more links are available
            while self.to_visit and (self.max_pages == -1 or self.pages_crawled < self.max_pages):
                # Check if job was cancelled
                self.db.refresh(self.job)
                if self.job.status == CrawlStatus.CANCELLED:
                    logger.info(f"Crawl job {self.job_id} was cancelled")
                    return
                
                # Get next URL
                url, depth = self.to_visit.pop(0)
                
                # Crawl the page (this increments pages_crawled)
                self._crawl_page(url, depth)
                
                # Update job progress
                self.job.pages_crawled = self.pages_crawled
                self.job.documents_found = self.documents_found
                self.db.commit()
                
                # Log progress every 10 pages
                if self.pages_crawled % 10 == 0:
                    logger.info(f"Progress: {self.pages_crawled}/{self.max_pages} pages, {self.documents_found} documents, {len(self.to_visit)} queued")
                
                # Polite delay
                time.sleep(self.request_delay)
            
            # Mark job as completed
            self.job.status = CrawlStatus.COMPLETED
            self.job.completed_at = datetime.utcnow()
            self.job.pages_crawled = self.pages_crawled
            self.job.documents_found = self.documents_found
            self.db.commit()
            
            # Clear queued URLs from database (job completed successfully)
            self._clear_queued_urls()
            
            logger.info(f"Crawl job {self.job_id} completed: {self.pages_crawled} pages crawled, {self.documents_found} documents found")
            
        except Exception as e:
            logger.error(f"Crawl job {self.job_id} failed: {e}")
            
            # Mark job as failed (keep queue for potential restart)
            self.job.status = CrawlStatus.FAILED
            self.job.error_message = str(e)
            self.job.completed_at = datetime.utcnow()
            self.db.commit()


def run_crawler(job_id: int):
    """
    Run crawler for a job (to be called as background task)
    
    Args:
        job_id: Crawl job ID
    """
    # Import here to avoid circular dependency
    from database.session import SessionLocal
    
    # Create a new database session for the background task
    db = SessionLocal()
    try:
        crawler = WebCrawler(job_id, db)
        crawler.run()
    except Exception as e:
        logger.error(f"Failed to run crawler for job {job_id}: {e}")
        
        # Try to mark job as failed
        try:
            job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
            if job:
                job.status = CrawlStatus.FAILED
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
                db.commit()
        except:
            pass
    finally:
        db.close()
