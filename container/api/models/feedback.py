"""
Feedback Model
Stores customer feedback submitted from the landing page contact form
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from .base import Base
import enum


class FeedbackStatus(str, enum.Enum):
    """Feedback status enumeration"""
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class FeedbackType(str, enum.Enum):
    """Feedback type enumeration"""
    FEEDBACK = "feedback"
    ACCOUNT_REQUEST = "account_request"


class Feedback(Base):
    """
    Feedback model for storing customer messages from the landing page
    """
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, doc="Contact person name")
    email = Column(String(255), nullable=False, index=True, doc="Contact email address")
    company = Column(String(255), nullable=True, doc="Company name (optional)")
    message = Column(Text, nullable=False, doc="Feedback message content")
    request_type = Column(
        SQLEnum(FeedbackType, values_callable=lambda x: [e.value for e in x]),
        default=FeedbackType.FEEDBACK,
        nullable=False,
        index=True,
        doc="Type of request: feedback or account_request"
    )
    status = Column(
        SQLEnum(FeedbackStatus, values_callable=lambda x: [e.value for e in x]),
        default=FeedbackStatus.NEW,
        nullable=False,
        index=True,
        doc="Current status of the feedback"
    )
    admin_notes = Column(Text, nullable=True, doc="Admin notes about this feedback")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True, doc="When feedback was resolved")

    def __repr__(self):
        return f"<Feedback(id={self.id}, email={self.email}, status={self.status})>"

    def to_dict(self):
        """Convert feedback to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "company": self.company,
            "message": self.message,
            "request_type": self.request_type.value if isinstance(self.request_type, FeedbackType) else self.request_type,
            "status": self.status.value if isinstance(self.status, FeedbackStatus) else self.status,
            "admin_notes": self.admin_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }
