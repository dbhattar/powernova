#!/usr/bin/env python3
"""
Reprocess Failed Document Extractions

This script finds documents in FAILED state with "No text extracted" error
and attempts to reprocess them by:
1. Re-downloading the original file from Azure Storage
2. Re-extracting text using the document processor
3. Updating the document record with new content
4. Creating a document job for re-embedding

Usage:
    # Dry run (see what would be reprocessed)
    python scripts/reprocess_failed_extractions.py --dry-run

    # Reprocess a single document
    python scripts/reprocess_failed_extractions.py --doc-id 123

    # Reprocess all failed extractions
    python scripts/reprocess_failed_extractions.py --all

    # Reprocess with limit
    python scripts/reprocess_failed_extractions.py --all --limit 50

    # Filter by specific error patterns
    python scripts/reprocess_failed_extractions.py --all --error-pattern "image-based"
"""

import sys
import os
import argparse
import logging
from typing import Optional, List

# Add the api directory to the path so we can import modules
script_dir = os.path.dirname(os.path.abspath(__file__))
container_dir = os.path.dirname(script_dir)
api_dir = os.path.join(container_dir, 'api')
sys.path.insert(0, api_dir)

# Load environment variables from .env.local if it exists
env_local_path = os.path.join(container_dir, '.env.local')
if os.path.exists(env_local_path):
    print(f"Loading environment variables from {env_local_path}")
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                # Handle both KEY=VALUE and KEY="VALUE" formats
                key, value = line.split('=', 1)
                # Remove surrounding quotes if present
                value = value.strip('"').strip("'")
                os.environ[key] = value

# Now import the modules
try:
    from database.session import SessionLocal
    from models import Document, DocumentStatus, DocumentJob, DocumentJobStatus
    from services.azure_storage import get_storage_service
    from services.document_processor import get_document_processor
