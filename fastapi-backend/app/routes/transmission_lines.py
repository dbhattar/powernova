from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.database import get_db
from app.models.models import TransmissionLine
from app.models.schemas import TransmissionLineResponse, TransmissionLineCreate
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser, optional_firebase_token

router = APIRouter()

@router.get("/", response_model=List[TransmissionLineResponse])
async def get_transmission_lines(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    voltage_min: Optional[float] = Query(None, description="Minimum voltage (kV)"),
    voltage_max: Optional[float] = Query(None, description="Maximum voltage (kV)"),
    utility_area: Optional[str] = Query(None, description="Filter by utility area"),
    line_type: Optional[str] = Query(None, description="Filter by line type"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get transmission lines with optional filtering"""
    
    query = db.query(TransmissionLine)
    
    # Apply filters
    if voltage_min is not None:
        query = query.filter(TransmissionLine.voltage >= voltage_min)
    
    if voltage_max is not None:
        query = query.filter(TransmissionLine.voltage <= voltage_max)
    
    if utility_area:
        query = query.filter(TransmissionLine.utility_area.ilike(f"%{utility_area}%"))
    
    if line_type:
        query = query.filter(TransmissionLine.line_type.ilike(f"%{line_type}%"))
    
    transmission_lines = query.offset(skip).limit(limit).all()
    return transmission_lines

@router.get("/{transmission_line_id}", response_model=TransmissionLineResponse)
async def get_transmission_line(
    transmission_line_id: int,
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get a specific transmission line by ID"""
    
    transmission_line = db.query(TransmissionLine).filter(
        TransmissionLine.id == transmission_line_id
    ).first()
    
    if not transmission_line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transmission line not found"
        )
    
    return transmission_line

@router.post("/", response_model=TransmissionLineResponse)
async def create_transmission_line(
    transmission_line: TransmissionLineCreate,
    user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Create a new transmission line"""
    
    db_transmission_line = TransmissionLine(**transmission_line.dict())
    db.add(db_transmission_line)
    db.commit()
    db.refresh(db_transmission_line)
    
    return db_transmission_line

@router.get("/search/", response_model=List[TransmissionLineResponse])
async def search_transmission_lines(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Search transmission lines by name, circuit, or utility area"""
    
    transmission_lines = (
        db.query(TransmissionLine)
        .filter(
            TransmissionLine.name.ilike(f"%{q}%") |
            TransmissionLine.circuit.ilike(f"%{q}%") |
            TransmissionLine.utility_area.ilike(f"%{q}%")
        )
        .limit(limit)
        .all()
    )
    
    return transmission_lines
