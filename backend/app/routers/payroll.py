"""
Payroll Management API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from calendar import monthrange
from io import BytesIO
import os
from pathlib import Path

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, Attendance, Leave, Payroll
from ..core import settings

router = APIRouter(prefix="/hr/payroll", tags=["hr-payroll"])


def admin_or_hr_required(user: User = Depends(get_current_user)) -> User:
    """Require admin or HR role"""
    if user.role not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return user


# Pydantic Models
class PayrollOut(BaseModel):
    id: int
    staff_id: int
    month: int
    year: int
    period_start: date
    period_end: date
    total_working_days: int
    present_days: float
    absent_days: float
    leave_days: float
    unpaid_leave_days: float
    half_days: float
    holidays: int
    total_hours: Optional[float]
    overtime_hours: float
    basic_salary: float
    calculated_salary: float
    total_allowances: float
    overtime_pay: float
    total_deductions: float
    leave_deductions: float
    net_salary: float
    allowances_breakdown: Optional[Dict[str, Any]]
    deductions_breakdown: Optional[Dict[str, Any]]
    status: str
    is_locked: bool
    salary_slip_url: Optional[str]
    processed_at: Optional[datetime]
    locked_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    staff: Optional[dict] = None

    class Config:
        from_attributes = True


def calculate_monthly_payroll(
    staff: Staff,
    month: int,
    year: int,
    attendance_records: List[Attendance],
    leave_records: List[Leave],
) -> Dict[str, Any]:
    """Calculate payroll for a staff member for a given month"""
    # Get month boundaries
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    
    # Calculate total working days (excluding Sundays, can be customized)
    total_days = monthrange(year, month)[1]
    # Count Sundays (assuming Sunday = 0)
    sundays = sum(1 for day in range(1, total_days + 1) if date(year, month, day).weekday() == 6)
    total_working_days = total_days - sundays
    
    # Process attendance
    present_count = 0
    absent_count = 0
    half_day_count = 0
    holiday_count = 0
    leave_count = 0
    unpaid_leave_count = 0
    total_hours = 0.0
    overtime_hours = 0.0
    
    for att in attendance_records:
        if att.status == "present":
            present_count += 1
        elif att.status == "absent":
            absent_count += 1
        elif att.status == "half_day":
            half_day_count += 1
            present_count += 0.5
        elif att.status == "holiday":
            holiday_count += 1
        elif att.status == "leave":
            leave_count += 1
        
        if att.total_hours:
            total_hours += att.total_hours
        if att.overtime_hours:
            overtime_hours += att.overtime_hours
    
    # Process leaves
    for leave in leave_records:
        if leave.status == "approved":
            if leave.leave_type == "unpaid":
                unpaid_leave_count += leave.total_days
            else:
                leave_count += leave.total_days
    
    # Calculate basic salary
    if staff.salary_type == "monthly":
        basic_salary = staff.fixed_salary or 0.0
        # Calculate salary based on present days
        calculated_salary = (basic_salary / total_working_days) * present_count
    else:  # hourly
        basic_salary = 0.0
        hourly_wage = staff.hourly_wage or 0.0
        calculated_salary = total_hours * hourly_wage
    
    # Calculate allowances
    allowances = staff.allowances or {}
    total_allowances = sum(
        allowances.get("hra", 0),
        allowances.get("travel", 0),
        allowances.get("food", 0),
        sum(allowances.get("custom", {}).values()) if isinstance(allowances.get("custom"), dict) else 0,
    )
    
    # Calculate overtime pay (assuming 1.5x for overtime)
    overtime_rate = 1.5
    if staff.salary_type == "monthly":
        hourly_rate = (staff.fixed_salary or 0.0) / (total_working_days * 8)  # Assuming 8 hours per day
    else:
        hourly_rate = staff.hourly_wage or 0.0
    overtime_pay = overtime_hours * hourly_rate * overtime_rate
    
    # Calculate deductions
    deductions = staff.deductions or {}
    total_deductions = sum(
        deductions.get("pf", 0),
        deductions.get("esi", 0),
        deductions.get("tds", 0),
        sum(deductions.get("custom", {}).values()) if isinstance(deductions.get("custom"), dict) else 0,
    )
    
    # Calculate leave deductions (for unpaid leaves)
    if staff.salary_type == "monthly":
        daily_rate = (staff.fixed_salary or 0.0) / total_working_days
        leave_deductions = unpaid_leave_count * daily_rate
    else:
        leave_deductions = 0.0  # For hourly, unpaid leave doesn't affect salary
    
    # Calculate net salary
    net_salary = calculated_salary + total_allowances + overtime_pay - total_deductions - leave_deductions
    
    return {
        "period_start": first_day,
        "period_end": last_day,
        "total_working_days": total_working_days,
        "present_days": present_count,
        "absent_days": absent_count,
        "leave_days": leave_count,
        "unpaid_leave_days": unpaid_leave_count,
        "half_days": half_day_count,
        "holidays": holiday_count,
        "total_hours": total_hours if staff.salary_type == "hourly" else None,
        "overtime_hours": overtime_hours,
        "basic_salary": basic_salary,
        "calculated_salary": calculated_salary,
        "total_allowances": total_allowances,
        "overtime_pay": overtime_pay,
        "total_deductions": total_deductions,
        "leave_deductions": leave_deductions,
        "net_salary": net_salary,
        "allowances_breakdown": allowances,
        "deductions_breakdown": deductions,
    }


@router.post("/calculate", response_model=PayrollOut)
async def calculate_payroll(
    staff_id: int,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Calculate payroll for a staff member for a given month"""
    # Verify staff exists
    result = await session.execute(
        select(Staff).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Check if payroll already exists
    existing = await session.execute(
        select(Payroll).where(
            Payroll.staff_id == staff_id,
            Payroll.month == month,
            Payroll.year == year,
        )
    )
    existing_payroll = existing.scalar_one_or_none()
    
    if existing_payroll and existing_payroll.is_locked:
        raise HTTPException(status_code=400, detail="Payroll for this month is locked and cannot be recalculated")
    
    # Get attendance records for the month
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    
    result = await session.execute(
        select(Attendance).where(
            Attendance.staff_id == staff_id,
            Attendance.attendance_date >= first_day,
            Attendance.attendance_date <= last_day,
        )
    )
    attendance_records = result.scalars().all()
    
    # Get leave records for the month
    result = await session.execute(
        select(Leave).where(
            Leave.staff_id == staff_id,
            Leave.status == "approved",
            or_(
                and_(Leave.start_date <= first_day, Leave.end_date >= first_day),
                and_(Leave.start_date <= last_day, Leave.end_date >= last_day),
                and_(Leave.start_date >= first_day, Leave.end_date <= last_day),
            ),
        )
    )
    leave_records = result.scalars().all()
    
    # Calculate payroll
    payroll_data = calculate_monthly_payroll(staff, month, year, attendance_records, leave_records)
    
    # Create or update payroll record
    if existing_payroll:
        for key, value in payroll_data.items():
            setattr(existing_payroll, key, value)
        existing_payroll.status = "draft"
        existing_payroll.updated_at = datetime.utcnow()
        payroll = existing_payroll
    else:
        payroll = Payroll(
            staff_id=staff_id,
            month=month,
            year=year,
            **payroll_data,
            status="draft",
        )
        session.add(payroll)
    
    await session.commit()
    await session.refresh(payroll)
    
    # Load staff info
    result = await session.execute(
        select(Payroll)
        .where(Payroll.id == payroll.id)
        .options(selectinload(Payroll.staff))
    )
    payroll = result.scalar_one()
    
    return payroll


@router.post("/process", response_model=PayrollOut)
async def process_payroll(
    staff_id: int,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Process payroll (calculate and generate salary slip)"""
    # Get or calculate payroll
    result = await session.execute(
        select(Payroll).where(
            Payroll.staff_id == staff_id,
            Payroll.month == month,
            Payroll.year == year,
        )
    )
    payroll = result.scalar_one_or_none()
    
    if not payroll:
        # Calculate first
        payroll = await calculate_payroll(staff_id, month, year, session, current_user)
    
    if payroll.is_locked:
        raise HTTPException(status_code=400, detail="Payroll is already locked")
    
    # Generate salary slip PDF
    salary_slip_url = await generate_salary_slip_pdf(payroll, session)
    
    # Update payroll
    payroll.status = "processed"
    payroll.salary_slip_url = salary_slip_url
    payroll.processed_by_user_id = current_user.id
    payroll.processed_at = datetime.utcnow()
    payroll.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(payroll)
    
    # Load staff info
    result = await session.execute(
        select(Payroll)
        .where(Payroll.id == payroll.id)
        .options(selectinload(Payroll.staff))
    )
    payroll = result.scalar_one()
    
    return payroll


@router.post("/lock", response_model=PayrollOut)
async def lock_payroll(
    staff_id: int,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Lock payroll after processing (prevents further changes)"""
    result = await session.execute(
        select(Payroll).where(
            Payroll.staff_id == staff_id,
            Payroll.month == month,
            Payroll.year == year,
        )
    )
    payroll = result.scalar_one_or_none()
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    if payroll.is_locked:
        raise HTTPException(status_code=400, detail="Payroll is already locked")
    
    if payroll.status != "processed":
        raise HTTPException(status_code=400, detail="Payroll must be processed before locking")
    
    payroll.is_locked = True
    payroll.status = "locked"
    payroll.locked_at = datetime.utcnow()
    payroll.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(payroll)
    
    # Load staff info
    result = await session.execute(
        select(Payroll)
        .where(Payroll.id == payroll.id)
        .options(selectinload(Payroll.staff))
    )
    payroll = result.scalar_one()
    
    return payroll


@router.get("", response_model=List[PayrollOut])
async def list_payroll(
    staff_id: Optional[int] = Query(None, description="Filter by staff ID"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month"),
    year: Optional[int] = Query(None, ge=2000, description="Filter by year"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """List payroll records"""
    stmt = select(Payroll)
    
    # Apply filters
    conditions = []
    if staff_id:
        conditions.append(Payroll.staff_id == staff_id)
    if month:
        conditions.append(Payroll.month == month)
    if year:
        conditions.append(Payroll.year == year)
    if status:
        conditions.append(Payroll.status == status)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.order_by(Payroll.year.desc(), Payroll.month.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt.options(selectinload(Payroll.staff)))
    payroll_list = result.scalars().all()
    
    return payroll_list


@router.get("/{payroll_id}", response_model=PayrollOut)
async def get_payroll(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get payroll details by ID"""
    result = await session.execute(
        select(Payroll)
        .where(Payroll.id == payroll_id)
        .options(selectinload(Payroll.staff))
    )
    payroll = result.scalar_one_or_none()
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    return payroll


@router.get("/{payroll_id}/salary-slip")
async def download_salary_slip(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Download salary slip PDF"""
    result = await session.execute(
        select(Payroll)
        .where(Payroll.id == payroll_id)
        .options(selectinload(Payroll.staff))
    )
    payroll = result.scalar_one_or_none()
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    if not payroll.salary_slip_url:
        raise HTTPException(status_code=404, detail="Salary slip not generated")
    
    # Read PDF file
    file_path = payroll.salary_slip_url.replace("/uploads/", settings.UPLOAD_DIR + "/")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Salary slip file not found")
    
    with open(file_path, "rb") as f:
        pdf_content = f.read()
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=salary_slip_{payroll.staff_id}_{payroll.year}_{payroll.month:02d}.pdf"
        }
    )


async def generate_salary_slip_pdf(payroll: Payroll, session: AsyncSession) -> str:
    """Generate salary slip PDF and return file URL"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        
        # Get staff details
        result = await session.execute(
            select(Staff).where(Staff.id == payroll.staff_id)
        )
        staff = result.scalar_one()
        
        # Create PDF buffer
        buffer = BytesIO()
        
        # Company details
        company_name = "LEBRQ"
        company_tagline = "REAL ESTATE GROUP"
        company_address = [
            "Third Floor City Complex, Karandakkad",
            "Kasaragod, Kerala - 671121",
        ]
        
        # Create PDF document
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Title style
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=12,
            alignment=TA_CENTER,
        )
        
        # Header style
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#666666'),
            alignment=TA_CENTER,
        )
        
        # Company header
        story.append(Paragraph(company_name, title_style))
        story.append(Paragraph(company_tagline, header_style))
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("<b>SALARY SLIP</b>", styles['Heading2']))
        story.append(Spacer(1, 0.3*inch))
        
        # Employee details
        emp_data = [
            ['Employee Code', staff.employee_code],
            ['Name', f"{staff.first_name} {staff.last_name}"],
            ['Department', staff.department],
            ['Designation', staff.role],
            ['Period', f"{payroll.period_start.strftime('%d-%b-%Y')} to {payroll.period_end.strftime('%d-%b-%Y')}"],
        ]
        
        emp_table = Table(emp_data, colWidths=[2*inch, 4*inch])
        emp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(emp_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Earnings
        earnings_data = [['Earnings', 'Amount (₹)']]
        earnings_data.append(['Basic Salary', f"{payroll.basic_salary:.2f}"])
        
        allowances = payroll.allowances_breakdown or {}
        if allowances.get("hra", 0) > 0:
            earnings_data.append(['HRA', f"{allowances.get('hra', 0):.2f}"])
        if allowances.get("travel", 0) > 0:
            earnings_data.append(['Travel Allowance', f"{allowances.get('travel', 0):.2f}"])
        if allowances.get("food", 0) > 0:
            earnings_data.append(['Food Allowance', f"{allowances.get('food', 0):.2f}"])
        if payroll.overtime_pay > 0:
            earnings_data.append(['Overtime Pay', f"{payroll.overtime_pay:.2f}"])
        
        # Custom allowances
        if isinstance(allowances.get("custom"), dict):
            for key, value in allowances["custom"].items():
                earnings_data.append([key.title(), f"{value:.2f}"])
        
        earnings_data.append(['<b>Total Earnings</b>', f"<b>{payroll.calculated_salary + payroll.total_allowances + payroll.overtime_pay:.2f}</b>"])
        
        earnings_table = Table(earnings_data, colWidths=[4*inch, 2*inch])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(Paragraph("<b>Earnings</b>", styles['Heading3']))
        story.append(earnings_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Deductions
        deductions_data = [['Deductions', 'Amount (₹)']]
        
        deductions = payroll.deductions_breakdown or {}
        if deductions.get("pf", 0) > 0:
            deductions_data.append(['Provident Fund (PF)', f"{deductions.get('pf', 0):.2f}"])
        if deductions.get("esi", 0) > 0:
            deductions_data.append(['ESI', f"{deductions.get('esi', 0):.2f}"])
        if deductions.get("tds", 0) > 0:
            deductions_data.append(['TDS', f"{deductions.get('tds', 0):.2f}"])
        if payroll.leave_deductions > 0:
            deductions_data.append(['Leave Deductions', f"{payroll.leave_deductions:.2f}"])
        
        # Custom deductions
        if isinstance(deductions.get("custom"), dict):
            for key, value in deductions["custom"].items():
                deductions_data.append([key.title(), f"{value:.2f}"])
        
        deductions_data.append(['<b>Total Deductions</b>', f"<b>{payroll.total_deductions + payroll.leave_deductions:.2f}</b>"])
        
        deductions_table = Table(deductions_data, colWidths=[4*inch, 2*inch])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(Paragraph("<b>Deductions</b>", styles['Heading3']))
        story.append(deductions_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Net Salary
        net_data = [
            ['<b>Net Salary</b>', f"<b>₹ {payroll.net_salary:.2f}</b>"],
        ]
        net_table = Table(net_data, colWidths=[4*inch, 2*inch])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Attendance summary
        summary_data = [
            ['Total Working Days', str(payroll.total_working_days)],
            ['Present Days', f"{payroll.present_days:.1f}"],
            ['Absent Days', f"{payroll.absent_days:.1f}"],
            ['Leave Days', f"{payroll.leave_days:.1f}"],
            ['Holidays', str(payroll.holidays)],
        ]
        if payroll.total_hours:
            summary_data.append(['Total Hours', f"{payroll.total_hours:.2f}"])
        if payroll.overtime_hours > 0:
            summary_data.append(['Overtime Hours', f"{payroll.overtime_hours:.2f}"])
        
        summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(Paragraph("<b>Attendance Summary</b>", styles['Heading3']))
        story.append(summary_table)
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("This is a computer-generated document and does not require a signature.", 
                              ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                                           textColor=colors.grey, alignment=TA_CENTER)))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Save PDF file
        upload_dir = Path(settings.UPLOAD_DIR) / "salary_slips" / str(payroll.staff_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"salary_slip_{payroll.staff_id}_{payroll.year}_{payroll.month:02d}.pdf"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(buffer.read())
        
        # Return file URL
        file_url = f"/uploads/salary_slips/{payroll.staff_id}/{filename}"
        return file_url
        
    except ImportError:
        raise HTTPException(status_code=500, detail='PDF generation requires reportlab. Install with: pip install reportlab')


@router.get("/summary/monthly")
async def get_monthly_payroll_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    department: Optional[str] = Query(None, description="Filter by department"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_or_hr_required),
):
    """Get monthly payroll summary"""
    stmt = select(Payroll).where(
        Payroll.month == month,
        Payroll.year == year,
    )
    
    if department:
        stmt = stmt.join(Staff).where(Staff.department == department)
    
    result = await session.execute(stmt.options(selectinload(Payroll.staff)))
    payroll_list = result.scalars().all()
    
    total_salary = sum(p.net_salary for p in payroll_list)
    total_employees = len(payroll_list)
    
    # Department-wise summary
    dept_summary = {}
    for payroll in payroll_list:
        dept = payroll.staff.department if payroll.staff else "Unknown"
        if dept not in dept_summary:
            dept_summary[dept] = {"count": 0, "total": 0.0}
        dept_summary[dept]["count"] += 1
        dept_summary[dept]["total"] += payroll.net_salary
    
    return {
        "month": month,
        "year": year,
        "total_employees": total_employees,
        "total_salary_expense": total_salary,
        "department_summary": dept_summary,
        "payrolls": [
            {
                "staff_id": p.staff_id,
                "staff_name": f"{p.staff.first_name} {p.staff.last_name}" if p.staff else "Unknown",
                "department": p.staff.department if p.staff else "Unknown",
                "net_salary": p.net_salary,
                "status": p.status,
            }
            for p in payroll_list
        ],
    }

