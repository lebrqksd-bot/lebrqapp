from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, Generator
from sqlalchemy import select, not_, or_, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_session
from app.auth import get_current_user
from app.models import Booking, Space, BookingItem, Item, User, Venue, BookingEvent, VendorProfile, Refund
from app.schemas.bookings import BookingCreate, BookingOut
from datetime import datetime, date, timezone, timedelta
from app.core import settings
from app.notifications import NotificationService
from app.services.client_notification_service import ClientNotificationService
# Import event ticketing models (if table doesn't exist yet, operations will be no-ops)
try:
    from app.models_events import EventSchedule, EventDefinition
    EVENT_TICKETING_ENABLED = True
except ImportError:
    EVENT_TICKETING_ENABLED = False
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:  # pragma: no cover - very old Python fallback
    ZoneInfo = None  # type: ignore
import uuid

router = APIRouter()

def _parse_iso_to_utc_naive(value: str) -> datetime:
    """Parse an ISO8601 string and normalize to LOCAL TIMEZONE naive datetime.
    Rationale: Existing database rows store naive datetimes that represent local time.
    To keep overlap checks consistent with stored values, we convert any offset-aware
    input (including trailing 'Z') to the configured local timezone and drop tzinfo.
    If the input has no offset, treat it as already local naive and return as-is.
    """
    s = str(value).strip()
    if s.endswith('Z'):
        s = s[:-1] + '+00:00'
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None and ZoneInfo is not None:
        try:
            local_tz = ZoneInfo(getattr(settings, 'LOCAL_TIMEZONE', 'Asia/Kolkata'))
            return dt.astimezone(local_tz).replace(tzinfo=None)
        except Exception:
            # Fallback to UTC naive if timezone conversion fails
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _check_for_conflicts(
    space_id: int,
    start_dt: datetime,
    end_dt: datetime,
    session: AsyncSession,
    exclude_booking_id: Optional[int] = None
) -> Optional[Booking]:
    """Check for conflicting bookings in a given time range."""
    query = (
        select(Booking)
        .where(
            Booking.space_id == space_id,
            Booking.status.in_( ["paid", "approved", "confirmed"] ),
            not_(
                or_(
                    Booking.end_datetime <= start_dt,
                    Booking.start_datetime >= end_dt,
                )
            ),
        )
    )
    if exclude_booking_id:
        query = query.where(Booking.id != exclude_booking_id)
    
    rs = await session.execute(query)
    return rs.scalars().first()

@router.post("/bookings", response_model=BookingOut)
async def create_booking(payload: BookingCreate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    # validate space
    stmt = select(Space).where(Space.id == payload.space_id)
    rs = await session.execute(stmt)
    space = rs.scalars().first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Normalize datetimes to UTC naive to avoid timezone drift in overlap checks
    start_dt = _parse_iso_to_utc_naive(str(payload.start_datetime))
    end_dt = _parse_iso_to_utc_naive(str(payload.end_datetime))
    # For one-day/daily programs, ensure end date stays on the same calendar day as start
    # (use the provided end time-of-day but align the date to start's date)
    try:
        # We default booking_type to one_day below; align end date accordingly
        if end_dt.date() != start_dt.date():
            end_dt = datetime.combine(start_dt.date(), end_dt.time())
        if end_dt <= start_dt:
            # enforce minimum 1-hour window if end <= start
            end_dt = start_dt + timedelta(hours=1)
    except Exception:
        pass
    if start_dt >= end_dt:
        raise HTTPException(status_code=400, detail="Invalid time range")

    # check overlap
    # For live show ticket purchases (booking_type == 'live-'), skip slot conflict checks.
    # Live tickets do not reserve the venue slot; they just attach participants after payment.
    booking_type_in_payload = (payload.booking_type or '').strip().lower() if hasattr(payload, 'booking_type') else ''
    if booking_type_in_payload != 'live-':
        conflict = await _check_for_conflicts(payload.space_id, start_dt, end_dt, session)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Time slot conflicts with booking {conflict.booking_reference}")

    # simple price calculation (hours * price_per_hour)
    # For programs like yoga and zumba, set price to 0
    # For admin bookings (regular programs), set price to 0 (no payment required)
    duration_hours = (end_dt - start_dt).total_seconds() / 3600.0
    
    # Check if this is a program booking (yoga, zumba, etc.) - set price to 0
    event_type_lower = (payload.event_type or '').lower()
    is_program = event_type_lower in ['yoga', 'zumba']
    
    # Admin bookings (regular programs) should have no payment
    is_admin_booking = payload.is_admin_booking or False
    
    if is_program or is_admin_booking:
        total_amount = 0.0
    else:
        total_amount = float(duration_hours * float(space.price_per_hour))

    # Check if user is a broker and get broker profile
    broker_id = None
    brokerage_amount = 0.0
    if current_user.role == 'broker':
        from app.models import BrokerProfile
        rs_broker = await session.execute(
            select(BrokerProfile).where(BrokerProfile.user_id == current_user.id)
        )
        broker_profile = rs_broker.scalars().first()
        if broker_profile:
            broker_id = broker_profile.id
            brokerage_percentage = float(getattr(broker_profile, 'brokerage_percentage', 0.0))
            # Brokerage will be calculated after items are added (based on final total)

    # create booking
    # Admin bookings (regular programs, live shows) should be auto-approved
    is_admin_booking = payload.is_admin_booking or False
    booking_status = "approved" if is_admin_booking else "pending"
    booking_type = payload.booking_type or "one_day"
    
    # For admin bookings of live shows, ensure customer_note includes "Sold: 0" for ticket tracking
    customer_note = payload.customer_note or ""
    if is_admin_booking and booking_type == 'live-':
        # Ensure "Sold: 0" is present in customer_note if not already there
        if "Sold:" not in customer_note and "sold:" not in customer_note.lower():
            customer_note = f"Sold: 0 | {customer_note}".strip()
            if customer_note.startswith("|"):
                customer_note = customer_note[1:].strip()
    
    # Store transport_locations as JSON in customer_note (append with separator)
    import json
    if payload.transport_locations:
        transport_json = json.dumps(payload.transport_locations)
        if customer_note:
            customer_note = f"{customer_note} ||TRANSPORT_LOCATIONS:{transport_json}"
        else:
            customer_note = f"||TRANSPORT_LOCATIONS:{transport_json}"
    
    # Validate event schedule availability if event_schedule_id is provided
    event_schedule_id = getattr(payload, 'event_schedule_id', None)
    event_definition_id = getattr(payload, 'event_definition_id', None)
    
    if EVENT_TICKETING_ENABLED and event_schedule_id:
        try:
            schedule_result = await session.execute(
                select(EventSchedule).where(EventSchedule.id == event_schedule_id)
            )
            schedule = schedule_result.scalar_one_or_none()
            
            if schedule:
                # Check ticket availability
                requested_tickets = payload.attendees or 1
                tickets_available = schedule.max_tickets - schedule.tickets_sold
                
                if schedule.status != 'scheduled':
                    raise HTTPException(status_code=400, detail=f"Event is {schedule.status}")
                
                if schedule.is_blocked:
                    raise HTTPException(status_code=400, detail="This time slot is blocked")
                
                if tickets_available < requested_tickets:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Only {tickets_available} tickets available"
                    )
                
                # Get the event_definition_id from the schedule
                event_definition_id = schedule.event_definition_id
        except HTTPException:
            raise
        except Exception as e:
            # Log but don't block if event tables don't exist yet
            import logging
            logging.warning(f"Event schedule check skipped: {e}")
            event_schedule_id = None
            event_definition_id = None
    
    booking_ref = "BK-" + uuid.uuid4().hex[:10].upper()
    b = Booking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        broker_id=broker_id,
        venue_id=space.venue_id,
        space_id=space.id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        attendees=payload.attendees,
        status=booking_status,
        total_amount=total_amount,
        brokerage_amount=0.0,  # Will be calculated after items
        booking_type=booking_type,
        event_type=payload.event_type,
        customer_note=customer_note,
        is_admin_booking=is_admin_booking,
        admin_note=payload.admin_note,
        banner_image_url=payload.banner_image_url,
        stage_banner_url=payload.stage_banner_url,
    )
    
    # Add event ticketing fields if available (columns may not exist yet)
    try:
        if event_schedule_id:
            b.event_schedule_id = event_schedule_id
        if event_definition_id:
            b.event_definition_id = event_definition_id
    except Exception:
        pass  # Columns don't exist yet, ignore
    
    session.add(b)
    await session.flush()  # to get booking.id

    # add booking items
    items_total = 0.0
    for it in payload.items or []:
        stmt = select(Item).where(Item.id == it.item_id)
        rs = await session.execute(stmt)
        item = rs.scalars().first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {it.item_id} not found")
        unit = float(item.price)
        qty = int(it.quantity)
        
        # Calculate total including extra hours cost if applicable
        base_total = unit * qty
        extra_hours_cost = 0.0
        hours_used = getattr(it, 'hours_used', None)
        
        # If item has hour-based pricing and hours_used is provided
        if hours_used and item.base_hours_included and item.base_hours_included > 0 and item.rate_per_extra_hour:
            extra_hours = max(0, hours_used - item.base_hours_included)
            if extra_hours > 0:
                extra_hours_cost = float(extra_hours * item.rate_per_extra_hour * qty)
        
        total = base_total + extra_hours_cost
        
        bi = BookingItem(
            booking_id=b.id,
            item_id=item.id,
            vendor_id=item.vendor_id,
            quantity=qty,
            unit_price=unit,
            total_price=total,
            event_date=start_dt.date(),
            booking_status=b.status,
            is_supplied=False,
            hours_used=hours_used if hours_used else None,
        )
        session.add(bi)
        items_total += total

    # add custom items (by name/price) - create or reuse Item rows by name
    for ci in (payload.custom_items or []):
        name = (ci.name or '').strip()
        if not name:
            continue
        # Extract stage_banner_url from code if present (format: "stage_banner:URL")
        stage_banner_url = None
        item_code = ci.code or None
        if item_code and item_code.startswith('stage_banner:'):
            stage_banner_url = item_code.replace('stage_banner:', '')
            item_code = 'stage_banner'  # Use a consistent code for lookup
        
        # For transport items, use code 'transport' for consistent lookup
        # This allows transport items to be assigned to vendors later
        if item_code == 'transport':
            item_code = 'transport'
        
        # Try to find an existing catalog item by exact name match or by code for transport
        if item_code == 'transport':
            # Look for transport item by code in description or by name
            rs = await session.execute(
                select(Item).where(
                    (Item.name == name) | (Item.description == 'transport')
                )
            )
        else:
            rs = await session.execute(select(Item).where(Item.name == name))
        item = rs.scalars().first()
        if not item:
            # Create a simple catalog item (no vendor) so we can reference it
            # If it's a stage banner, store the URL in image_url
            # For transport, store 'transport' in description so it can be identified
            item = Item(
                name=name, 
                description=item_code or None, 
                price=float(ci.unit_price or 0.0),
                image_url=stage_banner_url if stage_banner_url else None
            )
            session.add(item)
            await session.flush()
        elif stage_banner_url and not item.image_url:
            # Update existing item with stage banner URL if not already set
            item.image_url = stage_banner_url
        elif item_code == 'transport' and not item.description:
            # Ensure transport items have description set
            item.description = 'transport'
        unit = float(ci.unit_price or 0.0)
        qty = int(ci.quantity or 1)
        if qty <= 0:
            qty = 1
        total = unit * qty
        # For transport items, vendor_id starts as None but can be assigned later via admin
        bi = BookingItem(
            booking_id=b.id,
            item_id=item.id,
            vendor_id=item.vendor_id,  # Will be None for transport, can be assigned later
            quantity=qty,
            unit_price=unit,
            total_price=total,
            event_date=start_dt.date(),
            booking_status=b.status,
            is_supplied=False,
        )
        session.add(bi)
        items_total += total

    b.total_amount = float(b.total_amount) + items_total

    # Ensure offers/discounts do not affect Live Show bookings
    # If event_type indicates a live show, reset any applied offer-related fields and keep total unchanged
    try:
        if (b.event_type or '').lower().strip().startswith('live') or booking_type == 'live-':
            # Normalize any discount fields on booking (if present) to zero
            if hasattr(b, 'discount_amount') and b.discount_amount:
                b.discount_amount = 0.0
            # Also ensure items keep their calculated totals without additional offer reductions
            # (BookingItem totals were already computed above and persisted)
            pass
    except Exception:
        # Non-blocking: if schema lacks discount fields, ignore
        pass
    
    # Calculate brokerage if user is a broker
    if broker_id:
        from app.models import BrokerProfile
        rs_broker = await session.execute(
            select(BrokerProfile).where(BrokerProfile.id == broker_id)
        )
        broker_profile = rs_broker.scalars().first()
        if broker_profile:
            brokerage_percentage = float(getattr(broker_profile, 'brokerage_percentage', 0.0))
            if brokerage_percentage > 0:
                b.brokerage_amount = float(b.total_amount) * (brokerage_percentage / 100.0)
    
    # Participant entries for live shows are created only after successful payment verification.
    # Avoid creating participants at booking time to prevent unauthorized entries.
    
    # Save guest list if provided
    if payload.guest_list:
        try:
            from app.models_booking_guests import BookingGuest
            for guest_data in payload.guest_list:
                # Validate mobile number (should be 10 digits)
                mobile_cleaned = ''.join(filter(str.isdigit, guest_data.mobile))[:10]
                if len(mobile_cleaned) != 10:
                    continue  # Skip invalid mobile numbers
                
                guest = BookingGuest(
                    booking_id=b.id,
                    name=guest_data.name.strip(),
                    mobile=mobile_cleaned,
                    pickup_location=guest_data.pickupLocation or payload.default_pickup_location or None,
                    needs_transportation=guest_data.needsTransportation,
                )
                session.add(guest)
            print(f"[BOOKING] Added {len(payload.guest_list)} guests to booking {b.id}")
        except Exception as guest_error:
            print(f"[BOOKING] Warning: Error saving guest list (non-blocking): {guest_error}")
            import traceback
            traceback.print_exc()
            # Don't fail booking creation if guest list save fails
    
    # Commit everything in a single transaction
    try:
        await session.commit()
        await session.refresh(b)
    except Exception as commit_error:
        await session.rollback()
        print(f"[BOOKING] Error committing booking: {commit_error}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create booking: {str(commit_error)}")

    try:
        await ClientNotificationService.notify_booking_created(session, b)
    except Exception as exc:
        print(f"[CLIENT NOTIF] create booking notification failed: {exc}")

    # DISABLED: WhatsApp notification to prevent API blocking
    # Notifications will be sent via a separate job queue or scheduled task
    # This ensures booking API responses are always immediate
    # TODO: Re-implement notifications via separate job queue (Celery/RQ) or scheduled task
    pass

    # Vendor in-app notifications for items belonging to them
    try:
        stmt_vendor_items = (
            select(BookingItem, Item, VendorProfile, User)
            .join(Item, Item.id == BookingItem.item_id)
            .join(VendorProfile, VendorProfile.id == BookingItem.vendor_id)
            .join(User, User.id == VendorProfile.user_id)
            .where(BookingItem.booking_id == b.id, BookingItem.vendor_id.isnot(None))
        )
        rs_vi = await session.execute(stmt_vendor_items)
        rows = rs_vi.all()
        if rows:
            from collections import defaultdict
            vendor_items_map: dict[int, list[tuple[BookingItem, Item]]] = defaultdict(list)
            for bi, it, vp, vu in rows:
                vendor_items_map[vu.id].append((bi, it))
            for vu_id, pairs in vendor_items_map.items():
                lines = []
                total_value = 0.0
                for bi, it in pairs:
                    lines.append(f"{bi.quantity} x {it.name} (₹{int(bi.unit_price)})")
                    total_value += float(bi.total_price or (bi.unit_price * bi.quantity))
                summary = f"New order items for booking {b.booking_reference}: " + ", ".join(lines) + f" | Total ₹{int(total_value)}"
                await NotificationService._create_in_app_notification(
                    user_id=vu_id,
                    title="New Order Items",
                    message=summary,
                    booking_id=b.id,
                    session=session,
                )
    except Exception as e:
        print(f"[BOOKING] Vendor notification error (non-blocking): {e}")

    return b


