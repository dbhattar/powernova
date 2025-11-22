"""
DocumentChunk model - Stores chunked text from documents for embedding generation
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from .base import Base, TimestampMixin


class DocumentChunk(Base, TimestampMixin):
    """
    Document chunk model - stores text chunks from documents
    
    Large documents are split into smaller chunks to:
    1. Fit within embedding model token limits (8192 tokens for text-embedding-3-small)
    2. Improve search relevance (more precise matching)
    3. Provide better context in RAG responses
    
    Attributes:
        id: Primary key
        document_id: Foreign key to parent document
        chunk_index: Sequential index within the document (0, 1, 2, ...)
        content: The chunk text content
        word_count: Number of words in this chunk
        char_start: Starting character position in original document
        char_end: Ending character position in original document
        embedding: Vector embedding for this chunk (1536 dimensions)
        embedding_generated: Whether embedding has been generated for this chunk
    
    Relationships:
        document: Parent document that this chunk belongs to
    """
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)  # 0-based index within document
    content = Column(Text, nullable=False)  # The chunk text
    word_count = Column(Integer, default=0)
    char_start = Column(Integer, default=0)  # Position in original document
    char_end = Column(Integer, default=0)
    embedding = Column(Vector(1536))  # OpenAI text-embedding-3-small dimensions
    embedding_generated = Column(Boolean, default=False, index=True)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    def __repr__(self):
        return f"<DocumentChunk(id={self.id}, document_id={self.document_id}, chunk_index={self.chunk_index}, words={self.word_count})>"
