# Event Ticketing System Refactoring Analysis

## Implementation Status ✅

### Files Created:

#### SQL Migrations
- `backend/migrations/001_event_ticketing_system.sql` - Main migration (tables, functions, views)
- `backend/migrations/002_seed_wellness_events.sql` - Seed data for yoga/zumba

#### Python Models & Routers
- `backend/app/models_events.py` - SQLAlchemy models (EventDefinition, EventSchedule, TicketType)
- `backend/app/routers/event_definitions.py` - API for event definitions (CRUD, schedule generation)
- `backend/app/routers/event_schedules.py` - API for schedules, availability, participants

#### Core Updates
- `backend/app/core.py` - Router registration added

### Next Steps:
1. Run `001_event_ticketing_system.sql` in Supabase SQL Editor
2. Run `002_seed_wellness_events.sql` to seed yoga/zumba events
3. Test API endpoints at `/api/event-definitions` and `/api/event-schedules`
4. Integrate with frontend booking flow

---

## Current State Analysis

### A. Existing Database Schema

#### 1. `bookings` Table (Core Transaction Table)
The booking table currently stores ALL event bookings including:
- **Hall/Space bookings** (Grant Hall, Meeting Room)
- **Live shows** (booking_type='live-')
- **Daily programs** (booking_type='daily' - Yoga, Zumba)
- **One-day events** (booking_type='one_day')

**Key fields:**
- `id`, `booking_reference`, `user_id`, `space_id`, `venue_id`
- `start_datetime`, `end_datetime`, `attendees`
- `status`: pending, approved, paid, confirmed, completed, cancelled
- `total_amount`, `booking_type`, `event_type`
- `is_admin_booking`: True for admin-created events
- `customer_note`: Contains ticket info like "Sold: 5 @ ₹500"
- `banner_image_url`, `stage_banner_url`

#### 2. `program_participants` Table
Stores participants for programs (Yoga, Zumba, Live shows):
- `user_id`, `name`, `mobile`
- `program_type`: yoga|zumba|live
- `subscription_type`: daily|monthly (for yoga/zumba)
- `ticket_quantity`, `booking_id`
- `start_date`, `end_date`, `amount_paid`
- `is_active`, `is_verified`, `scan_count`

#### 3. `programs` Table (Underutilized)
- Basic program definition: `title`, `description`, `schedule`, `price`
- `status`: draft|pending|approved|rejected
- Not actively linked to bookings

#### 4. `events` Table (Underutilized)
- Simple title + date_text only
- Not linked to bookings/scheduling

### B. Current Workflow Analysis

#### Live Show Creation (Admin):
1. Admin creates booking with `is_admin_booking=True`, `booking_type='live-'`
2. `customer_note` stores "Sold: 0 | Tickets: X @ ₹Y"
3. Booking status set to "approved" automatically
4. Banner images stored in `banner_image_url`

#### Live Show Ticket Purchase (User):
1. Frontend shows live show card from admin booking
2. User books with `booking_type='live-'` referencing same space/time
3. Conflict check SKIPPED for `live-` bookings (line 101 bookings.py)
4. After payment verification, `ProgramParticipant` created (payments.py:131-147)
5. `booking.attendees` represents ticket count

#### Yoga/Zumba Handling:
1. Admin creates booking with `booking_type='daily'`, `event_type='yoga'/'zumba'`
2. Users can view these as available programs
3. User purchases create separate booking with same type
4. `program_participants` tracks subscriptions

### C. Identified Weaknesses

1. **No Centralized Event Definition:**
   - Event details (name, price, time, max capacity) duplicated across bookings
   - Changing event details requires updating multiple bookings

2. **No Schedule Management:**
   - Daily recurring events (yoga 7-8 AM, zumba 8-9 AM) not auto-generated
   - No automatic blocking of recurring slots
   - Manual booking creation required for each occurrence

