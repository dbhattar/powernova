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
from langdetect import detect, detect_langs, DetectorFactory, LangDetectException

from models import CrawlJob, CrawlStatus, Document, DocumentType, DocumentStatus, DocumentJob, DocumentJobStatus
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
    
    def _sanitize_text(self, text: Optional[str]) -> Optional[str]:
        """
        Sanitize text content to remove NULL bytes and other problematic characters.
        PostgreSQL TEXT columns cannot contain NULL (0x00) bytes.
        
        Args:
            text: Text to sanitize
            
        Returns:
            Sanitized text or None if input is None
        """
        if text is None:
            return None
        
        # Remove NULL bytes (0x00) which PostgreSQL doesn't allow in TEXT columns
        sanitized = text.replace('\x00', '')
        
        # Also remove other control characters that might cause issues (optional)
        # Keep common ones like \n, \r, \t
        sanitized = ''.join(char for char in sanitized if ord(char) >= 32 or char in '\n\r\t')
        
        return sanitized
    
    def _detect_language(self, text: str, min_en_prob: float = 0.15) -> tuple:
        """
        Detect the language of text content using langdetect.
        
        IMPORTANT: Uses deterministic detection (seed=0) to avoid random results.
        Also checks English probability to avoid false positives.
        
        Args:
            text: Text content to analyze
            min_en_prob: Minimum English probability to accept as English (default 0.15 = 15%)
            
        Returns:
            Tuple of (language_code, is_english, confidence)
            - language_code: ISO 639-1 code (e.g., 'en', 'es', 'fr')
            - is_english: True if should be treated as English
            - confidence: Probability of detected language (0.0-1.0)
        """
        if not text or len(text.strip()) < 200:
            # Too short for reliable detection - assume English
            logger.debug("Text too short for language detection, assuming English")
            return ('en', True, 1.0)
        
        try:
            # CRITICAL: Set seed for deterministic results
            # Without this, langdetect gives different results each time!
            DetectorFactory.seed = 0
            
            # Sample up to 5000 characters for faster detection
            sample = text[:5000] if len(text) > 5000 else text
            
            # Get probabilities for all detected languages
            langs = detect_langs(sample)
            
            top_lang = langs[0].lang
            top_prob = langs[0].prob
            
            # Check English probability
            en_prob = next((lp.prob for lp in langs if lp.lang == 'en'), 0.0)
            
            # Decision logic:
            # - If top language is English, it's English
            # - If English probability >= min_en_prob, treat as English (might be mixed content)
            # This prevents false positives from skipping English documents
            is_english = (top_lang == 'en') or (en_prob >= min_en_prob)
            
            logger.debug(
                f"Language detection: {top_lang} ({top_prob:.2f}), "
                f"English prob: {en_prob:.2f}, "
                f"is_english: {is_english}"
            )
            
            return (top_lang, is_english, top_prob)
            
        except LangDetectException as e:
            logger.warning(f"Language detection failed: {e}, assuming English")
            return ('en', True, 1.0)
        except Exception as e:
            logger.error(f"Unexpected error in language detection: {e}, assuming English")
            return ('en', True, 1.0)
    
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
            
            # Handle HTTP errors gracefully
            if response.status_code >= 400:
                logger.warning(f"HTTP error {response.status_code} downloading {url}")
                return False
            
            content = response.content
            file_ext = self._get_file_extension(url) or 'html'
            
            # Determine document type
            # Server-side pages (aspx, jsp, php, etc.) are treated as HTML since they render HTML
            doc_type_map = {
                'pdf': DocumentType.PDF,
                'html': DocumentType.HTML,
                'htm': DocumentType.HTML,
                'aspx': DocumentType.HTML,
                'asp': DocumentType.HTML,
                'jsp': DocumentType.HTML,
                'jspx': DocumentType.HTML,
                'php': DocumentType.HTML,
                'ashx': DocumentType.HTML,
                'asmx': DocumentType.HTML,
                'cfm': DocumentType.HTML,
                'xhtml': DocumentType.HTML,
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
            
            # Sanitize text content to remove NULL bytes (PostgreSQL doesn't allow them in TEXT columns)
            sanitized_title = self._sanitize_text(title)
            sanitized_content = self._sanitize_text(text_content)
            
            # Create document record
            document = Document(
                url=url,
                title=sanitized_title,
                content=sanitized_content,
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
            
            # Rollback the failed transaction
            self.db.rollback()
            
            # Create failed document record
            document = Document(
                url=url,
                title=url,
                document_type=DocumentType.OTHER,
                status=DocumentStatus.FAILED,
                error_message=self._sanitize_text(str(e)),
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
            # Server-side pages (aspx, jsp, php, etc.) are treated as HTML since they render HTML
            doc_type_map = {
                'pdf': DocumentType.PDF,
                'html': DocumentType.HTML,
                'htm': DocumentType.HTML,
                'aspx': DocumentType.HTML,
                'asp': DocumentType.HTML,
                'jsp': DocumentType.HTML,
                'jspx': DocumentType.HTML,
                'php': DocumentType.HTML,
                'ashx': DocumentType.HTML,
                'asmx': DocumentType.HTML,
                'cfm': DocumentType.HTML,
                'xhtml': DocumentType.HTML,
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
            
            # Check if extraction failed with error metadata
            extraction_error = metadata.get('error')
            error_type = metadata.get('error_type')
            extraction_warning = metadata.get('extraction_warning')
            
            # Handle extraction failures
            if extraction_error:
                logger.error(f"Document extraction failed for {url}: {extraction_error}")
                
                # Save as failed document with detailed error info
                document = Document(
                    url=url,
                    title=title,
                    content=text_content[:1000] if text_content else "",  # Save partial content if any
                    document_type=doc_type,
                    file_path=blob_path,
                    blob_url=blob_url,
                    file_size=file_size,
                    status=DocumentStatus.FAILED,
                    error_message=f"Extraction error: {extraction_error}",
                    doc_metadata=metadata,
                    language='unknown',
                    crawl_job_id=self.job_id,
                    embedding_generated=False,
                    chunk_count=0
                )
                self.db.add(document)
                self.db.commit()
                
                logger.warning(
                    f"Skipping document due to extraction error ({error_type}): {url}"
                )
                return False
            
            # Warn about partial extraction (some pages failed)
            if extraction_warning:
                logger.warning(f"Partial extraction for {url}: {extraction_warning}")
            
            # Check if we got any text content at all
            if not text_content or len(text_content.strip()) < 50:
                logger.warning(f"Insufficient text content extracted from {url} (length: {len(text_content or '')})")
                
                # Determine if this should fail or be marked for manual review
                error_msg = "No text extracted"
                if metadata.get('page_count', 0) > 0:
                    error_msg += f" ({metadata['page_count']} pages - likely image-based PDF or corrupted)"
                
                document = Document(
                    url=url,
                    title=title,
                    content=text_content or "",
                    document_type=doc_type,
                    file_path=blob_path,
                    blob_url=blob_url,
                    file_size=file_size,
                    status=DocumentStatus.FAILED,
                    error_message=error_msg,
                    doc_metadata=metadata,
                    language='unknown',
                    crawl_job_id=self.job_id,
                    embedding_generated=False,
                    chunk_count=0
                )
                self.db.add(document)
                self.db.commit()
                return False
            
            # Sanitize text content to remove NULL bytes (PostgreSQL doesn't allow them in TEXT columns)
            sanitized_title = self._sanitize_text(title)
            sanitized_content = self._sanitize_text(text_content)
            
            # Detect language with improved logic
            detected_lang, is_english, confidence = self._detect_language(sanitized_content)
            
            # Skip non-English documents with high confidence (they often cause token anomalies)
            # Only skip if:
            # 1. Detected as non-English (is_english=False)
            # 2. High confidence (>70%) to avoid false positives
            should_skip = not is_english and confidence > 0.7
            
            if should_skip:
                logger.warning(
                    f"Skipping non-English document: {url} "
                    f"(detected language: {detected_lang}, confidence: {confidence:.2f}). "
                    f"Non-English content often causes token inflation and embedding issues."
                )
                # Save as failed document with explanation
                document = Document(
                    url=url,
                    title=sanitized_title,
                    content=sanitized_content[:1000],  # Save first 1000 chars for reference
                    document_type=doc_type,
                    file_path=blob_path,
                    blob_url=blob_url,
                    file_size=file_size,
                    status=DocumentStatus.FAILED,
                    error_message=f"Skipped: Non-English content detected (language: {detected_lang}, confidence: {confidence:.2f})",
                    language=detected_lang,
                    crawl_job_id=self.job_id,
                    embedding_generated=False,
                    chunk_count=0
                )
                self.db.add(document)
                self.db.commit()
                return False
            
            # Log if borderline case (will process, but detected as non-English with low confidence)
            if not is_english:
                logger.info(
                    f"Processing borderline document: {url} "
                    f"(detected: {detected_lang}, confidence: {confidence:.2f}, English prob likely >15%)"
                )
            
            # Create document record
            document = Document(
                url=url,
                title=sanitized_title,
                content=sanitized_content,
                document_type=doc_type,
                file_path=blob_path,
                blob_url=blob_url,
                file_size=file_size,
                status=DocumentStatus.COMPLETED,
                doc_metadata=metadata,
                language=detected_lang,
                crawl_job_id=self.job_id,
                embedding_generated=False,
                chunk_count=0
            )
            
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)  # Get the document ID
            
            self.documents_found += 1
            logger.info(f"Saved {file_ext} document: {title} ({file_size} bytes)")
            
            # Create document processing job instead of processing inline
            # This allows for asynchronous processing and better error handling
            try:
                document_job = DocumentJob(
                    document_id=document.id,
                    status=DocumentJobStatus.PENDING,
                    retry_count=0
                )
                self.db.add(document_job)
                self.db.commit()
                logger.info(f"Created document processing job for document {document.id}")
            except Exception as e:
                logger.error(f"Failed to create document job for document {document.id}: {e}")
                # Don't fail the whole crawl if job creation fails
                # The document is saved, it can be manually reprocessed later
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to save document {url}: {e}")
            
            # Rollback the failed transaction
            self.db.rollback()
            
            # Create failed document record
            document = Document(
                url=url,
                title=url,
                document_type=DocumentType.OTHER,
                status=DocumentStatus.FAILED,
                error_message=self._sanitize_text(str(e)),
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
            
            # Save visited URL to database with status code (even for errors)
            self._save_visited_url(url, response.status_code, depth)
            
            # Handle HTTP error status codes gracefully
            if response.status_code >= 400:
                # Client errors (4xx) and server errors (5xx)
                if response.status_code == 404:
                    logger.warning(f"Page not found (404): {url}")
                elif response.status_code == 403:
                    logger.warning(f"Access forbidden (403): {url}")
                elif response.status_code == 401:
                    logger.warning(f"Unauthorized (401): {url}")
                elif response.status_code >= 500:
                    logger.warning(f"Server error ({response.status_code}): {url}")
                else:
                    logger.warning(f"HTTP error {response.status_code}: {url}")
                
                # Skip this URL and continue crawling
                return
            
            content_type = response.headers.get('Content-Type', '').lower()
            
            # Skip Office Open XML component files (themes, relationships, etc.)
            # These have .docx extensions but aren't Word documents
            office_component_types = [
                'thememanager+xml',
                'theme+xml', 
                'relationships+xml',
                'slideshow+xml',
                'presentation+xml'
            ]
            if any(comp in content_type for comp in office_component_types):
                logger.debug(f"Skipping Office XML component file: {content_type} for {url}")
                return
            
            # Determine if this is a document we should save based on content type
            should_save = False
            file_ext = self._get_file_extension(url)
            
            # Check content type to determine document type
            if 'text/html' in content_type:
                should_save = 'html' in self.file_types
                file_ext = file_ext or 'html'
            # Server-side pages often have text/html content type even with different extensions
            elif file_ext in ['aspx', 'asp', 'jsp', 'jspx', 'php', 'ashx', 'asmx', 'cfm'] and 'html' in self.file_types:
                should_save = True
                # Keep the original extension for proper storage, but will be processed as HTML
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
                # But be careful: don't process based on extension alone if content type is mismatched
                if file_ext and file_ext in self.file_types:
                    # For DOCX files, verify the content type matches or at least isn't contradictory
                    if file_ext in ['docx', 'doc']:
                        # If content type is set and doesn't look like a Word document, skip it
                        if content_type and not any(word_type in content_type for word_type in [
                            'application/vnd.openxmlformats-officedocument.wordprocessingml',
                            'application/msword',
                            'application/octet-stream',  # Generic binary, might be valid
                            'application/zip'  # DOCX is a ZIP file
                        ]):
                            logger.warning(f"Skipping .docx file with mismatched content type: {content_type} for {url}")
                            return
                    
                    # For PDF files, verify content type
                    if file_ext == 'pdf':
                        if content_type and 'pdf' not in content_type and 'octet-stream' not in content_type:
                            logger.warning(f"Skipping .pdf file with mismatched content type: {content_type} for {url}")
                            return
                    
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
            
        except requests.exceptions.Timeout:
            logger.warning(f"Request timeout (30s) for {url} - skipping")
            # Save as visited with a placeholder status code
            try:
                self._save_visited_url(url, 408, depth)  # 408 = Request Timeout
            except:
                pass
        except requests.exceptions.ConnectionError as e:
            logger.warning(f"Connection error for {url}: {e} - skipping")
            try:
                self._save_visited_url(url, 0, depth)  # 0 = Connection failed
            except:
                pass
        except requests.exceptions.TooManyRedirects:
            logger.warning(f"Too many redirects for {url} - skipping")
            try:
                self._save_visited_url(url, 310, depth)  # 310 = Too many redirects
            except:
                pass
        except requests.exceptions.RequestException as e:
            logger.warning(f"Request failed for {url}: {e} - skipping")
            try:
                self._save_visited_url(url, 0, depth)
            except:
                pass
        except Exception as e:
            logger.error(f"Unexpected error crawling {url}: {e} - skipping")
            # Don't let one bad URL stop the entire crawl
            try:
                self._save_visited_url(url, 0, depth)
            except:
                pass
    
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
            
            # Rollback any failed transaction
            self.db.rollback()
            
            # Mark job as failed (keep queue for potential restart)
            self.job.status = CrawlStatus.FAILED
            self.job.error_message = self._sanitize_text(str(e))
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
            # Rollback any failed transaction
            db.rollback()
            
            job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
            if job:
                job.status = CrawlStatus.FAILED
                # Sanitize error message to remove NULL bytes
                error_msg = str(e).replace('\x00', '')
                job.error_message = error_msg
                job.completed_at = datetime.utcnow()
                db.commit()
        except:
            pass
    finally:
        db.close()
