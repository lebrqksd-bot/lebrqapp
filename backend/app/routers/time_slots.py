from datetime import datetime, timedelta, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.db import get_session, AsyncSessionLocal
from app.models import Booking, Space
from pydantic import BaseModel

router = APIRouter(prefix="/time-slots", tags=["time-slots"])
async def _execute_with_retry(db: AsyncSession, stmt, max_retries: int = 2):
    """Execute a DB statement with small retry on transient connection errors.
    Handles async driver errors like 'handler is closed' / 'TCPTransport closed'.
    """
    attempt = 0
    last_err: Exception | None = None
    cur_db = db
    while attempt <= max_retries:
        try:
            return await cur_db.execute(stmt)
        except Exception as e:  # transient connection/transport errors
            msg = str(e).lower()
            transient = any(k in msg for k in [
                'handler is closed', 'tcptranport closed', 'tcptransport closed',
                'connection reset', 'connection aborted', 'server has gone away',
                'lost connection', 'read timeout', 'write timeout', 'timeout'
            ])
            if not transient or attempt == max_retries:
                last_err = e
                break
            attempt += 1
            # Try again with a fresh session
            async with AsyncSessionLocal() as new_db:
                cur_db = new_db
                continue
    raise last_err if last_err else RuntimeError("Database operation failed")

class TimeSlotRequest(BaseModel):
    space_id: int
    date: str  # YYYY-MM-DD format
    duration_hours: int = 1

class TimeSlotResponse(BaseModel):
    date: str
    available_slots: List[str]  # List of available time slots in HH:MM format
    space_id: int
    space_name: str

class TimeSlotValidationRequest(BaseModel):
    space_id: int
    start_datetime: str  # ISO format
    end_datetime: str    # ISO format

class TimeSlotValidationResponse(BaseModel):
    is_available: bool
    message: str
    conflicting_bookings: List[dict] = []

