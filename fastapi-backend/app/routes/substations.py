from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.database import get_db
from app.models.models import Substation, County
from app.models.schemas import SubstationResponse, SubstationCreate, CountyResponse, SubstationCompareResponse, SubstationMappingsResponse, SubstationCompareResponse, SubstationMappingsResponse
from app.middleware.firebase_auth import verify_firebase_token, FirebaseUser, optional_firebase_token

router = APIRouter()

@router.get("/", response_model=List[SubstationResponse])
async def get_substations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    state: Optional[str] = Query(None, description="Filter by state code"),
    substation_type: Optional[str] = Query(None, description="Filter by substation type"),
    voltage_min: Optional[float] = Query(None, description="Minimum voltage (kV)"),
    voltage_max: Optional[float] = Query(None, description="Maximum voltage (kV)"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get substations with optional filtering"""
    
    query = db.query(Substation)
    
    # Apply filters
    if state:
        query = query.join(County).filter(County.state == state.upper())
    
    if substation_type:
        query = query.filter(Substation.substation_type == substation_type)
    
    if voltage_min is not None:
        query = query.filter(Substation.voltage >= voltage_min)
    
    if voltage_max is not None:
        query = query.filter(Substation.voltage <= voltage_max)
    
    substations = query.offset(skip).limit(limit).all()
    return substations

@router.get("/compare", response_model=SubstationCompareResponse)
async def compare_substations(
    substation_ids: str = Query(..., description="Comma-separated list of substation IDs"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Compare multiple substations (2-5 substations allowed)"""
    
    try:
        ids = [int(id.strip()) for id in substation_ids.split(",")]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid substation IDs format"
        )
    
    # Validate number of substations (2-5 as per Django)
    if len(ids) < 2 or len(ids) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide between 2 and 5 substation IDs."
        )
    
    substations = db.query(Substation).filter(Substation.id.in_(ids)).all()
    
    if len(substations) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more substations not found"
        )
    
    return {"data": substations}

@router.get("/mappings", response_model=SubstationMappingsResponse)
async def get_substation_mappings(
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get substation mappings by type, interconnecting entity, study region, and utility area"""
    
    # Get distinct combinations from the database
    substations = db.query(
        Substation.substation_type,
        Substation.interconnecting_entity,
        Substation.study_region,
        Substation.utility_area
    ).distinct().all()
    
    mappings_dict = {}
    for substation in substations:
        substation_type = substation.substation_type or "Unknown"
        interconnecting_entity = substation.interconnecting_entity or "Unknown"
        study_region = substation.study_region or "Unknown"
        utility_area = substation.utility_area or "Unknown"
        
        if substation_type not in mappings_dict:
            mappings_dict[substation_type] = {}
        
        if interconnecting_entity not in mappings_dict[substation_type]:
            mappings_dict[substation_type][interconnecting_entity] = {
                "study_regions": set(),
                "utility_areas": set(),
            }
        
        mappings_dict[substation_type][interconnecting_entity]["study_regions"].add(study_region)
        mappings_dict[substation_type][interconnecting_entity]["utility_areas"].add(utility_area)
    
    # Convert to the format expected by the frontend
    mappings = []
    for substation_type, entities in mappings_dict.items():
        for interconnecting_entity, data in entities.items():
            mappings.append([
                substation_type,
                interconnecting_entity,
                list(data["study_regions"]),
                list(data["utility_areas"]),
            ])
    
    return {
        "data": {
            "columns": [
                "Substation Type",
                "Interconnecting Entity",
                "Study Regions",
                "Utility Areas",
            ],
            "rows": mappings,
        }
    }

@router.get("/{substation_id}", response_model=SubstationResponse)
async def get_substation(
    substation_id: int,
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get a specific substation by ID"""
    
    substation = db.query(Substation).filter(Substation.id == substation_id).first()
    
    if not substation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substation not found"
        )
    
    return substation

