from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import shutil
from pathlib import Path
from app.models.database import get_db
from app.models.models import User, Document
from app.models.schemas import DocumentResponse, DocumentUploadResponse
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser
from app.core.config import settings

router = APIRouter()

# Ensure upload directory exists
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)

@router.get("/", response_model=List[DocumentResponse])
async def get_user_documents(
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all documents for the current user"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        return []
    
    # Get documents
    documents = (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    
    return documents

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Upload a document"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate file size
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB"
        )
    
    # Validate file type
    allowed_types = [
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not supported"
        )
    
    try:
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create database record
        document = Document(
            user_id=user.id,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            content_type=file.content_type,
            upload_status="completed"
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        return DocumentUploadResponse(
            message="Document uploaded successfully",
            document_id=document.id,
            filename=document.original_filename,
            file_size=document.file_size
        )
        
    except Exception as e:
        # Clean up file if database operation fails
        if file_path.exists():
            file_path.unlink()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get a specific document"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get document
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == user.id
        )
        .first()
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document

@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get document
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == user.id
        )
        .first()
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    try:
        # Delete file from filesystem
        file_path = Path(document.file_path)
        if file_path.exists():
            file_path.unlink()
        
        # Delete from database
        db.delete(document)
        db.commit()
        
        return {"message": "Document deleted successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {str(e)}"
        )
