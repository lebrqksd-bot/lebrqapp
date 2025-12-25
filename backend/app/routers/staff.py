"""
Staff Management API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import uuid
import os
import time
from pathlib import Path

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, StaffDocument
from ..core import settings

router = APIRouter(prefix="/hr/staff", tags=["hr-staff"])


def admin_or_hr_required(user: User = Depends(get_current_user)) -> User:
    """Require admin or HR role"""
    if user.role not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return user


# Pydantic Models
class StaffCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=32)
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    role: str = Field(..., min_length=1, max_length=100)  # Designation
    department: str = Field(..., min_length=1, max_length=100)
    salary_type: str = Field(..., pattern="^(monthly|hourly)$")
    fixed_salary: Optional[float] = Field(None, ge=0)
    hourly_wage: Optional[float] = Field(None, ge=0)
    joining_date: date
    allowances: Optional[Dict[str, Any]] = None
    deductions: Optional[Dict[str, Any]] = None


class StaffUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=120)
    last_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=32)
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    role: Optional[str] = Field(None, min_length=1, max_length=100)
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    salary_type: Optional[str] = Field(None, pattern="^(monthly|hourly)$")
    fixed_salary: Optional[float] = Field(None, ge=0)
    hourly_wage: Optional[float] = Field(None, ge=0)
    joining_date: Optional[date] = None
    allowances: Optional[Dict[str, Any]] = None
    deductions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class StaffOut(BaseModel):
    id: int
    employee_code: str
    user_id: Optional[int]
    first_name: str
    last_name: str
    email: str
    phone: str
    date_of_birth: Optional[date]
    address: Optional[str]
    aadhar_number: Optional[str]
    pan_number: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relation: Optional[str]
    role: str
    department: str
    salary_type: str
    fixed_salary: Optional[float]
    hourly_wage: Optional[float]
    joining_date: date
    allowances: Optional[Dict[str, Any]]
    deductions: Optional[Dict[str, Any]]
    is_active: bool
    photo_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


async def generate_employee_code(session: AsyncSession) -> str:
    """Generate unique employee code: EMP001, EMP002, etc."""
    # Get the highest existing employee code number
    result = await session.execute(
        select(func.max(Staff.id))
    )
    max_id = result.scalar() or 0
    
    # Try to find a unique code
    for attempt in range(100):  # Try up to 100 times
        candidate_code = f"EMP{str(max_id + 1 + attempt).zfill(3)}"
        
        # Check if this code already exists
        existing = await session.execute(
            select(Staff).where(Staff.employee_code == candidate_code)
        )
        if not existing.scalar_one_or_none():
            return candidate_code
    
    # Fallback: use timestamp-based code if all sequential codes are taken
    return f"EMP{int(time.time()) % 1000000}"


@router.post("", response_model=StaffOut, status_code=201)
async def create_staff(
    data: StaffCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Create a new staff member"""
    # Validate email uniqueness
    existing_email = await session.execute(
        select(Staff).where(Staff.email == data.email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate phone uniqueness
    existing_phone = await session.execute(
        select(Staff).where(Staff.phone == data.phone)
    )
    if existing_phone.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already exists")
    
    # Validate Aadhar uniqueness if provided
    if data.aadhar_number:
        existing_aadhar = await session.execute(
            select(Staff).where(Staff.aadhar_number == data.aadhar_number)
        )
        if existing_aadhar.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Aadhar number already exists")
    
    # Validate PAN uniqueness if provided
    if data.pan_number:
        existing_pan = await session.execute(
            select(Staff).where(Staff.pan_number == data.pan_number)
        )
        if existing_pan.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="PAN number already exists")
    
    # Validate salary fields based on salary_type
    if data.salary_type == "monthly" and not data.fixed_salary:
        raise HTTPException(status_code=400, detail="Fixed salary is required for monthly salary type")
    if data.salary_type == "hourly" and not data.hourly_wage:
        raise HTTPException(status_code=400, detail="Hourly wage is required for hourly salary type")
    
    # Generate employee code
    employee_code = await generate_employee_code(session)
    
    # Create staff
    staff = Staff(
        employee_code=employee_code,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        date_of_birth=data.date_of_birth,
        address=data.address,
        aadhar_number=data.aadhar_number,
        pan_number=data.pan_number,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        emergency_contact_relation=data.emergency_contact_relation,
        role=data.role,
        department=data.department,
        salary_type=data.salary_type,
        fixed_salary=data.fixed_salary,
        hourly_wage=data.hourly_wage,
        joining_date=data.joining_date,
        allowances=data.allowances or {},
        deductions=data.deductions or {},
        created_by_user_id=current_user.id,
    )
    
    try:
        session.add(staff)
        await session.commit()
        await session.refresh(staff)
        return staff
    except Exception as e:
        await session.rollback()
        # Check if it's a duplicate employee_code error
        error_str = str(e).lower()
        if "employee_code" in error_str or "duplicate" in error_str or "unique" in error_str:
            # Retry with a new employee code
            employee_code = await generate_employee_code(session)
            staff.employee_code = employee_code
            session.add(staff)
            await session.commit()
            await session.refresh(staff)
            return staff
        # Re-raise other errors
        raise HTTPException(status_code=500, detail=f"Failed to create staff: {str(e)}")


@router.get("", response_model=List[StaffOut])
async def list_staff(
    search: str = Query("", description="Search by name, email, phone, or employee code"),
    department: Optional[str] = Query(None, description="Filter by department"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List all staff members"""
    stmt = select(Staff)
    
    # Apply filters
    conditions = []
    if search:
        search_term = f"%{search.lower()}%"
        conditions.append(
            or_(
                func.lower(Staff.first_name).like(search_term),
                func.lower(Staff.last_name).like(search_term),
                func.lower(Staff.email).like(search_term),
                func.lower(Staff.phone).like(search_term),
                func.lower(Staff.employee_code).like(search_term),
            )
        )
    if department:
        conditions.append(Staff.department == department)
    if is_active is not None:
        conditions.append(Staff.is_active == is_active)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.order_by(Staff.created_at.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt)
    staff_list = result.scalars().all()
    
    return staff_list


@router.get("/{staff_id}", response_model=StaffOut)
async def get_staff(
    staff_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get staff details by ID"""
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    return staff


@router.put("/{staff_id}", response_model=StaffOut)
async def update_staff(
    staff_id: int,
    data: StaffUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Update staff details"""
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Validate email uniqueness if being updated
    if data.email and data.email != staff.email:
        existing_email = await session.execute(
            select(Staff).where(Staff.email == data.email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate phone uniqueness if being updated
    if data.phone and data.phone != staff.phone:
        existing_phone = await session.execute(
            select(Staff).where(Staff.phone == data.phone)
        )
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already exists")
    
    # Validate Aadhar uniqueness if being updated
    if data.aadhar_number and data.aadhar_number != staff.aadhar_number:
        existing_aadhar = await session.execute(
            select(Staff).where(Staff.aadhar_number == data.aadhar_number)
        )
        if existing_aadhar.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Aadhar number already exists")
    
    # Validate PAN uniqueness if being updated
    if data.pan_number and data.pan_number != staff.pan_number:
        existing_pan = await session.execute(
            select(Staff).where(Staff.pan_number == data.pan_number)
        )
        if existing_pan.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="PAN number already exists")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(staff, key, value)
    
    staff.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(staff)
    
    return staff


@router.delete("/{staff_id}", status_code=204)
async def delete_staff(
    staff_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Delete staff member (soft delete by setting is_active=False)"""
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Soft delete
    staff.is_active = False
    staff.updated_at = datetime.utcnow()
    
    await session.commit()
    
    return None


@router.get("/{staff_id}/documents")
async def list_staff_documents(
    staff_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List all documents for a staff member"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get documents
    result = await session.execute(
        select(StaffDocument)
        .where(StaffDocument.staff_id == staff_id)
        .order_by(StaffDocument.uploaded_at.desc())
    )
    documents = result.scalars().all()
    
    return [
        {
            "id": doc.id,
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "file_url": doc.file_url,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "description": doc.description,
            "uploaded_at": doc.uploaded_at,
        }
        for doc in documents
    ]


@router.post("/{staff_id}/documents")
async def upload_staff_document(
    staff_id: int,
    document_type: str = Form(..., description="Document type: id|photo|offer_letter|contract|other"),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Upload a document for a staff member"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Validate document type
    valid_types = ["id", "photo", "offer_letter", "contract", "other"]
    if document_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {', '.join(valid_types)}")
    
    # Create upload directory
    upload_dir = Path(settings.UPLOAD_DIR) / "staff_documents" / str(staff_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = upload_dir / unique_filename
    
    # Save file
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Generate file URL
    file_url = f"/uploads/staff_documents/{staff_id}/{unique_filename}"
    
    # If it's a photo, update staff photo_url
    if document_type == "photo":
        staff.photo_url = file_url
        staff.updated_at = datetime.utcnow()
    
    # Create document record
    doc = StaffDocument(
        staff_id=staff_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=str(file_path),
        file_url=file_url,
        file_size=len(content),
        mime_type=file.content_type,
        description=description,
        uploaded_by_user_id=current_user.id,
    )
    
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    
    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "file_name": doc.file_name,
        "file_url": doc.file_url,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "description": doc.description,
        "uploaded_at": doc.uploaded_at,
    }


@router.delete("/{staff_id}/documents/{document_id}", status_code=204)
async def delete_staff_document(
    staff_id: int,
    document_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Delete a staff document"""
    result = await session.execute(
        select(StaffDocument).where(
            StaffDocument.id == document_id,
            StaffDocument.staff_id == staff_id,
        )
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from filesystem
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    # If it was a photo, clear staff photo_url
    if doc.document_type == "photo":
        result = await session.execute(
            select(Staff).where(Staff.id == staff_id)
        )
        staff = result.scalar_one_or_none()
        if staff and staff.photo_url == doc.file_url:
            staff.photo_url = None
            staff.updated_at = datetime.utcnow()
    
    await session.delete(doc)
    await session.commit()
    
    return None