@router.post("/", response_model=SubstationResponse)
async def create_substation(
    substation_data: SubstationCreate,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Create a new substation (requires authentication)"""
    
    # Validate county if provided
    if substation_data.county_id:
        county = db.query(County).filter(County.id == substation_data.county_id).first()
        if not county:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid county ID"
            )
    
    # Create substation
    substation = Substation(**substation_data.dict())
    db.add(substation)
    db.commit()
    db.refresh(substation)
    
    return substation

@router.put("/{substation_id}", response_model=SubstationResponse)
async def update_substation(
    substation_id: int,
    substation_data: SubstationCreate,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Update a substation (requires authentication)"""
    
    substation = db.query(Substation).filter(Substation.id == substation_id).first()
    
    if not substation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substation not found"
        )
    
    # Validate county if provided
    if substation_data.county_id:
        county = db.query(County).filter(County.id == substation_data.county_id).first()
        if not county:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid county ID"
            )
    
    # Update fields
    for field, value in substation_data.dict(exclude_unset=True).items():
        setattr(substation, field, value)
    
    db.commit()
    db.refresh(substation)
    
    return substation

@router.delete("/{substation_id}")
async def delete_substation(
    substation_id: int,
    firebase_user: FirebaseUser = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Delete a substation (requires authentication)"""
    
    substation = db.query(Substation).filter(Substation.id == substation_id).first()
    
    if not substation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substation not found"
        )
    
    db.delete(substation)
    db.commit()
    
    return {"message": "Substation deleted successfully"}

@router.get("/counties/", response_model=List[CountyResponse])
async def get_counties(
    state: Optional[str] = Query(None, description="Filter by state code"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get counties with optional state filtering"""
    
    query = db.query(County)
    
    if state:
        query = query.filter(County.state == state.upper())
    
    counties = query.all()
    return counties

@router.get("/search/", response_model=List[SubstationResponse])
async def search_substations(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Search substations by name, code, or region"""
    
    # Simple text search - in production you might want to use full-text search
    substations = (
        db.query(Substation)
        .filter(
            Substation.name.ilike(f"%{q}%") |
            Substation.code.ilike(f"%{q}%") |
            Substation.study_region.ilike(f"%{q}%") |
            Substation.utility_area.ilike(f"%{q}%")
        )
        .limit(limit)
        .all()
    )
    
    return substations

@router.get("/compare", response_model=SubstationCompareResponse)
async def compare_substations(
    substation_ids: str = Query(..., description="Comma-separated list of substation IDs"),
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Compare multiple substations (2-5 substations allowed)"""
    
    try:
        ids = [int(id.strip()) for id in substation_ids.split(",")]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid substation IDs format"
        )
    
    # Validate number of substations (2-5 as per Django)
    if len(ids) < 2 or len(ids) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide between 2 and 5 substation IDs."
        )
    
    substations = db.query(Substation).filter(Substation.id.in_(ids)).all()
    
    if len(substations) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more substations not found"
        )
    
    return {"data": substations}

@router.get("/mappings", response_model=SubstationMappingsResponse)
async def get_substation_mappings(
    user: Optional[FirebaseUser] = Depends(optional_firebase_token),
    db: Session = Depends(get_db)
):
    """Get substation mappings by type, interconnecting entity, study region, and utility area"""
    
    # Get distinct combinations from the database
    substations = db.query(
        Substation.substation_type,
        Substation.interconnecting_entity,
        Substation.study_region,
        Substation.utility_area
    ).distinct().all()
    
    mappings_dict = {}
    for substation in substations:
        substation_type = substation.substation_type or "Unknown"
        interconnecting_entity = substation.interconnecting_entity or "Unknown"
        study_region = substation.study_region or "Unknown"
        utility_area = substation.utility_area or "Unknown"
        
        if substation_type not in mappings_dict:
            mappings_dict[substation_type] = {}
        
        if interconnecting_entity not in mappings_dict[substation_type]:
            mappings_dict[substation_type][interconnecting_entity] = {
                "study_regions": set(),
                "utility_areas": set(),
            }
        
        mappings_dict[substation_type][interconnecting_entity]["study_regions"].add(study_region)
        mappings_dict[substation_type][interconnecting_entity]["utility_areas"].add(utility_area)
    
    # Convert to the format expected by the frontend
    mappings = []
    for substation_type, entities in mappings_dict.items():
        for interconnecting_entity, data in entities.items():
            mappings.append([
                substation_type,
                interconnecting_entity,
                list(data["study_regions"]),
                list(data["utility_areas"]),
            ])
    
    return {
        "data": {
            "columns": [
                "Substation Type",
                "Interconnecting Entity",
                "Study Regions",
                "Utility Areas",
            ],
            "rows": mappings,
        }
    }
