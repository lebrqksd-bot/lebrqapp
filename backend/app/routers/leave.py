"""
Leave Management API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, timedelta

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, Leave

router = APIRouter(prefix="/hr/leave", tags=["hr-leave"])


def admin_or_hr_required(user: User = Depends(get_current_user)) -> User:
    """Require admin or HR role"""
    if user.role not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return user


def employee_or_above(user: User = Depends(get_current_user)) -> User:
    """Require employee, HR, or admin role"""
    if user.role not in ["admin", "hr", "employee"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return user


# Pydantic Models
class LeaveCreate(BaseModel):
    staff_id: int
    leave_type: str = Field(..., pattern="^(casual|sick|paid|unpaid)$")
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveUpdate(BaseModel):
    leave_type: Optional[str] = Field(None, pattern="^(casual|sick|paid|unpaid)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reason: Optional[str] = None


class LeaveApproval(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None


class LeaveOut(BaseModel):
    id: int
    staff_id: int
    leave_type: str
    start_date: date
    end_date: date
    total_days: float
    reason: Optional[str]
    status: str
    approved_by_user_id: Optional[int]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    applied_at: datetime
    updated_at: datetime
    staff: Optional[dict] = None

    class Config:
        from_attributes = True


def calculate_leave_days(start_date: date, end_date: date) -> float:
    """Calculate total leave days (can be 0.5 for half-day)"""
    if start_date > end_date:
        return 0.0
    delta = end_date - start_date
    return (delta.days + 1)  # Inclusive of both start and end dates


@router.post("", response_model=LeaveOut, status_code=201)
async def apply_leave(
    data: LeaveCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Apply for leave"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == data.staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Validate dates
    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="Start date must be before or equal to end date")
    
    # Calculate total days
    total_days = calculate_leave_days(data.start_date, data.end_date)
    
    # Check for overlapping leaves
    overlapping = await session.execute(
        select(Leave).where(
            Leave.staff_id == data.staff_id,
            Leave.status.in_(["pending", "approved"]),
            or_(
                and_(Leave.start_date <= data.start_date, Leave.end_date >= data.start_date),
                and_(Leave.start_date <= data.end_date, Leave.end_date >= data.end_date),
                and_(Leave.start_date >= data.start_date, Leave.end_date <= data.end_date),
            ),
        )
    )
    if overlapping.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Leave already exists for this date range")
    
    # Create leave record
    leave = Leave(
        staff_id=data.staff_id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        reason=data.reason,
        status="pending",
    )
    
    session.add(leave)
    await session.commit()
    await session.refresh(leave)
    
    # Load staff info
    result = await session.execute(
        select(Leave)
        .where(Leave.id == leave.id)
        .options(selectinload(Leave.staff))
    )
    leave = result.scalar_one()
    
    return leave


@router.get("", response_model=List[LeaveOut])
async def list_leaves(
    staff_id: Optional[int] = Query(None, description="Filter by staff ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    start_date: Optional[date] = Query(None, description="Filter leaves starting from this date"),
    end_date: Optional[date] = Query(None, description="Filter leaves ending before this date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List all leave requests"""
    stmt = select(Leave)
    
    # Apply filters
    conditions = []
    if staff_id:
        conditions.append(Leave.staff_id == staff_id)
    if status:
        conditions.append(Leave.status == status)
    if leave_type:
        conditions.append(Leave.leave_type == leave_type)
    if start_date:
        conditions.append(Leave.start_date >= start_date)
    if end_date:
        conditions.append(Leave.end_date <= end_date)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.order_by(Leave.applied_at.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt.options(selectinload(Leave.staff)))
    leaves = result.scalars().all()
    
    return leaves


