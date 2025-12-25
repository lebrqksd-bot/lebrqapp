"""
Attendance Management API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, Attendance

router = APIRouter(prefix="/hr/attendance", tags=["hr-attendance"])


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
class AttendanceCreate(BaseModel):
    staff_id: int
    attendance_date: date
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str = Field(default="present", pattern="^(present|absent|half_day|holiday|leave)$")
    overtime_hours: Optional[float] = Field(default=0.0, ge=0)


class AttendanceUpdate(BaseModel):
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: Optional[str] = Field(None, pattern="^(present|absent|half_day|holiday|leave)$")
    overtime_hours: Optional[float] = Field(None, ge=0)
    manual_correction_note: Optional[str] = None


class AttendanceOut(BaseModel):
    id: int
    staff_id: int
    attendance_date: date
    check_in_time: Optional[datetime]
    check_out_time: Optional[datetime]
    total_hours: Optional[float]
    overtime_hours: float
    status: str
    is_manual: bool
    manual_correction_note: Optional[str]
    corrected_by_user_id: Optional[int]
    corrected_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    staff: Optional[dict] = None

    class Config:
        from_attributes = True


def calculate_working_hours(check_in: datetime, check_out: datetime) -> float:
    """Calculate working hours between check-in and check-out"""
    if not check_in or not check_out:
        return 0.0
    delta = check_out - check_in
    return round(delta.total_seconds() / 3600, 2)


@router.post("", response_model=AttendanceOut, status_code=201)
async def mark_attendance(
    data: AttendanceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Mark attendance for a staff member"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == data.staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Check if attendance already exists for this date
    existing = await session.execute(
        select(Attendance).where(
            Attendance.staff_id == data.staff_id,
            Attendance.attendance_date == data.attendance_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Attendance already marked for this date")
    
    # Calculate total hours if check-in and check-out are provided
    total_hours = None
    if data.check_in_time and data.check_out_time:
        total_hours = calculate_working_hours(data.check_in_time, data.check_out_time)
    
    # Create attendance record
    attendance = Attendance(
        staff_id=data.staff_id,
        attendance_date=data.attendance_date,
        check_in_time=data.check_in_time,
        check_out_time=data.check_out_time,
        total_hours=total_hours,
        overtime_hours=data.overtime_hours or 0.0,
        status=data.status,
        is_manual=False,
    )
    
    session.add(attendance)
    await session.commit()
    await session.refresh(attendance, ["staff"])
    
    # Return attendance object (Pydantic will serialize it)
    return attendance


@router.post("/check-in")
async def check_in(
    staff_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Check-in for today"""
    today = date.today()
    
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Check if attendance already exists for today
    existing = await session.execute(
        select(Attendance).where(
            Attendance.staff_id == staff_id,
            Attendance.attendance_date == today,
        )
    )
    attendance = existing.scalar_one_or_none()
    
    if attendance:
        if attendance.check_in_time:
            raise HTTPException(status_code=400, detail="Already checked in today")
        # Update existing record
        attendance.check_in_time = datetime.utcnow()
        attendance.status = "present"
    else:
        # Create new attendance record
        attendance = Attendance(
            staff_id=staff_id,
            attendance_date=today,
            check_in_time=datetime.utcnow(),
            status="present",
        )
        session.add(attendance)
    
    await session.commit()
    await session.refresh(attendance)
    
    return {
        "message": "Checked in successfully",
        "check_in_time": attendance.check_in_time,
        "attendance_date": attendance.attendance_date,
    }


