"""
Web crawler service
Crawls websites and downloads documents for RAG indexing
"""
import logging
import requests
from typing import Set, List, Optional, Dict
from urllib.parse import urljoin, urlparse, urlunparse
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime
from sqlalchemy.orm import Session

from models import CrawlJob, CrawlStatus, Document, DocumentType, DocumentStatus
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
        
        # Crawl state
        self.visited_urls: Set[str] = set()  # URLs we've already crawled
        self.queued_urls: Set[str] = set()  # URLs we've queued but not yet crawled
        self.to_visit: List[tuple] = [(self.start_url, 0)]  # (url, depth)
        self.documents_found = 0
        self.pages_crawled = 0
        
        # Request settings
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'PowerNOVA-Crawler/1.0 (Document Indexing Bot)'
        })
        self.request_delay = 0.5  # Polite crawling delay
    
    def _is_allowed_domain(self, url: str) -> bool:
        """Check if URL domain is allowed"""
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # If no allowed domains specified, only allow same domain as start URL
        if not self.allowed_domains:
            start_domain = urlparse(self.start_url).netloc
            return domain == start_domain
        
        return domain in self.allowed_domains
    
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
            
            self.documents_found += 1
            logger.info(f"Saved {file_ext} document: {title} ({file_size} bytes)")
            
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
            # Mark as visited now that we're actually crawling it
            self.visited_urls.add(url)
            self.pages_crawled += 1
            
            logger.info(f"Crawling page {self.pages_crawled}/{self.max_pages}: {url} (depth: {depth})")
            
            # Fetch the page/document
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
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
                    
                    # Add to queue
                    self.to_visit.append((normalized_url, depth + 1))
                    self.queued_urls.add(normalized_url)
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
            logger.info(f"Max depth: {self.max_depth}, Max pages: {self.max_pages}")
            
            # Mark start URL as queued
            normalized_start = self._normalize_url(self.start_url)
            self.queued_urls.add(normalized_start)
            
            # Crawl loop - continue while we have URLs to visit AND haven't hit max pages
            while self.to_visit and self.pages_crawled < self.max_pages:
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
            
            logger.info(f"Crawl job {self.job_id} completed: {self.pages_crawled} pages crawled, {self.documents_found} documents found")
            
        except Exception as e:
            logger.error(f"Crawl job {self.job_id} failed: {e}")
            
            # Mark job as failed
            self.job.status = CrawlStatus.FAILED
            self.job.error_message = str(e)
            self.job.completed_at = datetime.utcnow()
            self.db.commit()


def run_crawler(job_id: int, db: Session):
    """
    Run crawler for a job (to be called as background task)
    
    Args:
        job_id: Crawl job ID
        db: Database session
    """
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