@router.get("/available/{space_id}")
async def get_available_time_slots(
    space_id: int,
    selected_date: str = Query(..., description="Date for which to get available slots (YYYY-MM-DD)"),
    duration_hours: int = Query(1, ge=1, le=12, description="Duration of the booking in hours"),
    debug: bool = Query(False, description="Include debug info about projected blocking windows"),
    exclude_booking_id: int = Query(None, description="Booking ID to exclude from conflict check (for edit mode)"),
    db: AsyncSession = Depends(get_session)
):
    """
    Get available time slots for a specific space on a given date.
    Returns slots in 1-hour intervals from 12:00 AM to 11:00 PM (full 24-hour period).
    """
    try:
        # Parse the date
        target_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
        
        # Get space information
        result = await _execute_with_retry(db, select(Space).where(Space.id == space_id))
        space = result.scalar_one_or_none()
        
        if not space:
            raise HTTPException(status_code=404, detail="Space not found")
        
        # Fetch bookings that overlap this date
        start_of_day = datetime.combine(target_date, time.min)
        end_of_day = datetime.combine(target_date, time.max)
        from sqlalchemy import func, or_
        
        # Build query conditions - check for bookings that overlap with the selected date
        query_conditions = [
            Booking.space_id == space_id,
            Booking.status.in_(['confirmed', 'completed', 'pending', 'approved']),
            # any overlap with the day's window (12 AM to 11:59 PM)
            and_(Booking.start_datetime <= end_of_day, Booking.end_datetime >= start_of_day),
        ]
        
        # Exclude current booking if in edit mode
        if exclude_booking_id:
            query_conditions.append(Booking.id != exclude_booking_id)
        
        result = await _execute_with_retry(db, select(Booking).where(and_(*query_conditions)))
        bookings = result.scalars().all()

        # Build projected blocking windows for this date (debug aid)
        projected_blocks = []
        for booking in bookings:
            b_start = booking.start_datetime
            b_end = booking.end_datetime
            p_start = b_start
            p_end = b_end
            # If spans multiple days, project its time-of-day window to the target_date
            if b_start.date() != b_end.date():
                window_start_time = b_start.time()
                window_end_time = b_end.time()
                start_ref = datetime.combine(b_start.date(), window_start_time)
                end_ref = datetime.combine(b_start.date(), window_end_time)
                daily_duration = end_ref - start_ref
                if daily_duration.total_seconds() <= 0:
                    daily_duration += timedelta(days=1)
                if daily_duration.total_seconds() < 24 * 3600:
                    p_start = datetime.combine(target_date, window_start_time)
                    p_end = p_start + daily_duration
            projected_blocks.append({
                "id": booking.id,
                "orig_start": b_start.isoformat(),
                "orig_end": b_end.isoformat(),
                "projected_start": p_start.isoformat(),
                "projected_end": p_end.isoformat(),
            })
        
        # Generate all possible time slots (1-hour intervals from 12 AM to 11 PM - full 24 hours)
        all_slots = []
        
        # Generate slots for the full day (12 AM to 11 PM)
        for hour in range(0, 24):
            all_slots.append(f"{hour:02d}:00")
        
        # Check which slots are available
        available_slots = []
        
        for slot_time in all_slots:
            # Parse the hour from slot_time (e.g., "00:00" -> 0, "23:00" -> 23)
            slot_hour = int(slot_time.split(':')[0])
            
            # All slots are on the current day (12:00 AM to 11:00 PM)
            slot_datetime = datetime.combine(target_date, datetime.strptime(slot_time, "%H:%M").time())
            
            slot_end_datetime = slot_datetime + timedelta(hours=duration_hours)
            
            # Check if this slot conflicts with any existing booking
            is_available = True
            for booking in bookings:
                # For daily series spanning multiple days, project its daily window onto target_date
                b_start = booking.start_datetime
                b_end = booking.end_datetime
                # If a booking spans multiple dates, project its time-of-day window onto the selected date.
                if b_start.date() != b_end.date():
                    window_start_time = b_start.time()
                    window_end_time = b_end.time()
                    # Compute daily window duration using only time-of-day
                    start_ref = datetime.combine(b_start.date(), window_start_time)
                    end_ref = datetime.combine(b_start.date(), window_end_time)
                    daily_duration = end_ref - start_ref
                    if daily_duration.total_seconds() <= 0:
                        # Handles overnight windows
                        daily_duration += timedelta(days=1)
                    # Heuristic: if daily window is less than a full day, project; otherwise keep as-is
                    if daily_duration.total_seconds() < 24 * 3600:
                        b_start = datetime.combine(target_date, window_start_time)
                        b_end = b_start + daily_duration
                # Check for overlap
                if slot_datetime < b_end and slot_end_datetime > b_start:
                    is_available = False
                    break
            
            if is_available:
                # Convert to 12-hour format with AM/PM
                time_obj = datetime.strptime(slot_time, "%H:%M").time()
                formatted_time = time_obj.strftime("%I:%M %p").lstrip('0')
                available_slots.append(formatted_time)
        
        if debug:
            return {
                "date": selected_date,
                "available_slots": available_slots,
                "space_id": space_id,
                "space_name": space.name,
                "projected_blocks": projected_blocks
            }
        else:
            return TimeSlotResponse(
                date=selected_date,
                available_slots=available_slots,
                space_id=space_id,
                space_name=space.name
            )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        msg = str(e)
        if any(t in msg.lower() for t in ['handler is closed', 'tcptransport closed', 'lost connection', 'timeout']):
            # Signal transient failure; client may retry
            raise HTTPException(status_code=503, detail="Temporary database connection issue. Please retry.")
        raise HTTPException(status_code=500, detail=f"Internal server error: {msg}")