except ImportError as e:
    print(f"Error importing modules: {e}")
    print(f"Make sure you're running this from the container directory")
    print(f"Required packages: pip install psycopg2-binary sqlalchemy azure-storage-blob PyPDF2 python-docx beautifulsoup4")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitize text content to remove NULL bytes and other problematic characters.
    
    Args:
        text: Text to sanitize
        
    Returns:
        Sanitized text or None if input is None
    """
    if text is None:
        return None
    
    # Remove NULL bytes (0x00) which PostgreSQL doesn't allow in TEXT columns
    sanitized = text.replace('\x00', '')
    
    # Also remove other control characters that might cause issues
    # Keep common ones like \n, \r, \t
    sanitized = ''.join(char for char in sanitized if ord(char) >= 32 or char in '\n\r\t')
    
    return sanitized


def find_failed_documents(db, error_pattern: Optional[str] = None, limit: Optional[int] = None) -> List[Document]:
    """
    Find all documents in FAILED state with extraction errors.
    
    Args:
        db: Database session
        error_pattern: Optional pattern to filter error messages
        limit: Optional limit on number of documents to return
        
    Returns:
        List of Document objects
    """
    query = db.query(Document).filter(
        Document.status == DocumentStatus.FAILED,
        Document.error_message.like('%No text extracted%')
    )
    
    # Apply additional error pattern filter if specified
    if error_pattern:
        query = query.filter(Document.error_message.like(f'%{error_pattern}%'))
    
    # Apply limit if specified
    if limit:
        query = query.limit(limit)
    
    documents = query.all()
    
    logger.info(f"Found {len(documents)} failed documents with extraction errors")
    
    return documents


def reprocess_document(doc: Document, db, storage_service, document_processor, dry_run: bool = False) -> bool:
    """
    Reprocess a failed document by re-downloading and re-extracting text.
    
    Args:
        doc: Document object to reprocess
        db: Database session
        storage_service: Azure Storage service instance
        document_processor: Document processor service instance
        dry_run: If True, don't actually make changes
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Reprocessing document {doc.id}: {doc.url}")
        logger.info(f"  Current error: {doc.error_message}")
        logger.info(f"  File path: {doc.file_path}")
        logger.info(f"  Document type: {doc.document_type.value if doc.document_type else 'UNKNOWN'}")
        
        if not doc.file_path:
            logger.error(f"  Document {doc.id} has no file_path - cannot reprocess")
            return False
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would download from Azure and reprocess")
            return True
        
        # Download the original file from Azure Storage
        logger.info(f"  Downloading from Azure Storage: {doc.file_path}")
        content = storage_service.download_document(doc.file_path)
        
        if not content:
            logger.error(f"  Failed to download document from Azure Storage")
            return False
        
        logger.info(f"  Downloaded {len(content)} bytes")
        
        # Determine file extension from file_path or document_type
        file_ext = None
        if '.' in doc.file_path:
            file_ext = doc.file_path.rsplit('.', 1)[-1].lower()
            # Clean up extension (remove any Azure Storage suffix)
            file_ext = file_ext.split('?')[0]
        
        if not file_ext or len(file_ext) > 5:
            # Fallback to document_type
            from models import DocumentType
            type_to_ext = {
                DocumentType.PDF: 'pdf',
                DocumentType.HTML: 'html',
                DocumentType.DOCX: 'docx',
                DocumentType.TEXT: 'txt',
                DocumentType.MARKDOWN: 'md',
            }
            file_ext = type_to_ext.get(doc.document_type, 'pdf')
        
        logger.info(f"  Using file extension: {file_ext}")
        
        # Re-extract text content
        logger.info(f"  Extracting text...")
        title, text_content, metadata = document_processor.process_document(
            content, file_ext, doc.url
        )
        
        # Check if extraction still failed
        extraction_error = metadata.get('error')
        extraction_warning = metadata.get('extraction_warning')
        
        if extraction_error:
            logger.warning(f"  Extraction still failed: {extraction_error}")
            # Update with new error information
            doc.error_message = f"Re-extraction failed: {extraction_error}"
            doc.doc_metadata = metadata
            db.commit()
            return False
        
        if extraction_warning:
            logger.warning(f"  Partial extraction: {extraction_warning}")
        
        # Check if we got text this time
        if not text_content or len(text_content.strip()) < 50:
            logger.warning(f"  Still insufficient text extracted: {len(text_content or '')} chars")
            
            error_msg = "Re-extraction: Still no text extracted"
            if metadata.get('page_count', 0) > 0:
                error_msg += f" ({metadata['page_count']} pages - likely image-based PDF)"
            
            doc.error_message = error_msg
            doc.doc_metadata = metadata
            db.commit()
            return False
        
        # Success! Update the document
        sanitized_title = sanitize_text(title)
        sanitized_content = sanitize_text(text_content)
        
        logger.info(f"  ✓ Successfully extracted {len(sanitized_content)} chars of text")
        
        # Update document record
        doc.title = sanitized_title
        doc.content = sanitized_content
        doc.status = DocumentStatus.COMPLETED
        doc.error_message = None
        doc.doc_metadata = metadata
        doc.embedding_generated = False  # Will need to re-embed
        doc.chunk_count = 0  # Will be updated when embedding job runs
        
        db.commit()
        db.refresh(doc)
        
        # Create or reset document job for re-embedding
        existing_job = db.query(DocumentJob).filter(
            DocumentJob.document_id == doc.id
        ).first()
        
        if existing_job:
            logger.info(f"  Resetting existing document job {existing_job.id} to PENDING")
            existing_job.status = DocumentJobStatus.PENDING
            existing_job.retry_count = 0
            existing_job.error_message = None
        else:
            logger.info(f"  Creating new document job")
            document_job = DocumentJob(
                document_id=doc.id,
                status=DocumentJobStatus.PENDING,
                retry_count=0
            )
            db.add(document_job)
        
        db.commit()
        
        logger.info(f"  ✓ Document {doc.id} successfully reprocessed and queued for embedding")
        return True
        
    except Exception as e:
        logger.error(f"  ✗ Failed to reprocess document {doc.id}: {e}")
        db.rollback()
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Reprocess failed document extractions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be reprocessed
  python scripts/reprocess_failed_extractions.py --dry-run --all

  # Reprocess a single document
  python scripts/reprocess_failed_extractions.py --doc-id 123

  # Reprocess all failed documents (up to 100)
  python scripts/reprocess_failed_extractions.py --all --limit 100

  # Reprocess only image-based PDFs
  python scripts/reprocess_failed_extractions.py --all --error-pattern "image-based"
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
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
        help='Limit number of documents to reprocess'
    )
    
    parser.add_argument(
        '--error-pattern',
        type=str,
        help='Filter by error message pattern (e.g., "image-based", "corrupted")'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.doc_id and not args.all:
        parser.error('Must specify either --doc-id or --all')
    
    if args.doc_id and args.all:
        parser.error('Cannot specify both --doc-id and --all')
    
    # Initialize services
    logger.info("Initializing services...")
    db = SessionLocal()
    storage_service = get_storage_service()
    document_processor = get_document_processor()
    
    try:
        if args.doc_id:
            # Reprocess single document
            doc = db.query(Document).filter(Document.id == args.doc_id).first()
            
            if not doc:
                logger.error(f"Document {args.doc_id} not found")
                return 1
            
            if doc.status != DocumentStatus.FAILED:
                logger.warning(f"Document {args.doc_id} is not in FAILED state (current: {doc.status.value})")
                response = input("Continue anyway? (y/n): ")
                if response.lower() != 'y':
                    return 0
            
            success = reprocess_document(doc, db, storage_service, document_processor, args.dry_run)
            
            if success:
                logger.info("✓ Successfully reprocessed document")
                return 0
            else:
                logger.error("✗ Failed to reprocess document")
                return 1
        
        else:
            # Reprocess all failed documents
            documents = find_failed_documents(db, args.error_pattern, args.limit)
            
            if not documents:
                logger.info("No failed documents found")
                return 0
            
            logger.info(f"\nFound {len(documents)} documents to reprocess")
            
            if args.dry_run:
                logger.info("\n=== DRY RUN MODE - No changes will be made ===\n")
            else:
                logger.info(f"\nThis will reprocess {len(documents)} documents")
                response = input("Continue? (y/n): ")
                if response.lower() != 'y':
                    logger.info("Cancelled")
                    return 0
            
            # Process documents
            success_count = 0
            failed_count = 0
            
            for i, doc in enumerate(documents, 1):
                logger.info(f"\n[{i}/{len(documents)}] Processing document {doc.id}...")
                
                success = reprocess_document(doc, db, storage_service, document_processor, args.dry_run)
                
                if success:
                    success_count += 1
                else:
                    failed_count += 1
            
            # Summary
            logger.info("\n" + "="*60)
            logger.info("SUMMARY")
            logger.info("="*60)
            logger.info(f"Total documents: {len(documents)}")
            logger.info(f"Successfully reprocessed: {success_count}")
            logger.info(f"Failed to reprocess: {failed_count}")
            logger.info("="*60)
            
            if args.dry_run:
                logger.info("\nThis was a DRY RUN - no changes were made")
            else:
                logger.info(f"\nSuccessfully reprocessed {success_count} documents")
                if success_count > 0:
                    logger.info("Documents have been queued for re-embedding")
            
            return 0
    
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        return 130
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1
    
    finally:
        db.close()


if __name__ == '__main__':
    sys.exit(main())
