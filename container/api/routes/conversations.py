"""
Conversation routes - Manage user conversations and messages
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
import os
import io
import logging
from datetime import datetime

from database import get_db
from services.conversation_service import get_conversation_service
from services.auth import get_current_user
from services.azure_storage import AzureStorageService
from services.embedding_service import EmbeddingService
from models import User, Document, DocumentType, DocumentStatus, DocumentScope

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ==================== #

class ConversationCreate(BaseModel):
    """Request model for creating a conversation"""
    title: Optional[str] = Field(default="New Conversation", max_length=500)


class ConversationUpdate(BaseModel):
    """Request model for updating a conversation"""
    title: str = Field(..., min_length=1, max_length=500)


class ConversationResponse(BaseModel):
    """Response model for conversation"""
    id: int
    title: str
    created_at: str
    updated_at: str
    message_count: int
    document_count: int
    last_message_preview: Optional[str] = None
    last_message_role: Optional[str] = None


class MessageResponse(BaseModel):
    """Response model for message"""
    id: int
    role: str
    content: str
    model: Optional[str] = None
    token_count: int
    created_at: str
    updated_at: str


class DocumentResponse(BaseModel):
    """Response model for document"""
    id: int
    title: str
    url: str
    document_type: str
    file_size: Optional[int] = None
    blob_url: Optional[str] = None
    status: str
    chunk_count: int
    uploaded_at: str
    uploaded_by: Optional[int] = None


# ==================== Conversation Endpoints ==================== #

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all conversations for the current user
    
    Returns conversations ordered by most recent activity.
    """
    conv_service = get_conversation_service(db)
    conversations = conv_service.get_user_conversations(
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    return conversations


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new conversation
    
    Returns the created conversation.
    """
    conv_service = get_conversation_service(db)
    conversation = conv_service.create_conversation(
        user_id=current_user.id,
        title=request.title
    )
    
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "message_count": 0,
        "document_count": 0,
        "last_message_preview": None,
        "last_message_role": None
    }


@router.get("/conversations/{conversation_id}", response_model=dict)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific conversation with its messages and documents
    
    Returns:
        Conversation details with messages and linked documents
    """
    conv_service = get_conversation_service(db)
    
    # Get conversation metadata
    conversation = conv_service.get_conversation(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get messages
    messages = conv_service.get_conversation_messages(
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    # Get documents
    documents = conv_service.get_conversation_documents(
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "messages": messages,
        "documents": documents
    }


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: int,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get messages from a specific conversation
    
    Returns messages ordered chronologically.
    """
    conv_service = get_conversation_service(db)
    messages = conv_service.get_conversation_messages(
        conversation_id=conversation_id,
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    
    if not messages and offset == 0:
        # Verify conversation exists
        conversation = conv_service.get_conversation(conversation_id, current_user.id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    
    return messages


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    request: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a conversation's title
    """
    conv_service = get_conversation_service(db)
    conversation = conv_service.update_conversation_title(
        conversation_id=conversation_id,
        user_id=current_user.id,
        title=request.title
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "message_count": len(conversation.messages),
        "document_count": len(conversation.conversation_documents),
        "last_message_preview": conversation.messages[-1].content[:100] if conversation.messages else None,
        "last_message_role": conversation.messages[-1].role.value if conversation.messages else None
    }


@router.post("/conversations/{conversation_id}/title/generate")
async def auto_generate_title(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Auto-generate a conversation title based on the first few messages
    """
    conv_service = get_conversation_service(db)
    title = await conv_service.auto_generate_title(
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    if not title:
        raise HTTPException(status_code=500, detail="Failed to generate title")
    
    return {"title": title}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a conversation and all its messages
    """
    conv_service = get_conversation_service(db)
    success = conv_service.delete_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation deleted successfully"}


# ==================== Document Upload Endpoints ==================== #

@router.get("/conversations/{conversation_id}/documents", response_model=List[DocumentResponse])
async def get_conversation_documents(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all documents linked to a conversation
    """
    conv_service = get_conversation_service(db)
    documents = conv_service.get_conversation_documents(
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    if not documents:
        # Verify conversation exists
        conversation = conv_service.get_conversation(conversation_id, current_user.id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    
    return documents


@router.post("/conversations/{conversation_id}/documents")
async def upload_document(
    conversation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a document to a conversation
    
    Supported file types: PDF, DOCX, TXT, MD
    Maximum file size: 10MB
    """
    conv_service = get_conversation_service(db)
    
    # Verify conversation exists and user owns it
    conversation = conv_service.get_conversation(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Validate file type
    allowed_extensions = ['.pdf', '.docx', '.txt', '.md']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Validate file size (10MB max)
    max_size = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is 10MB. Your file is {file_size / (1024 * 1024):.2f}MB"
        )
    
    # Reset file pointer
    await file.seek(0)
    
    try:
        # Determine document type
        doc_type_map = {
            '.pdf': DocumentType.PDF,
            '.docx': DocumentType.DOCX,
            '.txt': DocumentType.TEXT,
            '.md': DocumentType.MARKDOWN
        }
        doc_type = doc_type_map.get(file_ext, DocumentType.OTHER)
        
        # Upload to Azure Blob Storage
        logger.info(f"Initializing Azure Storage service for user {current_user.id}")
        storage_service = AzureStorageService()
        
        # Generate a unique URL for this user-uploaded document
        import hashlib
        from datetime import datetime
        file_hash = hashlib.md5(file_content).hexdigest()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_url = f"user_upload/{current_user.id}/{file_hash}_{timestamp}"
        
        logger.info(f"Uploading document to Azure: {file.filename} ({file_size} bytes)")
        logger.info(f"Blob path will be: {unique_url}.{file_ext.lstrip('.')}")
        
        # Upload document (not async)
        try:
            file_path, blob_url, uploaded_size = storage_service.upload_document(
                content=file_content,
                url=unique_url,
                file_extension=file_ext.lstrip('.'),  # Remove leading dot
                job_id=0,  # User upload, not from a crawl job
                content_type=None  # Let service determine content type
            )
            logger.info(f"✅ Successfully uploaded to Azure: {blob_url}")
            logger.info(f"File path: {file_path}, Size: {uploaded_size} bytes")
        except Exception as e:
            logger.error(f"❌ Failed to upload to Azure Storage: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")
        
        # Create document record with conversation scope and user ownership
        document = Document(
            url=blob_url,
            title=file.filename,
            document_type=doc_type,
            document_scope=DocumentScope.CONVERSATION,  # Conversation-specific document
            uploaded_by=current_user.id,  # Track who uploaded it
            file_path=file_path,
            blob_url=blob_url,
            file_size=file_size,
            status=DocumentStatus.PENDING,
            crawl_job_id=None  # User-uploaded, not from crawler
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Extract text content from the document
        # This will be handled asynchronously in the background
        # For now, we'll mark it as processing
        document.status = DocumentStatus.PROCESSING
        db.commit()
        
        # Link document to conversation
        conv_doc = conv_service.add_document_to_conversation(
            conversation_id=conversation_id,
            document_id=document.id,
            user_id=current_user.id
        )
        
        if not conv_doc:
            raise HTTPException(status_code=500, detail="Failed to link document to conversation")
        
        # Extract text content and generate embeddings
        # This is done synchronously to ensure documents are immediately searchable
        try:
            from services.document_processor import DocumentProcessor
            from services.embedding_processor import process_document_embedding
            
            # Extract text based on file type
            logger.info(f"Extracting text from {doc_type.value} document: {file.filename}")
            
            if doc_type == DocumentType.TEXT or doc_type == DocumentType.MARKDOWN:
                # Simple text extraction
                text_content = file_content.decode('utf-8', errors='ignore')
                document.content = text_content
                logger.info(f"Extracted {len(text_content)} chars from text document")
                
            elif doc_type == DocumentType.PDF:
                # Extract text from PDF using DocumentProcessor
                title, text_content, metadata = DocumentProcessor.extract_text_from_pdf(
                    pdf_content=file_content,
                    url=blob_url
                )
                document.content = text_content
                document.title = title if title != blob_url else file.filename
                logger.info(f"Extracted {len(text_content)} chars from PDF ({metadata.get('page_count', 0)} pages)")
                
            elif doc_type == DocumentType.DOCX:
                # Extract text from DOCX using DocumentProcessor
                title, text_content, metadata = DocumentProcessor.extract_text_from_docx(
                    docx_content=file_content,
                    url=blob_url
                )
                document.content = text_content
                document.title = title if title != blob_url else file.filename
                logger.info(f"Extracted {len(text_content)} chars from DOCX")
            else:
                document.content = ""
                logger.warning(f"Unsupported document type: {doc_type.value}")
            
            # Check if we have content to process
            if not document.content or len(document.content.strip()) < 50:
                logger.warning(f"Document {document.id} has insufficient content ({len(document.content or '')} chars)")
                document.status = DocumentStatus.COMPLETED
                document.error_message = "Document contains insufficient text content"
                db.commit()
                db.refresh(document)
            else:
                # Save document with content first
                document.status = DocumentStatus.PROCESSING
                db.commit()
                db.refresh(document)
                
                # Generate embeddings (handles chunking and token limits internally)
                logger.info(f"Generating embeddings for document {document.id}")
                embedding_success = process_document_embedding(document.id, db)
                
                if embedding_success:
                    document.status = DocumentStatus.COMPLETED
                    logger.info(f"✅ Document {document.id} processed successfully with embeddings")
                else:
                    document.status = DocumentStatus.COMPLETED  # Still mark as completed even if embeddings fail
                    logger.warning(f"⚠️ Document {document.id} processed but embedding generation failed")
                
                db.commit()
                db.refresh(document)
            
        except Exception as e:
            logger.error(f"Failed to process document content: {e}")
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
            db.commit()
        
        return {
            "id": document.id,
            "title": document.title,
            "url": document.url,
            "document_type": document.document_type.value,
            "file_size": document.file_size,
            "blob_url": document.blob_url,
            "status": document.status.value,
            "chunk_count": document.chunk_count,
            "uploaded_at": conv_doc.created_at.isoformat(),
            "uploaded_by": conv_doc.uploaded_by,
            "message": "Document uploaded and processing started"
        }
        
    except Exception as e:
        print(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


@router.delete("/conversations/{conversation_id}/documents/{document_id}")
async def remove_document(
    conversation_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a document from a conversation
    
    Note: This only unlinks the document from the conversation,
    it does not delete the document from storage.
    """
    conv_service = get_conversation_service(db)
    success = conv_service.remove_document_from_conversation(
        conversation_id=conversation_id,
        document_id=document_id,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Document link not found")
    
    return {"message": "Document removed from conversation"}