3. **Ticket Availability Not Enforced:**
   - No max_tickets field on events
   - Ticket count parsed from customer_note (fragile)
   - Race conditions possible for concurrent purchases

4. **Slot Conflicts for Recurring Events:**
   - Daily yoga/zumba should block their slots every day
   - Currently relies on manual conflict detection
   - Series bookings (daily) use date range but slot check projects incorrectly

5. **Participant Tracking Scattered:**
   - `program_participants` linked via `booking_id`
   - Admin booking vs user bookings create separate participant entries
   - No unified view per event schedule

---

## Target Architecture Design

### New Tables (Minimal, Non-Breaking)

```sql
-- ============================================================
-- MIGRATION: Event Ticketing System Enhancement
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Master Events Table
-- Stores event templates/definitions
CREATE TABLE IF NOT EXISTS event_definitions (
    id SERIAL PRIMARY KEY,
    
    -- Event identification
    event_code VARCHAR(50) UNIQUE NOT NULL,  -- 'yoga-morning', 'zumba-evening', 'live-show-xyz'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    event_category VARCHAR(50) NOT NULL,  -- 'wellness', 'live-show', 'workshop'
    event_type VARCHAR(50) NOT NULL,      -- 'yoga', 'zumba', 'concert', 'comedy'
    
    -- Recurrence pattern
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none',  -- 'none', 'daily', 'weekly'
    recurrence_days VARCHAR(50),  -- '1,2,3,4,5,6,7' for weekdays (1=Monday)
    
    -- Default timing (for recurring)
    default_start_time TIME,  -- '07:00:00' for yoga
    default_end_time TIME,    -- '08:00:00' for yoga
    default_duration_minutes INT DEFAULT 60,
    
    -- Capacity & Pricing
    max_tickets INT DEFAULT 50,
    default_ticket_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- Venue linkage
    space_id INT REFERENCES spaces(id),
    venue_id INT REFERENCES venues(id),
    
    -- Display
    banner_image_url TEXT,
    poster_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INT REFERENCES users(id)
);

-- 2. Event Schedules Table
-- Stores specific occurrences/instances of events
CREATE TABLE IF NOT EXISTS event_schedules (
    id SERIAL PRIMARY KEY,
    
    -- Link to definition
    event_definition_id INT REFERENCES event_definitions(id) ON DELETE CASCADE,
    
    -- Link to booking (for admin-created events)
    -- Allows backward compatibility: existing bookings become schedules
    booking_id INT REFERENCES bookings(id),
    
    -- Schedule specifics
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_datetime TIMESTAMP GENERATED ALWAYS AS (schedule_date + start_time) STORED,
    end_datetime TIMESTAMP GENERATED ALWAYS AS (schedule_date + end_time) STORED,
    
    -- Capacity for this specific occurrence
    max_tickets INT NOT NULL,
    tickets_sold INT DEFAULT 0,
    tickets_available INT GENERATED ALWAYS AS (max_tickets - tickets_sold) STORED,
    
    -- Pricing override (if different from default)
    ticket_price DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',  -- 'scheduled', 'cancelled', 'completed'
    is_blocked BOOLEAN DEFAULT FALSE,  -- Blocks slot without selling tickets
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one schedule per event per date/time
    UNIQUE(event_definition_id, schedule_date, start_time)
);

-- 3. Ticket Types Table (Optional Enhancement)
CREATE TABLE IF NOT EXISTS ticket_types (
    id SERIAL PRIMARY KEY,
    event_definition_id INT REFERENCES event_definitions(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,  -- 'Standard', 'VIP', 'Early Bird'
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    max_quantity INT,  -- NULL = unlimited
    
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add columns to existing bookings table (backward compatibility)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS event_schedule_id INT REFERENCES event_schedules(id),
ADD COLUMN IF NOT EXISTS event_definition_id INT REFERENCES event_definitions(id),
ADD COLUMN IF NOT EXISTS ticket_type_id INT REFERENCES ticket_types(id);

-- 5. Add event reference to program_participants
ALTER TABLE program_participants
ADD COLUMN IF NOT EXISTS event_schedule_id INT REFERENCES event_schedules(id),
ADD COLUMN IF NOT EXISTS event_definition_id INT REFERENCES event_definitions(id);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_schedules_date ON event_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_event_schedules_definition ON event_schedules(event_definition_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_booking ON event_schedules(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_schedule ON bookings(event_schedule_id);
CREATE INDEX IF NOT EXISTS idx_participants_event_schedule ON program_participants(event_schedule_id);

-- ============================================================
-- FUNCTIONS FOR RECURRING EVENT GENERATION
-- ============================================================

-- Function to generate daily schedules for a date range
CREATE OR REPLACE FUNCTION generate_recurring_schedules(
    p_event_definition_id INT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INT AS $$
DECLARE
    v_event event_definitions%ROWTYPE;
    v_current_date DATE;
    v_day_of_week INT;
    v_days_array INT[];
    v_count INT := 0;
BEGIN
    -- Get event definition
    SELECT * INTO v_event FROM event_definitions WHERE id = p_event_definition_id;
    
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event definition not found';
    END IF;
    
    IF v_event.recurrence_type = 'none' THEN
        RETURN 0;
    END IF;
    
    -- Parse recurrence days
    IF v_event.recurrence_days IS NOT NULL THEN
        v_days_array := string_to_array(v_event.recurrence_days, ',')::INT[];
    ELSE
        v_days_array := ARRAY[1,2,3,4,5,6,7];  -- All days
    END IF;
    
    -- Generate schedules
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
        v_day_of_week := EXTRACT(ISODOW FROM v_current_date)::INT;
        
        IF v_day_of_week = ANY(v_days_array) THEN
            INSERT INTO event_schedules (
                event_definition_id,
                schedule_date,
                start_time,
                end_time,
                max_tickets,
                ticket_price,
                status
            ) VALUES (
                v_event.id,
                v_current_date,
                v_event.default_start_time,
                v_event.default_end_time,
                v_event.max_tickets,
                v_event.default_ticket_price,
                'scheduled'
            )
            ON CONFLICT (event_definition_id, schedule_date, start_time) DO NOTHING;
            
            v_count := v_count + 1;
        END IF;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================

-- Combined event availability view
CREATE OR REPLACE VIEW v_event_availability AS
SELECT 
    ed.id AS event_definition_id,
    ed.event_code,
    ed.title,
    ed.event_category,
    ed.event_type,
    ed.banner_image_url,
    ed.default_ticket_price,
    es.id AS schedule_id,
    es.schedule_date,
    es.start_time,
    es.end_time,
    es.start_datetime,
    es.end_datetime,
    es.max_tickets,
    es.tickets_sold,
    es.tickets_available,
    COALESCE(es.ticket_price, ed.default_ticket_price) AS effective_price,
    es.status,
    ed.space_id,
    ed.venue_id
FROM event_definitions ed
JOIN event_schedules es ON es.event_definition_id = ed.id
WHERE ed.is_active = TRUE
  AND es.status = 'scheduled'
  AND es.schedule_date >= CURRENT_DATE;

-- Participant list per schedule
CREATE OR REPLACE VIEW v_schedule_participants AS
SELECT 
    es.id AS schedule_id,
    es.schedule_date,
    ed.title AS event_title,
    ed.event_type,
    pp.id AS participant_id,
    pp.name,
    pp.mobile,
    pp.ticket_quantity,
    pp.amount_paid,
    pp.is_verified,
    pp.scan_count,
    pp.joined_at,
    b.booking_reference,
    b.status AS booking_status,
    u.username AS user_email,
    u.first_name,
    u.last_name
FROM event_schedules es
JOIN event_definitions ed ON ed.id = es.event_definition_id
LEFT JOIN program_participants pp ON pp.event_schedule_id = es.id
LEFT JOIN bookings b ON b.id = pp.booking_id
LEFT JOIN users u ON u.id = pp.user_id;
```

