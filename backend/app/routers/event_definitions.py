"""
Event Definitions Router
Manages master event templates/definitions.
"""
from datetime import datetime, date, time, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from ..db import get_session
from ..models_events import EventDefinition, EventSchedule, TicketType
from ..models import User
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

class EventDefinitionCreate(BaseModel):
    """Schema for creating a new event definition."""
    event_code: str = Field(..., min_length=1, max_length=50, description="Unique event identifier like 'yoga-morning'")
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    event_category: str = Field(..., description="Category: wellness, live-show, workshop")
    event_type: str = Field(..., description="Type: yoga, zumba, concert, comedy")
    
    recurrence_type: str = Field(default="none", description="none, daily, weekly")
    recurrence_days: Optional[str] = Field(None, description="Comma-separated day numbers (1=Mon, 7=Sun)")
    
    default_start_time: Optional[str] = Field(None, description="HH:MM:SS format")
    default_end_time: Optional[str] = Field(None, description="HH:MM:SS format")
    default_duration_minutes: int = Field(default=60)
    
    max_tickets: int = Field(default=50, ge=1)
    default_ticket_price: float = Field(default=0.00, ge=0)
    
    space_id: Optional[int] = None
    venue_id: Optional[int] = None
    
    banner_image_url: Optional[str] = None
    poster_url: Optional[str] = None
    voice_instructions: Optional[str] = None


class EventDefinitionUpdate(BaseModel):
    """Schema for updating an event definition."""
    title: Optional[str] = None
    description: Optional[str] = None
    
    event_category: Optional[str] = None
    event_type: Optional[str] = None
    
    recurrence_type: Optional[str] = None
    recurrence_days: Optional[str] = None
    
    default_start_time: Optional[str] = None
    default_end_time: Optional[str] = None
    default_duration_minutes: Optional[int] = None
    
    max_tickets: Optional[int] = None
    default_ticket_price: Optional[float] = None
    
    space_id: Optional[int] = None
    venue_id: Optional[int] = None
    
    banner_image_url: Optional[str] = None
    poster_url: Optional[str] = None
    voice_instructions: Optional[str] = None
    
    is_active: Optional[bool] = None


class EventDefinitionResponse(BaseModel):
    """Schema for event definition response."""
    id: int
    event_code: str
    title: str
    description: Optional[str]
    event_category: str
    event_type: str
    recurrence_type: str
    recurrence_days: Optional[str]
    default_start_time: Optional[str]
    default_end_time: Optional[str]
    default_duration_minutes: int
    max_tickets: int
    default_ticket_price: float
    space_id: Optional[int]
    venue_id: Optional[int]
    banner_image_url: Optional[str]
    poster_url: Optional[str]
    voice_instructions: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GenerateSchedulesRequest(BaseModel):
    """Schema for generating recurring schedules."""
    event_definition_id: int
    start_date: str = Field(..., description="YYYY-MM-DD format")
    end_date: str = Field(..., description="YYYY-MM-DD format")


class TicketTypeCreate(BaseModel):
    """Schema for creating a ticket type."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    price: float = Field(..., ge=0)
    max_quantity: Optional[int] = Field(None, ge=1)
    perks: Optional[str] = None
    sort_order: int = Field(default=0)


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


# ========================================
# Event Definition Endpoints
# ========================================

@router.get("/", response_model=List[EventDefinitionResponse])
async def list_event_definitions(
    category: Optional[str] = Query(None, description="Filter by category"),
    event_type: Optional[str] = Query(None, description="Filter by type"),
    active_only: bool = Query(True, description="Only active definitions"),
    session: AsyncSession = Depends(get_session),
):
    """List all event definitions with optional filters."""
    query = select(EventDefinition)
    
    if category:
        query = query.where(EventDefinition.event_category == category)
    if event_type:
        query = query.where(EventDefinition.event_type == event_type)
    if active_only:
        query = query.where(EventDefinition.is_active == True)
    
    query = query.order_by(EventDefinition.event_category, EventDefinition.title)
    
    result = await session.execute(query)
    definitions = result.scalars().all()
    
    return [
        EventDefinitionResponse(
            id=d.id,
            event_code=d.event_code,
            title=d.title,
            description=d.description,
            event_category=d.event_category,
            event_type=d.event_type,
            recurrence_type=d.recurrence_type,
            recurrence_days=d.recurrence_days,
            default_start_time=time_to_str(d.default_start_time),
            default_end_time=time_to_str(d.default_end_time),
            default_duration_minutes=d.default_duration_minutes,
            max_tickets=d.max_tickets,
            default_ticket_price=float(d.default_ticket_price),
            space_id=d.space_id,
            venue_id=d.venue_id,
            banner_image_url=d.banner_image_url,
            poster_url=d.poster_url,
            voice_instructions=d.voice_instructions,
            is_active=d.is_active,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in definitions
    ]


@router.get("/{event_id}", response_model=EventDefinitionResponse)
async def get_event_definition(
    event_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single event definition by ID."""
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == event_id)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    return EventDefinitionResponse(
        id=definition.id,
        event_code=definition.event_code,
        title=definition.title,
        description=definition.description,
        event_category=definition.event_category,
        event_type=definition.event_type,
        recurrence_type=definition.recurrence_type,
        recurrence_days=definition.recurrence_days,
        default_start_time=time_to_str(definition.default_start_time),
        default_end_time=time_to_str(definition.default_end_time),
        default_duration_minutes=definition.default_duration_minutes,
        max_tickets=definition.max_tickets,
        default_ticket_price=float(definition.default_ticket_price),
        space_id=definition.space_id,
        venue_id=definition.venue_id,
        banner_image_url=definition.banner_image_url,
        poster_url=definition.poster_url,
        voice_instructions=definition.voice_instructions,
        is_active=definition.is_active,
        created_at=definition.created_at,
        updated_at=definition.updated_at,
    )


