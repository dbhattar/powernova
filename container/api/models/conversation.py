"""
Conversation and Message models for chat history
"""
from sqlalchemy import Column, String, Integer, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from .base import Base, TimestampMixin


class MessageRole(str, Enum):
    """Message role enumeration"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Conversation(Base, TimestampMixin):
    """
    Conversation model for chat sessions
    
    Fields:
    - id: Primary key
    - user_id: Foreign key to users table
    - title: Conversation title (auto-generated or user-defined)
    - created_at: Conversation start timestamp
    - updated_at: Last message timestamp
    
    Relationships:
    - user: Conversation owner
    - messages: All messages in the conversation
    """
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False, default="New Conversation")
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, title='{self.title}')>"


class Message(Base, TimestampMixin):
    """
    Message model for individual chat messages
    
    Fields:
    - id: Primary key
    - conversation_id: Foreign key to conversations table
    - role: Message role (user, assistant, system)
    - content: Message text content
    - token_count: Number of tokens in the message
    - model: AI model used (for assistant messages)
    - created_at: Message timestamp
    - updated_at: Message edit timestamp
    
    Relationships:
    - conversation: Parent conversation
    """
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    model = Column(String(100), nullable=True)  # e.g., "gpt-4o-mini"
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(id={self.id}, conversation_id={self.conversation_id}, role={self.role.value})>"
