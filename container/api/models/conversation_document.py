"""
ConversationDocument model - Links uploaded documents to specific conversations
"""
from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class ConversationDocument(Base, TimestampMixin):
    """
    Junction table linking conversations to uploaded documents
    
    This allows each conversation to have its own set of documents,
    keeping contexts completely isolated between conversations.
    
    Fields:
    - id: Primary key
    - conversation_id: Foreign key to conversations table
    - document_id: Foreign key to documents table
    - uploaded_by: User ID who uploaded the document
    - created_at: Upload timestamp
    - updated_at: Last modification timestamp
    
    Relationships:
    - conversation: The conversation this document belongs to
    - document: The uploaded document
    """
    __tablename__ = "conversation_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="conversation_documents")
    document = relationship("Document", backref="conversation_links")
    user = relationship("User")
    
    def __repr__(self):
        return f"<ConversationDocument(id={self.id}, conversation_id={self.conversation_id}, document_id={self.document_id})>"