---

## SQLAlchemy Model Updates

### New Models (add to models.py)

```python
# Add to backend/app/models.py

class EventDefinition(Base):
    """Master event template/definition"""
    __tablename__ = "event_definitions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Classification
    event_category: Mapped[str] = mapped_column(String(50), nullable=False)  # wellness, live-show, workshop
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # yoga, zumba, concert
    
    # Recurrence
    recurrence_type: Mapped[str] = mapped_column(String(20), default='none')  # none, daily, weekly
    recurrence_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 1,2,3,4,5,6,7
    
    # Default timing
    default_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    default_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    default_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    
    # Capacity & Pricing
    max_tickets: Mapped[int] = mapped_column(Integer, default=50)
    default_ticket_price: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Venue
    space_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("spaces.id"), nullable=True)
    venue_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("venues.id"), nullable=True)
    
    # Display
    banner_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    poster_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    schedules: Mapped[List["EventSchedule"]] = relationship("EventSchedule", back_populates="event_definition", cascade="all, delete-orphan")


class EventSchedule(Base):
    """Specific occurrence/instance of an event"""
    __tablename__ = "event_schedules"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_definition_id: Mapped[int] = mapped_column(Integer, ForeignKey("event_definitions.id", ondelete="CASCADE"), nullable=False)
    
    # Link to booking (backward compatibility)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    
    # Schedule
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    
    # Capacity
    max_tickets: Mapped[int] = mapped_column(Integer, nullable=False)
    tickets_sold: Mapped[int] = mapped_column(Integer, default=0)
    
    # Pricing override
    ticket_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default='scheduled')  # scheduled, cancelled, completed
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    event_definition: Mapped["EventDefinition"] = relationship("EventDefinition", back_populates="schedules")
    participants: Mapped[List["ProgramParticipant"]] = relationship("ProgramParticipant", foreign_keys="ProgramParticipant.event_schedule_id")
    
    @property
    def tickets_available(self) -> int:
        return max(0, self.max_tickets - self.tickets_sold)
    
    @property
    def start_datetime(self) -> datetime:
        return datetime.combine(self.schedule_date, self.start_time)
    
    @property
    def end_datetime(self) -> datetime:
        return datetime.combine(self.schedule_date, self.end_time)


class TicketType(Base):
    """Ticket type variants for events"""
    __tablename__ = "ticket_types"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_definition_id: Mapped[int] = mapped_column(Integer, ForeignKey("event_definitions.id", ondelete="CASCADE"), nullable=False)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    max_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

### Update Existing Models (add new columns)

```python
# Add to Booking class:
    event_schedule_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("event_schedules.id"), nullable=True)
    event_definition_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("event_definitions.id"), nullable=True)
    ticket_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ticket_types.id"), nullable=True)