@router.get("/pending", response_model=List[LeaveOut])
async def list_pending_leaves(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List all pending leave requests"""
    stmt = select(Leave).where(Leave.status == "pending")
    stmt = stmt.order_by(Leave.applied_at.asc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt.options(selectinload(Leave.staff)))
    leaves = result.scalars().all()
    
    return leaves


@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave(
    leave_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get leave details by ID"""
    result = await session.execute(
        select(Leave)
        .where(Leave.id == leave_id)
        .options(selectinload(Leave.staff))
    )
    leave = result.scalar_one_or_none()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    return leave


@router.put("/{leave_id}", response_model=LeaveOut)
async def update_leave(
    leave_id: int,
    data: LeaveUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Update leave request (only if pending)"""
    result = await session.execute(
        select(Leave).where(Leave.id == leave_id)
    )
    leave = result.scalar_one_or_none()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending leave requests")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    
    # Recalculate total days if dates changed
    start_date = update_data.get("start_date") or leave.start_date
    end_date = update_data.get("end_date") or leave.end_date
    
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before or equal to end date")
    
    total_days = calculate_leave_days(start_date, end_date)
    leave.total_days = total_days
    
    for key, value in update_data.items():
        setattr(leave, key, value)
    
    leave.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(leave)
    
    # Load staff info
    result = await session.execute(
        select(Leave)
        .where(Leave.id == leave.id)
        .options(selectinload(Leave.staff))
    )
    leave = result.scalar_one()
    
    return leave


@router.post("/{leave_id}/approve", response_model=LeaveOut)
async def approve_leave(
    leave_id: int,
    data: LeaveApproval,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Approve or reject leave request"""
    result = await session.execute(
        select(Leave).where(Leave.id == leave_id)
    )
    leave = result.scalar_one_or_none()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Leave request is not pending")
    
    leave.status = data.status
    leave.approved_by_user_id = current_user.id
    leave.approved_at = datetime.utcnow()
    
    if data.status == "rejected":
        leave.rejection_reason = data.rejection_reason
    
    leave.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(leave)
    
    # Load staff info
    result = await session.execute(
        select(Leave)
        .where(Leave.id == leave.id)
        .options(selectinload(Leave.staff))
    )
    leave = result.scalar_one()
    
    return leave


@router.delete("/{leave_id}", status_code=204)
async def delete_leave(
    leave_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Delete leave request (only if pending)"""
    result = await session.execute(
        select(Leave).where(Leave.id == leave_id)
    )
    leave = result.scalar_one_or_none()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Can only delete pending leave requests")
    
    await session.delete(leave)
    await session.commit()
    
    return None


@router.get("/staff/{staff_id}/summary")
async def get_staff_leave_summary(
    staff_id: int,
    year: int = Query(..., ge=2000, description="Year"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get leave summary for a staff member for a year"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get all leaves for the year
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    
    result = await session.execute(
        select(Leave).where(
            Leave.staff_id == staff_id,
            Leave.start_date >= start_date,
            Leave.end_date <= end_date,
        )
    )
    leaves = result.scalars().all()
    
    # Calculate summary by leave type
    summary = {
        "casual": {"total": 0.0, "approved": 0.0, "pending": 0.0, "rejected": 0.0},
        "sick": {"total": 0.0, "approved": 0.0, "pending": 0.0, "rejected": 0.0},
        "paid": {"total": 0.0, "approved": 0.0, "pending": 0.0, "rejected": 0.0},
        "unpaid": {"total": 0.0, "approved": 0.0, "pending": 0.0, "rejected": 0.0},
    }
    
    for leave in leaves:
        leave_type = leave.leave_type
        if leave_type in summary:
            summary[leave_type]["total"] += leave.total_days
            summary[leave_type][leave.status] += leave.total_days
    
    return {
        "staff_id": staff_id,
        "year": year,
        "summary": summary,
        "total_leaves": sum(l.total_days for l in leaves),
        "approved_leaves": sum(l.total_days for l in leaves if l.status == "approved"),
        "pending_leaves": sum(l.total_days for l in leaves if l.status == "pending"),
        "rejected_leaves": sum(l.total_days for l in leaves if l.status == "rejected"),
    }

