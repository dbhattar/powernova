"""
Document model - Stores crawled documents and their metadata
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime
import enum
from .base import Base, TimestampMixin


class DocumentType(str, enum.Enum):
    """Document type enum"""
    PDF = "PDF"
    HTML = "HTML"
    TEXT = "TEXT"
    MARKDOWN = "MARKDOWN"
    DOCX = "DOCX"
    OTHER = "OTHER"


class DocumentStatus(str, enum.Enum):
    """Document processing status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DocumentScope(str, enum.Enum):
    """
    Document scope - defines the visibility/ownership level
    
    PLATFORM: Crawled documents available to all users (crawl_job_id != NULL)
    USER: User's personal library, available across all their conversations
    CONVERSATION: Specific to a single conversation
    """
    PLATFORM = "platform"
    USER = "user"
    CONVERSATION = "conversation"


class Document(Base, TimestampMixin):
    """
    Document model - stores crawled and user-uploaded documents
    
    Document Hierarchy:
    1. PLATFORM: Crawled documents (crawl_job_id != NULL) - available to all users
    2. USER: User's personal library (uploaded_by != NULL, scope='user') - available across all conversations
    3. CONVERSATION: Conversation-specific (linked via conversation_documents) - only for that conversation
    
    Attributes:
        id: Primary key
        url: Original URL of the document
        title: Document title
        content: Extracted text content
        document_type: Type of document (pdf, html, etc.)
        document_scope: Visibility level (platform, user, conversation)
        uploaded_by: User ID who uploaded the document (NULL for platform docs)
        file_path: Path in Azure Blob Storage
        blob_url: Public URL to access the document
        file_size: Size in bytes
        status: Processing status
        doc_metadata: Additional metadata (author, description, keywords, etc.)
        crawl_job_id: Foreign key to CrawlJob (NULL for user-uploaded docs)
        embedding_generated: Whether embeddings have been generated
        chunk_count: Number of text chunks created for RAG
        embedding: Vector embedding for semantic search (1536 dimensions)
    """
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), nullable=False, index=True)
    title = Column(String(500))
    content = Column(Text)  # Extracted text content
    document_type = Column(SQLEnum(DocumentType, values_callable=lambda x: [e.value for e in x]), nullable=False, default=DocumentType.HTML)
    
    # Document ownership and scope
    document_scope = Column(SQLEnum(DocumentScope, values_callable=lambda x: [e.value for e in x]), nullable=False, default=DocumentScope.PLATFORM, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Azure Storage info
    file_path = Column(String(1024))  # Path in blob storage
    blob_url = Column(String(2048))  # Public URL
    file_size = Column(Integer)  # Size in bytes
    
    # Processing status
    status = Column(SQLEnum(DocumentStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=DocumentStatus.PENDING)
    error_message = Column(Text)
    
    # Metadata (renamed to avoid SQLAlchemy reserved attribute)
    doc_metadata = Column(JSON, default={})  # Store additional info like author, description, etc.
    
    # Crawl job reference (NULL for user-uploaded documents)
    crawl_job_id = Column(Integer, nullable=True)  # Can be null for manually uploaded docs
    
    # RAG/Embedding info
    embedding_generated = Column(Boolean, default=False)
    chunk_count = Column(Integer, default=0)
    embedding = Column(Vector(1536), nullable=True)  # OpenAI text-embedding-3-small (1536 dims)
    
    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by])
    
    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', scope={self.document_scope.value})>"
