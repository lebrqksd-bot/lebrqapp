"""
Event Schedules Router
Manages specific event occurrences/instances.
"""
from datetime import datetime, date, time, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from ..db import get_session
from ..models_events import EventDefinition, EventSchedule
from ..models import User, ProgramParticipant, Booking
from ..auth import get_current_user

# Admin required dependency
def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user

router = APIRouter()


# ========================================
# Pydantic Schemas
# ========================================

class ScheduleCreateRequest(BaseModel):
    """Schema for creating a single schedule."""
    event_definition_id: int
    schedule_date: str = Field(..., description="YYYY-MM-DD format")
    start_time: Optional[str] = Field(None, description="HH:MM:SS format (optional, uses definition default)")
    end_time: Optional[str] = Field(None, description="HH:MM:SS format (optional, uses definition default)")
    max_tickets: Optional[int] = Field(None, description="Override max tickets")
    ticket_price: Optional[float] = Field(None, description="Override ticket price")
    admin_note: Optional[str] = None


class ScheduleUpdateRequest(BaseModel):
    """Schema for updating a schedule."""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    max_tickets: Optional[int] = None
    ticket_price: Optional[float] = None
    status: Optional[str] = None
    is_blocked: Optional[bool] = None
    admin_note: Optional[str] = None


class ScheduleResponse(BaseModel):
    """Schema for schedule response."""
    id: int
    event_definition_id: int
    event_code: str
    event_title: str
    event_category: str
    event_type: str
    booking_id: Optional[int]
    schedule_date: str
    start_time: str
    end_time: str
    max_tickets: int
    tickets_sold: int
    tickets_available: int
    ticket_price: Optional[float]
    effective_price: float
    status: str
    is_blocked: bool
    admin_note: Optional[str]
    banner_image_url: Optional[str]
    poster_url: Optional[str]
    created_at: datetime


class TicketAvailabilityResponse(BaseModel):
    """Schema for ticket availability check."""
    is_available: bool
    available_tickets: int
    message: str
    schedule_id: int
    event_title: str
    schedule_date: str
    start_time: str


class ParticipantSummary(BaseModel):
    """Schema for participant summary."""
    participant_id: int
    user_id: Optional[int]
    name: str
    mobile: str
    ticket_quantity: int
    amount_paid: Optional[float]
    is_verified: bool
    scan_count: Optional[int]
    joined_at: datetime
    booking_id: Optional[int]
    booking_reference: Optional[str]


# ========================================
# Helper Functions
# ========================================

def parse_time(time_str: Optional[str]) -> Optional[time]:
    """Parse HH:MM:SS or HH:MM string to time object."""
    if not time_str:
        return None
    try:
        parts = time_str.split(':')
        if len(parts) == 2:
            return time(int(parts[0]), int(parts[1]))
        elif len(parts) == 3:
            return time(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}")
    return None


def time_to_str(t: Optional[time]) -> Optional[str]:
    """Convert time object to HH:MM:SS string."""
    if t is None:
        return None
    return t.strftime("%H:%M:%S")


def schedule_to_response(schedule: EventSchedule, definition: EventDefinition) -> ScheduleResponse:
    """Convert schedule and definition to response schema."""
    effective_price = float(schedule.ticket_price) if schedule.ticket_price is not None else float(definition.default_ticket_price)
    
    return ScheduleResponse(
        id=schedule.id,
        event_definition_id=definition.id,
        event_code=definition.event_code,
        event_title=definition.title,
        event_category=definition.event_category,
        event_type=definition.event_type,
        booking_id=schedule.booking_id,
        schedule_date=schedule.schedule_date.isoformat(),
        start_time=time_to_str(schedule.start_time),
        end_time=time_to_str(schedule.end_time),
        max_tickets=schedule.max_tickets,
        tickets_sold=schedule.tickets_sold,
        tickets_available=schedule.max_tickets - schedule.tickets_sold,
        ticket_price=float(schedule.ticket_price) if schedule.ticket_price is not None else None,
        effective_price=effective_price,
        status=schedule.status,
        is_blocked=schedule.is_blocked,
        admin_note=schedule.admin_note,
        banner_image_url=definition.banner_image_url,
        poster_url=definition.poster_url,
        created_at=schedule.created_at,
    )


