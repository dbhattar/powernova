"""
Feedback Routes
Public endpoint for submitting feedback and admin endpoints for managing feedback
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

from database.session import get_db
from models.feedback import Feedback, FeedbackStatus, FeedbackType
from routes.admin import verify_admin_key

router = APIRouter()


# === Pydantic Models ===

class FeedbackSubmit(BaseModel):
    """Model for submitting new feedback"""
    name: str = Field(..., min_length=1, max_length=255, description="Contact person name")
    email: EmailStr = Field(..., description="Contact email address")
    company: Optional[str] = Field(None, max_length=255, description="Company name (optional)")
    message: str = Field(..., min_length=10, description="Feedback message content")
    request_type: Optional[FeedbackType] = Field(FeedbackType.FEEDBACK, description="Type of request: feedback or account_request")


class FeedbackUpdate(BaseModel):
    """Model for updating feedback (admin only)"""
    status: Optional[FeedbackStatus] = Field(None, description="New status")
    admin_notes: Optional[str] = Field(None, description="Admin notes")


class FeedbackResponse(BaseModel):
    """Response model for feedback"""
    id: int
    name: str
    email: str
    company: Optional[str]
    message: str
    request_type: str
    status: str
    admin_notes: Optional[str]
    created_at: str
    updated_at: Optional[str]
    resolved_at: Optional[str]

    class Config:
        from_attributes = True


# === Public Endpoint ===

@router.post("/feedback", status_code=201)
async def submit_feedback(
    feedback_data: FeedbackSubmit,
    db: Session = Depends(get_db)
):
    """
    Submit feedback or account request from the app.
    No authentication required - this is a public endpoint.
    
    For account requests, set request_type='account_request' and provide:
    - name: Full name
    - email: Valid email address (will be used for login)
    - company: Company name
    - message: Justification for account access
    """
    try:
        # Create new feedback
        feedback = Feedback(
            name=feedback_data.name,
            email=feedback_data.email,
            company=feedback_data.company,
            message=feedback_data.message,
            request_type=feedback_data.request_type,
            status=FeedbackStatus.NEW
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        
        # Different messages based on request type
        if feedback_data.request_type == FeedbackType.ACCOUNT_REQUEST:
            message = "Thank you for your account request! We'll review it and contact you at the provided email address."
        else:
            message = "Thank you for your feedback! We'll get back to you soon."
        
        return {
            "success": True,
            "message": message,
            "feedback_id": feedback.id
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


# === Admin Endpoints ===

@router.get("/admin/feedback", response_model=List[FeedbackResponse])
async def list_feedback(
    status: Optional[FeedbackStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_key)
):
    """
    List all feedback submissions (admin only).
    Can filter by status and paginate results.
    """
    query = db.query(Feedback)
    
    # Filter by status if provided
    if status:
        query = query.filter(Feedback.status == status)
    
    # Order by most recent first
    query = query.order_by(Feedback.created_at.desc())
    
    # Paginate
    feedback_list = query.offset(skip).limit(limit).all()
    
    return [FeedbackResponse(**fb.to_dict()) for fb in feedback_list]


@router.get("/admin/feedback/stats")
async def get_feedback_stats(
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_key)
):
    """
    Get feedback statistics (admin only).
    Returns counts by status and overall metrics.
    """
    total = db.query(Feedback).count()
    new_count = db.query(Feedback).filter(Feedback.status == FeedbackStatus.NEW).count()
    in_progress_count = db.query(Feedback).filter(Feedback.status == FeedbackStatus.IN_PROGRESS).count()
    resolved_count = db.query(Feedback).filter(Feedback.status == FeedbackStatus.RESOLVED).count()
    archived_count = db.query(Feedback).filter(Feedback.status == FeedbackStatus.ARCHIVED).count()
    
    return {
        "total": total,
        "new": new_count,
        "in_progress": in_progress_count,
        "resolved": resolved_count,
        "archived": archived_count
    }


@router.get("/admin/feedback/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_key)
):
    """
    Get a specific feedback submission by ID (admin only).
    """
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return FeedbackResponse(**feedback.to_dict())


@router.patch("/admin/feedback/{feedback_id}")
async def update_feedback(
    feedback_id: int,
    update_data: FeedbackUpdate,
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_key)
):
    """
    Update feedback status or admin notes (admin only).
    """
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Update fields
    if update_data.status is not None:
        feedback.status = update_data.status
        
        # Set resolved_at timestamp when marking as resolved
        if update_data.status == FeedbackStatus.RESOLVED and feedback.resolved_at is None:
            feedback.resolved_at = datetime.utcnow()
    
    if update_data.admin_notes is not None:
        feedback.admin_notes = update_data.admin_notes
    
    feedback.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(feedback)
        
        return {
            "success": True,
            "message": "Feedback updated successfully",
            "feedback": FeedbackResponse(**feedback.to_dict())
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update feedback: {str(e)}")


@router.delete("/admin/feedback/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_key)
):
    """
    Delete a feedback submission (admin only).
    """
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    try:
        db.delete(feedback)
        db.commit()
        return None  # 204 No Content
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete feedback: {str(e)}")
