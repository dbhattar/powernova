from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.database import get_db
from app.models.models import AverageLMP, Substation
from app.models.schemas import AverageLMPResponse, AverageLMPCreate
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser, optional_firebase_token

router = APIRouter()

@router.get("/", response_model=List[AverageLMPResponse])
async def get_average_lmp(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    substation_ids: Optional[str] = Query(None, description="Comma-separated list of substation IDs"),
    lmp_type: Optional[str] = Query(None, description="Filter by LMP type (forecast/actual)"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get average LMP data with optional filtering"""
    
    query = db.query(AverageLMP)
    
    # Apply filters
    if substation_ids:
        try:
            ids = [int(id.strip()) for id in substation_ids.split(",")]
            query = query.filter(AverageLMP.substation_id.in_(ids))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid substation IDs format"
            )
    
    if lmp_type:
        query = query.filter(AverageLMP.lmp_type == lmp_type)
    
    if start_time:
        query = query.filter(AverageLMP.time >= start_time)
    
    if end_time:
        query = query.filter(AverageLMP.time <= end_time)
    
    # Order by time
    query = query.order_by(AverageLMP.time)
    
    average_lmp_data = query.offset(skip).limit(limit).all()
    return average_lmp_data

@router.get("/{average_lmp_id}", response_model=AverageLMPResponse)
async def get_average_lmp_by_id(
    average_lmp_id: int,
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get a specific average LMP record by ID"""
    
    average_lmp = db.query(AverageLMP).filter(
        AverageLMP.id == average_lmp_id
    ).first()
    
    if not average_lmp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Average LMP record not found"
        )
    
    return average_lmp

@router.post("/", response_model=AverageLMPResponse)
async def create_average_lmp(
    average_lmp: AverageLMPCreate,
    user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Create a new average LMP record"""
    
    # Verify substation exists
    substation = db.query(Substation).filter(
        Substation.id == average_lmp.substation_id
    ).first()
    
    if not substation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substation not found"
        )
    
    db_average_lmp = AverageLMP(**average_lmp.dict())
    db.add(db_average_lmp)
    db.commit()
    db.refresh(db_average_lmp)
    
    return db_average_lmp

@router.get("/substation/{substation_id}", response_model=List[AverageLMPResponse])
async def get_average_lmp_by_substation(
    substation_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    lmp_type: Optional[str] = Query(None, description="Filter by LMP type (forecast/actual)"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get average LMP data for a specific substation"""
    
    # Verify substation exists
    substation = db.query(Substation).filter(Substation.id == substation_id).first()
    if not substation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substation not found"
        )
    
    query = db.query(AverageLMP).filter(AverageLMP.substation_id == substation_id)
    
    # Apply filters
    if lmp_type:
        query = query.filter(AverageLMP.lmp_type == lmp_type)
    
    if start_time:
        query = query.filter(AverageLMP.time >= start_time)
    
    if end_time:
        query = query.filter(AverageLMP.time <= end_time)
    
    # Order by time
    query = query.order_by(AverageLMP.time)
    
    average_lmp_data = query.offset(skip).limit(limit).all()
    return average_lmp_data