# ========================================
# Schedule Listing & Search
# ========================================

@router.get("/", response_model=List[ScheduleResponse])
async def list_schedules(
    event_code: Optional[str] = Query(None, description="Filter by event code"),
    event_type: Optional[str] = Query(None, description="Filter by event type (yoga, zumba, etc.)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Filter by status"),
    available_only: bool = Query(False, description="Only schedules with available tickets"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List event schedules with optional filters.
    
    Public endpoint for browsing available events.
    """
    query = (
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventDefinition.is_active == True)
    )
    
    # Apply filters
    if event_code:
        query = query.where(EventDefinition.event_code == event_code)
    if event_type:
        query = query.where(EventDefinition.event_type == event_type)
    if category:
        query = query.where(EventDefinition.event_category == category)
    if status:
        query = query.where(EventSchedule.status == status)
    else:
        query = query.where(EventSchedule.status == 'scheduled')  # Default to scheduled only
    
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
            query = query.where(EventSchedule.schedule_date >= from_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")
    
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.where(EventSchedule.schedule_date <= to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")
    
    if available_only:
        query = query.where(EventSchedule.tickets_sold < EventSchedule.max_tickets)
        query = query.where(EventSchedule.is_blocked == False)
    
    query = query.order_by(EventSchedule.schedule_date, EventSchedule.start_time)
    query = query.limit(limit).offset(offset)
    
    result = await session.execute(query)
    rows = result.all()
    
    return [schedule_to_response(schedule, definition) for schedule, definition in rows]


@router.get("/upcoming")
async def get_upcoming_schedules(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look ahead"),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get upcoming schedules for the next N days.
    
    Useful for frontend home pages showing upcoming events.
    """
    today = date.today()
    end_date = today + timedelta(days=days)
    
    query = (
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventDefinition.is_active == True)
        .where(EventSchedule.status == 'scheduled')
        .where(EventSchedule.is_blocked == False)
        .where(EventSchedule.schedule_date >= today)
        .where(EventSchedule.schedule_date <= end_date)
        .where(EventSchedule.tickets_sold < EventSchedule.max_tickets)
    )
    
    if event_type:
        query = query.where(EventDefinition.event_type == event_type)
    
    query = query.order_by(EventSchedule.schedule_date, EventSchedule.start_time)
    query = query.limit(limit)
    
    result = await session.execute(query)
    rows = result.all()
    
    return {
        "schedules": [schedule_to_response(schedule, definition) for schedule, definition in rows],
        "count": len(rows),
        "date_range": {
            "from": today.isoformat(),
            "to": end_date.isoformat(),
        }
    }


@router.get("/today")
async def get_today_schedules(
    event_type: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Get all schedules for today."""
    today = date.today()
    
    query = (
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventDefinition.is_active == True)
        .where(EventSchedule.schedule_date == today)
    )
    
    if event_type:
        query = query.where(EventDefinition.event_type == event_type)
    
    query = query.order_by(EventSchedule.start_time)
    
    result = await session.execute(query)
    rows = result.all()
    
    return {
        "date": today.isoformat(),
        "schedules": [schedule_to_response(schedule, definition) for schedule, definition in rows],
        "count": len(rows),
    }


# ========================================
# Single Schedule Operations
# ========================================

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single schedule by ID."""
    result = await session.execute(
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.id == schedule_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule, definition = row
    return schedule_to_response(schedule, definition)


@router.post("/")
async def create_schedule(
    data: ScheduleCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Create a single schedule (admin only).
    
    Useful for one-time events or manual schedule additions.
    """
    # Get event definition
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == data.event_definition_id)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    # Parse date
    try:
        schedule_date = datetime.strptime(data.schedule_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Use definition defaults if not provided
    start_time = parse_time(data.start_time) if data.start_time else definition.default_start_time
    end_time = parse_time(data.end_time) if data.end_time else definition.default_end_time
    max_tickets = data.max_tickets if data.max_tickets is not None else definition.max_tickets
    
    if not start_time or not end_time:
        raise HTTPException(status_code=400, detail="Start and end time required")
    
    # Check for existing schedule at same time
    existing = await session.execute(
        select(EventSchedule).where(
            and_(
                EventSchedule.event_definition_id == definition.id,
                EventSchedule.schedule_date == schedule_date,
                EventSchedule.start_time == start_time,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Schedule already exists for this date/time")
    
    schedule = EventSchedule(
        event_definition_id=definition.id,
        schedule_date=schedule_date,
        start_time=start_time,
        end_time=end_time,
        max_tickets=max_tickets,
        ticket_price=data.ticket_price,
        admin_note=data.admin_note,
        status='scheduled',
    )
    
    session.add(schedule)
    await session.commit()
    await session.refresh(schedule)
    
    return schedule_to_response(schedule, definition)


@router.patch("/{schedule_id}")
async def update_schedule(
    schedule_id: int,
    data: ScheduleUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Update a schedule (admin only)."""
    result = await session.execute(
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.id == schedule_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule, definition = row
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in ('start_time', 'end_time'):
            value = parse_time(value) if value else None
        setattr(schedule, field, value)
    
    await session.commit()
    await session.refresh(schedule)
    
    return schedule_to_response(schedule, definition)


@router.delete("/{schedule_id}")
async def cancel_schedule(
    schedule_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Cancel a schedule (admin only).
    
    Sets status to 'cancelled' rather than deleting.
    """
    result = await session.execute(
        select(EventSchedule).where(EventSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if schedule.tickets_sold > 0:
        return {
            "success": False,
            "message": f"Cannot cancel: {schedule.tickets_sold} tickets already sold",
            "tickets_sold": schedule.tickets_sold,
        }
    
    schedule.status = 'cancelled'
    await session.commit()
    
    return {"success": True, "message": "Schedule cancelled"}


# ========================================
# Ticket Availability
# ========================================

@router.get("/{schedule_id}/availability", response_model=TicketAvailabilityResponse)
async def check_availability(
    schedule_id: int,
    quantity: int = Query(1, ge=1, le=50, description="Number of tickets needed"),
    session: AsyncSession = Depends(get_session),
):
    """Check ticket availability for a schedule.
    
    Public endpoint for frontend to check before booking.
    """
    result = await session.execute(
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.id == schedule_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule, definition = row
    
    available = schedule.max_tickets - schedule.tickets_sold
    
    if schedule.status != 'scheduled':
        return TicketAvailabilityResponse(
            is_available=False,
            available_tickets=0,
            message=f"Event is {schedule.status}",
            schedule_id=schedule.id,
            event_title=definition.title,
            schedule_date=schedule.schedule_date.isoformat(),
            start_time=time_to_str(schedule.start_time),
        )
    
    if schedule.is_blocked:
        return TicketAvailabilityResponse(
            is_available=False,
            available_tickets=0,
            message="This time slot is blocked",
            schedule_id=schedule.id,
            event_title=definition.title,
            schedule_date=schedule.schedule_date.isoformat(),
            start_time=time_to_str(schedule.start_time),
        )
    
    if available < quantity:
        return TicketAvailabilityResponse(
            is_available=False,
            available_tickets=available,
            message=f"Only {available} tickets available" if available > 0 else "Sold out",
            schedule_id=schedule.id,
            event_title=definition.title,
            schedule_date=schedule.schedule_date.isoformat(),
            start_time=time_to_str(schedule.start_time),
        )
    
    return TicketAvailabilityResponse(
        is_available=True,
        available_tickets=available,
        message="Tickets available",
        schedule_id=schedule.id,
        event_title=definition.title,
        schedule_date=schedule.schedule_date.isoformat(),
        start_time=time_to_str(schedule.start_time),
    )


@router.post("/{schedule_id}/reserve-tickets")
async def reserve_tickets(
    schedule_id: int,
    quantity: int = Query(1, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Reserve tickets (admin only - for manual adjustments).
    
    NOTE: Normal ticket purchases go through the payment flow which
    atomically reserves tickets after payment verification.
    """
    result = await session.execute(
        select(EventSchedule).where(EventSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    available = schedule.max_tickets - schedule.tickets_sold
    
    if available < quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough tickets. Available: {available}, Requested: {quantity}"
        )
    
    schedule.tickets_sold += quantity
    await session.commit()
    
    return {
        "success": True,
        "tickets_reserved": quantity,
        "new_total_sold": schedule.tickets_sold,
        "remaining": schedule.max_tickets - schedule.tickets_sold,
    }


# ========================================
# Participants
# ========================================

@router.get("/{schedule_id}/participants", response_model=List[ParticipantSummary])
async def list_schedule_participants(
    schedule_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """List participants for a specific schedule (admin only)."""
    # Verify schedule exists
    result = await session.execute(
        select(EventSchedule).where(EventSchedule.id == schedule_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Get participants linked to this schedule
    # Note: This requires event_schedule_id column on program_participants
    # which is added by the migration
    try:
        result = await session.execute(
            select(ProgramParticipant, Booking)
            .outerjoin(Booking, ProgramParticipant.booking_id == Booking.id)
            .where(ProgramParticipant.event_schedule_id == schedule_id)
            .order_by(ProgramParticipant.joined_at.desc())
        )
        rows = result.all()
        
        return [
            ParticipantSummary(
                participant_id=participant.id,
                user_id=participant.user_id,
                name=participant.name,
                mobile=participant.mobile,
                ticket_quantity=participant.ticket_quantity,
                amount_paid=participant.amount_paid,
                is_verified=participant.is_verified,
                scan_count=participant.scan_count,
                joined_at=participant.joined_at,
                booking_id=participant.booking_id,
                booking_reference=booking.booking_reference if booking else None,
            )
            for participant, booking in rows
        ]
    except Exception:
        # Fallback if event_schedule_id column doesn't exist yet
        return []


@router.get("/{schedule_id}/stats")
async def get_schedule_stats(
    schedule_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Get statistics for a schedule (admin only)."""
    result = await session.execute(
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.id == schedule_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule, definition = row
    
    # Count verified participants
    try:
        verified_result = await session.execute(
            select(func.count(ProgramParticipant.id))
            .where(ProgramParticipant.event_schedule_id == schedule_id)
            .where(ProgramParticipant.is_verified == True)
        )
        verified_count = verified_result.scalar() or 0
        
        # Count total scans
        scan_result = await session.execute(
            select(func.sum(ProgramParticipant.scan_count))
            .where(ProgramParticipant.event_schedule_id == schedule_id)
        )
        total_scans = scan_result.scalar() or 0
    except Exception:
        verified_count = 0
        total_scans = 0
    
    effective_price = float(schedule.ticket_price) if schedule.ticket_price else float(definition.default_ticket_price)
    
    return {
        "schedule_id": schedule.id,
        "event_title": definition.title,
        "schedule_date": schedule.schedule_date.isoformat(),
        "max_tickets": schedule.max_tickets,
        "tickets_sold": schedule.tickets_sold,
        "tickets_available": schedule.max_tickets - schedule.tickets_sold,
        "verified_entries": verified_count,
        "total_scans": total_scans,
        "expected_revenue": schedule.tickets_sold * effective_price,
        "status": schedule.status,
    }


# ========================================
# Admin Dashboard Endpoints
# ========================================

@router.get("/admin/by-type/{event_type}")
async def admin_get_schedules_by_type(
    event_type: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    include_participants: bool = Query(True),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Get all schedules for a specific event type with participants (admin only).
    
    Event types: yoga, zumba, live, concert, workshop, etc.
    """
    # Default date range: last 7 days to next 30 days
    if not date_from:
        from_date = date.today() - timedelta(days=7)
    else:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")
    
    if not date_to:
        to_date = date.today() + timedelta(days=30)
    else:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")
    
    # Get schedules
    query = (
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventDefinition.event_type == event_type)
        .where(EventSchedule.schedule_date >= from_date)
        .where(EventSchedule.schedule_date <= to_date)
        .order_by(EventSchedule.schedule_date.desc(), EventSchedule.start_time)
    )
    
    result = await session.execute(query)
    rows = result.all()
    
    schedules_data = []
    
    for schedule, definition in rows:
        schedule_dict = {
            "id": schedule.id,
            "event_definition_id": definition.id,
            "event_code": definition.event_code,
            "event_title": definition.title,
            "event_type": definition.event_type,
            "event_category": definition.event_category,
            "schedule_date": schedule.schedule_date.isoformat(),
            "start_time": schedule.start_time.strftime("%H:%M:%S") if schedule.start_time else None,
            "end_time": schedule.end_time.strftime("%H:%M:%S") if schedule.end_time else None,
            "max_tickets": schedule.max_tickets,
            "tickets_sold": schedule.tickets_sold,
            "tickets_available": schedule.max_tickets - schedule.tickets_sold,
            "ticket_price": float(schedule.ticket_price) if schedule.ticket_price else float(definition.default_ticket_price),
            "status": schedule.status,
            "is_blocked": schedule.is_blocked,
            "banner_image_url": definition.banner_image_url,
            "poster_url": definition.poster_url,
            "participants": [],
        }
        
        if include_participants:
            # Get participants for this schedule
            # First try with event_schedule_id (new system)
            try:
                participant_query = (
                    select(ProgramParticipant, Booking)
                    .outerjoin(Booking, ProgramParticipant.booking_id == Booking.id)
                    .where(ProgramParticipant.event_schedule_id == schedule.id)
                    .order_by(ProgramParticipant.joined_at.desc())
                )
                participant_result = await session.execute(participant_query)
                participant_rows = participant_result.all()
                
                for participant, booking in participant_rows:
                    schedule_dict["participants"].append({
                        "id": participant.id,
                        "user_id": participant.user_id,
                        "name": participant.name,
                        "mobile": participant.mobile,
                        "ticket_quantity": participant.ticket_quantity,
                        "amount_paid": float(participant.amount_paid) if participant.amount_paid else None,
                        "is_verified": participant.is_verified,
                        "scan_count": participant.scan_count,
                        "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
                        "booking_reference": booking.booking_reference if booking else None,
                        "payment_status": booking.status if booking else None,
                    })
            except Exception:
                # Fallback: use legacy program_type matching
                pass
        
        schedules_data.append(schedule_dict)
    
    return {
        "event_type": event_type,
        "date_range": {
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
        },
        "total_schedules": len(schedules_data),
        "schedules": schedules_data,
    }


@router.get("/admin/legacy/{program_type}")
async def admin_get_legacy_participants(
    program_type: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Get participants using legacy program_type field (backward compatibility).
    
    This works with existing program_participants that don't have event_schedule_id.
    Program types: yoga, zumba, live
    """
    # Default date range
    if not date_from:
        from_date = date.today() - timedelta(days=30)
    else:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")
    
    if not date_to:
        to_date = date.today() + timedelta(days=7)
    else:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")
    
    # Query participants by program_type
    query = (
        select(ProgramParticipant, Booking)
        .outerjoin(Booking, ProgramParticipant.booking_id == Booking.id)
        .where(ProgramParticipant.program_type == program_type)
        .where(ProgramParticipant.joined_at >= datetime.combine(from_date, time.min))
        .where(ProgramParticipant.joined_at <= datetime.combine(to_date, time.max))
        .order_by(ProgramParticipant.joined_at.desc())
    )
    
    result = await session.execute(query)
    rows = result.all()
    
    participants = []
    total_tickets = 0
    total_revenue = 0.0
    verified_count = 0
    
    for participant, booking in rows:
        participants.append({
            "id": participant.id,
            "user_id": participant.user_id,
            "name": participant.name,
            "mobile": participant.mobile,
            "ticket_quantity": participant.ticket_quantity,
            "amount_paid": float(participant.amount_paid) if participant.amount_paid else None,
            "is_verified": participant.is_verified,
            "scan_count": participant.scan_count,
            "subscription_type": participant.subscription_type,
            "start_date": participant.start_date.isoformat() if participant.start_date else None,
            "end_date": participant.end_date.isoformat() if participant.end_date else None,
            "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
            "booking_reference": booking.booking_reference if booking else None,
            "payment_status": booking.status if booking else None,
            "event_title": booking.customer_note if booking else None,  # Live shows store title in customer_note
        })
        
        total_tickets += participant.ticket_quantity
        if participant.amount_paid:
            total_revenue += float(participant.amount_paid)
        if participant.is_verified:
            verified_count += 1
    
    return {
        "program_type": program_type,
        "date_range": {
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
        },
        "summary": {
            "total_participants": len(participants),
            "total_tickets": total_tickets,
            "total_revenue": total_revenue,
            "verified_count": verified_count,
        },
        "participants": participants,
    }


@router.get("/admin/dashboard-summary")
async def admin_get_dashboard_summary(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Get summary statistics for all event types (admin dashboard)."""
    today = date.today()
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=30)
    
    # Get stats for each event type using new tables
    stats = {}
    
    # Query event definitions grouped by type
    result = await session.execute(
        select(
            EventDefinition.event_type,
            func.count(EventSchedule.id).label('total_schedules'),
            func.sum(EventSchedule.tickets_sold).label('total_tickets_sold'),
        )
        .join(EventSchedule, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.schedule_date >= month_start)
        .where(EventDefinition.is_active == True)
        .group_by(EventDefinition.event_type)
    )
    
    for row in result:
        stats[row.event_type] = {
            "total_schedules": row.total_schedules or 0,
            "total_tickets_sold": row.total_tickets_sold or 0,
        }
    
    # Also get legacy stats from program_participants
    legacy_result = await session.execute(
        select(
            ProgramParticipant.program_type,
            func.count(ProgramParticipant.id).label('participant_count'),
            func.sum(ProgramParticipant.ticket_quantity).label('ticket_count'),
            func.sum(ProgramParticipant.amount_paid).label('revenue'),
        )
        .where(ProgramParticipant.joined_at >= datetime.combine(month_start, time.min))
        .group_by(ProgramParticipant.program_type)
    )
    
    legacy_stats = {}
    for row in legacy_result:
        legacy_stats[row.program_type] = {
            "participant_count": row.participant_count or 0,
            "ticket_count": int(row.ticket_count or 0),
            "revenue": float(row.revenue or 0),
        }
    
    # Get today's schedules
    today_result = await session.execute(
        select(func.count(EventSchedule.id))
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(EventSchedule.schedule_date == today)
        .where(EventDefinition.is_active == True)
    )
    today_schedules = today_result.scalar() or 0
    
    return {
        "date": today.isoformat(),
        "period": {
            "from": month_start.isoformat(),
            "to": today.isoformat(),
        },
        "new_system_stats": stats,
        "legacy_stats": legacy_stats,
        "today_schedules": today_schedules,
    }
