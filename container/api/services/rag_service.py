"""
RAG (Retrieval-Augmented Generation) service using pgvector for semantic search
"""
import logging
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import Document
from services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAG service for semantic search over documents using pgvector
    """
    
    def __init__(self, db: Session):
        """
        Initialize RAG service
        
        Args:
            db: Database session
        """
        self.db = db
        self.embedding_service = get_embedding_service()
    
    def search_similar_documents(self, 
                                 query: str, 
                                 top_k: int = 5,
                                 similarity_threshold: float = 0.7,
                                 filters: Optional[Dict] = None) -> List[Dict]:
        """
        Search for documents similar to the query using vector similarity
        
        Args:
            query: Search query text
            top_k: Number of results to return
            similarity_threshold: Minimum similarity score (0-1)
            filters: Optional filters (e.g., {'document_type': 'html', 'crawl_job_id': 5})
        
        Returns:
            List of dicts with document info and similarity scores
        """
        try:
            # Generate query embedding
            logger.info(f"Searching for: {query[:100]}...")
            query_embedding = self.embedding_service.generate_embedding(query)
            
            if query_embedding is None:
                logger.error("Failed to generate query embedding")
                return []
            
            # Build SQL query
            # Using cosine distance: 1 - cosine_distance = cosine_similarity
            # Note: Using :param style with .bindparams() for SQLAlchemy text()
            sql = """
                SELECT 
                    id,
                    title,
                    url,
                    content,
                    document_type,
                    crawl_job_id,
                    1 - (embedding <=> CAST(:query_embedding AS vector)) AS similarity
                FROM documents
                WHERE embedding IS NOT NULL
            """
            
            params = {'query_embedding': str(query_embedding)}
            
            # Add filters
            if filters:
                if 'document_type' in filters:
                    sql += " AND document_type = :document_type"
                    params['document_type'] = filters['document_type']
                
                if 'crawl_job_id' in filters:
                    sql += " AND crawl_job_id = :crawl_job_id"
                    params['crawl_job_id'] = filters['crawl_job_id']
            
            # Add similarity threshold
            sql += " AND (1 - (embedding <=> CAST(:query_embedding AS vector))) >= :threshold"
            params['threshold'] = similarity_threshold
            
            # Order by similarity and limit
            sql += " ORDER BY embedding <=> CAST(:query_embedding AS vector) LIMIT :top_k"
            params['top_k'] = top_k
            
            # Execute query with bindparams
            stmt = text(sql).bindparams(**params)
            result = self.db.execute(stmt)
            rows = result.fetchall()
            
            # Format results
            documents = []
            for row in rows:
                documents.append({
                    'id': row[0],
                    'title': row[1],
                    'url': row[2],
                    'content': row[3][:500] + '...' if len(row[3]) > 500 else row[3],  # Truncate for preview
                    'content_full': row[3],
                    'document_type': row[4],
                    'crawl_job_id': row[5],
                    'similarity': float(row[6])
                })
            
            logger.info(f"Found {len(documents)} similar documents")
            return documents
            
        except Exception as e:
            logger.error(f"Search failed: {e}", exc_info=True)
            return []
    
    def generate_rag_response(self, 
                             question: str, 
                             top_k: int = 5,
                             similarity_threshold: float = 0.5,
                             model: str = "gpt-4o-mini") -> Dict:
        """
        Generate answer to question using RAG
        
        Args:
            question: User's question
            top_k: Number of documents to retrieve
            similarity_threshold: Minimum similarity score (0-1), default 0.5
            model: OpenAI model to use for generation
        
        Returns:
            Dict with answer and source documents
        """
        try:
            # Search for relevant documents
            relevant_docs = self.search_similar_documents(
                question, 
                top_k=top_k,
                similarity_threshold=similarity_threshold
            )
            
            if not relevant_docs:
                return {
                    'answer': "I don't have enough information to answer this question.",
                    'sources': [],
                    'found_relevant_docs': False
                }
            
            # Build context from retrieved documents
            context_parts = []
            for i, doc in enumerate(relevant_docs, 1):
                context_parts.append(f"""
[Document {i}]
Title: {doc['title']}
URL: {doc['url']}
Similarity: {doc['similarity']:.2%}

{doc['content_full']}
                """.strip())
            
            context = "\n\n---\n\n".join(context_parts)
            
            # Generate answer using OpenAI
            from openai import OpenAI
            client = OpenAI()
            
            system_prompt = f"""You are a helpful assistant that answers questions based on the provided documents.

Use ONLY the information from the documents below to answer the question. If the documents don't contain enough information, say so.

Always cite your sources by mentioning the document title or URL.

Documents:
{context}
"""
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            answer = response.choices[0].message.content
            
            # Prepare sources
            sources = [{
                'title': doc['title'],
                'url': doc['url'],
                'similarity': doc['similarity']
            } for doc in relevant_docs]
            
            return {
                'answer': answer,
                'sources': sources,
                'found_relevant_docs': True,
                'num_docs_used': len(relevant_docs)
            }
            
        except Exception as e:
            logger.error(f"RAG generation failed: {e}", exc_info=True)
            return {
                'answer': f"An error occurred while generating the answer: {str(e)}",
                'sources': [],
                'found_relevant_docs': False,
                'error': str(e)
            }


def get_rag_service(db: Session) -> RAGService:
    """Get RAG service instance"""
    return RAGService(db)
