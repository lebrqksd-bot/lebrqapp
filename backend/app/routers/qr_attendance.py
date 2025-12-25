"""
QR Code Attendance System API
Single QR scanner for all employees with OTP verification and location check
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, timedelta
import secrets
import math

from ..auth import get_current_user
from ..db import get_session
from ..models import User, Staff, Attendance, Office, AttendanceOTP
from ..services.otp_service import send_sms_otp_async

# Public router for staff attendance (no auth required)
# Using different prefix to avoid conflict with authenticated attendance router
router = APIRouter(prefix="/hr/attendance/qr", tags=["hr-attendance-qr"])


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates using Haversine formula
    Returns distance in meters
    """
    R = 6371000  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def generate_otp(length: int = 6) -> str:
    """Generate random OTP"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(length)])


def get_client_ip(request: Request) -> str:
    """Get client IP address"""
    if request.client:
        return request.client.host
    return "unknown"


def get_device_type(request: Request) -> str:
    """Detect device type from user agent"""
    user_agent = request.headers.get("user-agent", "").lower()
    if "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent:
        return "mobile"
    elif "tablet" in user_agent or "ipad" in user_agent:
        return "tablet"
    return "web"


# Pydantic Models
class OfficeInfoResponse(BaseModel):
    office_id: int
    office_name: str
    latitude: float
    longitude: float
    allowed_radius: float
    staff_list: List[dict]


class SendOTPRequest(BaseModel):
    staff_id: int


class SendOTPResponse(BaseModel):
    success: bool
    message: str
    otp_expires_in: int  # seconds


class VerifyOTPRequest(BaseModel):
    staff_id: int
    otp: str
    staff_latitude: float = Field(..., description="Staff's current GPS latitude")
    staff_longitude: float = Field(..., description="Staff's current GPS longitude")
    office_id: int


class VerifyOTPResponse(BaseModel):
    success: bool
    message: str
    attendance_type: str  # check_in|check_out|already_completed
    attendance_data: Optional[dict] = None


@router.get("/scan-office-info", response_model=OfficeInfoResponse, dependencies=[])
async def scan_office_info(
    qr_id: str = Query(..., description="QR code identifier"),
    session: AsyncSession = Depends(get_session),
):
    """
    Step 1: Scan QR code and get office info + staff list (PUBLIC ENDPOINT - No auth required)
    QR code contains: office_id (qr_id)
    """
    # Find office by QR ID
    result = await session.execute(
        select(Office).where(Office.qr_id == qr_id, Office.is_active == True)
    )
    office = result.scalar_one_or_none()
    
    if not office:
        raise HTTPException(status_code=404, detail="Invalid QR code or office not found")
    
    # Get all active staff
    staff_result = await session.execute(
        select(Staff).where(Staff.is_active == True).order_by(Staff.first_name, Staff.last_name)
    )
    staff_list = staff_result.scalars().all()
    
    return {
        "office_id": office.id,
        "office_name": office.name,
        "latitude": office.latitude,
        "longitude": office.longitude,
        "allowed_radius": office.allowed_radius,
        "staff_list": [
            {
                "id": s.id,
                "employee_code": s.employee_code,
                "name": f"{s.first_name} {s.last_name}",
                "phone": s.phone,
                "department": s.department,
                "role": s.role,
            }
            for s in staff_list
        ],
    }


@router.post("/send-otp", response_model=SendOTPResponse, dependencies=[])
async def send_attendance_otp(
    data: SendOTPRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Step 3: Send OTP to selected staff member
    OTP valid for 2 minutes
    """
    # Check if staff exists and is active
    result = await session.execute(
        select(Staff).where(Staff.id == data.staff_id, Staff.is_active == True)
    )
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found or inactive")
    
    # Check if staff is blocked due to wrong attempts
    recent_otp_result = await session.execute(
        select(AttendanceOTP)
        .where(
            AttendanceOTP.staff_id == data.staff_id,
            AttendanceOTP.blocked_until.isnot(None),
            AttendanceOTP.blocked_until > datetime.utcnow(),
        )
        .order_by(AttendanceOTP.created_at.desc())
        .limit(1)
    )
    blocked_otp = recent_otp_result.scalar_one_or_none()
    
    if blocked_otp:
        remaining_seconds = int((blocked_otp.blocked_until - datetime.utcnow()).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Too many wrong attempts. Please try again after {remaining_seconds} seconds."
        )
    
    # Invalidate any existing valid OTPs for this staff
    await session.execute(
        select(AttendanceOTP)
        .where(
            AttendanceOTP.staff_id == data.staff_id,
            AttendanceOTP.status == "valid",
            AttendanceOTP.expires_at > datetime.utcnow(),
        )
    )
    existing_otps = await session.execute(
        select(AttendanceOTP)
        .where(
            AttendanceOTP.staff_id == data.staff_id,
            AttendanceOTP.status == "valid",
            AttendanceOTP.expires_at > datetime.utcnow(),
        )
    )
    for otp_record in existing_otps.scalars().all():
        otp_record.status = "expired"
    
    # Generate new OTP
    otp = generate_otp(6)
    expires_at = datetime.utcnow() + timedelta(minutes=5)  # 5 minutes expiry (same as existing OTP service)
    
    otp_record = AttendanceOTP(
        staff_id=data.staff_id,
        otp=otp,
        status="valid",
        expires_at=expires_at,
    )
    
    session.add(otp_record)
    await session.commit()
    
    # Send OTP via SMS using existing OTP service
    # Prepare OTP message - using the exact template format from otp_service
    template_id = "1607100000000128308"
    otp_message = f"{otp} is your SECRET One Time Password (OTP) for your LeBRQ Attendance. Please use this password to complete your transaction. From:BRQ GLOB TECH"
    
    # Send SMS using async service (no need for thread pool - it's already async)
    import asyncio
    
    try:
        success, gateway_response = await asyncio.wait_for(
            send_sms_otp_async(staff.phone, otp_message, template_id),
            timeout=12.0  # 12 second timeout for SMS sending (includes retries)
        )
        
        if success:
            print(f"[Attendance OTP] ✓ OTP sent to {staff.phone} for staff {staff.first_name} {staff.last_name}")
            return {
                "success": True,
                "message": f"OTP sent to {staff.phone}",
                "otp_expires_in": 300,  # 5 minutes
            }
        else:
            # SMS failed, but OTP is still stored in DB
            print(f"[Attendance OTP] ✗ Failed to send SMS to {staff.phone}: {gateway_response}")
            # Still return success but with a warning - OTP is in DB and can be verified
            return {
                "success": True,
                "message": f"OTP generated. SMS sending failed: {gateway_response}. Please contact admin.",
                "otp_expires_in": 300,  # 5 minutes
                "warning": "SMS delivery failed, but OTP is valid"
            }
    except asyncio.TimeoutError:
        print(f"[Attendance OTP] ✗ SMS sending timed out for {staff.phone}")
        # Still return success - OTP is in DB
        return {
            "success": True,
            "message": f"OTP generated. SMS sending timed out. Please contact admin.",
            "otp_expires_in": 300,  # 5 minutes
            "warning": "SMS delivery timed out, but OTP is valid"
        }
    except Exception as e:
        print(f"[Attendance OTP] ✗ Error sending SMS to {staff.phone}: {e}")
        # Still return success - OTP is in DB
        return {
            "success": True,
            "message": f"OTP generated. SMS sending error: {str(e)}. Please contact admin.",
            "otp_expires_in": 300,  # 5 minutes
            "warning": "SMS delivery error, but OTP is valid"
        }