# Add to ProgramParticipant class:
    event_schedule_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("event_schedules.id"), nullable=True)
    event_definition_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("event_definitions.id"), nullable=True)
```

---

## API Endpoint Updates

### 1. New Event Definition APIs

```python
# backend/app/routers/event_definitions.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, time, datetime

from app.db import get_session
from app.models import EventDefinition, EventSchedule, User
from app.auth import get_current_user
from app.routers.auth import require_role

router = APIRouter(prefix="/event-definitions", tags=["event-definitions"])


class EventDefinitionCreate(BaseModel):
    event_code: str
    title: str
    description: Optional[str] = None
    event_category: str  # wellness, live-show, workshop
    event_type: str      # yoga, zumba, concert
    recurrence_type: str = 'none'  # none, daily, weekly
    recurrence_days: Optional[str] = None  # 1,2,3,4,5
    default_start_time: Optional[str] = None  # HH:MM
    default_end_time: Optional[str] = None
    default_duration_minutes: int = 60
    max_tickets: int = 50
    default_ticket_price: float = 0.0
    space_id: Optional[int] = None
    venue_id: Optional[int] = None
    banner_image_url: Optional[str] = None
    poster_url: Optional[str] = None


class EventDefinitionOut(BaseModel):
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
    max_tickets: int
    default_ticket_price: float
    banner_image_url: Optional[str]
    is_active: bool