@router.get("/code/{event_code}", response_model=EventDefinitionResponse)
async def get_event_definition_by_code(
    event_code: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a single event definition by code."""
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.event_code == event_code)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    return EventDefinitionResponse(
        id=definition.id,
        event_code=definition.event_code,
        title=definition.title,
        description=definition.description,
        event_category=definition.event_category,
        event_type=definition.event_type,
        recurrence_type=definition.recurrence_type,
        recurrence_days=definition.recurrence_days,
        default_start_time=time_to_str(definition.default_start_time),
        default_end_time=time_to_str(definition.default_end_time),
        default_duration_minutes=definition.default_duration_minutes,
        max_tickets=definition.max_tickets,
        default_ticket_price=float(definition.default_ticket_price),
        space_id=definition.space_id,
        venue_id=definition.venue_id,
        banner_image_url=definition.banner_image_url,
        poster_url=definition.poster_url,
        voice_instructions=definition.voice_instructions,
        is_active=definition.is_active,
        created_at=definition.created_at,
        updated_at=definition.updated_at,
    )


@router.post("/", response_model=EventDefinitionResponse)
async def create_event_definition(
    data: EventDefinitionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Create a new event definition (admin only)."""
    # Check if event_code already exists
    existing = await session.execute(
        select(EventDefinition).where(EventDefinition.event_code == data.event_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Event code '{data.event_code}' already exists")
    
    definition = EventDefinition(
        event_code=data.event_code,
        title=data.title,
        description=data.description,
        event_category=data.event_category,
        event_type=data.event_type,
        recurrence_type=data.recurrence_type,
        recurrence_days=data.recurrence_days,
        default_start_time=parse_time(data.default_start_time),
        default_end_time=parse_time(data.default_end_time),
        default_duration_minutes=data.default_duration_minutes,
        max_tickets=data.max_tickets,
        default_ticket_price=data.default_ticket_price,
        space_id=data.space_id,
        venue_id=data.venue_id,
        banner_image_url=data.banner_image_url,
        poster_url=data.poster_url,
        voice_instructions=data.voice_instructions,
        created_by_user_id=current_user.id,
    )
    
    session.add(definition)
    await session.commit()
    await session.refresh(definition)
    
    return EventDefinitionResponse(
        id=definition.id,
        event_code=definition.event_code,
        title=definition.title,
        description=definition.description,
        event_category=definition.event_category,
        event_type=definition.event_type,
        recurrence_type=definition.recurrence_type,
        recurrence_days=definition.recurrence_days,
        default_start_time=time_to_str(definition.default_start_time),
        default_end_time=time_to_str(definition.default_end_time),
        default_duration_minutes=definition.default_duration_minutes,
        max_tickets=definition.max_tickets,
        default_ticket_price=float(definition.default_ticket_price),
        space_id=definition.space_id,
        venue_id=definition.venue_id,
        banner_image_url=definition.banner_image_url,
        poster_url=definition.poster_url,
        voice_instructions=definition.voice_instructions,
        is_active=definition.is_active,
        created_at=definition.created_at,
        updated_at=definition.updated_at,
    )


@router.patch("/{event_id}", response_model=EventDefinitionResponse)
async def update_event_definition(
    event_id: int,
    data: EventDefinitionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Update an event definition (admin only)."""
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == event_id)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    # Update fields that are provided
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in ('default_start_time', 'default_end_time'):
            value = parse_time(value) if value else None
        setattr(definition, field, value)
    
    await session.commit()
    await session.refresh(definition)
    
    return EventDefinitionResponse(
        id=definition.id,
        event_code=definition.event_code,
        title=definition.title,
        description=definition.description,
        event_category=definition.event_category,
        event_type=definition.event_type,
        recurrence_type=definition.recurrence_type,
        recurrence_days=definition.recurrence_days,
        default_start_time=time_to_str(definition.default_start_time),
        default_end_time=time_to_str(definition.default_end_time),
        default_duration_minutes=definition.default_duration_minutes,
        max_tickets=definition.max_tickets,
        default_ticket_price=float(definition.default_ticket_price),
        space_id=definition.space_id,
        venue_id=definition.venue_id,
        banner_image_url=definition.banner_image_url,
        poster_url=definition.poster_url,
        voice_instructions=definition.voice_instructions,
        is_active=definition.is_active,
        created_at=definition.created_at,
        updated_at=definition.updated_at,
    )


@router.delete("/{event_id}")
async def delete_event_definition(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Soft delete an event definition by setting is_active=False (admin only)."""
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == event_id)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    definition.is_active = False
    await session.commit()
    
    return {"success": True, "message": "Event definition deactivated"}


# ========================================
# Schedule Generation
# ========================================

@router.post("/generate-schedules")
async def generate_schedules(
    data: GenerateSchedulesRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Generate recurring schedules for an event definition (admin only)."""
    # Get the event definition
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == data.event_definition_id)
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    if definition.recurrence_type == 'none':
        raise HTTPException(status_code=400, detail="Event is not recurring")
    
    # Parse dates
    try:
        start_date = datetime.strptime(data.start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(data.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # Parse recurrence days
    if definition.recurrence_days:
        allowed_days = [int(d) for d in definition.recurrence_days.split(',')]
    else:
        allowed_days = [1, 2, 3, 4, 5, 6, 7]  # All days
    
    # Generate schedules
    created_count = 0
    current_date = start_date
    
    while current_date <= end_date:
        # Python weekday: 0=Monday, 6=Sunday
        # We use 1=Monday, 7=Sunday to match PostgreSQL EXTRACT(ISODOW)
        day_of_week = current_date.weekday() + 1  # Convert to 1-7
        
        if day_of_week in allowed_days:
            # Check if schedule already exists
            existing = await session.execute(
                select(EventSchedule).where(
                    and_(
                        EventSchedule.event_definition_id == definition.id,
                        EventSchedule.schedule_date == current_date,
                        EventSchedule.start_time == definition.default_start_time,
                    )
                )
            )
            
            if not existing.scalar_one_or_none():
                schedule = EventSchedule(
                    event_definition_id=definition.id,
                    schedule_date=current_date,
                    start_time=definition.default_start_time,
                    end_time=definition.default_end_time,
                    max_tickets=definition.max_tickets,
                    ticket_price=definition.default_ticket_price,
                    status='scheduled',
                )
                session.add(schedule)
                created_count += 1
        
        current_date += timedelta(days=1)
    
    await session.commit()
    
    return {
        "success": True,
        "message": f"Generated {created_count} schedules",
        "schedules_created": created_count,
        "event_code": definition.event_code,
        "date_range": f"{data.start_date} to {data.end_date}",
    }


# ========================================
# Ticket Types
# ========================================

@router.get("/{event_id}/ticket-types")
async def list_ticket_types(
    event_id: int,
    session: AsyncSession = Depends(get_session),
):
    """List ticket types for an event definition."""
    result = await session.execute(
        select(TicketType)
        .where(TicketType.event_definition_id == event_id)
        .where(TicketType.is_active == True)
        .order_by(TicketType.sort_order)
    )
    ticket_types = result.scalars().all()
    
    return [
        {
            "id": tt.id,
            "name": tt.name,
            "description": tt.description,
            "price": float(tt.price),
            "max_quantity": tt.max_quantity,
            "perks": tt.perks,
            "sort_order": tt.sort_order,
        }
        for tt in ticket_types
    ]


@router.post("/{event_id}/ticket-types")
async def create_ticket_type(
    event_id: int,
    data: TicketTypeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """Create a ticket type for an event definition (admin only)."""
    # Verify event exists
    result = await session.execute(
        select(EventDefinition).where(EventDefinition.id == event_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event definition not found")
    
    ticket_type = TicketType(
        event_definition_id=event_id,
        name=data.name,
        description=data.description,
        price=data.price,
        max_quantity=data.max_quantity,
        perks=data.perks,
        sort_order=data.sort_order,
    )
    
    session.add(ticket_type)
    await session.commit()
    await session.refresh(ticket_type)
    
    return {
        "id": ticket_type.id,
        "name": ticket_type.name,
        "description": ticket_type.description,
        "price": float(ticket_type.price),
        "max_quantity": ticket_type.max_quantity,
        "perks": ticket_type.perks,
        "sort_order": ticket_type.sort_order,
    }
