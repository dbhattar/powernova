from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.database import get_db
from app.models.models import User, Conversation, Message
from app.models.schemas import (
    ConversationResponse, 
    ConversationWithMessages, 
    MessageResponse,
    ChatRequest,
    ChatResponse
)
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser
from app.services.chat_service import ChatService
import uuid

router = APIRouter()
chat_service = ChatService()

@router.get("/history", response_model=List[ConversationResponse])
async def get_conversation_history(
    limit: int = 50,
    offset: int = 0,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get user's conversation history"""
    
    # Get user from database
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        return []
    
    # Get conversations
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return conversations

@router.get("/thread/{thread_id}", response_model=ConversationWithMessages)
async def get_conversation_thread(
    thread_id: str,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get a specific conversation thread with messages"""
    
    # Get user from database
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get conversation
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.thread_id == thread_id,
            Conversation.user_id == user.id
        )
        .first()
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return conversation

@router.post("/message", response_model=ChatResponse)
async def send_chat_message(
    chat_request: ChatRequest,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Send a chat message and get AI response"""
    
    # Get or create user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get or create conversation
    if chat_request.thread_id:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.thread_id == chat_request.thread_id,
                Conversation.user_id == user.id
            )
            .first()
        )
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        # Create new conversation
        thread_id = str(uuid.uuid4())
        conversation = Conversation(
            user_id=user.id,
            thread_id=thread_id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Get AI response
    try:
        ai_response = await chat_service.get_chat_response(
            message=chat_request.message,
            user_id=user.firebase_uid,
            thread_id=conversation.thread_id,
            is_follow_up=chat_request.is_follow_up
        )
    except Exception as e:
        ai_response = f"Sorry, I'm having trouble processing your request right now. Error: {str(e)}"
    
    # Save message and response
    message = Message(
        conversation_id=conversation.id,
        content=chat_request.message,
        response=ai_response,
        message_type="text",
        is_from_user=True
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update conversation timestamp
    conversation.updated_at = message.created_at
    db.commit()
    
    return ChatResponse(
        response=ai_response,
        thread_id=conversation.thread_id,
        message_id=message.id,
        conversation_id=conversation.id
    )

@router.post("/transcribe", response_model=ChatResponse)
async def transcribe_and_chat(
    audio: UploadFile = File(...),
    auto_send: bool = Form(True),
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Transcribe audio and optionally send to chat"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Transcribe audio
        transcription = await chat_service.transcribe_audio(audio)
        
        if not auto_send:
            return {"transcription": transcription}
        
        # Auto-send to chat
        chat_request = ChatRequest(message=transcription, is_follow_up=False)
        return await send_chat_message(chat_request, firebase_user, db)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )

@router.delete("/thread/{thread_id}")
async def delete_conversation(
    thread_id: str,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Delete a conversation thread"""
    
    # Get user
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get conversation
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.thread_id == thread_id,
            Conversation.user_id == user.id
        )
        .first()
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Delete conversation (cascading will delete messages)
    db.delete(conversation)
    db.commit()
    
    return {"message": "Conversation deleted successfully"}