@router.get('/bookings')
async def list_my_bookings(
    status: Optional[str] = None,
    from_date: Optional[str] = Query(default=None, description="Filter bookings with start_datetime >= this (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="Filter bookings with start_datetime <= this (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    session: AsyncSession = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    """List bookings for the current authenticated user only.
    
    Query parameters:
    - status: Optional filter by status (pending, approved, completed, cancelled, rejected)
             If not provided, returns all bookings except cancelled (for backward compatibility)
    - from_date: Optional filter by start date (YYYY-MM-DD format)
    - to_date: Optional filter by end date (YYYY-MM-DD format)
    - page: Page number (default: 1)
    - page_size: Items per page (default: 50, max: 100)
    """
    # Only include bookings owned by the current user
    base_stmt = select(Booking).where(
        Booking.user_id == current_user.id
    )
    
    # Apply status filter if provided
    if status:
        status_lower = status.lower()
        if status_lower == 'all':
            # Include all statuses including cancelled
            pass  # No status filter
        elif status_lower == 'approved':
            base_stmt = base_stmt.where(Booking.status.in_(['approved', 'confirm', 'confirmed']))
        elif status_lower == 'pending':
            base_stmt = base_stmt.where(Booking.status == 'pending')
        elif status_lower == 'completed':
            base_stmt = base_stmt.where(Booking.status.in_(['completed', 'finished']))
        elif status_lower == 'cancelled':
            base_stmt = base_stmt.where(Booking.status == 'cancelled')
        elif status_lower == 'rejected':
            base_stmt = base_stmt.where(Booking.status == 'rejected')
        else:
            # Invalid status, default to excluding cancelled
            base_stmt = base_stmt.where(Booking.status != 'cancelled')
    else:
        # Default behavior: exclude cancelled bookings (for backward compatibility)
        base_stmt = base_stmt.where(Booking.status != 'cancelled')
    
    # Apply date filters if provided
    if from_date:
        try:
            from_dt = datetime.strptime(from_date, '%Y-%m-%d').date()
            base_stmt = base_stmt.where(func.date(Booking.start_datetime) >= from_dt)
        except ValueError:
            pass  # Invalid date format, ignore
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, '%Y-%m-%d').date()
            base_stmt = base_stmt.where(func.date(Booking.start_datetime) <= to_dt)
        except ValueError:
            pass  # Invalid date format, ignore
    
    # Get total count for pagination (before applying limit/offset)
    count_stmt = select(func.count(Booking.id)).select_from(base_stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    stmt = base_stmt.order_by(Booking.start_datetime.desc()).offset(offset).limit(page_size)
    rs = await session.execute(stmt)
    rows = rs.scalars().all()
    
    # Log for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[BOOKINGS] Query returned {len(rows)} bookings for user {current_user.id} with status filter: {status}")
    
    # Get all booking IDs for batch fetching refunds and cancellation events
    booking_ids = [b.id for b in rows]
    
    # Batch fetch booking items for all bookings
    items_map = {}
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
            if booking_item.booking_id not in items_map:
                items_map[booking_item.booking_id] = []
            items_map[booking_item.booking_id].append({
                'id': booking_item.id,
                'item_id': item.id,
                'item_name': item.name,
                'item_description': item.description,
                'quantity': booking_item.quantity,
                'unit_price': float(booking_item.unit_price),
                'total_price': float(booking_item.total_price),
                'is_supplied': booking_item.is_supplied,
            })
    
    # Batch fetch refunds for all bookings
    refunds_map = {}
    if booking_ids:
        stmt_refunds = select(Refund).where(Refund.booking_id.in_(booking_ids)).order_by(Refund.created_at.desc())
        rs_refunds = await session.execute(stmt_refunds)
        refunds = rs_refunds.scalars().all()
        for refund in refunds:
            if refund.booking_id not in refunds_map:  # Only keep the latest refund per booking
                refunds_map[refund.booking_id] = {
                    'id': refund.id,
                    'amount': float(refund.amount),
                    'status': refund.status,
                    'refund_type': refund.refund_type,
                    'reason': refund.reason,
                    'notes': refund.notes,
                    'created_at': refund.created_at.isoformat(),
                    'processed_at': refund.processed_at.isoformat() if refund.processed_at else None,
                }
    
    # Batch fetch cancellation events for all bookings
    cancellation_times_map = {}
    if booking_ids:
        stmt_events = select(BookingEvent).where(
            BookingEvent.booking_id.in_(booking_ids),
            BookingEvent.to_status == 'cancelled'
        ).order_by(BookingEvent.created_at.desc())
        rs_events = await session.execute(stmt_events)
        events = rs_events.scalars().all()
        for event in events:
            if event.booking_id not in cancellation_times_map:  # Only keep the latest cancellation event per booking
                cancellation_times_map[event.booking_id] = event.created_at.isoformat()
    
    # Serialize bookings to ensure proper JSON response
    # This prevents any potential issues with ORM object serialization
    # Note: Query already filters by user_id == current_user.id, so all bookings here belong to the user
    result = []
    skipped_count = 0
    for booking in rows:
        # Double-check ownership (should never fail since query filters by user_id, but safety check)
        if booking.user_id != current_user.id:
            skipped_count += 1
            logger.warning(f"[BOOKINGS] Skipping booking {booking.id} - user_id mismatch (expected {current_user.id}, got {booking.user_id})")
            continue
        
        booking_dict = {
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'series_reference': getattr(booking, 'series_reference', None),
            'broker_id': getattr(booking, 'broker_id', None),
            'brokerage_amount': float(getattr(booking, 'brokerage_amount', 0.0)),
            'user_id': booking.user_id,
            'venue_id': booking.venue_id,
            'space_id': booking.space_id,
            'start_datetime': booking.start_datetime.isoformat() if booking.start_datetime else None,
            'end_datetime': booking.end_datetime.isoformat() if booking.end_datetime else None,
            'attendees': booking.attendees,
            'status': booking.status,
            'total_amount': float(booking.total_amount),
            'booking_type': getattr(booking, 'booking_type', None),
            'event_type': booking.event_type,
            'customer_note': booking.customer_note,
            'admin_note': booking.admin_note,
            'is_admin_booking': getattr(booking, 'is_admin_booking', False),
            'banner_image_url': getattr(booking, 'banner_image_url', None),
            'stage_banner_url': getattr(booking, 'stage_banner_url', None),
            'created_at': booking.created_at.isoformat() if hasattr(booking, 'created_at') and booking.created_at else None,
            'items': items_map.get(booking.id, []),  # Add booking items (add-ons)
        }
        
        # Add refund and cancellation info if booking is cancelled
        if booking.status == 'cancelled':
            if booking.id in refunds_map:
                booking_dict['refund'] = refunds_map[booking.id]
            if booking.id in cancellation_times_map:
                booking_dict['cancellation_time'] = cancellation_times_map[booking.id]
        
        result.append(booking_dict)
    
    # Also fetch rack orders for the current user
    from ..models_rack import RackOrder
    rack_orders_stmt = select(RackOrder).where(RackOrder.user_id == current_user.id)
    if status:
        status_lower = status.lower()
        if status_lower == 'cancelled':
            rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'cancelled')
        elif status_lower == 'pending':
            rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'pending')
        elif status_lower == 'approved' or status_lower == 'confirmed':
            rack_orders_stmt = rack_orders_stmt.where(RackOrder.status.in_(['confirmed', 'shipped', 'delivered']))
        elif status_lower == 'completed':
            rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'delivered')
        elif status_lower != 'all':
            # For other statuses, exclude cancelled
            rack_orders_stmt = rack_orders_stmt.where(RackOrder.status != 'cancelled')
    else:
        # Default: exclude cancelled
        rack_orders_stmt = rack_orders_stmt.where(RackOrder.status != 'cancelled')
    
    rack_orders_stmt = rack_orders_stmt.order_by(RackOrder.created_at.desc())
    rack_orders_rs = await session.execute(rack_orders_stmt)
    rack_orders = rack_orders_rs.scalars().all()
    
    # Get surprise gift info for rack orders
    for rack_order in rack_orders:
        surprise_gift_name = None
        surprise_gift_image_url = None
        if rack_order.applied_offer_id:
            from ..models import Offer
            offer_result = await session.execute(
                select(Offer).where(Offer.id == rack_order.applied_offer_id)
            )
            offer = offer_result.scalar_one_or_none()
            if offer:
                surprise_gift_name = offer.surprise_gift_name
                surprise_gift_image_url = offer.surprise_gift_image_url
        
        # Convert rack order to booking-like format
        rack_order_dict = {
            'id': f"rack_order_{rack_order.id}",  # Prefix to avoid conflicts
            'booking_reference': rack_order.order_reference,
            'series_reference': None,
            'broker_id': None,
            'brokerage_amount': 0.0,
            'user_id': rack_order.user_id,
            'venue_id': None,
            'space_id': None,
            'start_datetime': rack_order.created_at.isoformat() if rack_order.created_at else None,
            'end_datetime': None,
            'attendees': None,
            'status': rack_order.status,
            'total_amount': float(rack_order.total_amount),
            'booking_type': 'rack_order',
            'event_type': 'Rack Order',
            'customer_note': None,
            'admin_note': None,
            'is_admin_booking': False,
            'banner_image_url': None,
            'stage_banner_url': None,
            'created_at': rack_order.created_at.isoformat() if rack_order.created_at else None,
            # Rack order specific fields
            'rack_order_id': rack_order.id,
            'rack_order_items': rack_order.items_json,
            'discount_amount': float(rack_order.discount_amount or 0.0),
            'original_amount': float(rack_order.original_amount or rack_order.total_amount),
            'delivery_address': rack_order.delivery_address,
            'recipient_name': rack_order.recipient_name,
            'recipient_mobile': rack_order.recipient_mobile,
            'pin_code': rack_order.pin_code,
            'city': rack_order.city,
            'state': rack_order.state,
            'surprise_gift_name': surprise_gift_name,
            'surprise_gift_image_url': surprise_gift_image_url,
            'is_surprise_gift': rack_order.is_surprise_gift,
        }
        result.append(rack_order_dict)
    
    # Log final result
    logger.info(f"[BOOKINGS] Returning {len(result)} bookings for user {current_user.id} (skipped {skipped_count} non-owned bookings, {len(rack_orders)} rack orders)")
    
    # Add pagination metadata (include rack orders in total count)
    total_with_rack_orders = total + len(rack_orders)
    total_pages = (total_with_rack_orders + page_size - 1) // page_size if total_with_rack_orders > 0 else 0
    
    return {
        "items": result,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total_with_rack_orders,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@router.get('/bookings/today')
async def get_todays_bookings(session: AsyncSession = Depends(get_session)):
    """Get all bookings for today - public endpoint"""
    # Use local timezone for today's date calculation
    from datetime import time
    today = date.today()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    
    # Include any booking that overlaps today (start <= end_of_day AND end >= start_of_day)
    # and limit to relevant statuses. Do not exclude 'daily' types, so daily programs show up.
    stmt = (
        select(
            Booking,
            Space.name.label('space_name'),
            User.first_name,
            User.last_name,
            User.mobile
        )
        .join(Space, Booking.space_id == Space.id)
        .join(User, Booking.user_id == User.id)
        .where(
            Booking.start_datetime <= today_end,
            Booking.end_datetime >= today_start,
            Booking.status.in_(["pending", "approved", "confirmed", "completed"]) 
        )
        .order_by(Booking.start_datetime.asc())
    )
    
    result = await session.execute(stmt)
    rows = result.all()
    
    events = []
    for booking, space_name, first_name, last_name, mobile in rows:
        # Format time for display
        start_time = booking.start_datetime.strftime("%H:%M:%S")
        end_time = booking.end_datetime.strftime("%H:%M:%S")
        
        # Combine first and last name
        user_name = f"{first_name or ''} {last_name or ''}".strip()
        if not user_name:
            user_name = "Anonymous"
        
        events.append({
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'event_name': booking.event_type or 'Event',
            'space_name': space_name,
            'space_id': booking.space_id,
            'start_time': start_time,
            'end_time': end_time,
            'attendees': booking.attendees or 0,
            'status': booking.status,
            'total_amount': float(booking.total_amount),
            'user_name': user_name,
            'user_phone': mobile or '',
            'space_features': None,
            'event_type': booking.event_type or 'General Event',
            'is_admin_booking': booking.is_admin_booking or False,
            'admin_note': booking.admin_note
        })
    
    return {
        'date': today.isoformat(),
        'events': events,
        'total_events': len(events)
    }


@router.get('/bookings/regular-programs')
async def get_regular_programs(
    include_past: bool = Query(False, description="Include programs whose end time is in the past"),
    booking_type: Optional[str] = Query(None, description="Filter by booking_type, e.g., 'live-'"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    session: AsyncSession = Depends(get_session),
):
    """Get regular programs.

    Per request: do not filter by is_admin_booking or status. By default, only upcoming/ongoing
    programs are returned (end_datetime >= now). Use include_past=true to include past programs too.
    
    Now includes pagination to prevent memory issues with large datasets.
    """
    now = datetime.now()

    base_stmt = (
        select(Booking, Space.name.label('space_name'))
        .join(Space, Booking.space_id == Space.id)
    )

    if not include_past:
        base_stmt = base_stmt.where(Booking.end_datetime >= now)
    if booking_type:
        # Filter by booking_type, but also include admin bookings with NULL booking_type for backward compatibility
        if booking_type.strip().lower() == 'live-':
            # For live shows, include bookings with booking_type='live-' OR (is_admin_booking=True AND booking_type IS NULL AND space_id=1)
            base_stmt = base_stmt.where(
                or_(
                    Booking.booking_type == booking_type,
                    and_(
                        Booking.is_admin_booking == True,
                        Booking.booking_type.is_(None),
                        Booking.space_id == 1  # Live show space
                    )
                )
            )
        else:
            base_stmt = base_stmt.where(Booking.booking_type == booking_type)
    
    # Get total count for pagination
    count_stmt = select(func.count(Booking.id)).select_from(base_stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    stmt = base_stmt.order_by(Booking.start_datetime.asc()).offset(offset).limit(page_size)
    result = await session.execute(stmt)
    rows = result.all()

    items = []
    # Helper: group rows by series_reference (fallbacks to unique key)
    def add_item(bk: Booking, sp_name: str):
        items.append({
            'id': bk.id,
            'title': bk.event_type or 'Program',
            'event_type': bk.event_type,
            'booking_type': getattr(bk, 'booking_type', None),
            'start_datetime': bk.start_datetime.isoformat(),
            'end_datetime': bk.end_datetime.isoformat(),
            'space_id': bk.space_id,
            'space_name': sp_name,
            'status': bk.status,
            'series_reference': getattr(bk, 'series_reference', None),
            'trainer': 'Coach',
            'banner_image_url': getattr(bk, 'banner_image_url', None),
            'customer_note': getattr(bk, 'customer_note', None),
            'attendees': getattr(bk, 'attendees', None),
        })

    # When explicitly filtering live-, return all matching rows (no dedupe)
    if booking_type and booking_type.strip().lower() == 'live-':
        for booking, space_name in rows:
            add_item(booking, space_name)
    else:
        # Dedupe by series_reference: prefer a booking that occurs today; otherwise pick earliest upcoming in the group
        today = date.today()
        groups: dict[str, list[tuple[Booking, str]]] = {}
        for booking, space_name in rows:
            key = getattr(booking, 'series_reference', None) or booking.booking_reference or str(booking.id)
            groups.setdefault(key, []).append((booking, space_name))

        for key, group in groups.items():
            # Prefer items that start today
            today_candidates = [g for g in group if g[0].start_datetime.date() == today]
            if today_candidates:
                # Choose the earliest time among today's candidates
                chosen_booking, chosen_space_name = sorted(today_candidates, key=lambda x: x[0].start_datetime)[0]
                add_item(chosen_booking, chosen_space_name)
                continue
            # Otherwise pick the earliest upcoming in this group (rows are already filtered/sorted globally)
            chosen_booking, chosen_space_name = sorted(group, key=lambda x: x[0].start_datetime)[0]
            add_item(chosen_booking, chosen_space_name)
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    return {
        'items': items,
        'count': len(items),
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }


@router.get('/bookings/public/{booking_id}')
async def get_public_booking(booking_id: int, session: AsyncSession = Depends(get_session)):
    """Public booking details for displaying on landing/booking pages.

    Returns booking core fields and associated space/venue info including base pricing,
    plus any optional pricing overrides if available on the space model.
    """
    stmt = (
        select(Booking, Space.name.label('space_name'), Venue.name.label('venue_name'))
        .join(Space, Booking.space_id == Space.id)
        .join(Venue, Booking.venue_id == Venue.id)
        .where(Booking.id == booking_id)
    )
    rs = await session.execute(stmt)
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Booking not found')

    booking, space_name, venue_name = row

    # Safely fetch optional attributes that may not exist on Space model in all deployments
    # We'll query Space again to access all attributes directly
    rs2 = await session.execute(select(Space).where(Space.id == booking.space_id))
    space = rs2.scalars().first()

    def safe_get(obj, attr, default=None):
        try:
            return getattr(obj, attr)
        except Exception:
            return default

    price_per_hour = float(safe_get(space, 'price_per_hour', 0.0) or 0.0)
    pricing_overrides = safe_get(space, 'pricing_overrides', None)
    stage_options = safe_get(space, 'stage_options', None)
    banner_sizes = safe_get(space, 'banner_sizes', None)
    event_types = safe_get(space, 'event_types', None)

    return {
        'id': booking.id,
        'booking_reference': booking.booking_reference,
        'event_type': booking.event_type,
        'booking_type': getattr(booking, 'booking_type', None),
        'customer_note': booking.customer_note,
        'start_datetime': booking.start_datetime.isoformat(),
        'end_datetime': booking.end_datetime.isoformat(),
        'space_id': booking.space_id,
        'venue_id': booking.venue_id,
        'space_name': space_name,
        'venue_name': venue_name,
        'status': booking.status,
        'banner_image_url': getattr(booking, 'banner_image_url', None),
        'stage_banner_url': getattr(booking, 'stage_banner_url', None),
        'base_pricing': {
            'price_per_hour': price_per_hour,
        },
        'pricing_overrides': pricing_overrides,
        'stage_options': stage_options,
        'banner_sizes': banner_sizes,
        'event_types': event_types,
    }


@router.post('/bookings/price-quote')
async def get_price_quote(
    payload: dict,
    session: AsyncSession = Depends(get_session),
):
    """Compute a price quote based on space base rate and optional selections.

    Expects JSON payload with:
      - space_id: int
      - start_datetime: ISO string
      - end_datetime: ISO string
      - guests: optional int
      - selected_addons: [{ price: number, quantity: number }]
      - selected_stage: { price: number } optional
      - selected_banner: { price: number } optional
    Returns:
      - duration_hours, base_amount, addons_amount, stage_amount, banner_amount, total_amount
    """
    try:
        space_id = int(payload.get('space_id'))
        start_dt = _parse_iso_to_utc_naive(str(payload.get('start_datetime')))
        end_dt = _parse_iso_to_utc_naive(str(payload.get('end_datetime')))
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid payload: space_id/start_datetime/end_datetime')

    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail='Invalid time range')

    # Fetch space pricing
    rs = await session.execute(select(Space).where(Space.id == space_id))
    space = rs.scalars().first()
    if not space:
        raise HTTPException(status_code=404, detail='Space not found')

    price_per_hour = float(getattr(space, 'price_per_hour', 0.0) or 0.0)
    duration_hours = max(0.0, (end_dt - start_dt).total_seconds() / 3600.0)
    
    # Check if this is a program booking (yoga, zumba, etc.) - set base amount to 0
    event_type = payload.get('event_type', '')
    event_type_lower = (event_type or '').lower()
    is_program = event_type_lower in ['yoga', 'zumba']
    
    if is_program:
        base_amount = 0.0
    else:
        base_amount = float(duration_hours * price_per_hour)

    # Addons and overrides
    addons = payload.get('selected_addons') or []
    addons_amount = 0.0
    for a in addons:
        try:
            qty = int(a.get('quantity') or 1)
            price = float(a.get('price') or 0.0)
            addons_amount += max(0.0, qty * price)
        except Exception:
            continue

    stage_amount = 0.0
    st = payload.get('selected_stage') or {}
    try:
        stage_amount = float(st.get('price') or 0.0)
    except Exception:
        stage_amount = 0.0

    banner_amount = 0.0
    bn = payload.get('selected_banner') or {}
    try:
        banner_amount = float(bn.get('price') or 0.0)
    except Exception:
        banner_amount = 0.0

    # For programs, total amount is 0 regardless of addons/stage/banner
    if is_program:
        total_amount = 0.0
    else:
        total_amount = float(base_amount + addons_amount + stage_amount + banner_amount)

    return {
        'space_id': space_id,
        'duration_hours': round(duration_hours, 2),
        'price_per_hour': price_per_hour,
        'base_amount': round(base_amount, 2),
        'addons_amount': round(addons_amount, 2),
        'stage_amount': round(stage_amount, 2),
        'banner_amount': round(banner_amount, 2),
        'total_amount': round(total_amount, 2),
    }


@router.get('/bookings/conflicts')
async def detect_conflicts(
    space_id: int,
    start_datetime: str,
    end_datetime: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Utility endpoint to diagnose overlapping bookings for a given time range.
    Returns the list of bookings on the same space that overlap with the provided interval.
    """
    try:
        start_dt = _parse_iso_to_utc_naive(start_datetime)
        end_dt = _parse_iso_to_utc_naive(end_datetime)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid start_datetime or end_datetime')

    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail='Invalid time range')

    rs = await session.execute(
        select(Booking).where(
            Booking.space_id == space_id,
            Booking.status.in_(["pending","approved","confirmed"]),
            not_(
                or_(
                    Booking.end_datetime <= start_dt,
                    Booking.start_datetime >= end_dt,
                )
            )
        ).order_by(Booking.start_datetime.asc())
    )
    conflicts = rs.scalars().all()
    return [
        {
            'id': b.id,
            'booking_reference': b.booking_reference,
            'start_datetime': b.start_datetime.isoformat(),
            'end_datetime': b.end_datetime.isoformat(),
            'status': b.status,
        }
        for b in conflicts
    ]


@router.get('/bookings/search-locations')
async def search_locations(q: str = Query(..., min_length=2)):
    """
    Search for locations using Google Places API.
    Backend proxy to avoid CORS/rate-limit issues with direct frontend calls.
    Public endpoint - no authentication required.
    """
    import httpx
    import logging
    
    logger = logging.getLogger(__name__)
    GOOGLE_PLACES_API_KEY = settings.GOOGLE_PLACES_API_KEY or ""
    
    # If no API key, return empty results (will fallback to Nominatim in frontend if needed)
    if not GOOGLE_PLACES_API_KEY:
        logger.warning("Google Places API key not configured")
        return {'results': [], 'error': 'Google Places API key not configured'}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Use Google Places Autocomplete API
            url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
            params = {
                'input': q,
                'key': GOOGLE_PLACES_API_KEY,
                'components': 'country:in',  # Restrict to India
                'types': 'geocode|establishment',  # Allow both addresses and places
            }
            
            response = await client.get(url, params=params)
            
            if response.status_code != 200:
                logger.warning(f"Google Places API returned {response.status_code}")
                return {'results': []}
            
            data = response.json()
            
            # Handle REQUEST_DENIED and other error statuses
            if data.get('status') not in ['OK', 'ZERO_RESULTS']:
                error_status = data.get('status')
                logger.warning(f"Google Places API status: {error_status}")
                if error_status == 'REQUEST_DENIED':
                    logger.warning("Google Places API key may be invalid or missing required permissions. Please check Google Cloud Console.")
                return {'results': [], 'error': f'Google Places API error: {error_status}'}
            
            predictions = data.get('predictions', [])
            
            if not predictions:
                return {'results': []}
            
            # Transform results to match expected format
            suggestions = []
            for i, prediction in enumerate(predictions[:5]):  # Limit to 5 results
                structured = prediction.get('structured_formatting', {})
                suggestions.append({
                    'id': f"location_{i}",
                    'description': prediction.get('description', ''),
                    'place_id': prediction.get('place_id', ''),
                    'structured_formatting': {
                        'main_text': structured.get('main_text', ''),
                        'secondary_text': structured.get('secondary_text', '')
                    },
                    'address': prediction.get('description', ''),
                    'type': 'place'
                })
            
            return {'results': suggestions}
            
    except Exception as e:
        logger.error(f"Location search error: {str(e)}")
        return {'results': [], 'error': str(e)}


@router.get('/bookings/{booking_id}')
async def get_booking(booking_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Get booking details for the current user.
    
    Also allows access to public admin bookings (live shows and regular programs) that are visible to all users.
    """
    # Include: bookings owned by user OR public admin bookings (live shows, regular programs)
    stmt = (
        select(Booking, Space, Venue)
        .join(Space, Booking.space_id == Space.id)
        .join(Venue, Booking.venue_id == Venue.id)
        .where(
            Booking.id == booking_id,
            or_(
                Booking.user_id == current_user.id,
                and_(
                    Booking.is_admin_booking == True,
                    or_(
                        Booking.booking_type.in_(['live-', 'daily', 'one_day']),
                        Booking.booking_type.is_(None)  # Include admin bookings even if booking_type is NULL
                    )
                )
            )
        )
    )
    rs = await session.execute(stmt)
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    booking, space, venue = row
    
    # Get broker info if booking has a broker
    broker_info = None
    if getattr(booking, 'broker_id', None):
        from app.models import BrokerProfile, User as BrokerUser
        stmt_broker = (
            select(BrokerProfile, BrokerUser)
            .join(BrokerUser, BrokerUser.id == BrokerProfile.user_id)
            .where(BrokerProfile.id == booking.broker_id)
        )
        rs_broker = await session.execute(stmt_broker)
        broker_row = rs_broker.first()
        if broker_row:
            bp, bu = broker_row
            broker_info = {
                'id': bp.id,
                'username': bu.username,
                'company_name': bp.company_name,
                'brokerage_percentage': float(getattr(bp, 'brokerage_percentage', 0.0)),
            }
    
    # Get booking items - use explicit column selection to avoid performance_team_profile column issue
    stmt_items = text("""
        SELECT 
            bi.id, bi.booking_id, bi.item_id, bi.quantity, 
            bi.unit_price, bi.total_price,
            i.id as item_id, i.name as item_name, i.image_url
        FROM booking_items bi
        INNER JOIN items i ON bi.item_id = i.id
        WHERE bi.booking_id = :booking_id
    """)
    rs_items = await session.execute(stmt_items, {'booking_id': booking_id})
    items_rows = rs_items.all()
    
    items = []
    for row in items_rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        items.append({
            'id': row_dict.get('id'),
            'item_id': row_dict.get('item_id'),
            'item_name': row_dict.get('item_name'),
            'quantity': row_dict.get('quantity'),
            'unit_price': float(row_dict.get('unit_price', 0)),
            'total_price': float(row_dict.get('total_price', 0)),
            'image_url': row_dict.get('image_url'),
        })
    
    # Calculate paid amount from payments
    from app.models import Payment
    stmt_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status == 'success'
    )
    rs_payments = await session.execute(stmt_payments)
    paid_amount = float(rs_payments.scalar() or 0.0)
    
    # Get refund information if booking is cancelled
    refund_info = None
    if booking.status == 'cancelled':
        stmt_refunds = select(Refund).where(Refund.booking_id == booking_id).order_by(Refund.created_at.desc())
        rs_refunds = await session.execute(stmt_refunds)
        refund = rs_refunds.scalars().first()
        if refund:
            refund_info = {
                'id': refund.id,
                'amount': float(refund.amount),
                'status': refund.status,
                'refund_type': refund.refund_type,
                'reason': refund.reason,
                'notes': refund.notes,
                'created_at': refund.created_at.isoformat(),
                'processed_at': refund.processed_at.isoformat() if refund.processed_at else None,
            }
    
    # Get cancellation event to find cancellation time
    cancellation_time = None
    if booking.status == 'cancelled':
        stmt_events = select(BookingEvent).where(
            BookingEvent.booking_id == booking_id,
            BookingEvent.to_status == 'cancelled'
        ).order_by(BookingEvent.created_at.desc())
        rs_events = await session.execute(stmt_events)
        cancel_event = rs_events.scalars().first()
        if cancel_event:
            cancellation_time = cancel_event.created_at.isoformat()
    
    return {
        'id': booking.id,
        'booking_reference': booking.booking_reference,
        'venue_id': booking.venue_id,
        'venue_name': venue.name,
        'space_id': booking.space_id,
        'space_name': space.name,
        'start_datetime': booking.start_datetime.isoformat(),
        'end_datetime': booking.end_datetime.isoformat(),
        'attendees': booking.attendees,
        'status': booking.status,
        'total_amount': float(booking.total_amount),
        'broker_id': getattr(booking, 'broker_id', None),
        'brokerage_amount': float(getattr(booking, 'brokerage_amount', 0.0)),
        'broker': broker_info,
        'paid_amount': paid_amount,
        'balance_amount': float(booking.total_amount) - paid_amount,
        'booking_type': getattr(booking, 'booking_type', None),
        'event_type': booking.event_type,
        'customer_note': booking.customer_note,
        'admin_note': booking.admin_note,
        'items': items,
        'price_per_hour': float(getattr(space, 'price_per_hour', 0.0) or 0.0),
        'refund': refund_info,
        'cancellation_time': cancellation_time,
    }


@router.get('/settings/refund-percentage')
async def get_refund_percentage(
    session: AsyncSession = Depends(get_session),
):
    """Get refund percentage setting (public endpoint for clients)"""
    try:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT value FROM admin_settings WHERE setting_key = 'refund_percentage' LIMIT 1")
        )
        row = result.first()
        if row:
            try:
                percentage = float(row[0])
                return {'percentage': percentage}
            except (ValueError, TypeError):
                return {'percentage': 40.0}
    except Exception as e:
        print(f"[Refund Percentage] Error getting setting: {e}")
    return {'percentage': 40.0}  # Default


@router.get('/bookings/{booking_id}/payment-history')
async def get_payment_history(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get payment and refund history for a booking."""
    # Get booking - admins can view any booking, users can only view their own
    if current_user.role == 'admin':
        rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    else:
        rs = await session.execute(select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id))
    booking = rs.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    # Get all payments for this booking
    from app.models import Payment
    stmt_payments = select(Payment).where(Payment.booking_id == booking_id).order_by(Payment.created_at.desc())
    rs_payments = await session.execute(stmt_payments)
    payments = rs_payments.scalars().all()
    
    # Get all refunds for this booking
    stmt_refunds = select(Refund).where(Refund.booking_id == booking_id).order_by(Refund.created_at.desc())
    rs_refunds = await session.execute(stmt_refunds)
    refunds = rs_refunds.scalars().all()
    
    # Serialize payments
    payments_list = []
    for payment in payments:
        payments_list.append({
            'id': payment.id,
            'amount': float(payment.amount),
            'currency': payment.currency or 'INR',
            'provider': payment.provider,
            'provider_payment_id': payment.provider_payment_id,
            'order_id': payment.order_id,
            'status': payment.status,
            'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
            'created_at': payment.created_at.isoformat(),
            'details': payment.details,
        })
    
    # Serialize refunds
    refunds_list = []
    for refund in refunds:
        refunds_list.append({
            'id': refund.id,
            'amount': float(refund.amount),
            'reason': refund.reason,
            'status': refund.status,
            'refund_type': refund.refund_type,
            'refund_method': refund.refund_method,
            'refund_reference': refund.refund_reference,
            'processed_at': refund.processed_at.isoformat() if refund.processed_at else None,
            'created_at': refund.created_at.isoformat(),
            'notes': refund.notes,
        })
    
    return {
        'payments': payments_list,
        'refunds': refunds_list,
        'total_paid': sum(p['amount'] for p in payments_list if p['status'] == 'success'),
        'total_refunded': sum(r['amount'] for r in refunds_list if r['status'] == 'completed'),
        'pending_refunds': sum(r['amount'] for r in refunds_list if r['status'] in ['pending', 'processing']),
    }


@router.get('/bookings/{booking_id}/invoice')
async def download_booking_invoice(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Download booking invoice as PDF.
    
    - For pending bookings: Simple invoice
    - For confirmed/approved bookings: Tax invoice with all details and totals
    Uses the same professional letterhead as admin invoices.
    - Uses saved invoice edits if available
    """
    try:
        # First verify access
        stmt = (
            select(Booking)
            .where(
                Booking.id == booking_id,
                or_(
                    Booking.user_id == current_user.id,
                    and_(
                        Booking.is_admin_booking == True,
                        or_(
                            Booking.booking_type.in_(['live-', 'daily', 'one_day']),
                            Booking.booking_type.is_(None)
                        )
                    )
                )
            )
        )
        rs = await session.execute(stmt)
        booking = rs.scalars().first()
        
        if not booking:
            raise HTTPException(status_code=404, detail='Booking not found or access denied')
        
        # Use invoice_helper to get invoice data (this will check for saved edits)
        from app.utils.invoice_helper import get_invoice_data
        invoice_data = await get_invoice_data(session, booking_id, custom_data=None, use_saved_edit=True)
        
        # Extract values from invoice_data
        items = invoice_data.get('items', [])
        paid_amount = invoice_data.get('paid_amount', 0.0)
        is_tax_invoice = invoice_data.get('is_tax_invoice', False)
        is_proforma_invoice = invoice_data.get('is_proforma_invoice', False)
        invoice_number = invoice_data.get('invoice_number', f"BK-{invoice_data.get('booking_reference', '')}")
        invoice_date = invoice_data.get('invoice_date', '')
        customer_name = invoice_data.get('customer', {}).get('name', '')
        customer_email = invoice_data.get('customer', {}).get('email', '')
        customer_phone = invoice_data.get('customer', {}).get('phone', '')
        subtotal = invoice_data.get('subtotal', 0.0)
        brokerage_amount = invoice_data.get('brokerage_amount', 0.0)
        gst_rate = invoice_data.get('gst_rate', 0.0)
        gst_amount = invoice_data.get('gst_amount', 0.0)
        total_amount = invoice_data.get('total_amount', 0.0)
        balance_due = invoice_data.get('balance_due', 0.0)
        notes = invoice_data.get('notes', '')
        
        # Get booking details for venue/space info
        from app.models import Space, Venue, User
        stmt_full = (
            select(Booking, User, Space, Venue)
            .join(User, User.id == Booking.user_id)
            .join(Space, Space.id == Booking.space_id)
            .join(Venue, Venue.id == Booking.venue_id)
            .where(Booking.id == booking_id)
        )
        rs_full = await session.execute(stmt_full)
        row_full = rs_full.first()
        if row_full:
            booking, user, space, venue = row_full
        else:
            raise HTTPException(status_code=404, detail='Booking details not found')
        
        # Generate PDF invoice - check if reportlab is available
        try:
            import reportlab
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail='PDF generation requires reportlab library. Please install it with: pip install reportlab'
            )
        
        # Import PDF generation libraries
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        from reportlab.lib.colors import HexColor
        import tempfile
        import os
        
        # Use temporary file instead of BytesIO to avoid loading entire PDF into memory
        # This allows streaming the PDF to the client
        temp_file = tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False)
        temp_path = temp_file.name
        temp_file.close()  # Close so reportlab can write to it
        
        # Company details - BRQ Associates (matching reference invoice)
        company_name = "BRQ ASSOCIATES"
        company_services = "Chartered Accountant Services"
        company_tagline = "Feel the Expertise"
        company_address = "Second Floor, City Complex, NH Road, Karandakkad, Kasaragod - 671121"
        company_phone = "04994 225 895, 896, 897, 898"
        company_mobile = "96 33 18 18 98"
        company_email = "brqgst@gmail.com"
        company_website = "www.brqassociates.in"
        
        # Find logo
        logo_path = None
        possible_logo_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'lebrq-logo.png'),
            os.path.join(os.path.dirname(__file__), '..', '..', '..', 'assets', 'images', 'lebrq-logo.png'),
            os.path.join(os.path.dirname(__file__), '..', '..', '..', 'images', 'lebrq-logo.png'),
        ]
        for path in possible_logo_paths:
            if os.path.exists(path):
                logo_path = path
                break
        
        # BRQ Letterhead Template (same as vendor invoice) - reuse from vendor_payments logic
        # For now, I'll create a simplified version. Full implementation would be in a separate helper
        # Import the letterhead logic from vendor_payments or create it here
        # Since it's complex, I'll create a simplified version that matches the style
        
        # Create PDF document in temporary file (adjusted margins for professional header design)
        doc = SimpleDocTemplate(
            temp_path,  # Use temp file path instead of buffer
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1.5*inch,  # Adjusted for structured header
            bottomMargin=0.4*inch  # Minimal footer
        )
        
        # Letterhead function (matching BRQ ASSOCIATES invoice style - professional layout)
        def add_letterhead(canvas, doc):
            canvas.saveState()
            page_width = letter[0]
            page_height = letter[1]
            left_margin = 0.5*inch
            right_margin = page_width - 0.5*inch
            
            # Header section - structured layout matching reference
            header_height = 1.3*inch
            canvas.setFillColor(colors.white)
            canvas.rect(0, page_height - header_height, page_width, header_height, fill=1, stroke=0)
            
            # Left column - Company info
            y_pos = page_height - 0.35*inch
            canvas.setFillColor(colors.black)
            
            # Company name (large, bold, left aligned)
            canvas.setFont("Helvetica-Bold", 20)
            canvas.drawString(left_margin, y_pos, company_name)
            y_pos -= 0.18*inch
            
            # Services line (below company name)
            canvas.setFont("Helvetica", 10)
            canvas.drawString(left_margin, y_pos, company_services)
            y_pos -= 0.15*inch
            
            # Tagline (below services)
            canvas.setFont("Helvetica", 9)
            canvas.drawString(left_margin, y_pos, company_tagline)
            
            # Right column - Contact info (right aligned, starting from top)
            canvas.setFont("Helvetica", 8)
            y_pos_right = page_height - 0.35*inch
            contact_info = [
                company_address,
                f"Phone: {company_phone}",
                f"Mobile: {company_mobile}",
                f"Email: {company_email}",
                f"Website: {company_website}"
            ]
            for info in contact_info:
                text_width = canvas.stringWidth(info, "Helvetica", 8)
                canvas.drawString(right_margin - text_width, y_pos_right, info)
                y_pos_right -= 0.12*inch
            
            # Bottom border line
            canvas.setFillColor(HexColor('#000000'))
            canvas.setLineWidth(1)
            canvas.line(left_margin, page_height - header_height, right_margin, page_height - header_height)
            
            # Footer section (minimal)
            footer_height = 0.3*inch
            canvas.setFillColor(colors.white)
            canvas.rect(0, 0, page_width, footer_height, fill=1, stroke=0)
            
            canvas.restoreState()
        
        story = []
        styles = getSampleStyleSheet()
        
        # Invoice title based on event completion
        invoice_title = "TAX INVOICE" if is_tax_invoice else ("PROFORMA INVOICE" if is_proforma_invoice else "INVOICE")
        
        invoice_title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontSize=22,
            textColor=colors.HexColor('#1a1f3a'),
            spaceAfter=8,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        )
        
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph(invoice_title, invoice_title_style))
        story.append(Spacer(1, 0.15*inch))
        
        # Invoice details (matching BRQ ASSOCIATES format - professional layout)
        invoice_number_str = invoice_number if invoice_number else f"{booking.id:05d}"
        # Parse invoice_date if it's a string, otherwise use current date
        try:
            if invoice_date:
                # Try to parse the invoice_date string (format: "Month DD, YYYY" or "DD-MM-YY")
                try:
                    parsed_date = datetime.strptime(invoice_date, '%B %d, %Y')
                except:
                    try:
                        parsed_date = datetime.strptime(invoice_date, '%d-%b-%y')
                    except:
                        parsed_date = datetime.utcnow()
                invoice_date_str = parsed_date.strftime('%d-%b-%y')
                invoice_month = parsed_date.strftime('%B %Y')
            else:
                invoice_date_obj = datetime.utcnow()
                invoice_date_str = invoice_date_obj.strftime('%d-%b-%y')
                invoice_month = invoice_date_obj.strftime('%B %Y')
        except:
            invoice_date_obj = datetime.utcnow()
            invoice_date_str = invoice_date_obj.strftime('%d-%b-%y')
            invoice_month = invoice_date_obj.strftime('%B %Y')
        
        # Invoice info in table format (matching reference - proper alignment)
        invoice_info_data = [
            ['Invoice No.', invoice_number_str, 'Invoice Date', invoice_date_str],
            ['Month', invoice_month, '', ''],
        ]
        invoice_info_table = Table(invoice_info_data, colWidths=[1.2*inch, 1.8*inch, 1.2*inch, 1.8*inch])
        invoice_info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'LEFT'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#111827')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#111827')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTNAME', (3, 0), (3, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0, colors.white),  # No visible grid, just for alignment
        ]))
        story.append(invoice_info_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Billed To section (matching reference format - simple and clean)
        # Use customer_name from invoice_data (may be from saved edit)
        user_name = customer_name if customer_name else (f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username)
        
        # Billed To in table format for better alignment (matching reference)
        billed_to_data = [
            ['Billed To:', user_name],
        ]
        if customer_phone and customer_phone != 'N/A':
            billed_to_data.append(['', customer_phone])
        elif user.mobile:
            billed_to_data.append(['', user.mobile])
        if customer_email:
            billed_to_data.append(['', customer_email])
        elif user.username:
            billed_to_data.append(['', user.username])
        
        billed_to_table = Table(billed_to_data, colWidths=[1.3*inch, 4.7*inch])
        billed_to_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('GRID', (0, 0), (-1, -1), 0, colors.white),  # No visible grid
        ]))
        story.append(billed_to_table)
        story.append(Spacer(1, 0.25*inch))
        
        # Items table (matching BRQ ASSOCIATES format - no rupee symbols, professional layout)
        items_data = [['Sl. No.', 'Product/Service Description', 'Qty.', 'Rate', 'Discount', 'Value', 'TOTAL']]
        
        sl_no = 1
        for item in items:
            discount = 0.0  # Default discount
            value = item['total_price'] - discount
            items_data.append([
                str(sl_no),
                item['name'],
                str(item['quantity']),
                f"{item['unit_price']:.2f}",
                f"{discount:.2f}",
                f"{value:.2f}",
                f"{value:.2f}"
            ])
            sl_no += 1
        
        # Calculate totals - use values from invoice_data (may be from saved edit)
        # subtotal, brokerage_amount, gst_rate, gst_amount, total_amount already extracted from invoice_data above
        
        # Add brokerage if exists as a separate line item
        if brokerage_amount > 0:
            items_data.append([
                str(sl_no),
                'Brokerage',
                '1',
                f"{brokerage_amount:.2f}",
                '0.00',
                f"{brokerage_amount:.2f}",
                f"{brokerage_amount:.2f}"
            ])
            sl_no += 1
        
        # Add GST row if applicable (use values from invoice_data)
        if is_tax_invoice and gst_amount > 0:
            items_data.append([
                '',
                f'GST ({gst_rate}%)',
                '',
                '',
                '',
                f"{gst_amount:.2f}",
                f"{gst_amount:.2f}"
            ])
        
        # Grand Total row (use total_amount from invoice_data)
        
        # Calculate column widths to fit page (6 inches usable width)
        total_width = 6*inch
        items_table = Table(items_data, colWidths=[
            0.5*inch,    # Sl. No.
            2.2*inch,    # Product/Service Description
            0.5*inch,    # Qty.
            0.7*inch,    # Rate
            0.7*inch,    # Discount
            0.7*inch,    # Value
            0.7*inch     # TOTAL
        ])
        items_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1f3a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            # Data rows
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -2), 6),
            ('TOPPADDING', (0, 1), (-1, -2), 6),
            # Grand Total row
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 11),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#111827')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F3F4F6')),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
            ('TOPPADDING', (0, -1), (-1, -1), 8),
            # Borders - proper grid lines
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#000000')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#000000')),  # Thicker line below header
            # Table formatting continues
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),   # Sl. No. - centered
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),     # Description - left
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),   # Qty. - centered
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),    # Rate - right
            ('ALIGN', (4, 0), (4, -1), 'RIGHT'),    # Discount - right
            ('ALIGN', (5, 0), (5, -1), 'RIGHT'),    # Value - right
            ('ALIGN', (6, 0), (6, -1), 'RIGHT'),    # TOTAL - right
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Amount in words
        def number_to_words(num):
            """Convert number to words (simplified version)"""
            ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                   'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
            tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
            
            if num == 0:
                return 'zero'
            
            def convert_hundreds(n):
                if n == 0:
                    return ''
                if n < 20:
                    return ones[n]
                if n < 100:
                    return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')
                if n < 1000:
                    return ones[n // 100] + ' hundred' + (' ' + convert_hundreds(n % 100) if n % 100 else '')
                if n < 100000:
                    return convert_hundreds(n // 1000) + ' thousand' + (' ' + convert_hundreds(n % 1000) if n % 1000 else '')
                if n < 10000000:
                    return convert_hundreds(n // 100000) + ' lakh' + (' ' + convert_hundreds(n % 100000) if n % 100000 else '')
                return convert_hundreds(n // 10000000) + ' crore' + (' ' + convert_hundreds(n % 10000000) if n % 10000000 else '')
            
            rupees = int(num)
            paise = int((num - rupees) * 100)
            
            result = convert_hundreds(rupees).title() + ' Rupees'
            if paise > 0:
                result += ' and ' + convert_hundreds(paise).title() + ' Paise'
            result += ' Only'
            return result
        
        # Amount in words (properly aligned)
        amount_words = number_to_words(total_amount)
        amount_in_words_data = [
            ['Total Received Amount in Words:', amount_words]
        ]
        amount_in_words_table = Table(amount_in_words_data, colWidths=[2*inch, 4*inch])
        amount_in_words_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('GRID', (0, 0), (-1, -1), 0, colors.white),
        ]))
        story.append(amount_in_words_table)
        story.append(Spacer(1, 0.15*inch))
        
        # Remarks section (properly aligned) - use notes from invoice_data (may be from saved edit)
        remarks_text = notes if notes else (booking.customer_note or "GENERATED BILL")
        remarks_data = [
            ['Remarks:', remarks_text]
        ]
        remarks_table = Table(remarks_data, colWidths=[1.2*inch, 4.8*inch])
        remarks_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('GRID', (0, 0), (-1, -1), 0, colors.white),
        ]))
        story.append(remarks_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Payment summary (for tax invoice - no rupee symbols) - use balance_due from invoice_data
        if is_tax_invoice and paid_amount > 0:
            payment_data = [
                ['Total Amount:', f"{total_amount:.2f}"],
                ['Paid Amount:', f"{paid_amount:.2f}"],
                ['Balance Due:', f"{balance_due:.2f}"],
            ]
            payment_table = Table(payment_data, colWidths=[2*inch, 4.5*inch])
            payment_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(payment_table)
            story.append(Spacer(1, 0.2*inch))
        
        # Certification statement (properly aligned)
        certification_style = ParagraphStyle(
            'Certification',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#111827'),
            spaceAfter=12,
            fontName='Helvetica',
            alignment=TA_LEFT,
        )
        story.append(Paragraph("Certified that the above particulars are true & correct.", certification_style))
        story.append(Spacer(1, 0.3*inch))
        
        # Authorized signatory section (properly aligned to right)
        signatory_data = [
            ['', 'For BRQ ASSOCIATES'],
            ['', ''],
            ['', 'Authorised Signatory'],
        ]
        signatory_table = Table(signatory_data, colWidths=[4.5*inch, 1.5*inch])
        signatory_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (1, 2), (1, 2), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('TOPPADDING', (1, 2), (1, 2), 25),  # Space for signature
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('GRID', (0, 0), (-1, -1), 0, colors.white),
        ]))
        story.append(signatory_table)
        story.append(Spacer(1, 0.15*inch))
        
        # Computer generated note (centered)
        note_style = ParagraphStyle(
            'Note',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#6B7280'),
            spaceAfter=0,
            fontName='Helvetica',
            alignment=TA_CENTER,
        )
        story.append(Paragraph("*Computer Generated Invoice with due Seal & Signature.", note_style))
        
        # Build PDF to temporary file (already created above)
        invoice_type_name = "tax_invoice" if is_tax_invoice else ("proforma_invoice" if is_proforma_invoice else "invoice")
        filename = f"{invoice_type_name}_{booking.booking_reference}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        
        try:
            # Build PDF to file (doc already created with temp_path)
            doc.build(story, onFirstPage=add_letterhead, onLaterPages=add_letterhead)
            
            # Stream file in chunks to avoid loading entire PDF into memory
            from fastapi.responses import StreamingResponse
            
            def generate() -> Generator[bytes, None, None]:
                """Stream PDF file in chunks and cleanup"""
                chunk_size = 64 * 1024  # 64KB chunks
                try:
                    with open(temp_path, 'rb') as f:
                        while True:
                            chunk = f.read(chunk_size)
                            if not chunk:
                                break
                            yield chunk
                finally:
                    # Clean up temporary file
                    try:
                        if os.path.exists(temp_path):
                            os.unlink(temp_path)
                    except Exception:
                        pass
            
            return StreamingResponse(
                generate(),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                }
            )
        except Exception as e:
            # Clean up on error
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception:
                pass
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BOOKING INVOICE] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to generate invoice: {str(e)}')


