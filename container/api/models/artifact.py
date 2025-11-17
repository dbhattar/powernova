"""
Artifact model for uploaded documents and files
"""
from sqlalchemy import Column, String, Integer, ForeignKey, BigInteger, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from .base import Base, TimestampMixin


class ArtifactType(str, Enum):
    """Artifact type enumeration"""
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    CSV = "csv"
    XLSX = "xlsx"
    IMAGE = "image"
    OTHER = "other"


class ArtifactStatus(str, Enum):
    """Artifact processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Artifact(Base, TimestampMixin):
    """
    Artifact model for storing uploaded files and documents
    
    Fields:
    - id: Primary key
    - user_id: Foreign key to users table
    - filename: Original filename
    - file_type: Type of file (pdf, docx, etc.)
    - file_size: File size in bytes
    - storage_path: Path to file in storage (Azure Blob, S3, etc.)
    - status: Processing status
    - metadata: JSON metadata (extracted text, embeddings, etc.)
    - created_at: Upload timestamp
    - updated_at: Last update timestamp
    
    Relationships:
    - user: Artifact owner
    """
    __tablename__ = "artifacts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    file_type = Column(SQLEnum(ArtifactType), nullable=False)
    file_size = Column(BigInteger, nullable=False)  # Size in bytes
    storage_path = Column(String(1000), nullable=False)
    status = Column(SQLEnum(ArtifactStatus), default=ArtifactStatus.PENDING, nullable=False)
    
    # Optional: Store extracted content or metadata
    # For RAG: store embeddings, chunks, etc.
    # metadata = Column(JSON, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="artifacts")
    
    def __repr__(self):
        return f"<Artifact(id={self.id}, filename='{self.filename}', status={self.status.value})>"
