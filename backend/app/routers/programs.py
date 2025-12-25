from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc
import re

from ..db import get_session
from ..models import Program, ProgramParticipant, Booking
from .auth import require_role

router = APIRouter(prefix="/programs", tags=["programs"]) 


class ProgramCreate(BaseModel):
    title: str
    description: Optional[str] = None
    schedule: Optional[str] = None
    price: Optional[float] = None
    poster_url: Optional[str] = None
    event_id: Optional[int] = None


class ProgramUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    price: Optional[float] = None
    status: Optional[str] = None
    poster_url: Optional[str] = None
    event_id: Optional[int] = None


@router.get("/")
async def list_programs(
    q: Optional[str] = Query(None, description="Search in title/description"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    sort: Optional[str] = Query("-id", description="Sort field, prefix '-' for desc. e.g. -created_at"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Program)
    if q:
        from sqlalchemy import or_
        stmt = stmt.where(or_(Program.title.ilike(f"%{q}%"), Program.description.ilike(f"%{q}%")))
    if status_filter:
        stmt = stmt.where(Program.status == status_filter)
    # sorting
    sort_field = Program.id
    direction = desc
    if sort:
        desc_order = sort.startswith("-")
        key = sort[1:] if desc_order else sort
        sort_map = {
            "id": Program.id,
            "created_at": Program.created_at,
            "updated_at": Program.updated_at,
            "price": Program.price,
            "title": Program.title,
        }
        sort_field = sort_map.get(key, Program.id)
        direction = desc if desc_order else asc
    stmt = stmt.order_by(direction(sort_field)).offset(offset).limit(limit)
    rs = await session.execute(stmt)
    items = [p for p in rs.scalars().all()]
    return {
        "items": [
            {
                "id": p.id,
                "title": p.title,
                "status": p.status,
                "schedule": p.schedule,
                "price": p.price,
            }
            for p in items
        ],
        "limit": limit,
        "offset": offset,
        "count": len(items),
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_program(payload: ProgramCreate, session: AsyncSession = Depends(get_session)):
    p = Program(
        title=payload.title,
        description=payload.description,
        schedule=payload.schedule,
        price=payload.price,
        status="pending",
        poster_url=payload.poster_url,
        event_id=payload.event_id,
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return {"id": p.id, "title": p.title, "status": p.status}


@router.get("/{program_id}")
async def get_program(program_id: int, session: AsyncSession = Depends(get_session)):
    p = await session.get(Program, program_id)
    if not p:
        raise HTTPException(404, detail="Program not found")
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "schedule": p.schedule,
        "price": p.price,
        "status": p.status,
        "poster_url": p.poster_url,
        "event_id": p.event_id,
        "createdAt": p.created_at,
        "updatedAt": p.updated_at,
    }


@router.patch("/{program_id}")
async def update_program(program_id: int, payload: ProgramUpdate, session: AsyncSession = Depends(get_session)):
    p = await session.get(Program, program_id)
    if not p:
        raise HTTPException(404, detail="Program not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    await session.commit()
    await session.refresh(p)
    return {"id": p.id, "title": p.title, "status": p.status}


@router.post("/{program_id}/approve", dependencies=[Depends(require_role("admin", "approver"))])
async def approve_program(program_id: int, session: AsyncSession = Depends(get_session)):
    p = await session.get(Program, program_id)
    if not p:
        raise HTTPException(404, detail="Program not found")
    p.status = "approved"
    await session.commit()
    return {"ok": True}


@router.post("/{program_id}/reject", dependencies=[Depends(require_role("admin", "approver"))])
async def reject_program(program_id: int, session: AsyncSession = Depends(get_session)):
    p = await session.get(Program, program_id)
    if not p:
        raise HTTPException(404, detail="Program not found")
    p.status = "rejected"
    await session.commit()
    return {"ok": True}


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("admin"))])
async def delete_program(program_id: int, session: AsyncSession = Depends(get_session)):
    p = await session.get(Program, program_id)
    if not p:
        raise HTTPException(404, detail="Program not found")
    await session.delete(p)
    await session.commit()
    return {}


@router.get("/admin/with_participants", dependencies=[Depends(require_role("admin"))])
async def list_programs_with_participants(
    q: Optional[str] = Query(None, description="Search in title/description"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    session: AsyncSession = Depends(get_session),
):
    """Admin-only: return programs with participants grouped by inferred program_type.

    Since Program has no explicit program_type column, we infer from title (yoga|zumba|live) heuristically.
    Also includes live show bookings from the Booking table with booking_type='live-'.
    """
    from app.models import Booking
    from sqlalchemy import or_, and_
    
    # Fetch programs
    stmt = select(Program)
    if q:
        stmt = stmt.where(or_(Program.title.ilike(f"%{q}%"), Program.description.ilike(f"%{q}%")))
    if status_filter:
        stmt = stmt.where(Program.status == status_filter)
    rs = await session.execute(stmt.order_by(Program.created_at.desc()))
    programs = rs.scalars().all()

    # Fetch live show bookings (booking_type='live-' or is_admin_booking=True with space_id=1)
    booking_stmt = select(Booking).where(
        or_(
            Booking.booking_type == 'live-',
            and_(
                getattr(Booking, 'is_admin_booking', False) == True,
                Booking.booking_type.is_(None),
                Booking.space_id == 1  # Live show space
            )
        )
    )
    if q:
        booking_stmt = booking_stmt.where(Booking.event_type.ilike(f"%{q}%"))
    if status_filter:
        booking_stmt = booking_stmt.where(Booking.status == status_filter)
    booking_rs = await session.execute(booking_stmt.order_by(Booking.start_datetime.desc()))
    live_show_bookings = booking_rs.scalars().all()

    # Fetch all participants once and group by program_type and booking_id
    prs = await session.execute(select(ProgramParticipant))
    participants = prs.scalars().all()
    by_type: dict[str, list[ProgramParticipant]] = {}
    by_booking_id: dict[int, list[ProgramParticipant]] = {}
    for p in participants:
        key = (p.program_type or '').lower().strip()
        by_type.setdefault(key, []).append(p)
        if hasattr(p, 'booking_id') and p.booking_id:
            by_booking_id.setdefault(p.booking_id, []).append(p)
    
    # Fetch booking items for all bookings (for add-ons display)
    from app.models import BookingItem, Item
    booking_ids = [booking.id for booking in live_show_bookings]
    items_by_booking: dict[int, list[dict]] = {}
    if booking_ids:
        stmt_items = (
            select(BookingItem, Item)
            .join(Item, Item.id == BookingItem.item_id)
            .where(BookingItem.booking_id.in_(booking_ids))
            .order_by(BookingItem.id)
        )
        rs_items = await session.execute(stmt_items)
        rows_items = rs_items.all()
        for booking_item, item in rows_items:
            if booking_item.booking_id not in items_by_booking:
                items_by_booking[booking_item.booking_id] = []
            items_by_booking[booking_item.booking_id].append({
                'id': booking_item.id,
                'item_id': item.id,
                'item_name': item.name,
                'quantity': booking_item.quantity,
                'unit_price': float(booking_item.unit_price),
                'total_price': float(booking_item.total_price),
            })

    def infer_type(title: str | None) -> Optional[str]:
        if not title:
            return None
        t = title.lower()
        if 'yog' in t:
            return 'yoga'
        if 'zumb' in t:
            return 'zumba'
        if 'live' in t:
            return 'live'
        return None

    items = []
    # Add regular programs
    for p in programs:
        ptype = infer_type(p.title)
        plist = by_type.get((ptype or ''), [])
        items.append({
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "schedule": p.schedule,
            "price": p.price,
            "program_type": ptype,
            "participant_count": len(plist),
            "participants": [
                {
                    "id": pt.id,
                    "name": pt.name,
                    "mobile": pt.mobile,
                    "program_type": pt.program_type,
                    "subscription_type": pt.subscription_type,
                    "ticket_quantity": pt.ticket_quantity,
                    "start_date": pt.start_date.isoformat() if pt.start_date else None,
                    "end_date": pt.end_date.isoformat() if pt.end_date else None,
                    "amount_paid": pt.amount_paid,
                    "is_active": pt.is_active,
                    "is_verified": getattr(pt, 'is_verified', False),
                    "joined_at": pt.joined_at.isoformat() if pt.joined_at else None,
                }
                for pt in plist
            ],
        })
    
    # Add live show bookings
    for booking in live_show_bookings:
        booking_id = booking.id
        plist = by_booking_id.get(booking_id, [])
        # Also include participants with program_type='live' that might not have booking_id set
        live_participants = [p for p in by_type.get('live', []) if not hasattr(p, 'booking_id') or not p.booking_id]
        all_participants = plist + live_participants
        
        # Get booked items for this live show booking
        booking_items = items_by_booking.get(booking_id, [])
        # Parse ticket rate from customer_note if present (pattern: "Tickets: N @ ₹P")
        ticket_rate = None
        try:
            note = getattr(booking, 'customer_note', '') or ''
            # Match numbers possibly with commas, capture the price part
            m = re.search(r"Tickets\s*:\s*\d+\s*@\s*(?:₹|Rs\.?\s*)?([0-9]+(?:\.[0-9]{1,2})?)", note, re.IGNORECASE)
            if m:
                ticket_rate = float(m.group(1))
        except Exception:
            ticket_rate = None
        
        items.append({
            "id": booking_id,
            "title": getattr(booking, 'event_type', None) or 'Live Show',
            "status": booking.status,
            "schedule": f"{booking.start_datetime.strftime('%Y-%m-%d %H:%M')} - {booking.end_datetime.strftime('%H:%M')}" if booking.start_datetime and booking.end_datetime else None,
            "price": float(booking.total_amount) if booking.total_amount else None,
            "program_type": "live",
            "ticket_rate": ticket_rate,
            "participant_count": len(all_participants),
            "participants": [
                {
                    "id": pt.id,
                    "name": pt.name,
                    "mobile": pt.mobile,
                    "program_type": pt.program_type,
                    "subscription_type": pt.subscription_type,
                    "ticket_quantity": pt.ticket_quantity,
                    "start_date": pt.start_date.isoformat() if pt.start_date else None,
                    "end_date": pt.end_date.isoformat() if pt.end_date else None,
                    "amount_paid": pt.amount_paid,
                    "is_active": pt.is_active,
                    "is_verified": getattr(pt, 'is_verified', False),
                    "joined_at": pt.joined_at.isoformat() if pt.joined_at else None,
                    "booked_items": booking_items if pt.booking_id == booking_id or not pt.booking_id else None,  # Items for this booking's participants
                }
                for pt in all_participants
            ],
            "booking_items": booking_items,  # Aggregated items for the entire live show
        })

    return {"items": items, "count": len(items)}
