"""
Search API routes - Semantic search across documents
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, text
import logging
import time
import re

from database import get_db
from models.document import Document, DocumentStatus
from models.document_chunk import DocumentChunk
from services.embedding_service import get_embedding_service

router = APIRouter(prefix="/search", tags=["search"])
logger = logging.getLogger(__name__)


class SearchResult(BaseModel):
    """Single search result"""
    id: int
    url: str
    title: Optional[str]
    snippet: str
    similarity_score: float
    document_type: str
    source: Optional[str] = None  # e.g., "CAISO", "ERCOT", extracted from metadata


class SearchResponse(BaseModel):
    """Search response with pagination"""
    query: str
    results: List[SearchResult]
    total: int
    page: int
    pages: int
    search_time_ms: float


def extract_snippet(content: str, query: str, max_length: int = 300) -> str:
    """
    Extract a relevant snippet from content around the query terms
    
    Args:
        content: Full document content
        query: Search query
        max_length: Maximum snippet length
    
    Returns:
        Snippet of content with context around query terms
    """
    if not content:
        return ""
    
    # Clean content - remove excessive whitespace
    content = re.sub(r'\s+', ' ', content).strip()
    
    if len(content) <= max_length:
        return content
    
    # Try to find query terms in content (case-insensitive)
    query_terms = query.lower().split()
    content_lower = content.lower()
    
    # Find first occurrence of any query term
    best_pos = -1
    for term in query_terms:
        pos = content_lower.find(term)
        if pos != -1 and (best_pos == -1 or pos < best_pos):
            best_pos = pos
    
    # If query term found, center snippet around it
    if best_pos != -1:
        # Try to center the query term
        start = max(0, best_pos - max_length // 2)
        end = min(len(content), start + max_length)
        
        # Adjust if we're at the end
        if end - start < max_length:
            start = max(0, end - max_length)
        
        snippet = content[start:end]
        
        # Add ellipsis if truncated
        if start > 0:
            snippet = "..." + snippet
        if end < len(content):
            snippet = snippet + "..."
            
        return snippet.strip()
    
    # If no query terms found, return beginning of content
    snippet = content[:max_length]
    if len(content) > max_length:
        snippet += "..."
    
    return snippet.strip()


def extract_source_from_url(url: str) -> Optional[str]:
    """
    Extract data source from URL (e.g., CAISO, ERCOT, PJM)
    
    Args:
        url: Document URL
    
    Returns:
        Source identifier or None
    """
    url_lower = url.lower()
    
    sources = {
        'caiso': 'CAISO',
        'ercot': 'ERCOT',
        'pjm': 'PJM',
        'misoenergy': 'MISO',
        'spp.org': 'SPP',
        'nyiso': 'NYISO',
        'iso-ne': 'ISO-NE',
        'ferc.gov': 'FERC',
    }
    
    for key, value in sources.items():
        if key in url_lower:
            return value
    
    return None


@router.get("")
async def search_documents(
    q: str = Query(..., description="Search query", min_length=1),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db)
) -> SearchResponse:
    """
    Semantic search across all documents using vector embeddings
    
    Args:
        q: Search query
        page: Page number (1-indexed)
        limit: Results per page (max 100)
        db: Database session
    
    Returns:
        Search results with pagination
    """
    start_time = time.time()
    
    try:
        # Generate embedding for query
        embedding_service = get_embedding_service()
        query_embedding = embedding_service.generate_embedding(q)
        
        if not query_embedding:
            raise HTTPException(
                status_code=500, 
                detail="Failed to generate query embedding"
            )
        
        # Calculate offset for pagination
        offset = (page - 1) * limit
        
        # Get total count of unique documents with searchable chunks
        total_docs = db.query(Document.id).join(
            DocumentChunk, Document.id == DocumentChunk.document_id
        ).filter(
            DocumentChunk.embedding_generated == True,
            DocumentChunk.embedding.isnot(None),
            Document.status == DocumentStatus.COMPLETED
        ).distinct().count()
        
        # Perform vector similarity search on chunks
        # Use a subquery to get the best matching chunk per document
        # Step 1: Get all chunks with their similarity scores
        chunk_scores = db.query(
            DocumentChunk.id.label('chunk_id'),
            DocumentChunk.content,
            DocumentChunk.document_id,
            Document.id.label('doc_id'),
            Document.url,
            Document.title,
            Document.document_type,
            Document.doc_metadata,
            # Calculate cosine similarity (1 - cosine_distance)
            (1 - DocumentChunk.embedding.cosine_distance(query_embedding)).label('similarity'),
            # Add a row number partitioned by document_id, ordered by similarity
            func.row_number().over(
                partition_by=DocumentChunk.document_id,
                order_by=(1 - DocumentChunk.embedding.cosine_distance(query_embedding)).desc()
            ).label('rn')
        ).join(
            Document, DocumentChunk.document_id == Document.id
        ).filter(
            DocumentChunk.embedding_generated == True,
            DocumentChunk.embedding.isnot(None),
            Document.status == DocumentStatus.COMPLETED
        ).subquery()
        
        # Step 2: Select only the best chunk per document (rn = 1)
        chunk_results = db.query(
            chunk_scores.c.chunk_id,
            chunk_scores.c.content,
            chunk_scores.c.document_id,
            chunk_scores.c.doc_id,
            chunk_scores.c.url,
            chunk_scores.c.title,
            chunk_scores.c.document_type,
            chunk_scores.c.doc_metadata,
            chunk_scores.c.similarity
        ).filter(
            chunk_scores.c.rn == 1
        ).order_by(
            text('similarity DESC')
        ).offset(offset).limit(limit).all()
        
        # Format results
        search_results = []
        for row in chunk_results:
            # Use the chunk content as the snippet
            snippet = extract_snippet(row.content or "", q, max_length=300)
            
            # Extract source from URL or metadata
            source = extract_source_from_url(row.url)
            if not source and row.doc_metadata:
                source = row.doc_metadata.get('source')
            
            search_results.append(SearchResult(
                id=row.doc_id,  # Use document ID, not chunk ID
                url=row.url,
                title=row.title or "Untitled Document",
                snippet=snippet,
                similarity_score=round(float(row.similarity), 4),
                document_type=row.document_type.value if hasattr(row.document_type, 'value') else str(row.document_type),
                source=source
            ))
        
        # Calculate total pages based on total documents (not chunks)
        total_pages = (total_docs + limit - 1) // limit  # Ceiling division
        
        # Calculate search time
        search_time_ms = round((time.time() - start_time) * 1000, 2)
        
        logger.info(
            f"Search query: '{q}' | Results: {len(search_results)} | "
            f"Page: {page}/{total_pages} | Time: {search_time_ms}ms"
        )
        
        return SearchResponse(
            query=q,
            results=search_results,
            total=total_docs,
            page=page,
            pages=total_pages,
            search_time_ms=search_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )
