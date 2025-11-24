"""
Embedding service for generating vector embeddings using OpenAI
"""
import os
import logging
from typing import List, Optional
from openai import OpenAI
import time

logger = logging.getLogger(__name__)

# Try to import tiktoken for accurate token counting
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not installed - using word-based approximation for token counting")


class EmbeddingService:
    """
    Generate embeddings using OpenAI's text-embedding models
    
    Uses text-embedding-3-small by default:
    - 1536 dimensions
    - $0.02 per 1M tokens (5x cheaper than ada-002)
    - Better performance than ada-002
    - Max context: 8191 tokens
    """
    
    def __init__(self):
        """Initialize embedding service"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self.dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
        self.max_tokens = 8191  # Maximum tokens for text-embedding-3-small
        
        # Initialize tokenizer if available
        self.tokenizer = None
        if TIKTOKEN_AVAILABLE:
            try:
                self.tokenizer = tiktoken.encoding_for_model(self.model)
                logger.info(f"Initialized tiktoken encoder for {self.model}")
            except Exception as e:
                logger.warning(f"Could not initialize tiktoken for {self.model}: {e}")
        
        logger.info(f"Initialized EmbeddingService with model={self.model}, dimensions={self.dimensions}, max_tokens={self.max_tokens}")
    
    def _clean_text_for_encoding(self, text: str) -> str:
        """
        Clean text to prevent encoding issues with tiktoken
        
        This fixes the REPLACEMENT_CHARACTER warning by:
        1. Ensuring valid UTF-8 encoding
        2. Removing problematic characters that tiktoken can't handle
        
        Args:
            text: Raw text that may contain encoding issues
            
        Returns:
            Cleaned text safe for tiktoken encoding
        """
        if not text:
            return ""
        
        # Step 1: Ensure valid UTF-8 by encoding and decoding with error handling
        # 'ignore' skips invalid bytes, 'replace' would add � which we want to avoid
        try:
            # Try to encode as UTF-8, then decode back
            # This removes any characters that aren't valid UTF-8
            text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning(f"UTF-8 cleaning error: {e}, using original text")
        
        # Step 2: Remove NULL bytes (shouldn't exist after UTF-8 cleaning, but be safe)
        text = text.replace('\x00', '')
        
        # Step 3: Remove other problematic control characters
        # Keep: newlines (\n), carriage returns (\r), tabs (\t)
        # Remove: other control chars (0x00-0x1F except \n \r \t)
        cleaned_chars = []
        for char in text:
            code = ord(char)
            # Allow printable chars (>= 32), and common whitespace (\n=10, \r=13, \t=9)
            if code >= 32 or char in '\n\r\t':
                cleaned_chars.append(char)
        
        cleaned_text = ''.join(cleaned_chars)
        
        # Log if we removed significant content
        if len(cleaned_text) < len(text) * 0.95:
            logger.warning(f"Cleaned text from {len(text)} to {len(cleaned_text)} chars ({len(text) - len(cleaned_text)} chars removed)")
        
        return cleaned_text
    
    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text accurately
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Number of tokens
        """
        if self.tokenizer:
            return len(self.tokenizer.encode(text))
        else:
            # Fallback: conservative word-based estimate
            # For technical/dense text: 1 token ≈ 0.6 words
            words = len(text.split())
            return int(words * 1.67)
    
    def truncate_to_token_limit(self, text: str, max_tokens: int = None) -> str:
        """
        Truncate text to fit within token limit
        
        NOTE: Assumes text is already cleaned. Call _clean_text_for_encoding() first.
        
        Args:
            text: Text to truncate (should already be cleaned)
            max_tokens: Maximum tokens (defaults to self.max_tokens)
            
        Returns:
            Truncated text
        """
        if max_tokens is None:
            max_tokens = self.max_tokens
        
        token_count = self.count_tokens(text)
        
        if token_count <= max_tokens:
            return text
        
        logger.warning(f"Text exceeds token limit ({token_count} > {max_tokens}), truncating...")
        
        if self.tokenizer:
            # Accurate truncation using tokenizer
            tokens = self.tokenizer.encode(text)
            truncated_tokens = tokens[:max_tokens]
            return self.tokenizer.decode(truncated_tokens)
        else:
            # Fallback: word-based truncation
            # Estimate: max_tokens / 1.67 ≈ safe word count
            max_words = int(max_tokens / 1.67)
            words = text.split()
            if len(words) > max_words:
                return ' '.join(words[:max_words])
            return text
    
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
        
        # Step 1: Clean text to prevent REPLACEMENT_CHARACTER issues
        # This fixes encoding problems BEFORE chunking/counting
        text = self._clean_text_for_encoding(text)
        
        # Step 2: Truncate to token limit (with safety margin)
        safe_limit = self.max_tokens - 100  # Safety margin
        text = self.truncate_to_token_limit(text, safe_limit)
        
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
                error_msg = str(e)
                logger.error(f"Failed to generate embedding (attempt {attempt + 1}/{retry_count}): {e}")
                
                # Check if it's a token limit error
                if "maximum context length" in error_msg.lower() or "tokens" in error_msg.lower():
                    # Try more aggressive truncation
                    logger.warning("Token limit exceeded, trying more aggressive truncation")
                    text = self.truncate_to_token_limit(text, int(safe_limit * 0.8))
                
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
