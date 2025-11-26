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
    1. Detects token anomalies (abnormal token-to-char ratio)
    2. Skips embedding generation for anomalous documents
    3. Splits normal documents into overlapping chunks
    4. Generates embeddings for each chunk separately
    5. Stores chunks in document_chunks table
    6. Updates document with chunk count
    
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
        
        # STEP 1: Detect token anomalies
        # Sample first 5000 characters to detect token inflation
        sample_text = document.content[:5000] if len(document.content) > 5000 else document.content
        token_count = embedding_service.count_tokens(sample_text)
        char_count = len(sample_text)
        
        # Calculate token-to-character ratio
        token_to_char_ratio = token_count / char_count if char_count > 0 else 0
        
        # Store ratio for analysis
        document.token_to_char_ratio = token_to_char_ratio
        
        # Threshold: Normal text is ~0.3-0.5, borderline is 0.5-0.6
        # Anything above 0.6 indicates encoding issues or dense special characters
        # For severely corrupted encoding, ratio can be 2.0-6.0+
        ANOMALY_THRESHOLD = 0.6  # Lowered from 0.7 to catch more problematic documents
        
        # if token_to_char_ratio > ANOMALY_THRESHOLD:
        #     logger.warning(
        #         f"Token anomaly detected for document {document_id} "
        #         f"(ratio={token_to_char_ratio:.2f}, tokens={token_count}, chars={char_count}). "
        #         f"Marking as anomalous and skipping embedding generation."
        #     )
        #     document.token_anomaly = True
        #     document.embedding_generated = False
        #     document.chunk_count = 0
        #     db.commit()
        #     return False  # Skip this document
        
        # Normal ratio - proceed with embedding generation
        logger.info(
            f"Document {document_id} token ratio is normal "
            f"(ratio={token_to_char_ratio:.2f}, tokens={token_count}, chars={char_count})"
        )
        document.token_anomaly = False
        
        # STEP 2: Chunk the document
        cleaned_text = embedding_service.clean_text_for_encoding(document.content)
        chunks = text_chunker.chunk_text(cleaned_text)
        
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
                num_chunk_tokens = embedding_service.count_tokens(chunk_text)
                if num_chunk_tokens > embedding_service.max_tokens:
                    logger.error(f"PROBLEMATIC CHUNK: chunk {chunk_meta['chunk_index']} of document {document_id}")
                    logger.error(f"chunk size {len(chunk_text)}, number of tokens {num_chunk_tokens}")
                    document.token_anomaly = True
                    document.embedding_generated = False
                    document.chunk_count = 0
                    db.commit()
                    return False  # Skip this document

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
