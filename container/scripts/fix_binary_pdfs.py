#!/usr/bin/env python3
"""
Fix PDF documents with binary content in the database.

This script identifies PDF documents where the 'content' column contains
raw binary bytes instead of extracted text, and reprocesses them by:
1. Downloading the original file from Azure Storage
2. Re-extracting text using PyPDF2
3. Updating the database with extracted text
4. Creating document jobs for re-embedding

Usage:
    # Dry run (preview only)
    python scripts/fix_binary_pdfs.py --dry-run
    
    # Fix specific document
    python scripts/fix_binary_pdfs.py --doc-id 123
    
    # Fix all binary PDFs
    python scripts/fix_binary_pdfs.py --all
    
    # Fix with limit
    python scripts/fix_binary_pdfs.py --all --limit 50
"""

import os
import sys
import argparse
import logging
from typing import List, Dict, Tuple

# Add API directory to Python path
# This allows importing modules when running from local machine
script_dir = os.path.dirname(os.path.abspath(__file__))
container_dir = os.path.dirname(script_dir)  # /path/to/container
api_dir = os.path.join(container_dir, 'api')  # /path/to/container/api

# Add api directory to path so we can import database, models, services
if os.path.exists(api_dir):
    sys.path.insert(0, api_dir)
    print(f"✓ Added to Python path: {api_dir}")
else:
    print(f"⚠️ Warning: API directory not found at {api_dir}")
    print("  Script may not work correctly if modules cannot be imported.")

# Load environment variables from .env.local if it exists
env_local_path = os.path.join(container_dir, '.env.local')
if os.path.exists(env_local_path):
    print(f"✓ Loading environment variables from: {env_local_path}")
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if line and not line.startswith('#'):
                # Handle KEY="VALUE" or KEY=VALUE format
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    os.environ[key] = value
    print(f"✓ Environment variables loaded")
else:
    print(f"ℹ️  No .env.local file found at {env_local_path}")
    print(f"   Using system environment variables")

try:
    from database.session import SessionLocal
    from models import Document
    from services.azure_storage import get_storage_service
    from services.document_processor import get_document_processor
    print("✓ Successfully imported all required modules")
except ModuleNotFoundError as e:
    print(f"\n❌ ERROR: Cannot import required modules: {e}")
    print(f"\nPython path includes:")
    for path in sys.path[:5]:
        print(f"  - {path}")
    print("\nTroubleshooting:")
    print("  1. Make sure you're in the container directory:")
    print(f"     cd {container_dir}")
    print("  2. Run from scripts directory:")
    print("     ./scripts/fix_binary_pdfs.py --help")
    print("  3. Or use absolute path:")
    print(f"     python {os.path.abspath(__file__)} --help")
    print("\nAlternatively, run inside Docker container:")
    print("  docker exec powernova-api python /app/scripts/fix_binary_pdfs.py --help\n")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_binary_content(content: str) -> Tuple[bool, str]:
    """
    Detect if content contains binary data instead of extracted text.
    
    Args:
        content: Document content to check
        
    Returns:
        Tuple of (is_binary, reason)
    """
    if not content:
        return (False, "Empty content")
    
    # Check for PDF magic bytes
    if content.startswith('%PDF-'):
        return (True, "Starts with %PDF- magic bytes")
    
    # Check for high percentage of non-printable characters
    sample = content[:5000]
    non_printable = sum(1 for c in sample if ord(c) < 32 and c not in '\n\r\t')
    
    if len(sample) > 0 and (non_printable / len(sample)) > 0.05:
        return (True, f"High non-printable ratio: {non_printable/len(sample)*100:.1f}%")
    
    # Check for common binary markers
    binary_markers = ['%%EOF', '/Type', 'endobj', 'stream', 'endstream']
    marker_count = sum(1 for marker in binary_markers if marker in content[:1000])
    
    if marker_count >= 3:
        return (True, f"Contains {marker_count} PDF binary markers")
    
    return (False, "Appears to be text content")


def find_binary_documents(db, limit: int = None) -> List[Document]:
    """
    Find documents with binary content.
    
    Args:
        db: Database session
        limit: Maximum number of documents to return
        
    Returns:
        List of Document objects
    """
    query = db.query(Document).filter(
    )
    
    if limit:
        query = query.limit(limit * 2)  # Get extra to account for filtering
    
    documents = query.all()
    
    # Filter to only binary content
    binary_docs = []
    for doc in documents:
        is_binary, reason = is_binary_content(doc.content or "")
        if is_binary:
            binary_docs.append(doc)
            if limit and len(binary_docs) >= limit:
                break
    
    return binary_docs


