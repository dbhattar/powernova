"""
Database CRUD operations for models
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from models.user import User
from models.conversation import Conversation, Message, MessageRole
from models.artifact import Artifact, ArtifactStatus


# ============================================================================
# USER OPERATIONS
# ============================================================================

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, username: str, hashed_password: str) -> User:
    """Create new user"""
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Get list of users with pagination"""
    return db.query(User).offset(skip).limit(limit).all()


# ============================================================================
# CONVERSATION OPERATIONS
# ============================================================================

def create_conversation(db: Session, user_id: int, title: str = "New Conversation") -> Conversation:
    """Create new conversation for user"""
    conversation = Conversation(user_id=user_id, title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_conversation(db: Session, conversation_id: int) -> Optional[Conversation]:
    """Get conversation by ID with messages"""
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def get_user_conversations(db: Session, user_id: int, skip: int = 0, limit: int = 50) -> List[Conversation]:
    """Get all conversations for a user"""
    return db.query(Conversation)\
        .filter(Conversation.user_id == user_id)\
        .order_by(Conversation.updated_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()


def update_conversation_title(db: Session, conversation_id: int, title: str) -> Optional[Conversation]:
    """Update conversation title"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.title = title
        db.commit()
        db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, conversation_id: int) -> bool:
    """Delete conversation and all its messages"""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        db.delete(conversation)
        db.commit()
        return True
    return False


# ============================================================================
# MESSAGE OPERATIONS
# ============================================================================

def create_message(
    db: Session,
    conversation_id: int,
    role: MessageRole,
    content: str,
    token_count: int = 0,
    model: Optional[str] = None
) -> Message:
    """Create new message in conversation"""
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        token_count=token_count,
        model=model
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def get_conversation_messages(db: Session, conversation_id: int) -> List[Message]:
    """Get all messages in a conversation, ordered by creation time"""
    return db.query(Message)\
        .filter(Message.conversation_id == conversation_id)\
        .order_by(Message.created_at.asc())\
        .all()


def get_recent_messages(db: Session, conversation_id: int, limit: int = 10) -> List[Message]:
    """Get recent messages from a conversation"""
    return db.query(Message)\
        .filter(Message.conversation_id == conversation_id)\
        .order_by(Message.created_at.desc())\
        .limit(limit)\
        .all()


# ============================================================================
# ARTIFACT OPERATIONS
# ============================================================================

def create_artifact(
    db: Session,
    user_id: int,
    filename: str,
    file_type: str,
    file_size: int,
    storage_path: str
) -> Artifact:
    """Create new artifact record"""
    artifact = Artifact(
        user_id=user_id,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        storage_path=storage_path,
        status=ArtifactStatus.PENDING
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return artifact


def get_artifact(db: Session, artifact_id: int) -> Optional[Artifact]:
    """Get artifact by ID"""
    return db.query(Artifact).filter(Artifact.id == artifact_id).first()


def get_user_artifacts(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Artifact]:
    """Get all artifacts for a user"""
    return db.query(Artifact)\
        .filter(Artifact.user_id == user_id)\
        .order_by(Artifact.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()


def update_artifact_status(db: Session, artifact_id: int, status: ArtifactStatus) -> Optional[Artifact]:
    """Update artifact processing status"""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if artifact:
        artifact.status = status
        db.commit()
        db.refresh(artifact)
    return artifact


def delete_artifact(db: Session, artifact_id: int) -> bool:
    """Delete artifact record"""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if artifact:
        db.delete(artifact)
        db.commit()
        return True
    return False