@router.post('/bookings/{booking_id}/cancel')
async def cancel_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking if initiated at least 24 hours before start time.
    Marks status as 'cancelled', records a booking event, and automatically
    cancels all booking items with vendor assignments.
    
    Allows:
    - Booking owner (user_id matches)
    - Admin users (role == 'admin')
    """
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking: Optional[Booking] = rs.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    # Allow booking owner, admin, or broker (if booking was made by broker) to cancel
    # Ensure both IDs are integers for proper comparison
    booking_user_id = int(booking.user_id) if booking.user_id else None
    current_user_id = int(current_user.id) if current_user.id else None
    is_owner = booking_user_id == current_user_id
    is_admin = current_user.role == 'admin'
    
    # Check if user is a broker and if this booking was made by them
    is_broker_owner = False
    if current_user.role == 'broker' and hasattr(booking, 'broker_id') and booking.broker_id:
        from app.models import BrokerProfile
        rs_broker = await session.execute(
            select(BrokerProfile).where(BrokerProfile.user_id == current_user_id)
        )
        broker_profile = rs_broker.scalars().first()
        if broker_profile and booking.broker_id == broker_profile.id:
            is_broker_owner = True
    
    # Debug logging
    print(f"[CANCEL BOOKING] Request from user_id={current_user_id} (type: {type(current_user_id)}), role={current_user.role}, booking.user_id={booking_user_id} (type: {type(booking_user_id)}), booking.broker_id={getattr(booking, 'broker_id', None)}, is_owner={is_owner}, is_admin={is_admin}, is_broker_owner={is_broker_owner}")
    
    if not is_owner and not is_admin and not is_broker_owner:
        error_detail = f'Not allowed. Only the booking owner (user_id={booking_user_id}), admin, or the broker who made this booking can cancel it. Current user: {current_user_id} (role: {current_user.role})'
        print(f"[CANCEL BOOKING] Access denied: {error_detail}")
        raise HTTPException(status_code=403, detail=error_detail)

    now = datetime.now()
    if (booking.start_datetime - now).total_seconds() < 24 * 3600:
        raise HTTPException(status_code=400, detail='Cannot cancel within 24 hours of start')

    prev_status = booking.status
    booking.status = 'cancelled'
    session.add(booking)
    
    # Generate cancellation date string for the note
    cancellation_date = now.strftime('%B %d, %Y at %I:%M %p')
    cancelled_by = "admin" if is_admin else "client"
    cancellation_note = f"Booking cancelled by {cancelled_by} on {cancellation_date}. Booking Reference: {booking.booking_reference}"
    
    # Automatically cancel all booking items with vendor assignments
    rs_items = await session.execute(
        select(BookingItem).where(BookingItem.booking_id == booking_id)
    )
    booking_items = rs_items.scalars().all()
    
    cancelled_items_count = 0
    for bi in booking_items:
        if bi.vendor_id:
            # Keep vendor_id so vendor can see the cancelled item
            # Don't set vendor_id to None - this allows vendor to see cancelled items
            bi.rejection_status = True  # Mark as cancelled
            bi.rejection_note = f"[Booking Cancelled] {cancellation_note}"
            bi.rejected_at = now
            bi.booking_status = 'cancelled'  # Mark booking item as cancelled
            bi.accepted_at = None  # Clear acceptance if any
            cancelled_items_count += 1
        else:
            # Even if no vendor, mark the booking item as cancelled
            bi.booking_status = 'cancelled'
    
    # Calculate paid amount and create refund record if payment exists
    from app.models import Payment, Refund
    # Check ALL payments for this booking (regardless of status)
    # We'll use the total amount from all payments, but prefer successful ones
    stmt_all_payments = select(Payment).where(
        Payment.booking_id == booking_id
    )
    rs_all_payments = await session.execute(stmt_all_payments)
    all_payments = rs_all_payments.scalars().all()
    
    # Calculate paid amount from successful payments first
    stmt_success_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status.in_(['success', 'completed', 'confirmed'])
    )
    rs_success_payments = await session.execute(stmt_success_payments)
    paid_amount = float(rs_success_payments.scalar() or 0.0)
    
    # If no successful payments, check if there are any payments at all
    # and use the total amount (in case status is different)
    if paid_amount == 0 and all_payments:
        # Sum all payments regardless of status
        total_all_payments = sum(float(p.amount) for p in all_payments)
        if total_all_payments > 0:
            paid_amount = total_all_payments
            print(f"[CANCEL BOOKING] No successful payments found, using total from all payments: ₹{paid_amount:.2f}")
            print(f"[CANCEL BOOKING] Payment statuses found: {[p.status for p in all_payments]}")
    
    # Get refund percentage from settings (default 40%)
    from sqlalchemy import text
    refund_percentage = 40.0  # Default
    try:
        result = await session.execute(
            text("SELECT value FROM admin_settings WHERE setting_key = 'refund_percentage' LIMIT 1")
        )
        row = result.first()
        if row:
            try:
                refund_percentage = float(row[0])
            except (ValueError, TypeError):
                refund_percentage = 40.0
    except Exception as e:
        print(f"[CANCEL BOOKING] Could not fetch refund percentage, using default 40%: {e}")
    
    # Check if refund already exists for this booking to prevent duplicates
    stmt_existing_refund = select(Refund).where(
        Refund.booking_id == booking_id,
        Refund.refund_type == 'cancellation',
        Refund.status.in_(['pending', 'processing'])
    )
    rs_existing_refund = await session.execute(stmt_existing_refund)
    existing_refund = rs_existing_refund.scalars().first()
    
    if existing_refund:
        print(f"[CANCEL BOOKING] ⚠ Refund already exists for booking {booking.id} (Refund ID: {existing_refund.id}, Status: {existing_refund.status})")
        refund_id = existing_refund.id
        refund_amount = float(existing_refund.amount)
    else:
        # Create refund record if there's a paid amount
        # Also check booking total_amount as fallback if no payments found
        base_refund_amount = paid_amount
        if base_refund_amount == 0 and booking.total_amount > 0:
            # If no payments found but booking has a total amount, 
            # it might be an admin booking or payment wasn't recorded properly
            # Check if booking was paid via other means (check PREVIOUS booking status before cancellation)
            # Note: We use prev_status because booking.status is already set to 'cancelled' above
            if prev_status in ['approved', 'confirmed', 'completed', 'pending']:
                # Booking was approved/confirmed/pending, might have been paid
                # Use booking total as refund amount (admin can adjust later)
                base_refund_amount = float(booking.total_amount)
                print(f"[CANCEL BOOKING] No payments found, but booking was {prev_status}. Using booking total as base refund amount: ₹{base_refund_amount:.2f}")
        
        # Calculate refund amount using percentage
        refund_amount = (base_refund_amount * refund_percentage) / 100.0 if base_refund_amount > 0 else 0.0
        print(f"[CANCEL BOOKING] Refund calculation: base_amount=₹{base_refund_amount:.2f}, percentage={refund_percentage}%, refund_amount=₹{refund_amount:.2f}")
        
        if refund_amount > 0:
            try:
                # Determine who cancelled for the reason
                cancelled_by_text = "admin" if is_admin else "client"
                refund = Refund(
                    booking_id=booking.id,
                    amount=refund_amount,
                    reason=f'Booking cancelled by {cancelled_by_text}. Booking Reference: {booking.booking_reference}',
                    status='pending',
                    refund_type='cancellation',
                    notes=f'Refund will be processed within 3 working days. Cancellation date: {cancellation_date}. Refund percentage: {refund_percentage}% of paid amount (₹{paid_amount:.2f}).',
                    created_by_user_id=current_user.id
                )
                session.add(refund)
                # Flush to ensure refund gets an ID and validate before commit
                await session.flush()
                refund_id = refund.id
                print(f"[CANCEL BOOKING] ✓ Created refund ID={refund_id} for booking {booking.id}, amount: ₹{refund_amount:.2f}")
            except Exception as e:
                print(f"[CANCEL BOOKING] ✗ ERROR creating refund: {e}")
                import traceback
                traceback.print_exc()
                # Don't fail the cancellation if refund creation fails
                refund_id = None
        else:
            refund_id = None
            print(f"[CANCEL BOOKING] ⚠ No refund created for booking {booking.id} - paid_amount: ₹{paid_amount:.2f}, booking_total: ₹{float(booking.total_amount):.2f}")
            if all_payments:
                print(f"[CANCEL BOOKING] Found {len(all_payments)} payment(s):")
                for p in all_payments:
                    print(f"  - Payment {p.id}: status='{p.status}', amount=₹{p.amount:.2f}, booking_id={p.booking_id}")
            else:
                print(f"[CANCEL BOOKING] No payments found for booking {booking.id} (booking status: {booking.status})")
    
    # log event
    actor_type = "Admin" if is_admin else "User"
    ev = BookingEvent(
        booking_id=booking.id,
        actor_user_id=current_user.id,
        from_status=prev_status,
        to_status='cancelled',
        note=f'{actor_type} requested cancellation (>=24h rule). {cancelled_items_count} item(s) with vendor assignments automatically cancelled. Refund of ₹{refund_amount:.2f} will be processed within 3 working days.'
    )
    session.add(ev)
    
    # Commit all changes (booking, items, refund, event)
    try:
        await session.commit()
        await session.refresh(booking)
        
        # Verify refund was saved
        if refund_id:
            stmt_check_refund = select(Refund).where(Refund.id == refund_id)
            rs_check = await session.execute(stmt_check_refund)
            saved_refund = rs_check.scalars().first()
            if saved_refund:
                print(f"[CANCEL BOOKING] ✓ Verified refund {refund_id} saved in database")
            else:
                print(f"[CANCEL BOOKING] ✗ WARNING: Refund {refund_id} not found after commit!")
        
        # Send WhatsApp notification for booking cancellation
        try:
            from app.models import User
            rs_user = await session.execute(select(User).where(User.id == booking.user_id))
            user = rs_user.scalars().first()
            if user and user.mobile:
                customer_name = f"{user.first_name} {user.last_name}".strip() or user.username or "Customer"
                from app.notifications import NotificationService
                await NotificationService.send_booking_cancelled_whatsapp(
                    mobile=user.mobile,
                    customer_name=customer_name,
                    booking_ref=booking.booking_reference,
                    cancelled_date=cancellation_date
                )
        except Exception as whatsapp_error:
            print(f"[CANCEL BOOKING] WhatsApp notification error (non-critical): {whatsapp_error}")
        
        return {
            'ok': True, 
            'status': booking.status, 
            'cancelled_items_count': cancelled_items_count, 
            'refund_amount': refund_amount,
            'refund_created': refund_id is not None,
            'refund_id': refund_id,
            'paid_amount': paid_amount,
            'booking_total': float(booking.total_amount)
        }
    except Exception as e:
        print(f"[CANCEL BOOKING] ✗ ERROR during commit: {e}")
        import traceback
        traceback.print_exc()
        await session.rollback()
        raise HTTPException(status_code=500, detail=f'Failed to cancel booking: {str(e)}')


@router.patch('/bookings/{booking_id}')
async def update_booking(
    booking_id: int,
    payload: dict,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Comprehensive booking update endpoint.
    - Updates date, time, hours, attendees, items
    - Calculates new total and price difference
    - Returns balance amount to pay
    - Marks booking as 'edited' status
    - Sends notifications to admin and client
    """
    # Load original booking
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    original: Optional[Booking] = rs.scalars().first()
    if not original:
        raise HTTPException(status_code=404, detail="Booking not found")
    if original.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get space for pricing
    rs_space = await session.execute(select(Space).where(Space.id == original.space_id))
    space = rs_space.scalars().first()
    if not space:
        raise HTTPException(status_code=404, detail='Associated space not found')

    # Store original total before update
    original_total = float(original.total_amount)
    
    # Calculate original paid amount
    from app.models import Payment
    stmt_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status == 'success'
    )
    rs_payments = await session.execute(stmt_payments)
    original_paid = float(rs_payments.scalar() or 0.0)

    # Parse new times
    start_str = payload.get('start_datetime')
    end_str = payload.get('end_datetime')
    target_start = _parse_iso_to_utc_naive(start_str) if start_str else original.start_datetime
    target_end = _parse_iso_to_utc_naive(end_str) if end_str else original.end_datetime

    # Validate time range
    if target_start >= target_end:
        raise HTTPException(status_code=400, detail='Invalid time range')

    # Check for conflicts (exclude current booking)
    # Allow extending up to 1 hour without conflict check (only check the extended portion)
    original_duration = (original.end_datetime - original.start_datetime).total_seconds() / 3600.0
    new_duration = (target_end - target_start).total_seconds() / 3600.0
    duration_increase = new_duration - original_duration
    
    # If extending by 1 hour or less, only check if the extended portion conflicts
    if duration_increase > 0 and duration_increase <= 1.0:
        # Only check conflicts for the extended portion (from original end to new end)
        conflict = await _check_for_conflicts(original.space_id, original.end_datetime, target_end, session, exclude_booking_id=original.id)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Extending booking conflicts with booking {conflict.booking_reference}")
    elif duration_increase > 1.0 or target_start != original.start_datetime or target_end < original.end_datetime:
        # For changes more than 1 hour extension, or date/time changes, check full range
        conflict = await _check_for_conflicts(original.space_id, target_start, target_end, session, exclude_booking_id=original.id)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Time slot conflicts with booking {conflict.booking_reference}")

    # Calculate new base amount (hours * price_per_hour)
    duration_hours = max(0.0, (target_end - target_start).total_seconds() / 3600.0)
    new_base_amount = float(duration_hours * float(getattr(space, 'price_per_hour', 0.0) or 0.0))

    # Process items (add/update/remove)
    items_total = 0.0
    new_items = payload.get('items', [])  # List of {item_id, quantity} or {item_id: quantity}
    
    # Delete existing booking items
    stmt_delete_items = select(BookingItem).where(BookingItem.booking_id == booking_id)
    rs_delete = await session.execute(stmt_delete_items)
    existing_items = rs_delete.scalars().all()
    for bi in existing_items:
        await session.delete(bi)

    # Add new/updated items
    if new_items:
        for item_data in new_items:
            if isinstance(item_data, dict):
                item_id = item_data.get('item_id') or item_data.get('id')
                quantity = int(item_data.get('quantity', 1))
            else:
                # Handle simple format {item_id: quantity}
                item_id = item_data
                quantity = 1
            
            if not item_id or quantity <= 0:
                continue
                
            stmt_item = select(Item).where(Item.id == item_id)
            rs_item = await session.execute(stmt_item)
            item = rs_item.scalars().first()
            if not item:
                continue
            
            unit_price = float(item.price)
            total_price = unit_price * quantity
            items_total += total_price
            
            bi = BookingItem(
                booking_id=original.id,
                item_id=item.id,
                vendor_id=item.vendor_id,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                event_date=target_start.date(),
                booking_status=original.status,
                is_supplied=False,
            )
            session.add(bi)

    # Calculate new total
    new_total_amount = new_base_amount + items_total

    # Update booking
    original.start_datetime = target_start
    original.end_datetime = target_end
    original.total_amount = new_total_amount
    if 'attendees' in payload:
        try:
            original.attendees = int(payload['attendees'])
        except Exception:
            pass
    if 'event_type' in payload:
        original.event_type = payload.get('event_type')
    if 'customer_note' in payload:
        original.customer_note = payload.get('customer_note')
    
    # Mark as edited (or keep current status if already approved/confirmed)
    if original.status in ['pending', 'approved']:
        original.status = 'edited'  # New status to indicate it needs admin review
    
    session.add(original)

    # Log booking event
    try:
        ev = BookingEvent(
            booking_id=original.id,
            actor_user_id=current_user.id,
            from_status=original.status,
            to_status='edited',
            note=f'Booking edited: Date/Time/Items updated. New total: ₹{new_total_amount:.2f}'
        )
        session.add(ev)
    except Exception:
        pass

    await session.commit()
    await session.refresh(original)

    # Calculate price difference
    price_difference = new_total_amount - original_total
    balance_amount = max(0.0, new_total_amount - original_paid)
    refund_amount = max(0.0, original_paid - new_total_amount) if original_paid > new_total_amount else 0.0

    # Send notifications (fire-and-forget)
    try:
        rs_venue = await session.execute(select(Venue).where(Venue.id == original.venue_id))
        venue = rs_venue.scalars().first()
        
        if venue:
            # Notify client (create in-app notification)
            try:
                await ClientNotificationService.create_notification(
                    session=session,
                    user_id=current_user.id,
                    type="booking_edited",
                    title="Booking Edited",
                    message=f"Your booking {original.booking_reference} has been updated. New total: ₹{new_total_amount:.2f}",
                    booking_id=original.id,
                    link=f"/book/{original.id}",
                    priority="normal",
                )
            except Exception:
                pass
            
            # Notify admin (in-app notification to all admins)
            try:
                # Get all admin users
                stmt_admins = select(User).where(User.role == 'admin')
                rs_admins = await session.execute(stmt_admins)
                admins = rs_admins.scalars().all()
                for admin in admins:
                    await NotificationService._create_in_app_notification(
                        user_id=admin.id,
                        title="Booking Edited",
                        message=f"Booking {original.booking_reference} has been edited by {current_user.username}. New total: ₹{new_total_amount:.2f}",
                        booking_id=original.id,
                        session=session,
                    )
            except Exception:
                pass
            
            # Notify vendors about booking changes (for items assigned to them)
            try:
                # Get all booking items with vendor assignments
                stmt_vendor_items = (
                    select(BookingItem, Item, VendorProfile, User)
                    .join(Item, Item.id == BookingItem.item_id)
                    .outerjoin(VendorProfile, VendorProfile.id == BookingItem.vendor_id)
                    .outerjoin(User, User.id == VendorProfile.user_id)
                    .where(BookingItem.booking_id == original.id, BookingItem.vendor_id.isnot(None))
                )
                rs_vendor_items = await session.execute(stmt_vendor_items)
                vendor_items = rs_vendor_items.all()
                
                # Group by vendor
                vendor_notifications: dict[int, list[str]] = {}
                for bi, item, vp, vu in vendor_items:
                    if not vu or not vp:
                        continue
                    vu_id = vu.id
                    if vu_id not in vendor_notifications:
                        vendor_notifications[vu_id] = []
                    vendor_notifications[vu_id].append(f"{item.name} (Qty: {bi.quantity})")
                
                # Send notification to each vendor
                for vu_id, item_list in vendor_notifications.items():
                    summary = f"Booking {original.booking_reference} has been updated. Items: {', '.join(item_list[:3])}"
                    if len(item_list) > 3:
                        summary += f" and {len(item_list) - 3} more"
                    await NotificationService._create_in_app_notification(
                        user_id=vu_id,
                        title="Booking Updated",
                        message=summary,
                        booking_id=original.id,
                        session=session,
                    )
            except Exception as e:
                print(f"[BOOKING] Vendor notification error (non-blocking): {e}")
    except Exception as e:
        print(f"[BOOKING] Notification error (non-blocking): {e}")

    return {
        'ok': True,
        'message': 'Booking updated successfully',
        'booking_id': original.id,
        'booking_reference': original.booking_reference,
        'status': original.status,
        'original_total': float(original.total_amount),
        'new_total': new_total_amount,
        'original_paid': original_paid,
        'price_difference': price_difference,
        'balance_amount': balance_amount,
        'refund_amount': refund_amount,
        'requires_payment': balance_amount > 0,
        'requires_refund': refund_amount > 0,
    }


