"""
RAG API routes - Search and question answering endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from sqlalchemy.orm import Session

from database import get_db
from services.rag_service import get_rag_service
from services.embedding_processor import reprocess_failed_embeddings

router = APIRouter(prefix="/rag", tags=["rag"])


class SearchRequest(BaseModel):
    """Search request model"""
    query: str
    top_k: int = 5
    similarity_threshold: float = 0.7
    filters: Optional[Dict] = None


class QuestionRequest(BaseModel):
    """Question answering request model"""
    question: str
    top_k: int = 5
    similarity_threshold: float = 0.5
    model: str = "gpt-4o-mini"


@router.post("/search")
def search_documents(request: SearchRequest, db: Session = Depends(get_db)):
    """
    Search for similar documents using vector similarity
    
    Args:
        request: Search request with query and parameters
        db: Database session
    
    Returns:
        List of similar documents with similarity scores
    """
    try:
        rag_service = get_rag_service(db)
        results = rag_service.search_similar_documents(
            query=request.query,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
            filters=request.filters
        )
        
        return {
            "query": request.query,
            "num_results": len(results),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask")
def ask_question(request: QuestionRequest, db: Session = Depends(get_db)):
    """
    Ask a question and get AI-generated answer based on relevant documents
    
    Args:
        request: Question request
        db: Database session
    
    Returns:
        Answer with source documents
    """
    try:
        rag_service = get_rag_service(db)
        result = rag_service.generate_rag_response(
            question=request.question,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
            model=request.model
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reprocess-embeddings")
def reprocess_embeddings(limit: int = 100, db: Session = Depends(get_db)):
    """
    Reprocess documents that don't have embeddings
    
    Args:
        limit: Maximum number of documents to process
        db: Database session
    
    Returns:
        Processing results
    """
    try:
        results = reprocess_failed_embeddings(db, limit=limit)
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
