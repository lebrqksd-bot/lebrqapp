"""
HR Dashboard API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, date, timedelta

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, Attendance, Leave, Payroll

router = APIRouter(prefix="/hr/dashboard", tags=["hr-dashboard"])


def admin_or_hr_required(user: User = Depends(get_current_user)) -> User:
    """Require admin or HR role"""
    if user.role not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return user


@router.get("/stats")
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get HR dashboard statistics"""
    today = date.today()
    
    # Total staff
    result = await session.execute(
        select(func.count(Staff.id)).where(Staff.is_active == True)
    )
    total_staff = result.scalar() or 0
    
    # Present today
    result = await session.execute(
        select(func.count(Attendance.id)).where(
            Attendance.attendance_date == today,
            Attendance.status == "present",
        )
    )
    present_today = result.scalar() or 0
    
    # Absent today
    result = await session.execute(
        select(func.count(Attendance.id)).where(
            Attendance.attendance_date == today,
            Attendance.status == "absent",
        )
    )
    absent_today = result.scalar() or 0
    
    # Upcoming birthdays (next 30 days)
    today_month = today.month
    today_day = today.day
    next_month = today + timedelta(days=30)
    
    # Get staff with birthdays in next 30 days
    result = await session.execute(
        select(Staff).where(
            Staff.is_active == True,
            Staff.date_of_birth.isnot(None),
        )
    )
    all_staff = result.scalars().all()
    
    upcoming_birthdays = []
    for staff in all_staff:
        if staff.date_of_birth:
            # Create birthday for this year
            birthday_this_year = date(today.year, staff.date_of_birth.month, staff.date_of_birth.day)
            # If birthday already passed this year, use next year
            if birthday_this_year < today:
                birthday_this_year = date(today.year + 1, staff.date_of_birth.month, staff.date_of_birth.day)
            
            # Check if within next 30 days
            if today <= birthday_this_year <= next_month:
                days_until = (birthday_this_year - today).days
                upcoming_birthdays.append({
                    "staff_id": staff.id,
                    "name": f"{staff.first_name} {staff.last_name}",
                    "date": birthday_this_year,
                    "days_until": days_until,
                })
    
    # Sort by date
    upcoming_birthdays.sort(key=lambda x: x["date"])
    
    # Monthly salary expenses (current month)
    current_month = today.month
    current_year = today.year
    
    result = await session.execute(
        select(func.sum(Payroll.net_salary)).where(
            Payroll.month == current_month,
            Payroll.year == current_year,
            Payroll.status.in_(["processed", "locked"]),
        )
    )
    monthly_salary_expenses = result.scalar() or 0.0
    
    # Leave requests (pending)
    result = await session.execute(
        select(func.count(Leave.id)).where(Leave.status == "pending")
    )
    pending_leave_requests = result.scalar() or 0
    
    # Get recent pending leaves
    result = await session.execute(
        select(Leave)
        .where(Leave.status == "pending")
        .order_by(Leave.applied_at.asc())
        .limit(10)
        .options(selectinload(Leave.staff))
    )
    recent_pending_leaves = result.scalars().all()
    
    pending_leaves_list = [
        {
            "id": leave.id,
            "staff_id": leave.staff_id,
            "staff_name": f"{leave.staff.first_name} {leave.staff.last_name}" if leave.staff else "Unknown",
            "leave_type": leave.leave_type,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "total_days": leave.total_days,
            "applied_at": leave.applied_at,
        }
        for leave in recent_pending_leaves
    ]
    
    return {
        "total_staff": total_staff,
        "present_today": present_today,
        "absent_today": absent_today,
        "upcoming_birthdays": upcoming_birthdays[:10],  # Top 10
        "monthly_salary_expenses": monthly_salary_expenses,
        "pending_leave_requests": pending_leave_requests,
        "recent_pending_leaves": pending_leaves_list,
    }


@router.get("/attendance-summary")
async def get_attendance_summary(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    department: Optional[str] = Query(None, description="Filter by department"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get attendance summary for a date range"""
    stmt = select(Attendance).where(
        Attendance.attendance_date >= start_date,
        Attendance.attendance_date <= end_date,
    )
    
    if department:
        stmt = stmt.join(Staff).where(Staff.department == department)
    
    result = await session.execute(stmt.options(selectinload(Attendance.staff)))
    records = result.scalars().all()
    
    # Calculate summary
    present_count = sum(1 for r in records if r.status == "present")
    absent_count = sum(1 for r in records if r.status == "absent")
    half_day_count = sum(1 for r in records if r.status == "half_day")
    leave_count = sum(1 for r in records if r.status == "leave")
    holiday_count = sum(1 for r in records if r.status == "holiday")
    
    total_hours = sum(r.total_hours or 0.0 for r in records)
    total_overtime = sum(r.overtime_hours or 0.0 for r in records)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "present": present_count,
        "absent": absent_count,
        "half_days": half_day_count,
        "leaves": leave_count,
        "holidays": holiday_count,
        "total_hours": round(total_hours, 2),
        "total_overtime_hours": round(total_overtime, 2),
    }


@router.get("/department-stats")
async def get_department_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get statistics by department"""
    # Get all active staff grouped by department
    result = await session.execute(
        select(Staff.department, func.count(Staff.id).label("count"))
        .where(Staff.is_active == True)
        .group_by(Staff.department)
    )
    dept_counts = result.all()
    
    department_stats = []
    for dept, count in dept_counts:
        # Get present today for this department
        today = date.today()
        result = await session.execute(
            select(func.count(Attendance.id)).where(
                Attendance.attendance_date == today,
                Attendance.status == "present",
            ).join(Staff).where(Staff.department == dept)
        )
        present_today = result.scalar() or 0
        
        department_stats.append({
            "department": dept,
            "total_staff": count,
            "present_today": present_today,
            "absent_today": count - present_today,
        })
    
    return department_stats