@router.post("/check-out")
async def check_out(
    staff_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(employee_or_above),
):
    """Check-out for today"""
    today = date.today()
    
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get today's attendance
    result = await session.execute(
        select(Attendance).where(
            Attendance.staff_id == staff_id,
            Attendance.attendance_date == today,
        )
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance or not attendance.check_in_time:
        raise HTTPException(status_code=400, detail="Please check in first")
    
    if attendance.check_out_time:
        raise HTTPException(status_code=400, detail="Already checked out today")
    
    # Calculate working hours
    check_out_time = datetime.utcnow()
    total_hours = calculate_working_hours(attendance.check_in_time, check_out_time)
    
    # Calculate overtime (assuming 8 hours is standard, overtime if > 8 hours)
    standard_hours = 8.0
    overtime_hours = max(0.0, total_hours - standard_hours)
    
    attendance.check_out_time = check_out_time
    attendance.total_hours = total_hours
    attendance.overtime_hours = overtime_hours
    
    await session.commit()
    await session.refresh(attendance)
    
    return {
        "message": "Checked out successfully",
        "check_out_time": attendance.check_out_time,
        "total_hours": attendance.total_hours,
        "overtime_hours": attendance.overtime_hours,
    }


@router.get("", response_model=List[AttendanceOut])
async def list_attendance(
    staff_id: Optional[int] = Query(None, description="Filter by staff ID"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List attendance records"""
    print(f"[Attendance List] Request from user: {current_user.username} (role: {current_user.role})")
    print(f"[Attendance List] Filters - staff_id: {staff_id}, start_date: {start_date}, end_date: {end_date}, status: {status}")
    
    stmt = select(Attendance)
    
    # Apply filters
    conditions = []
    if staff_id:
        conditions.append(Attendance.staff_id == staff_id)
        print(f"[Attendance List] Filtering by staff_id: {staff_id}")
    if start_date:
        conditions.append(Attendance.attendance_date >= start_date)
        print(f"[Attendance List] Filtering by start_date >= {start_date}")
    if end_date:
        conditions.append(Attendance.attendance_date <= end_date)
        print(f"[Attendance List] Filtering by end_date <= {end_date}")
    if status:
        conditions.append(Attendance.status == status)
        print(f"[Attendance List] Filtering by status: {status}")
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.order_by(Attendance.attendance_date.desc(), Attendance.created_at.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt.options(selectinload(Attendance.staff)))
    attendance_list = result.scalars().all()
    
    print(f"[Attendance List] Found {len(attendance_list)} attendance records")
    
    # Convert to response format with staff as dict
    response_list = []
    for att in attendance_list:
        att_dict = {
            "id": att.id,
            "staff_id": att.staff_id,
            "attendance_date": att.attendance_date,
            "check_in_time": att.check_in_time,
            "check_out_time": att.check_out_time,
            "total_hours": att.total_hours,
            "overtime_hours": att.overtime_hours,
            "status": att.status,
            "is_manual": att.is_manual,
            "manual_correction_note": att.manual_correction_note,
            "corrected_by_user_id": att.corrected_by_user_id,
            "corrected_at": att.corrected_at,
            "created_at": att.created_at,
            "updated_at": att.updated_at,
            "staff": {
                "id": att.staff.id,
                "employee_code": att.staff.employee_code,
                "first_name": att.staff.first_name,
                "last_name": att.staff.last_name,
            } if att.staff else None,
        }
        response_list.append(att_dict)
        print(f"  - ID: {att.id}, Staff: {att.staff_id} ({att.staff.first_name if att.staff else 'N/A'}), Date: {att.attendance_date}, Status: {att.status}, Check-in: {att.check_in_time}")
    
    return response_list


@router.get("/{attendance_id}", response_model=AttendanceOut)
async def get_attendance(
    attendance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get attendance details by ID"""
    result = await session.execute(
        select(Attendance)
        .where(Attendance.id == attendance_id)
        .options(selectinload(Attendance.staff))
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    
    return attendance


@router.put("/{attendance_id}", response_model=AttendanceOut)
async def update_attendance(
    attendance_id: int,
    data: AttendanceUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Update attendance (manual correction by admin/HR)"""
    result = await session.execute(
        select(Attendance).where(Attendance.id == attendance_id)
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    
    # Recalculate total hours if check-in or check-out changed
    check_in = update_data.get("check_in_time") or attendance.check_in_time
    check_out = update_data.get("check_out_time") or attendance.check_out_time
    
    if check_in and check_out:
        total_hours = calculate_working_hours(check_in, check_out)
        attendance.total_hours = total_hours
        
        # Recalculate overtime
        standard_hours = 8.0
        overtime_hours = max(0.0, total_hours - standard_hours)
        if "overtime_hours" not in update_data:
            attendance.overtime_hours = overtime_hours
    
    for key, value in update_data.items():
        if key not in ["check_in_time", "check_out_time", "overtime_hours"]:
            setattr(attendance, key, value)
        elif key == "check_in_time":
            attendance.check_in_time = value
        elif key == "check_out_time":
            attendance.check_out_time = value
        elif key == "overtime_hours":
            attendance.overtime_hours = value
    
    # Mark as manual correction
    attendance.is_manual = True
    attendance.corrected_by_user_id = current_user.id
    attendance.corrected_at = datetime.utcnow()
    attendance.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(attendance, ["staff"])
    
    return attendance


@router.get("/summary/monthly")
async def get_monthly_summary(
    staff_id: int,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, description="Year"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get monthly attendance summary for a staff member"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get all attendance records for the month
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    result = await session.execute(
        select(Attendance).where(
            Attendance.staff_id == staff_id,
            Attendance.attendance_date >= start_date,
            Attendance.attendance_date <= end_date,
        )
    )
    records = result.scalars().all()
    
    # Calculate summary
    present_count = sum(1 for r in records if r.status == "present")
    absent_count = sum(1 for r in records if r.status == "absent")
    half_day_count = sum(1 for r in records if r.status == "half_day")
    leave_count = sum(1 for r in records if r.status == "leave")
    holiday_count = sum(1 for r in records if r.status == "holiday")
    
    total_hours = sum(r.total_hours or 0.0 for r in records)
    total_overtime = sum(r.overtime_hours or 0.0 for r in records)
    
    # Calculate working days (excluding holidays)
    total_working_days = (end_date - start_date).days + 1 - holiday_count
    
    return {
        "staff_id": staff_id,
        "month": month,
        "year": year,
        "start_date": start_date,
        "end_date": end_date,
        "total_working_days": total_working_days,
        "present_days": present_count + (half_day_count * 0.5),
        "absent_days": absent_count,
        "half_days": half_day_count,
        "leave_days": leave_count,
        "holidays": holiday_count,
        "total_hours": round(total_hours, 2),
        "total_overtime_hours": round(total_overtime, 2),
        "attendance_records": [
            {
                "date": r.attendance_date,
                "status": r.status,
                "check_in": r.check_in_time,
                "check_out": r.check_out_time,
                "hours": r.total_hours,
                "overtime": r.overtime_hours,
            }
            for r in records
        ],
    }

