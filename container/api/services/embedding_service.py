"""
Embedding service for generating vector embeddings using OpenAI
"""
import os
import logging
from typing import List, Optional
from openai import OpenAI
import time

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Generate embeddings using OpenAI's text-embedding models
    
    Uses text-embedding-3-small by default:
    - 1536 dimensions
    - $0.02 per 1M tokens (5x cheaper than ada-002)
    - Better performance than ada-002
    """
    
    def __init__(self):
        """Initialize embedding service"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self.dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
        
        logger.info(f"Initialized EmbeddingService with model={self.model}, dimensions={self.dimensions}")
    
    def generate_embedding(self, text: str, retry_count: int = 3) -> Optional[List[float]]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            retry_count: Number of retries on failure
        
        Returns:
            Embedding vector as list of floats, or None on failure
        """
        if not text or len(text.strip()) == 0:
            logger.warning("Empty text provided for embedding")
            return None
        
        # Truncate if too long (max 8191 tokens for text-embedding-3-small)
        # Conservative approximation for dense technical text: 1 token ≈ 0.5 words
        # Using 4000 words to ensure we stay well below 8192 token limit
        words = text.split()
        max_words = 4000  # ~6000-7000 tokens (safe margin below 8192 limit)
        if len(words) > max_words:
            logger.warning(f"Text too long ({len(words)} words), truncating to {max_words}")
            text = ' '.join(words[:max_words])
        
        for attempt in range(retry_count):
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=text
                )
                
                embedding = response.data[0].embedding
                
                # Validate dimensions
                if len(embedding) != self.dimensions:
                    logger.error(f"Expected {self.dimensions} dimensions, got {len(embedding)}")
                    return None
                
                logger.debug(f"Generated embedding with {len(embedding)} dimensions")
                return embedding
                
            except Exception as e:
                logger.error(f"Failed to generate embedding (attempt {attempt + 1}/{retry_count}): {e}")
                
                if attempt < retry_count - 1:
                    # Exponential backoff
                    sleep_time = 2 ** attempt
                    logger.info(f"Retrying in {sleep_time} seconds...")
                    time.sleep(sleep_time)
                else:
                    logger.error("All retry attempts failed")
                    return None
        
        return None
    
    def generate_embeddings_batch(self, 
                                  texts: List[str], 
                                  batch_size: int = 100,
                                  retry_count: int = 3) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts (more efficient)
        
        OpenAI supports batch embedding requests up to 2048 texts per request.
        We use a conservative batch_size of 100 for reliability.
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts per API call
            retry_count: Number of retries on failure
        
        Returns:
            List of embeddings (same order as input texts)
            None entries indicate failure for that text
        """
        if not texts:
            return []
        
        all_embeddings = []
        
        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(texts) + batch_size - 1) // batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} texts)")
            
            for attempt in range(retry_count):
                try:
                    response = self.client.embeddings.create(
                        model=self.model,
                        input=batch
                    )
                    
                    # Extract embeddings in order
                    batch_embeddings = [item.embedding for item in response.data]
                    
                    # Validate
                    if len(batch_embeddings) != len(batch):
                        logger.error(f"Expected {len(batch)} embeddings, got {len(batch_embeddings)}")
                        # Fill with None for missing embeddings
                        batch_embeddings.extend([None] * (len(batch) - len(batch_embeddings)))
                    
                    all_embeddings.extend(batch_embeddings)
                    break  # Success
                    
                except Exception as e:
                    logger.error(f"Batch embedding failed (attempt {attempt + 1}/{retry_count}): {e}")
                    
                    if attempt < retry_count - 1:
                        sleep_time = 2 ** attempt
                        logger.info(f"Retrying in {sleep_time} seconds...")
                        time.sleep(sleep_time)
                    else:
                        logger.error("All retry attempts failed for batch")
                        # Fill batch with None on complete failure
                        all_embeddings.extend([None] * len(batch))
        
        logger.info(f"Generated {sum(1 for e in all_embeddings if e is not None)}/{len(texts)} embeddings successfully")
        
        return all_embeddings


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get singleton embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
