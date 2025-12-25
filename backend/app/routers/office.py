"""
Office Location Management API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import secrets
try:
    import qrcode
    import io
    import base64
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Office

router = APIRouter(prefix="/hr/office", tags=["hr-office"])


def admin_or_hr_required(user: User = Depends(get_current_user)) -> User:
    """Require admin or HR role"""
    if user.role not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return user


# Pydantic Models
class OfficeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    allowed_radius: float = Field(default=100.0, ge=10, le=1000)  # 10m to 1000m


class OfficeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    allowed_radius: Optional[float] = Field(None, ge=10, le=1000)
    is_active: Optional[bool] = None


class OfficeOut(BaseModel):
    id: int
    name: str
    qr_id: str
    latitude: float
    longitude: float
    allowed_radius: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
    qr_generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def generate_qr_id() -> str:
    """Generate unique QR identifier"""
    return f"OFFICE_{secrets.token_urlsafe(16)}"


@router.post("", response_model=OfficeOut, status_code=201)
async def create_office(
    data: OfficeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Add office GPS location"""
    qr_id = generate_qr_id()
    
    # Ensure unique QR ID
    while True:
        result = await session.execute(select(Office).where(Office.qr_id == qr_id))
        if not result.scalar_one_or_none():
            break
        qr_id = generate_qr_id()
    
    office = Office(
        name=data.name,
        qr_id=qr_id,
        latitude=data.latitude,
        longitude=data.longitude,
        allowed_radius=data.allowed_radius,
        created_by_user_id=current_user.id,
    )
    
    session.add(office)
    await session.commit()
    await session.refresh(office)
    
    return office


@router.get("", response_model=List[OfficeOut])
async def list_offices(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List all offices"""
    result = await session.execute(select(Office).order_by(Office.created_at.desc()))
    offices = result.scalars().all()
    return offices


@router.get("/{office_id}", response_model=OfficeOut)
async def get_office(
    office_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get office details"""
    result = await session.execute(select(Office).where(Office.id == office_id))
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    return office


@router.put("/{office_id}", response_model=OfficeOut)
async def update_office(
    office_id: int,
    data: OfficeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Update office location"""
    result = await session.execute(select(Office).where(Office.id == office_id))
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    if data.name is not None:
        office.name = data.name
    if data.latitude is not None:
        office.latitude = data.latitude
    if data.longitude is not None:
        office.longitude = data.longitude
    if data.allowed_radius is not None:
        office.allowed_radius = data.allowed_radius
    if data.is_active is not None:
        office.is_active = data.is_active
    
    office.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(office)
    
    return office


@router.delete("/{office_id}")
async def delete_office(
    office_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Delete office location"""
    result = await session.execute(select(Office).where(Office.id == office_id))
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    await session.delete(office)
    await session.commit()
    
    return {"message": "Office deleted successfully"}


@router.get("/{office_id}/generate-qr")
async def generate_qr_code(
    office_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Generate QR code for office (only once per office)"""
    if not QRCODE_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="QR code generation not available. Please install: pip install qrcode[pil]"
        )
    
    result = await session.execute(select(Office).where(Office.id == office_id))
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    # Check if QR has already been generated
    if office.qr_generated_at is not None:
        raise HTTPException(
            status_code=400,
            detail=f"QR code has already been generated for this office on {office.qr_generated_at.strftime('%Y-%m-%d %H:%M:%S')}. QR code can only be generated once."
        )
    
    # Create QR code with office QR ID
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(office.qr_id)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 with explicit cleanup
    buffer = None
    try:
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        # Clear buffer immediately
        buffer.seek(0)
        buffer.truncate(0)
    finally:
        if buffer:
            buffer.close()
        # Explicitly delete references to free memory
        del img
        del qr
    
    # Mark QR as generated
    office.qr_generated_at = datetime.utcnow()
    await session.commit()
    
    return {
        "qr_id": office.qr_id,
        "qr_code_base64": f"data:image/png;base64,{img_str}",
        "office_name": office.name,
        "generated_at": office.qr_generated_at.isoformat(),
    }


@router.get("/{office_id}/view-qr")
async def view_qr_code(
    office_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """View/Download QR code for office (if already generated)"""
    if not QRCODE_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="QR code generation not available. Please install: pip install qrcode[pil]"
        )
    
    result = await session.execute(select(Office).where(Office.id == office_id))
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    # Check if QR has been generated
    if office.qr_generated_at is None:
        raise HTTPException(
            status_code=400,
            detail="QR code has not been generated yet. Please generate it first."
        )
    
    # Create QR code with office QR ID (regenerate for viewing/downloading)
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(office.qr_id)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 with explicit cleanup
    buffer = None
    try:
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        # Clear buffer immediately
        buffer.seek(0)
        buffer.truncate(0)
    finally:
        if buffer:
            buffer.close()
        # Explicitly delete references to free memory
        del img
        del qr
    
    return {
        "qr_id": office.qr_id,
        "qr_code_base64": f"data:image/png;base64,{img_str}",
        "office_name": office.name,
        "generated_at": office.qr_generated_at.isoformat(),
    }