@router.get("/", response_model=List[EventDefinitionOut])
async def list_event_definitions(
    category: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    session: AsyncSession = Depends(get_session)
):
    """List all event definitions with optional filtering"""
    stmt = select(EventDefinition)
    
    if category:
        stmt = stmt.where(EventDefinition.event_category == category)
    if event_type:
        stmt = stmt.where(EventDefinition.event_type == event_type)
    if active_only:
        stmt = stmt.where(EventDefinition.is_active == True)
    
    stmt = stmt.order_by(EventDefinition.title)
    result = await session.execute(stmt)
    events = result.scalars().all()
    
    return [
        EventDefinitionOut(
            id=e.id,
            event_code=e.event_code,
            title=e.title,
            description=e.description,
            event_category=e.event_category,
            event_type=e.event_type,
            recurrence_type=e.recurrence_type,
            recurrence_days=e.recurrence_days,
            default_start_time=e.default_start_time.strftime("%H:%M") if e.default_start_time else None,
            default_end_time=e.default_end_time.strftime("%H:%M") if e.default_end_time else None,
            max_tickets=e.max_tickets,
            default_ticket_price=e.default_ticket_price,
            banner_image_url=e.banner_image_url,
            is_active=e.is_active
        )
        for e in events
    ]


@router.post("/", dependencies=[Depends(require_role("admin"))])
async def create_event_definition(
    payload: EventDefinitionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new event definition (admin only)"""
    # Parse times
    start_time = None
    end_time = None
    if payload.default_start_time:
        start_time = datetime.strptime(payload.default_start_time, "%H:%M").time()
    if payload.default_end_time:
        end_time = datetime.strptime(payload.default_end_time, "%H:%M").time()
    
    event_def = EventDefinition(
        event_code=payload.event_code,
        title=payload.title,
        description=payload.description,
        event_category=payload.event_category,
        event_type=payload.event_type,
        recurrence_type=payload.recurrence_type,
        recurrence_days=payload.recurrence_days,
        default_start_time=start_time,
        default_end_time=end_time,
        default_duration_minutes=payload.default_duration_minutes,
        max_tickets=payload.max_tickets,
        default_ticket_price=payload.default_ticket_price,
        space_id=payload.space_id,
        venue_id=payload.venue_id,
        banner_image_url=payload.banner_image_url,
        poster_url=payload.poster_url,
        created_by_user_id=current_user.id
    )
    
    session.add(event_def)
    await session.commit()
    await session.refresh(event_def)
    
    return {"id": event_def.id, "event_code": event_def.event_code}


@router.post("/{event_id}/generate-schedules", dependencies=[Depends(require_role("admin"))])
async def generate_schedules(
    event_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_session)
):
    """Generate recurring schedules for an event definition"""
    event_def = await session.get(EventDefinition, event_id)
    if not event_def:
        raise HTTPException(404, "Event definition not found")
    
    if event_def.recurrence_type == 'none':
        raise HTTPException(400, "Event is not recurring")
    
    # Parse recurrence days
    days = [int(d) for d in (event_def.recurrence_days or "1,2,3,4,5,6,7").split(",")]
    
    count = 0
    current = start_date
    while current <= end_date:
        day_of_week = current.isoweekday()  # 1=Monday, 7=Sunday
        
        if day_of_week in days:
            # Check if schedule already exists
            existing = await session.execute(
                select(EventSchedule).where(
                    EventSchedule.event_definition_id == event_id,
                    EventSchedule.schedule_date == current,
                    EventSchedule.start_time == event_def.default_start_time
                )
            )
            if not existing.scalar_one_or_none():
                schedule = EventSchedule(
                    event_definition_id=event_id,
                    schedule_date=current,
                    start_time=event_def.default_start_time,
                    end_time=event_def.default_end_time,
                    max_tickets=event_def.max_tickets,
                    ticket_price=event_def.default_ticket_price,
                    status='scheduled'
                )
                session.add(schedule)
                count += 1
        
        current = current + timedelta(days=1)
    
    await session.commit()
    return {"generated_count": count}
```

### 2. Schedule Availability API

```python
# backend/app/routers/event_schedules.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, time

from app.db import get_session
from app.models import EventSchedule, EventDefinition, ProgramParticipant

router = APIRouter(prefix="/event-schedules", tags=["event-schedules"])


class ScheduleAvailabilityOut(BaseModel):
    schedule_id: int
    event_code: str
    event_title: str
    event_type: str
    schedule_date: str
    start_time: str
    end_time: str
    max_tickets: int
    tickets_sold: int
    tickets_available: int
    ticket_price: float
    status: str


@router.get("/available")
async def get_available_schedules(
    event_type: Optional[str] = Query(None),  # yoga, zumba, live
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    session: AsyncSession = Depends(get_session)
) -> List[ScheduleAvailabilityOut]:
    """Get available event schedules with ticket availability"""
    
    stmt = (
        select(EventSchedule, EventDefinition)
        .join(EventDefinition, EventSchedule.event_definition_id == EventDefinition.id)
        .where(
            EventDefinition.is_active == True,
            EventSchedule.status == 'scheduled'
        )
    )
    
    if event_type:
        stmt = stmt.where(EventDefinition.event_type == event_type)
    
    if start_date:
        stmt = stmt.where(EventSchedule.schedule_date >= start_date)
    else:
        stmt = stmt.where(EventSchedule.schedule_date >= date.today())
    
    if end_date:
        stmt = stmt.where(EventSchedule.schedule_date <= end_date)
    
    stmt = stmt.order_by(EventSchedule.schedule_date, EventSchedule.start_time)
    
    result = await session.execute(stmt)
    rows = result.all()
    
    return [
        ScheduleAvailabilityOut(
            schedule_id=schedule.id,
            event_code=event_def.event_code,
            event_title=event_def.title,
            event_type=event_def.event_type,
            schedule_date=schedule.schedule_date.isoformat(),
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            max_tickets=schedule.max_tickets,
            tickets_sold=schedule.tickets_sold,
            tickets_available=schedule.tickets_available,
            ticket_price=float(schedule.ticket_price or event_def.default_ticket_price),
            status=schedule.status
        )
        for schedule, event_def in rows
    ]


@router.get("/{schedule_id}/participants")
async def get_schedule_participants(
    schedule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get participant list for a specific event schedule"""
    
    schedule = await session.get(EventSchedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    
    # Get participants linked to this schedule
    stmt = (
        select(ProgramParticipant)
        .where(ProgramParticipant.event_schedule_id == schedule_id)
        .order_by(ProgramParticipant.joined_at.desc())
    )
    result = await session.execute(stmt)
    participants = result.scalars().all()
    
    # Also get participants linked via booking_id if schedule has a booking
    if schedule.booking_id:
        stmt_booking = (
            select(ProgramParticipant)
            .where(
                ProgramParticipant.booking_id == schedule.booking_id,
                ProgramParticipant.event_schedule_id.is_(None)
            )
        )
        result_booking = await session.execute(stmt_booking)
        participants.extend(result_booking.scalars().all())
    
    return {
        "schedule_id": schedule_id,
        "schedule_date": schedule.schedule_date.isoformat(),
        "max_tickets": schedule.max_tickets,
        "tickets_sold": schedule.tickets_sold,
        "participants": [
            {
                "id": p.id,
                "name": p.name,
                "mobile": p.mobile,
                "ticket_quantity": p.ticket_quantity,
                "amount_paid": p.amount_paid,
                "is_verified": p.is_verified,
                "scan_count": p.scan_count,
                "joined_at": p.joined_at.isoformat() if p.joined_at else None,
                "booking_id": p.booking_id
            }
            for p in participants
        ]
    }
```

### 3. Updated Booking Creation with Ticket Validation

```python
# Add to backend/app/routers/bookings.py

async def _check_ticket_availability(
    session: AsyncSession,
    event_schedule_id: int,
    requested_quantity: int
) -> tuple[bool, str, Optional[EventSchedule]]:
    """Check if tickets are available for an event schedule.
    
    Returns: (is_available, message, schedule)
    """
    schedule = await session.get(EventSchedule, event_schedule_id)
    
    if not schedule:
        return False, "Event schedule not found", None
    
    if schedule.status != 'scheduled':
        return False, f"Event is {schedule.status}", schedule
    
    if schedule.tickets_available < requested_quantity:
        return False, f"Only {schedule.tickets_available} tickets available", schedule
    
    return True, "Tickets available", schedule


async def _reserve_tickets(
    session: AsyncSession,
    schedule: EventSchedule,
    quantity: int
) -> bool:
    """Reserve tickets for an event schedule (increment tickets_sold).
    
    NOTE: This should only be called AFTER successful payment verification.
    """
    # Reload to get latest count
    await session.refresh(schedule)
    
    if schedule.tickets_available < quantity:
        return False
    
    schedule.tickets_sold += quantity
    return True


# Modify create_booking to validate ticket availability:
# (Add this check after the booking_type check)

    # For program bookings (yoga, zumba, live shows), validate ticket availability
    if hasattr(payload, 'event_schedule_id') and payload.event_schedule_id:
        is_available, message, schedule = await _check_ticket_availability(
            session, 
            payload.event_schedule_id,
            payload.attendees or 1
        )
        if not is_available:
            raise HTTPException(status_code=409, detail=message)
        
        # Store schedule reference (tickets reserved after payment)
        b.event_schedule_id = payload.event_schedule_id
        b.event_definition_id = schedule.event_definition_id if schedule else None
```

### 4. Updated Payment Verification with Ticket Deduction

```python
# Update in backend/app/routers/payments.py handle_payment_callback

async def handle_payment_callback(verification_result, booking, db):
    if verification_result.get("success") and booking:
        
        # TICKET DEDUCTION: Only after successful payment
        if booking.event_schedule_id:
            from app.models import EventSchedule
            schedule = db.query(EventSchedule).filter(
                EventSchedule.id == booking.event_schedule_id
            ).with_for_update().first()  # Lock row
            
            if schedule:
                quantity = booking.attendees or 1
                if schedule.tickets_available >= quantity:
                    schedule.tickets_sold += quantity
                    db.commit()
                else:
                    # Handle race condition: refund may be needed
                    # Log for manual resolution
                    logger.error(f"Ticket oversold for schedule {schedule.id}")
        
        # ... rest of existing participant creation logic
```

---

## Migration Strategy

### Phase 1: Database Changes (Non-Breaking)
1. Create new tables (`event_definitions`, `event_schedules`, `ticket_types`)
2. Add new columns to `bookings` and `program_participants`
3. Create indexes and views
4. No changes to existing data

### Phase 2: Seed Initial Event Definitions
```sql
-- Create Yoga event definition
INSERT INTO event_definitions (
    event_code, title, description, event_category, event_type,
    recurrence_type, recurrence_days, default_start_time, default_end_time,
    max_tickets, default_ticket_price, space_id, is_active
) VALUES (
    'yoga-morning', 'Morning Yoga Session', 'Daily yoga class',
    'wellness', 'yoga', 'daily', '1,2,3,4,5,6,7',
    '07:00:00', '08:00:00', 30, 0.00, 1, TRUE
);

-- Create Zumba event definition
INSERT INTO event_definitions (
    event_code, title, description, event_category, event_type,
    recurrence_type, recurrence_days, default_start_time, default_end_time,
    max_tickets, default_ticket_price, space_id, is_active
) VALUES (
    'zumba-morning', 'Morning Zumba Class', 'Daily zumba fitness class',
    'wellness', 'zumba', 'daily', '1,2,3,4,5,6,7',
    '08:00:00', '09:00:00', 30, 0.00, 1, TRUE
);
```

### Phase 3: Generate Schedules
```sql
-- Generate schedules for next 30 days
SELECT generate_recurring_schedules(
    (SELECT id FROM event_definitions WHERE event_code = 'yoga-morning'),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
);

SELECT generate_recurring_schedules(
    (SELECT id FROM event_definitions WHERE event_code = 'zumba-morning'),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
);
```

### Phase 4: Link Existing Data
```sql
-- Link existing live show bookings to event schedules
-- (Create event_definitions and schedules for existing admin bookings)

-- For each admin booking with booking_type='live-':
-- 1. Create event_definition if event_type is new
-- 2. Create event_schedule linked to that booking
-- 3. Update booking.event_schedule_id

-- Link existing program_participants to schedules
UPDATE program_participants pp
SET event_schedule_id = es.id
FROM event_schedules es
JOIN event_definitions ed ON ed.id = es.event_definition_id
WHERE pp.program_type = ed.event_type
  AND DATE(pp.start_date) = es.schedule_date;
```

### Phase 5: Update API Endpoints (Incremental)
1. New endpoints work alongside existing ones
2. Existing endpoints continue working
3. Gradually migrate frontend to use new endpoints

---

## Time Slot Blocking for Recurring Events

Update `time_slots.py` to block slots for event schedules:

```python
# Add to get_available_time_slots function

    # Also check event_schedules for blocked slots
    from app.models import EventSchedule
    schedule_stmt = select(EventSchedule).where(
        EventSchedule.schedule_date == target_date,
        EventSchedule.status.in_(['scheduled', 'completed']),
        EventSchedule.is_blocked == False  # Only non-blocked schedules take up slots
    )
    schedule_result = await _execute_with_retry(db, schedule_stmt)
    event_schedules = schedule_result.scalars().all()
    
    # Add schedules to blocking check
    for schedule in event_schedules:
        b_start = datetime.combine(schedule.schedule_date, schedule.start_time)
        b_end = datetime.combine(schedule.schedule_date, schedule.end_time)
        # Same overlap check as regular bookings
```

---

## Remaining Technical Debt

1. **Frontend Migration:**
   - Update yoga/zumba booking screens to use `/event-schedules/available`
   - Update live show screens to reference `event_schedule_id`
   - Add participant list view per event

2. **Admin Dashboard:**
   - Add event definition management UI
   - Add schedule generation UI
   - Add participant list with verification controls

3. **Notifications:**
   - Update ticket confirmation notifications
   - Add reminders for upcoming event schedules

4. **Cron Jobs:**
   - Auto-generate schedules for next month
   - Mark past schedules as 'completed'
   - Clean up cancelled schedules

5. **Reports:**
   - Ticket sales by event
   - Attendance tracking
   - Revenue per event type

---

## Summary

This refactoring:
- ✅ Introduces proper event management without breaking existing data
- ✅ Supports daily recurring events (yoga/zumba) with automatic slot blocking
- ✅ Enforces ticket availability before booking
- ✅ Deducts tickets only after payment verification
- ✅ Provides participant tracking per event schedule
- ✅ Maintains backward compatibility with existing frontend
- ✅ Allows gradual migration of existing bookings
