"""
Document model - Stores crawled documents and their metadata
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime
import enum
from .base import Base, TimestampMixin


class DocumentType(str, enum.Enum):
    """Document type enum"""
    PDF = "pdf"
    HTML = "html"
    TEXT = "text"
    MARKDOWN = "markdown"
    DOCX = "docx"
    OTHER = "other"


class DocumentStatus(str, enum.Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Document(Base, TimestampMixin):
    """
    Document model - stores crawled documents
    
    Attributes:
        id: Primary key
        url: Original URL of the document
        title: Document title
        content: Extracted text content
        document_type: Type of document (pdf, html, etc.)
        file_path: Path in Azure Blob Storage
        blob_url: Public URL to access the document
        file_size: Size in bytes
        status: Processing status
        doc_metadata: Additional metadata (author, description, keywords, etc.)
        crawl_job_id: Foreign key to CrawlJob
        embedding_generated: Whether embeddings have been generated
        chunk_count: Number of text chunks created for RAG
        embedding: Vector embedding for semantic search (1536 dimensions)
    """
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), nullable=False, index=True)
    title = Column(String(500))
    content = Column(Text)  # Extracted text content
    document_type = Column(SQLEnum(DocumentType), nullable=False, default=DocumentType.HTML)
    
    # Azure Storage info
    file_path = Column(String(1024))  # Path in blob storage
    blob_url = Column(String(2048))  # Public URL
    file_size = Column(Integer)  # Size in bytes
    
    # Processing status
    status = Column(SQLEnum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING)
    error_message = Column(Text)
    
    # Metadata (renamed to avoid SQLAlchemy reserved attribute)
    doc_metadata = Column(JSON, default={})  # Store additional info like author, description, etc.
    
    # Crawl job reference
    crawl_job_id = Column(Integer, nullable=True)  # Can be null for manually uploaded docs
    
    # RAG/Embedding info
    embedding_generated = Column(Boolean, default=False)
    chunk_count = Column(Integer, default=0)
    embedding = Column(Vector(1536), nullable=True)  # OpenAI text-embedding-3-small (1536 dims)
    
    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', url='{self.url}')>"