def reprocess_document(doc_id: int, db, dry_run: bool = True) -> Dict:
    """
    Reprocess a document by re-extracting text from Azure Storage.
    
    Args:
        doc_id: Document ID
        db: Database session
        dry_run: If True, don't save changes
        
    Returns:
        Dict with result information
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    
    if not doc:
        return {"success": False, "error": f"Document {doc_id} not found"}
    
    logger.info(f"Processing Document ID: {doc.id}")
    logger.info(f"  Title: {doc.title}")
    logger.info(f"  URL: {doc.url}")
    logger.info(f"  File Path: {doc.file_path}")
    logger.info(f"  Current content length: {len(doc.content or '')} chars")
    
    # Check if binary
    is_binary, reason = is_binary_content(doc.content or "")
    logger.info(f"  Is Binary: {is_binary} - {reason}")
    
    if not is_binary:
        return {"success": False, "error": "Document doesn't contain binary content"}
    
    try:
        # Initialize services
        storage_service = get_storage_service()
        document_processor = get_document_processor()
        
        # Download original file from Azure Storage
        logger.info(f"  Downloading from Azure Storage: {doc.file_path}")
        pdf_bytes = storage_service.download_document(doc.file_path)
        
        if not pdf_bytes:
            return {"success": False, "error": "Failed to download from Azure Storage"}
        
        logger.info(f"  Downloaded {len(pdf_bytes)} bytes")
        
        # Re-extract text
        logger.info(f"  Extracting text from PDF...")
        title, text_content, metadata = document_processor.extract_text_from_pdf(
            pdf_bytes, 
            doc.url
        )
        
        logger.info(f"  Extracted {len(text_content)} chars")
        logger.info(f"  New title: {title}")
        
        # Preview
        preview = text_content[:500] if text_content else ""
        logger.info(f"  Text preview: {preview[:200]}...")
        
        if dry_run:
            logger.warning(f"  DRY RUN - Changes not saved")
            return {
                "success": True,
                "dry_run": True,
                "doc_id": doc_id,
                "old_length": len(doc.content or ''),
                "new_length": len(text_content),
                "new_title": title
            }
        else:
            # Update database
            logger.info(f"  Updating database...")
            
            # Sanitize text
            sanitized_title = title.replace('\x00', '')
            sanitized_content = text_content.replace('\x00', '')
            
            doc.title = sanitized_title
            doc.content = sanitized_content
            doc.doc_metadata = metadata
            doc.embedding_generated = False
            
            db.commit()
            
            # Create document job for re-embedding
            from models import DocumentJob, DocumentJobStatus
            
            job = db.query(DocumentJob).filter(
                DocumentJob.document_id == doc_id
            ).first()
            
            if job:
                job.status = DocumentJobStatus.PENDING
                job.retry_count = 0
                job.error_message = None
                job.started_at = None
                job.completed_at = None
            else:
                job = DocumentJob(
                    document_id=doc_id,
                    status=DocumentJobStatus.PENDING,
                    retry_count=0
                )
                db.add(job)
            
            db.commit()
            
            logger.info(f"  ✓ Database updated and document job created")
            
            return {
                "success": True,
                "dry_run": False,
                "doc_id": doc_id,
                "old_length": len(doc.content or ''),
                "new_length": len(text_content),
                "new_title": title
            }
    
    except Exception as e:
        db.rollback()
        logger.error(f"  Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Fix PDF documents with binary content'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without saving'
    )
    parser.add_argument(
        '--doc-id',
        type=int,
        help='Process specific document ID'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all binary PDFs'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of documents to process'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.doc_id and not args.all:
        parser.error("Must specify either --doc-id or --all")
    
    db = SessionLocal()
    
    try:
        if args.doc_id:
            # Process single document
            logger.info(f"Processing document ID: {args.doc_id}")
            result = reprocess_document(args.doc_id, db, dry_run=args.dry_run)
            
            if result['success']:
                logger.info("✓ Success!")
                for key, value in result.items():
                    logger.info(f"  {key}: {value}")
            else:
                logger.error(f"✗ Failed: {result.get('error')}")
                sys.exit(1)
        
        else:
            # Process all binary documents
            logger.info("Finding binary documents...")
            binary_docs = find_binary_documents(db, limit=args.limit)
            
            logger.info(f"Found {len(binary_docs)} documents with binary content")
            
            if args.dry_run:
                logger.warning("DRY RUN MODE - No changes will be saved")
            
            # Process each document
            results = {
                "total": len(binary_docs),
                "success": 0,
                "failed": 0,
                "errors": []
            }
            
            for i, doc in enumerate(binary_docs, 1):
                logger.info(f"\n{'='*80}")
                logger.info(f"Processing {i}/{len(binary_docs)}: Document ID {doc.id}")
                logger.info(f"{'='*80}")
                
                result = reprocess_document(doc.id, db, dry_run=args.dry_run)
                
                if result.get('success'):
                    results['success'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'doc_id': doc.id,
                        'error': result.get('error')
                    })
            
            # Summary
            logger.info(f"\n{'='*80}")
            logger.info("SUMMARY:")
            logger.info(f"{'='*80}")
            logger.info(f"  Total: {results['total']}")
            logger.info(f"  ✓ Success: {results['success']}")
            logger.info(f"  ✗ Failed: {results['failed']}")
            
            if results['errors']:
                logger.info("\nErrors:")
                for error in results['errors']:
                    logger.info(f"  - Doc {error['doc_id']}: {error['error']}")
            
            if results['failed'] > 0:
                sys.exit(1)
    
    finally:
        db.close()


if __name__ == '__main__':
    main()