@router.post("/validate")
async def validate_time_slot(
    request: TimeSlotValidationRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Validate if a specific time slot is available for booking.
    """
    try:
        # Parse the datetime strings
        start_datetime = datetime.fromisoformat(request.start_datetime.replace('Z', '+00:00'))
        end_datetime = datetime.fromisoformat(request.end_datetime.replace('Z', '+00:00'))
        
        # Get conflicting bookings - only check same date unless booking type is daily
        from sqlalchemy import func
        
        # Extract date from start_datetime for comparison
        start_date = start_datetime.date()
        
        # Build conflict check conditions
        conflict_conditions = [
            Booking.space_id == request.space_id,
            Booking.status.in_(['confirmed', 'completed', 'pending']),
            or_(
                # New booking starts during existing booking
                and_(
                    start_datetime >= Booking.start_datetime,
                    start_datetime < Booking.end_datetime
                ),
                # New booking ends during existing booking
                and_(
                    end_datetime > Booking.start_datetime,
                    end_datetime <= Booking.end_datetime
                ),
                # New booking completely contains existing booking
                and_(
                    start_datetime <= Booking.start_datetime,
                    end_datetime >= Booking.end_datetime
                ),
                # Existing booking completely contains new booking
                and_(
                    start_datetime >= Booking.start_datetime,
                    end_datetime <= Booking.end_datetime
                )
            )
        ]
        
        # For now, assume one_day booking type (default behavior)
        # Only check conflicts on the same date
        conflict_conditions.append(
            func.date(Booking.start_datetime) == start_date
        )
        
        result = await db.execute(
            select(Booking).where(and_(*conflict_conditions))
        )
        conflicting_bookings = result.scalars().all()
        
        is_available = len(conflicting_bookings) == 0
        
        conflicting_data = []
        for booking in conflicting_bookings:
            conflicting_data.append({
                "id": booking.id,
                "start_datetime": booking.start_datetime.isoformat(),
                "end_datetime": booking.end_datetime.isoformat(),
                "status": booking.status
            })
        
        return TimeSlotValidationResponse(
            is_available=is_available,
            message="Slot is available" if is_available else f"Slot conflicts with {len(conflicting_bookings)} existing booking(s)",
            conflicting_bookings=conflicting_data
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/calendar/{space_id}")
async def get_calendar_availability(
    space_id: int,
    start_date: str,  # YYYY-MM-DD format
    end_date: str,    # YYYY-MM-DD format
    db: AsyncSession = Depends(get_session)
):
    """
    Get calendar availability for a space over a date range.
    Returns dates with their availability status.
    """
    try:
        start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        # Get space information
        result = await db.execute(
            select(Space).where(Space.id == space_id)
        )
        space = result.scalar_one_or_none()
        
        if not space:
            raise HTTPException(status_code=404, detail="Space not found")
        
        # Get all bookings in the date range
        start_datetime = datetime.combine(start_date_obj, time.min)
        end_datetime = datetime.combine(end_date_obj, time.max)
        
        result = await db.execute(
            select(Booking).where(
                and_(
                    Booking.space_id == space_id,
                    Booking.start_datetime >= start_datetime,
                    Booking.start_datetime <= end_datetime,
                    Booking.status.in_(['confirmed', 'completed', 'pending', 'approved'])
                )
            )
        )
        bookings = result.scalars().all()
        
        # Group bookings by date
        bookings_by_date = {}
        for booking in bookings:
            booking_date = booking.start_datetime.date()
            if booking_date not in bookings_by_date:
                bookings_by_date[booking_date] = []
            bookings_by_date[booking_date].append(booking)
        
        # Generate calendar data
        calendar_data = []
        current_date = start_date_obj
        
        while current_date <= end_date_obj:
            date_str = current_date.strftime("%Y-%m-%d")
            
            if current_date in bookings_by_date:
                # Calculate availability percentage
                total_minutes = 24 * 60  # 8 AM to 7 AM next day = 24 hours
                booked_minutes = 0
                
                for booking in bookings_by_date[current_date]:
                    booking_duration = (booking.end_datetime - booking.start_datetime).total_seconds() / 60
                    booked_minutes += booking_duration
                
                availability_percentage = max(0, (total_minutes - booked_minutes) / total_minutes * 100)
                
                calendar_data.append({
                    "date": date_str,
                    "available": availability_percentage > 20,  # Available if less than 80% booked
                    "availability_percentage": round(availability_percentage, 1),
                    "bookings_count": len(bookings_by_date[current_date])
                })
            else:
                calendar_data.append({
                    "date": date_str,
                    "available": True,
                    "availability_percentage": 100.0,
                    "bookings_count": 0
                })
            
            current_date += timedelta(days=1)
        
        return {
            "space_id": space_id,
            "space_name": space.name,
            "start_date": start_date,
            "end_date": end_date,
            "calendar": calendar_data
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