@router.post('/bookings/{booking_id}/refund')
async def create_booking_refund(
    booking_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a refund record for a booking edit that resulted in a refund."""
    refund_amount = float(request.get('refund_amount', 0))
    reason = request.get('reason', 'Booking edited - price decreased')
    
    if refund_amount <= 0:
        raise HTTPException(status_code=400, detail='Refund amount must be greater than 0')
    
    # Verify booking belongs to user
    rs = await session.execute(select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id))
    booking = rs.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    # Calculate paid amount
    from app.models import Payment
    stmt_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status == 'success'
    )
    rs_payments = await session.execute(stmt_payments)
    paid_amount = float(rs_payments.scalar() or 0.0)
    
    if refund_amount > paid_amount:
        raise HTTPException(status_code=400, detail='Refund amount cannot exceed paid amount')
    
    # Store refund information in booking's admin_note or create a refund record
    # For now, we'll add it to the booking event
    try:
        ev = BookingEvent(
            booking_id=booking.id,
            actor_user_id=current_user.id,
            from_status=booking.status,
            to_status=booking.status,
            note=f'Refund requested: ₹{refund_amount:.2f}. Reason: {reason}. Refund will be processed within 3 working days.'
        )
        session.add(ev)
    except Exception:
        pass
    
    # Update booking admin_note with refund info
    refund_note = f"Refund Request: ₹{refund_amount:.2f} - {reason}. Will be processed within 3 working days."
    if booking.admin_note:
        booking.admin_note = f"{booking.admin_note}\n\n{refund_note}"
    else:
        booking.admin_note = refund_note
    
    await session.commit()
    
    return {
        'ok': True,
        'message': 'Refund request recorded',
        'booking_id': booking.id,
        'refund_amount': refund_amount,
        'refund_note': refund_note,
    }


@router.post('/bookings/series')
async def create_booking_series(
    payload: dict,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a series of daily bookings across a date range.

    Payload fields:
      - space_id: int (required)
      - start_datetime: ISO string (date part used for series start, time-of-day used daily)
      - end_datetime: ISO string (date part used for series end, time-of-day used daily)
      - excluded_weekdays: [int] optional (Python weekday: Mon=0..Sun=6) to skip
      - attendees: int optional
      - booking_type: str optional (default 'daily')
      - event_type: str optional
      - items: [{ item_id, quantity }] optional per-booking items
      - customer_note: str optional
    """
    try:
        space_id = int(payload.get('space_id'))
        start_dt_ref = _parse_iso_to_utc_naive(str(payload.get('start_datetime')))
        end_dt_ref = _parse_iso_to_utc_naive(str(payload.get('end_datetime')))
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid payload: space_id/start_datetime/end_datetime')

    # Validate space
    rs = await session.execute(select(Space).where(Space.id == space_id))
    space = rs.scalars().first()
    if not space:
        raise HTTPException(status_code=404, detail='Space not found')

    # Normalize date window
    start_date = start_dt_ref.date()
    end_date = end_dt_ref.date()
    # Optional override via num_days (inclusive window): if provided, derive end_date
    try:
        num_days = int(payload.get('num_days')) if payload.get('num_days') is not None else None
        if num_days and num_days > 0:
            end_date = start_date + timedelta(days=max(0, num_days - 1))
    except Exception:
        pass
    if end_date < start_date:
        raise HTTPException(status_code=400, detail='End date before start date')

    start_t = start_dt_ref.time()
    end_t = end_dt_ref.time()

    excluded_weekdays = payload.get('excluded_weekdays') or []
    try:
        excluded_set = set(int(x) for x in excluded_weekdays)
    except Exception:
        excluded_set = set()

    attendees = payload.get('attendees')
    try:
        attendees = int(attendees) if attendees is not None else None
    except Exception:
        attendees = None

    booking_type = (payload.get('booking_type') or 'daily').strip() or 'daily'
    event_type = payload.get('event_type')
    items = payload.get('items') or []
    customer_note = payload.get('customer_note')

    series_ref = 'SR-' + uuid.uuid4().hex[:10].upper()

    created: list[dict] = []
    skipped: list[dict] = []

    cur = start_date
    while cur <= end_date:
        # Skip excluded weekdays (Python: Monday=0 .. Sunday=6)
        if cur.weekday() in excluded_set:
            skipped.append({'date': cur.isoformat(), 'reason': 'excluded_weekday'})
            cur = cur + timedelta(days=1)
            continue

        sdt = datetime.combine(cur, start_t)
        edt = datetime.combine(cur, end_t)
        if edt <= sdt:
            edt = sdt + timedelta(hours=1)

        # Overlap check
        rs = await session.execute(
            select(Booking).where(
                Booking.space_id == space_id,
                Booking.status.in_(["pending","approved","confirmed"]),
                not_(
                    or_(
                        Booking.end_datetime <= sdt,
                        Booking.start_datetime >= edt,
                    )
                )
            )
        )
        conflict = rs.scalars().first()
        if conflict:
            skipped.append({'date': cur.isoformat(), 'reason': f'conflict:{conflict.booking_reference}'})
            cur = cur + timedelta(days=1)
            continue

        # Price calc
        # Admin bookings (regular programs) should have no payment
        is_admin_booking = payload.get('is_admin_booking') or False
        duration_hours = max(0.0, (edt - sdt).total_seconds() / 3600.0)
        if is_admin_booking:
            total_amount = 0.0
        else:
            total_amount = float(duration_hours * float(space.price_per_hour))

        # Create booking
        # Admin bookings (regular programs, live shows) should be auto-approved
        booking_status = 'approved' if is_admin_booking else 'pending'
        
        booking_ref = 'BK-' + uuid.uuid4().hex[:10].upper()
        b = Booking(
            booking_reference=booking_ref,
            series_reference=series_ref,
            user_id=current_user.id,
            venue_id=space.venue_id,
            space_id=space.id,
            start_datetime=sdt,
            end_datetime=edt,
            attendees=attendees,
            status=booking_status,
            total_amount=total_amount,
            booking_type=booking_type,
            event_type=event_type,
            customer_note=customer_note,
            is_admin_booking=is_admin_booking,
            admin_note=payload.get('admin_note'),
            banner_image_url=payload.get('banner_image_url'),
        )
        session.add(b)
        await session.flush()  # get b.id

        # Optional items
        items_total = 0.0
        for it in items:
            try:
                item_id = int(it.get('item_id'))
                qty = int(it.get('quantity') or 1)
            except Exception:
                continue
            rs = await session.execute(select(Item).where(Item.id == item_id))
            item = rs.scalars().first()
            if not item:
                continue
            unit = float(item.price)
            total = unit * qty
            bi = BookingItem(
                booking_id=b.id,
                item_id=item.id,
                vendor_id=item.vendor_id,
                quantity=qty,
                unit_price=unit,
                total_price=total,
                event_date=sdt.date(),
                booking_status=b.status,
                is_supplied=False,
            )
            session.add(bi)
            items_total += total

        # For admin bookings, keep total_amount at 0 (no payment required)
        if not is_admin_booking:
            b.total_amount = float(b.total_amount) + items_total
        await session.flush()

        created.append({
            'id': b.id,
            'booking_reference': booking_ref,
            'date': cur.isoformat(),
            'start_datetime': sdt.isoformat(),
            'end_datetime': edt.isoformat(),
        })

        cur = cur + timedelta(days=1)

    await session.commit()

    # Fire a simple in-app notification to the user summarizing the series creation
    try:
        if created:
            first_id = created[0].get('id')
            title = "Program created"
            msg = f"Created {len(created)} daily booking(s) from {start_date.isoformat()} to {end_date.isoformat()}."
            await NotificationService._create_in_app_notification(
                user_id=current_user.id,
                title=title,
                message=msg,
                booking_id=int(first_id) if first_id else 0,
                session=session,
            )
    except Exception as e:
        print(f"[SERIES] Notification error (non-blocking): {e}")

    return {
        'ok': True,
        'series_reference': series_ref,
        'created_count': len(created),
        'skipped_count': len(skipped),
        'created': created,
        'skipped': skipped,
        'message': f"Created {len(created)} booking(s); skipped {len(skipped)}."
    }


@router.get("/bookings/cancelled")
async def get_cancelled_bookings(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all cancelled bookings for the current user."""
    stmt = select(Booking).where(
        Booking.user_id == current_user.id,
        Booking.status == "cancelled"
    ).order_by(Booking.created_at.desc())
    rs = await session.execute(stmt)
    bookings = rs.scalars().all()
    
    return {
        'ok': True,
        'items': [
            {
                'id': b.id,
                'booking_reference': b.booking_reference,
                'series_reference': b.series_reference,
                'start_datetime': b.start_datetime.isoformat() if b.start_datetime else None,
                'end_datetime': b.end_datetime.isoformat() if b.end_datetime else None,
                'status': b.status,
                'total_amount': b.total_amount,
                'event_type': b.event_type,
                'customer_note': b.customer_note,
                'created_at': b.created_at.isoformat() if b.created_at else None,
                'cancelled_at': b.updated_at.isoformat() if b.updated_at else None,
            }
            for b in bookings
        ]
    }
