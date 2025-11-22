"""
RAG (Retrieval-Augmented Generation) service using pgvector for semantic search
"""
import logging
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import Document, DocumentChunk
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
                                 filters: Optional[Dict] = None,
                                 conversation_id: Optional[int] = None,
                                 user_id: Optional[int] = None) -> List[Dict]:
        """
        Search for documents similar to the query using vector similarity on document chunks
        
        Now searches document_chunks table for better precision with large documents.
        Returns chunks along with parent document info.
        
        Searches across document hierarchy:
        1. PLATFORM documents (crawled docs available to all users)
        2. USER library documents (user's personal documents across all conversations)
        3. CONVERSATION-specific documents (if conversation_id provided)
        
        Args:
            query: Search query text
            top_k: Number of results to return
            similarity_threshold: Minimum similarity score (0-1)
            filters: Optional filters (e.g., {'document_type': 'html', 'crawl_job_id': 5})
            conversation_id: If provided, includes documents linked to this conversation
            user_id: If provided, includes user's personal library documents
        
        Returns:
            List of dicts with chunk content, document info, and similarity scores
        """
        try:
            # Generate query embedding
            logger.info(f"Searching for: {query[:100]}...")
            query_embedding = self.embedding_service.generate_embedding(query)
            
            if query_embedding is None:
                logger.error("Failed to generate query embedding")
                return []
            
            # Build SQL query to search across document_chunks with document hierarchy
            # Search chunks, join parent documents, filter by scope
            
            if conversation_id is not None or user_id is not None:
                # Complex query with multiple document sources
                # HYBRID APPROACH: Search both new chunks AND old document embeddings
                sql = """
                    WITH relevant_chunks AS (
                        -- NEW: Platform document chunks (available to all)
                        SELECT 
                            dc.id as chunk_id,
                            dc.chunk_index,
                            dc.content as chunk_content,
                            dc.word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (dc.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'platform' as source
                        FROM document_chunks dc
                        INNER JOIN documents d ON dc.document_id = d.id
                        WHERE dc.embedding IS NOT NULL
                        AND d.document_scope = 'platform'
                        
                        UNION ALL
                        
                        -- OLD: Platform documents with old embeddings (backward compatibility)
                        SELECT 
                            NULL as chunk_id,
                            0 as chunk_index,
                            d.content as chunk_content,
                            LENGTH(d.content) as word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (d.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'platform_legacy' as source
                        FROM documents d
                        WHERE d.embedding IS NOT NULL
                        AND d.document_scope = 'platform'
                        AND NOT EXISTS (
                            SELECT 1 FROM document_chunks dc2 WHERE dc2.document_id = d.id
                        )
                """
                
                params = {'query_embedding': str(query_embedding)}
                
                # Add user library document chunks if user_id provided
                if user_id is not None:
                    sql += """
                        UNION ALL
                        -- NEW: User library document chunks
                        SELECT 
                            dc.id as chunk_id,
                            dc.chunk_index,
                            dc.content as chunk_content,
                            dc.word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (dc.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'user_library' as source
                        FROM document_chunks dc
                        INNER JOIN documents d ON dc.document_id = d.id
                        WHERE dc.embedding IS NOT NULL
                        AND d.document_scope = 'user'
                        AND d.uploaded_by = :user_id
                        
                        UNION ALL
                        
                        -- OLD: User library documents with old embeddings (backward compatibility)
                        SELECT 
                            NULL as chunk_id,
                            0 as chunk_index,
                            d.content as chunk_content,
                            LENGTH(d.content) as word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (d.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'user_library_legacy' as source
                        FROM documents d
                        WHERE d.embedding IS NOT NULL
                        AND d.document_scope = 'user'
                        AND d.uploaded_by = :user_id
                        AND NOT EXISTS (
                            SELECT 1 FROM document_chunks dc2 WHERE dc2.document_id = d.id
                        )
                    """
                    params['user_id'] = user_id
                
                # Add conversation-specific document chunks if conversation_id provided
                if conversation_id is not None:
                    sql += """
                        UNION ALL
                        -- NEW: Conversation-specific document chunks
                        SELECT 
                            dc.id as chunk_id,
                            dc.chunk_index,
                            dc.content as chunk_content,
                            dc.word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (dc.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'conversation' as source
                        FROM document_chunks dc
                        INNER JOIN documents d ON dc.document_id = d.id
                        INNER JOIN conversation_documents cd ON d.id = cd.document_id
                        WHERE dc.embedding IS NOT NULL
                        AND cd.conversation_id = :conversation_id
                        
                        UNION ALL
                        
                        -- OLD: Conversation documents with old embeddings (backward compatibility)
                        SELECT 
                            NULL as chunk_id,
                            0 as chunk_index,
                            d.content as chunk_content,
                            LENGTH(d.content) as word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (d.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'conversation_legacy' as source
                        FROM documents d
                        INNER JOIN conversation_documents cd ON d.id = cd.document_id
                        WHERE d.embedding IS NOT NULL
                        AND cd.conversation_id = :conversation_id
                        AND NOT EXISTS (
                            SELECT 1 FROM document_chunks dc2 WHERE dc2.document_id = d.id
                        )
                    """
                    params['conversation_id'] = conversation_id
                
                sql += """
                    )
                    SELECT 
                        chunk_id, chunk_index, chunk_content, word_count,
                        document_id, title, url, document_type, crawl_job_id, 
                        document_scope, similarity, source
                    FROM relevant_chunks
                    WHERE similarity >= :threshold
                """
                params['threshold'] = similarity_threshold
                
                # Add additional filters if provided
                if filters:
                    if 'document_type' in filters:
                        sql += " AND document_type = :document_type"
                        params['document_type'] = filters['document_type']
                    
                    if 'crawl_job_id' in filters:
                        sql += " AND crawl_job_id = :crawl_job_id"
                        params['crawl_job_id'] = filters['crawl_job_id']
                
                # Order by similarity and limit
                sql += " ORDER BY similarity DESC LIMIT :top_k"
                params['top_k'] = top_k
                
            else:
                # Simple query - platform documents (chunks + old embeddings)
                # HYBRID APPROACH for backward compatibility
                sql = """
                    WITH relevant_results AS (
                        -- NEW: Platform document chunks
                        SELECT 
                            dc.id as chunk_id,
                            dc.chunk_index,
                            dc.content as chunk_content,
                            dc.word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (dc.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'platform' as source
                        FROM document_chunks dc
                        INNER JOIN documents d ON dc.document_id = d.id
                        WHERE dc.embedding IS NOT NULL
                        AND d.document_scope = 'platform'
                        
                        UNION ALL
                        
                        -- OLD: Platform documents with old embeddings (backward compatibility)
                        SELECT 
                            NULL as chunk_id,
                            0 as chunk_index,
                            d.content as chunk_content,
                            LENGTH(d.content) as word_count,
                            d.id as document_id,
                            d.title,
                            d.url,
                            d.document_type,
                            d.crawl_job_id,
                            d.document_scope,
                            1 - (d.embedding <=> CAST(:query_embedding AS vector)) AS similarity,
                            'platform_legacy' as source
                        FROM documents d
                        WHERE d.embedding IS NOT NULL
                        AND d.document_scope = 'platform'
                        AND NOT EXISTS (
                            SELECT 1 FROM document_chunks dc2 WHERE dc2.document_id = d.id
                        )
                    )
                    SELECT * FROM relevant_results WHERE similarity >= :threshold
                """
                params = {'query_embedding': str(query_embedding), 'threshold': similarity_threshold}
                
                # Add filters
                if filters:
                    if 'document_type' in filters:
                        sql += " AND document_type = :document_type"
                        params['document_type'] = filters['document_type']
                    
                    if 'crawl_job_id' in filters:
                        sql += " AND crawl_job_id = :crawl_job_id"
                        params['crawl_job_id'] = filters['crawl_job_id']
                
                # Order by similarity and limit
                sql += " ORDER BY similarity DESC LIMIT :top_k"
                params['top_k'] = top_k
            
            # Execute query with bindparams
            stmt = text(sql).bindparams(**params)
            result = self.db.execute(stmt)
            rows = result.fetchall()
            
            # Format results
            chunks = []
            for row in rows:
                chunks.append({
                    'chunk_id': row[0],
                    'chunk_index': row[1],
                    'chunk_content': row[2],
                    'word_count': row[3],
                    'document_id': row[4],
                    'title': row[5],
                    'url': row[6],
                    'content': row[2][:500] + '...' if len(row[2]) > 500 else row[2],  # Truncate for preview
                    'content_full': row[2],  # Full chunk content
                    'document_type': row[7],
                    'crawl_job_id': row[8],
                    'document_scope': row[9],
                    'similarity': float(row[10]),
                    'source': row[11]  # platform, user_library, or conversation
                })
            
            search_context = []
            if conversation_id:
                search_context.append(f"conversation {conversation_id}")
            if user_id:
                search_context.append(f"user {user_id}'s library")
            search_context.append("platform documents")
            
            logger.info(f"Found {len(chunks)} similar chunks from: {', '.join(search_context)}")
            return chunks
            
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
