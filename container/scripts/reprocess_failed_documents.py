#!/usr/bin/env python3
"""
Reprocess Failed Documents Script

This script finds documents in FAILED state with "No text extracted" error message,
re-downloads them from their original URL, determines the correct file extension
using the improved detection logic, and attempts to reprocess them.

This leverages:
- Improved URL extension parsing (handles /file.pdf/uuid patterns)
- Content-Type header fallback for extensionless URLs
- Enhanced PDF error handling (EOF markers, encryption, etc.)

Usage:
    # Dry run (preview what will be reprocessed)
    python scripts/reprocess_failed_documents.py --dry-run
    
    # Reprocess a specific document
    python scripts/reprocess_failed_documents.py --doc-id 123
    
    # Reprocess all failed documents
    python scripts/reprocess_failed_documents.py --all
    
    # Reprocess with limit
    python scripts/reprocess_failed_documents.py --all --limit 50
"""

import sys
import os
import argparse
import logging
import requests
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

# Add parent directory to path to import from api
script_dir = Path(__file__).parent
container_dir = script_dir.parent
api_dir = container_dir / 'api'
sys.path.insert(0, str(api_dir))

# Load environment variables from .env.local if it exists
env_local_file = container_dir / '.env.local'
if env_local_file.exists():
    print(f"Loading environment from {env_local_file}")
    with open(env_local_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value

try:
    from database.session import SessionLocal
    from models import Document, DocumentStatus, DocumentJob, DocumentJobStatus, DocumentType
    from services.azure_storage import get_storage_service
    from services.document_processor import get_document_processor
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure you're running from the container directory and all dependencies are installed")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_file_extension_from_url(url: str) -> Optional[str]:
    """
    Extract file extension from URL using improved logic.
    Handles complex URLs like: /path/file.pdf/uuid?query=params
    
    Returns None if no extension found in URL.
    """
    parsed = urlparse(url)
    path = parsed.path
    
    if '.' not in path:
        return None
    
    # Split path into segments
    segments = path.split('/')
    
    # Look for a segment with a file extension
    # Start from the end and work backwards
    for segment in reversed(segments):
        if not segment:  # Skip empty segments
            continue
        
        # Check if segment has a dot
        if '.' in segment:
            # Extract extension from this segment
            ext = segment.rsplit('.', 1)[-1].lower()
            
            # Clean up extension
            ext = ext.split('?')[0].split('#')[0]
            
            # Validate that extension looks reasonable
            # Extensions should be alphanumeric and typically 2-5 characters
            if ext and ext.isalnum() and len(ext) >= 2 and len(ext) <= 5:
                return ext
    
    return None


def get_extension_from_content_type(content_type: str) -> Optional[str]:
    """
    Extract file extension from Content-Type header.
    
    Args:
        content_type: Content-Type header value
        
    Returns:
        File extension or None
    """
    if not content_type:
        return None
    
    # Extract just the MIME type, ignoring parameters like charset
    mime_type = content_type.split(';')[0].strip().lower()
    
    # Map common MIME types to file extensions
    mime_to_ext = {
        # Documents
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/msword': 'doc',
        'application/vnd.ms-word': 'doc',
        
        # Text
        'text/html': 'html',
        'application/xhtml+xml': 'html',
        'text/plain': 'txt',
        'text/markdown': 'md',
        
        # Spreadsheets
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-excel': 'xls',
        
        # Presentations
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.ms-powerpoint': 'ppt',
        
        # Other
        'application/rtf': 'rtf',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'application/json': 'json',
    }
    
    return mime_to_ext.get(mime_type)


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitize text content to remove NULL bytes and other problematic characters.
    PostgreSQL TEXT columns cannot contain NULL (0x00) bytes.
    """
    if text is None:
        return None
    
    # Remove NULL bytes
    sanitized = text.replace('\x00', '')
    
    # Remove other control characters (keep \n, \r, \t)
    sanitized = ''.join(char for char in sanitized if ord(char) >= 32 or char in '\n\r\t')
    
    return sanitized


def download_and_determine_extension(url: str) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    """
    Download document from URL and determine file extension.
    Uses two-stage detection:
    1. Extract from URL path
    2. Fall back to Content-Type header if no extension in URL
    
    Returns:
        Tuple of (content, file_extension, content_type)
    """
    try:
        logger.info(f"Downloading from URL: {url}")
        
        # Download with timeout
        response = requests.get(url, timeout=30)
        
        # Handle HTTP errors
        if response.status_code >= 400:
            logger.error(f"HTTP error {response.status_code} downloading {url}")
            return None, None, None
        
        content = response.content
        content_type = response.headers.get('Content-Type', '')
        
        # Stage 1: Try to extract extension from URL
        file_ext = get_file_extension_from_url(url)
        
        # Stage 2: If no extension in URL, use Content-Type header
        if not file_ext:
            file_ext = get_extension_from_content_type(content_type)
            if file_ext:
                logger.info(f"Determined extension '{file_ext}' from Content-Type: {content_type}")
        else:
            logger.info(f"Determined extension '{file_ext}' from URL")
        
        if not file_ext:
            logger.warning(f"Could not determine file extension from URL or Content-Type")
            return content, None, content_type
        
        return content, file_ext, content_type
        
    except requests.exceptions.Timeout:
        logger.error(f"Timeout downloading {url}")
        return None, None, None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading {url}: {e}")
        return None, None, None
    except Exception as e:
        logger.error(f"Unexpected error downloading {url}: {e}")
        return None, None, None


def reprocess_document(doc_id: int, db: SessionLocal, dry_run: bool = False) -> bool:
    """
    Reprocess a single failed document.
    
    Args:
        doc_id: Document ID
        db: Database session
        dry_run: If True, only preview changes without applying them
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get document
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            logger.error(f"Document {doc_id} not found")
            return False
        
        logger.info(f"Processing document {doc_id}: {doc.url}")
        logger.info(f"  Current status: {doc.status}")
        logger.info(f"  Error message: {doc.error_message}")
        
        if dry_run:
            logger.info("  [DRY RUN] Would download and reprocess this document")
            return True
        
        # Download from original URL
        content, file_ext, content_type = download_and_determine_extension(doc.url)
        
        if content is None or file_ext is None:
            logger.error(f"Failed to download or determine extension for {doc.url}")
            return False
        
        logger.info(f"  Downloaded {len(content)} bytes, extension: {file_ext}")
        
        # Get document processor
        doc_processor = get_document_processor()
        
        # Extract text
        title, text_content, metadata = doc_processor.process_document(
            content, file_ext, doc.url
        )
        
        # Check if extraction failed with error
        extraction_error = metadata.get('error')
        if extraction_error:
            logger.error(f"Extraction still failed: {extraction_error}")
            # Update error message with new details
            doc.error_message = f"Re-extraction failed: {extraction_error}"
            doc.doc_metadata = metadata
            db.commit()
            return False
        
        # Check if we got sufficient text
        if not text_content or len(text_content.strip()) < 50:
            error_msg = f"Insufficient text extracted ({len(text_content or '')} chars)"
            logger.warning(error_msg)
            doc.error_message = error_msg
            doc.doc_metadata = metadata
            db.commit()
            return False
        
        # Sanitize text
        sanitized_title = sanitize_text(title)
        sanitized_content = sanitize_text(text_content)
        
        # Determine document type
        doc_type_map = {
            'pdf': DocumentType.PDF,
            'html': DocumentType.HTML,
            'htm': DocumentType.HTML,
            'txt': DocumentType.TEXT,
            'md': DocumentType.MARKDOWN,
            'docx': DocumentType.DOCX,
            'doc': DocumentType.DOCX,
        }
        doc_type = doc_type_map.get(file_ext, DocumentType.OTHER)
        
        # Update document
        doc.title = sanitized_title
        doc.content = sanitized_content
        doc.document_type = doc_type
        doc.status = DocumentStatus.COMPLETED
        doc.error_message = None
        doc.doc_metadata = metadata
        doc.embedding_generated = False
        doc.chunk_count = 0
        
        # Upload to Azure Storage if not already there
        if not doc.file_path or not doc.blob_url:
            try:
                storage_service = get_storage_service()
                blob_path, blob_url, file_size = storage_service.upload_document(
                    content=content,
                    url=doc.url,
                    file_extension=file_ext,
                    job_id=doc.crawl_job_id,
                    content_type=content_type
                )
                doc.file_path = blob_path
                doc.blob_url = blob_url
                doc.file_size = file_size
                logger.info(f"  Uploaded to Azure Storage: {blob_path}")
            except Exception as e:
                logger.warning(f"Failed to upload to Azure Storage: {e}")
                # Continue anyway - we have the text content
        
        db.commit()
        logger.info(f"  ✓ Successfully updated document (extracted {len(text_content)} chars)")
        
        # Create or reset document job for embedding generation
        doc_job = db.query(DocumentJob).filter(DocumentJob.document_id == doc_id).first()
        
        if doc_job:
            # Reset existing job
            doc_job.status = DocumentJobStatus.PENDING
            doc_job.retry_count = 0
            doc_job.error_message = None
            logger.info(f"  ✓ Reset document job to PENDING")
        else:
            # Create new job
            doc_job = DocumentJob(
                document_id=doc_id,
                status=DocumentJobStatus.PENDING,
                retry_count=0
            )
            db.add(doc_job)
            logger.info(f"  ✓ Created new document job")
        
        db.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error reprocessing document {doc_id}: {e}")
        db.rollback()
        return False


def find_failed_documents(db: SessionLocal, limit: Optional[int] = None):
    """
    Find documents in FAILED state with "No text extracted" error.
    
    Returns:
        List of Document objects
    """
    query = db.query(Document).filter(
        Document.status == DocumentStatus.FAILED,
        Document.error_message.like('%No text extracted%')
    )
    
    if limit:
        query = query.limit(limit)
    
    return query.all()


def main():
    parser = argparse.ArgumentParser(
        description='Reprocess failed documents with "No text extracted" errors'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without applying them'
    )
    parser.add_argument(
        '--doc-id',
        type=int,
        help='Reprocess a specific document by ID'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Reprocess all failed documents'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limit number of documents to process'
    )
    
    args = parser.parse_args()
    
    if not args.doc_id and not args.all:
        parser.error("Either --doc-id or --all must be specified")
    
    # Create database session
    db = SessionLocal()
    
    try:
        if args.doc_id:
            # Process single document
            logger.info(f"{'[DRY RUN] ' if args.dry_run else ''}Reprocessing document {args.doc_id}")
            success = reprocess_document(args.doc_id, db, args.dry_run)
            
            if success:
                logger.info("✓ Document reprocessed successfully")
            else:
                logger.error("✗ Failed to reprocess document")
                sys.exit(1)
        
        else:  # args.all
            # Find all failed documents
            docs = find_failed_documents(db, args.limit)
            
            if not docs:
                logger.info("No failed documents found with 'No text extracted' error")
                return
            
            logger.info(f"{'[DRY RUN] ' if args.dry_run else ''}Found {len(docs)} failed documents to reprocess")
            
            # Process each document
            success_count = 0
            failed_count = 0
            
            for i, doc in enumerate(docs, 1):
                logger.info(f"\n{'='*60}")
                logger.info(f"Processing {i}/{len(docs)}")
                logger.info(f"{'='*60}")
                
                if reprocess_document(doc.id, db, args.dry_run):
                    success_count += 1
                else:
                    failed_count += 1
            
            # Summary
            logger.info(f"\n{'='*60}")
            logger.info("SUMMARY")
            logger.info(f"{'='*60}")
            logger.info(f"Total documents: {len(docs)}")
            logger.info(f"Successfully reprocessed: {success_count}")
            logger.info(f"Failed to reprocess: {failed_count}")
            
            if args.dry_run:
                logger.info("\n[DRY RUN] No changes were made to the database")
    
    finally:
        db.close()


if __name__ == '__main__':
    main()