@router.post("/verify-otp", response_model=VerifyOTPResponse, dependencies=[])
async def verify_otp_and_mark_attendance(
    data: VerifyOTPRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """
    Step 4-6: Verify OTP, check location, and mark attendance
    """
    try:
        print(f"[Attendance] ===== OTP Verification Request =====")
        print(f"[Attendance] Staff ID: {data.staff_id}")
        print(f"[Attendance] Office ID: {data.office_id}")
        print(f"[Attendance] Staff Location: ({data.staff_latitude}, {data.staff_longitude})")
        
        # Get office
        office_result = await session.execute(
            select(Office).where(Office.id == data.office_id, Office.is_active == True)
        )
        office = office_result.scalar_one_or_none()
        
        if not office:
            error_msg = "Office not found"
            print(f"[Attendance] ❌ {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)
        
        # Get staff
        staff_result = await session.execute(
            select(Staff).where(Staff.id == data.staff_id, Staff.is_active == True)
        )
        staff = staff_result.scalar_one_or_none()
        
        if not staff:
            error_msg = "Staff not found"
            print(f"[Attendance] ❌ {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)
        
        print(f"[Attendance] Staff: {staff.first_name} {staff.last_name} ({staff.employee_code})")
        
        # Verify OTP - get the most recent valid OTP matching the provided OTP
        otp_result = await session.execute(
            select(AttendanceOTP)
            .where(
                AttendanceOTP.staff_id == data.staff_id,
                AttendanceOTP.otp == data.otp,
                AttendanceOTP.status == "valid",
            )
            .order_by(AttendanceOTP.created_at.desc())
            .limit(1)
        )
        otp_record = otp_result.scalar_one_or_none()
        
        if not otp_record:
            error_msg = "Invalid OTP"
            print(f"[Attendance] ❌ {error_msg} for staff {data.staff_id}")
            # Increment wrong attempts - get the most recent OTP for this staff
            recent_otp_result = await session.execute(
                select(AttendanceOTP)
                .where(AttendanceOTP.staff_id == data.staff_id)
                .order_by(AttendanceOTP.created_at.desc())
                .limit(1)
            )
            recent_otp = recent_otp_result.scalar_one_or_none()
            
            if recent_otp:
                recent_otp.wrong_attempts += 1
                print(f"[Attendance] Wrong attempts: {recent_otp.wrong_attempts}")
                if recent_otp.wrong_attempts >= 3:
                    recent_otp.blocked_until = datetime.utcnow() + timedelta(minutes=10)
                    print(f"[Attendance] ⚠️ Staff blocked for 10 minutes due to too many wrong attempts")
                await session.commit()
            
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"[Attendance] ✅ OTP found: {data.otp}")
        
        # Check if OTP expired (with 10 second buffer to account for clock differences)
        current_time = datetime.utcnow()
        expiry_time = otp_record.expires_at
        # Add small buffer to account for clock differences between server and database
        if expiry_time < (current_time - timedelta(seconds=10)):
            otp_record.status = "expired"
            await session.commit()
            # Calculate remaining time for better error message
            remaining_seconds = int((expiry_time - current_time).total_seconds())
            error_msg = f"OTP has expired. Please request a new OTP. (Expired {abs(remaining_seconds)} seconds ago)"
            print(f"[Attendance] ❌ {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Check if OTP already used
        if otp_record.status == "used":
            error_msg = "OTP already used"
            print(f"[Attendance] ❌ {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"[Attendance] ✅ OTP is valid and not expired")
        
        # Step 5: Location Verification
        distance = calculate_distance(
            data.staff_latitude,
            data.staff_longitude,
            office.latitude,
            office.longitude,
        )
        
        # Log location details for debugging
        print(f"[Attendance] Location Check:")
        print(f"  Office: {office.name} ({office.latitude}, {office.longitude})")
        print(f"  Staff Location: ({data.staff_latitude}, {data.staff_longitude})")
        print(f"  Distance: {distance:.2f}m")
        print(f"  Allowed Radius: {office.allowed_radius:.0f}m")
        print(f"  Status: {'✅ Within range' if distance <= office.allowed_radius else '❌ Out of range'}")
        
        if distance > office.allowed_radius:
            error_msg = f"You are not at the office location. Distance: {distance:.0f}m (required: {office.allowed_radius:.0f}m)"
            print(f"[Attendance] ❌ Location verification failed: {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        print(f"[Attendance] ✅ Location verified successfully")
        
        # Step 6: Mark Attendance
        today = date.today()
        
        # Check existing attendance for today
        attendance_result = await session.execute(
            select(Attendance)
            .where(
                Attendance.staff_id == data.staff_id,
                Attendance.attendance_date == today,
            )
            .limit(1)
        )
        attendance = attendance_result.scalar_one_or_none()
        
        device_type = get_device_type(request)
        ip_address = get_client_ip(request)
        current_time = datetime.utcnow()
        
        if not attendance:
            # First attendance of the day - Check-In
            attendance = Attendance(
                staff_id=data.staff_id,
                attendance_date=today,
                check_in_time=current_time,
                check_in_latitude=data.staff_latitude,
                check_in_longitude=data.staff_longitude,
                check_in_device_type=device_type,
                check_in_ip_address=ip_address,
                status="present",
            )
            session.add(attendance)
            attendance_type = "check_in"
            
        elif attendance.check_in_time and not attendance.check_out_time:
            # Already checked in - Check-Out
            attendance.check_out_time = current_time
            attendance.check_out_latitude = data.staff_latitude
            attendance.check_out_longitude = data.staff_longitude
            attendance.check_out_device_type = device_type
            attendance.check_out_ip_address = ip_address
            
            # Calculate total hours
            if attendance.check_in_time:
                delta = current_time - attendance.check_in_time
                attendance.total_hours = round(delta.total_seconds() / 3600, 2)
            
            attendance_type = "check_out"
            
        else:
            # Already completed
            await session.commit()
            return {
                "success": False,
                "message": "Attendance already completed for today",
                "attendance_type": "already_completed",
                "attendance_data": {
                    "check_in_time": attendance.check_in_time.isoformat() if attendance.check_in_time else None,
                    "check_out_time": attendance.check_out_time.isoformat() if attendance.check_out_time else None,
                    "total_hours": attendance.total_hours,
                },
            }
        
        # Mark OTP as used
        otp_record.status = "used"
        otp_record.used_at = current_time
        
        await session.commit()
        await session.refresh(attendance)
        
        # Log attendance creation/update
        print(f"[Attendance] ✅ Attendance saved successfully!")
        print(f"  Attendance ID: {attendance.id}")
        print(f"  Staff ID: {attendance.staff_id}")
        print(f"  Date: {attendance.attendance_date}")
        print(f"  Type: {attendance_type}")
        print(f"  Check-in: {attendance.check_in_time}")
        print(f"  Check-out: {attendance.check_out_time}")
        print(f"  Status: {attendance.status}")
        print(f"  Total Hours: {attendance.total_hours}")
        
        return {
            "success": True,
            "message": f"Attendance marked successfully ({attendance_type.replace('_', ' ').title()})",
            "attendance_type": attendance_type,
            "attendance_data": {
                "id": attendance.id,
                "check_in_time": attendance.check_in_time.isoformat() if attendance.check_in_time else None,
                "check_out_time": attendance.check_out_time.isoformat() if attendance.check_out_time else None,
                "total_hours": attendance.total_hours,
                "date": attendance.attendance_date.isoformat(),
            },
        }
    except HTTPException:
        # Re-raise HTTP exceptions (they already have proper status codes)
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Attendance] ❌ Unexpected error in verify_otp_and_mark_attendance:")
        print(f"[Attendance] Error: {str(e)}")
        print(f"[Attendance] Traceback:\n{error_trace}")
        
        # Return a proper error response
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/today", dependencies=[])
async def get_today_attendance(
    staff_id: int = Query(..., description="Staff ID"),
    session: AsyncSession = Depends(get_session),
):
    """Get today's attendance for a staff member"""
    today = date.today()
    
    result = await session.execute(
        select(Attendance)
        .where(
            Attendance.staff_id == staff_id,
            Attendance.attendance_date == today,
        )
        .options(selectinload(Attendance.staff))
        .limit(1)
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance:
        return {
            "has_attendance": False,
            "attendance": None,
        }
    
    return {
        "has_attendance": True,
        "attendance": {
            "id": attendance.id,
            "check_in_time": attendance.check_in_time.isoformat() if attendance.check_in_time else None,
            "check_out_time": attendance.check_out_time.isoformat() if attendance.check_out_time else None,
            "total_hours": attendance.total_hours,
            "status": attendance.status,
            "check_in_location": {
                "latitude": attendance.check_in_latitude,
                "longitude": attendance.check_in_longitude,
            } if attendance.check_in_latitude else None,
            "check_out_location": {
                "latitude": attendance.check_out_latitude,
                "longitude": attendance.check_out_longitude,
            } if attendance.check_out_latitude else None,
        },
    }

