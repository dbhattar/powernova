"""
Embedding processor - Orchestrates document chunking and embedding generation
"""
import logging
from sqlalchemy.orm import Session
from models import Document
from services.text_chunker import get_text_chunker
from services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


def process_document_embedding(document_id: int, db: Session) -> bool:
    """
    Process a document: generate embedding and store in database
    
    This is a simplified version that embeds the entire document content
    (or first 6000 words if longer). For production with very large documents,
    consider implementing chunking into a separate document_chunks table.
    
    Args:
        document_id: Database ID of the document
        db: Database session
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            logger.error(f"Document {document_id} not found")
            return False
        
        # Skip if no content
        if not document.content or len(document.content.strip()) < 50:
            logger.warning(f"Document {document_id} has insufficient content (< 50 chars)")
            document.embedding_generated = False
            db.commit()
            return False
        
        # Skip if already has embedding
        if document.embedding is not None:
            logger.info(f"Document {document_id} already has embedding, skipping")
            return True
        
        logger.info(f"Processing embedding for document {document_id}: {document.title}")
        
        # Get embedding service
        embedding_service = get_embedding_service()
        
        # For simplicity, we'll embed the full document content
        # (truncated to ~6000 words / 8000 tokens in embedding service)
        # 
        # Alternative approach for large documents:
        # 1. Chunk the document into smaller pieces
        # 2. Embed each chunk separately
        # 3. Store chunks in a document_chunks table with their embeddings
        # 4. Search chunks, then retrieve full document
        
        text_to_embed = document.content
        
        # Generate embedding
        embedding = embedding_service.generate_embedding(text_to_embed)
        
        if embedding is None:
            logger.error(f"Failed to generate embedding for document {document_id}")
            document.embedding_generated = False
            db.commit()
            return False
        
        # Store embedding
        document.embedding = embedding
        document.embedding_generated = True
        document.chunk_count = 1  # We're treating the whole document as one chunk
        
        db.commit()
        
        logger.info(f"Successfully generated embedding for document {document_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to process embedding for document {document_id}: {e}", exc_info=True)
        db.rollback()
        
        # Mark as failed
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.embedding_generated = False
                db.commit()
        except:
            pass
        
        return False


def process_documents_batch(document_ids: list[int], db: Session) -> dict:
    """
    Process multiple documents in batch
    
    Args:
        document_ids: List of document IDs to process
        db: Database session
    
    Returns:
        Dict with success/failure counts
    """
    results = {
        'total': len(document_ids),
        'success': 0,
        'failed': 0,
        'skipped': 0
    }
    
    for doc_id in document_ids:
        try:
            success = process_document_embedding(doc_id, db)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
        except Exception as e:
            logger.error(f"Error processing document {doc_id}: {e}")
            results['failed'] += 1
    
    logger.info(f"Batch processing complete: {results}")
    return results


def reprocess_failed_embeddings(db: Session, limit: int = 100) -> dict:
    """
    Find documents without embeddings and reprocess them
    
    Args:
        db: Database session
        limit: Maximum number of documents to process
    
    Returns:
        Dict with processing results
    """
    # Find documents without embeddings
    documents = db.query(Document).filter(
        Document.embedding == None,
        Document.content != None,
        Document.content != ''
    ).limit(limit).all()
    
    logger.info(f"Found {len(documents)} documents without embeddings (limit={limit})")
    
    document_ids = [doc.id for doc in documents]
    return process_documents_batch(document_ids, db)
