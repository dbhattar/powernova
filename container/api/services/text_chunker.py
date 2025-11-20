"""
Text chunking service for splitting documents into embeddable chunks
"""
import logging
from typing import List, Tuple, Dict

logger = logging.getLogger(__name__)


class TextChunker:
    """
    Split documents into overlapping chunks for embedding generation
    
    This ensures:
    1. Chunks fit within embedding model token limits
    2. Overlap prevents information loss at chunk boundaries
    3. Each chunk is meaningful and context-preserving
    """
    
    def __init__(self, 
                 chunk_size: int = 800,       # words per chunk (roughly 1000 tokens)
                 chunk_overlap: int = 200):   # word overlap between chunks
        """
        Initialize chunker
        
        Args:
            chunk_size: Target number of words per chunk
            chunk_overlap: Number of overlapping words between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
    
    def chunk_text(self, text: str, metadata: Dict = None) -> List[Tuple[str, Dict]]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Text to chunk
            metadata: Optional metadata to attach to each chunk
        
        Returns:
            List of (chunk_text, chunk_metadata) tuples
        """
        if not text or len(text.strip()) < 10:
            logger.warning("Text too short to chunk")
            return []
        
        # Split into words (simple whitespace splitting)
        # For production, consider using a proper tokenizer
        words = text.split()
        
        if len(words) <= self.chunk_size:
            # Document is smaller than one chunk
            return [(text, {
                'chunk_index': 0,
                'start_word': 0,
                'end_word': len(words),
                'word_count': len(words),
                'is_complete_document': True,
                **(metadata or {})
            })]
        
        chunks = []
        i = 0
        chunk_index = 0
        
        while i < len(words):
            # Get chunk words
            end_i = min(i + self.chunk_size, len(words))
            chunk_words = words[i:end_i]
            chunk_text = ' '.join(chunk_words)
            
            # Calculate character positions (for reference)
            char_start = len(' '.join(words[:i]))
            if i > 0:
                char_start += 1  # Account for space before first word
            char_end = char_start + len(chunk_text)
            
            # Build chunk metadata
            chunk_meta = {
                'chunk_index': chunk_index,
                'start_word': i,
                'end_word': end_i,
                'char_start': char_start,
                'char_end': char_end,
                'word_count': len(chunk_words),
                'is_complete_document': False,
                **(metadata or {})
            }
            
            chunks.append((chunk_text, chunk_meta))
            
            # Move forward with overlap
            step = self.chunk_size - self.chunk_overlap
            i += step
            chunk_index += 1
            
            # Prevent infinite loop
            if step <= 0:
                break
        
        logger.info(f"Split text into {len(chunks)} chunks (size={self.chunk_size}, overlap={self.chunk_overlap})")
        
        return chunks
    
    def estimate_token_count(self, text: str) -> int:
        """
        Rough estimation of token count
        
        Note: This is approximate. For precise counting, use tiktoken library.
        Rule of thumb: 1 token ≈ 0.75 words for English
        """
        words = len(text.split())
        return int(words * 1.33)  # Approximation


def get_text_chunker() -> TextChunker:
    """Get singleton text chunker instance"""
    return TextChunker(chunk_size=800, chunk_overlap=200)
