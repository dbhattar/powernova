"""
Embedding processor - Orchestrates document chunking and embedding generation
"""
import logging
from sqlalchemy.orm import Session
from models import Document, DocumentChunk
from services.text_chunker import get_text_chunker
from services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


def process_document_embedding(document_id: int, db: Session) -> bool:
    """
    Process a document: chunk it, generate embeddings for each chunk, and store in database
    
    This implementation:
    1. Splits large documents into overlapping chunks
    2. Generates embeddings for each chunk separately (no truncation)
    3. Stores chunks in document_chunks table
    4. Updates document with chunk count
    
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
        
        # Skip if already has chunks
        existing_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).count()
        
        if existing_chunks > 0:
            logger.info(f"Document {document_id} already has {existing_chunks} chunks, skipping")
            return True
        
        logger.info(f"Processing embedding for document {document_id}: {document.title}")
        
        # Get services
        text_chunker = get_text_chunker()
        embedding_service = get_embedding_service()
        
        # Chunk the document
        chunks = text_chunker.chunk_text(document.content)
        
        if not chunks:
            logger.warning(f"No chunks generated for document {document_id}")
            document.embedding_generated = False
            db.commit()
            return False
        
        logger.info(f"Generated {len(chunks)} chunks for document {document_id}")
        
        # Process each chunk
        successful_chunks = 0
        for chunk_text, chunk_meta in chunks:
            try:
                # Generate embedding for this chunk
                embedding = embedding_service.generate_embedding(chunk_text)
                
                if embedding is None:
                    logger.error(f"Failed to generate embedding for chunk {chunk_meta['chunk_index']} of document {document_id}")
                    continue
                
                # Create DocumentChunk record
                doc_chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=chunk_meta['chunk_index'],
                    content=chunk_text,
                    word_count=chunk_meta['word_count'],
                    char_start=chunk_meta['char_start'],
                    char_end=chunk_meta['char_end'],
                    embedding=embedding,
                    embedding_generated=True
                )
                
                db.add(doc_chunk)
                successful_chunks += 1
                
            except Exception as e:
                logger.error(f"Failed to process chunk {chunk_meta['chunk_index']} of document {document_id}: {e}")
                continue
        
        if successful_chunks == 0:
            logger.error(f"Failed to generate any embeddings for document {document_id}")
            document.embedding_generated = False
            db.commit()
            return False
        
        # Update document
        document.chunk_count = successful_chunks
        document.embedding_generated = True
        
        db.commit()
        
        logger.info(f"Successfully generated embeddings for {successful_chunks}/{len(chunks)} chunks of document {document_id}")
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
