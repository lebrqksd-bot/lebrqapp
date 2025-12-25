from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Form, Body, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timedelta
import re
import secrets
from sqlalchemy import select, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_session, AsyncSessionLocal
from app.auth import get_current_user, hash_password
from app.models import Booking, BookingEvent, User, Space, Venue, BookingItem, Item, VendorProfile, BrokerProfile, BookingItemRejection, Refund
from app.notifications import NotificationService
import json

router = APIRouter()

# Cache for auto-approve setting (loaded from database)
_auto_approve_enabled_cache = None

async def get_auto_approve_from_db(session: AsyncSession) -> bool:
    """Get auto-approve setting from database"""
    try:
        # Try to get from admin_settings table if it exists
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT value FROM admin_settings WHERE setting_key = 'auto_approve_enabled' LIMIT 1")
        )
        row = result.first()
        if row:
            return row[0] == 'true' or row[0] == '1'
    except Exception as e:
        # Table might not exist, create it
        try:
            await session.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS admin_settings (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        setting_key VARCHAR(100) UNIQUE NOT NULL,
                        value TEXT,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                """)
            )
            await session.commit()
            # Insert default value
            await session.execute(
                text("INSERT INTO admin_settings (setting_key, value) VALUES ('auto_approve_enabled', 'false') ON DUPLICATE KEY UPDATE value = value")
            )
            await session.commit()
        except Exception as create_error:
            print(f"[Auto-Approve] Error creating settings table: {create_error}")
    return False

async def set_auto_approve_in_db(session: AsyncSession, enabled: bool) -> bool:
    """Save auto-approve setting to database"""
    try:
        from sqlalchemy import text
        await session.execute(
            text("""
                INSERT INTO admin_settings (setting_key, value) 
                VALUES ('auto_approve_enabled', :value)
                ON DUPLICATE KEY UPDATE value = :value, updated_at = CURRENT_TIMESTAMP
            """),
            {"value": "true" if enabled else "false"}
        )
        await session.commit()
        return True
    except Exception as e:
        print(f"[Auto-Approve] Error saving setting: {e}")
        await session.rollback()
        return False

async def get_refund_percentage_from_db(session: AsyncSession) -> float:
    """Get refund percentage setting from database (default: 40.0)"""
    try:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT value FROM admin_settings WHERE setting_key = 'refund_percentage' LIMIT 1")
        )
        row = result.first()
        if row:
            try:
                return float(row[0])
            except (ValueError, TypeError):
                return 40.0
    except Exception as e:
        # Table might not exist, create it and set default
        try:
            await session.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS admin_settings (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        setting_key VARCHAR(100) UNIQUE NOT NULL,
                        value TEXT,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                """)
            )
            await session.commit()
            # Insert default value
            await session.execute(
                text("INSERT INTO admin_settings (setting_key, value) VALUES ('refund_percentage', '40.0') ON DUPLICATE KEY UPDATE value = value")
            )
            await session.commit()
        except Exception as create_error:
            print(f"[Refund Percentage] Error creating settings table: {create_error}")
    return 40.0  # Default 40%

async def set_refund_percentage_in_db(session: AsyncSession, percentage: float) -> bool:
    """Save refund percentage setting to database"""
    try:
        from sqlalchemy import text
        # Validate percentage (0-100)
        if percentage < 0 or percentage > 100:
            raise ValueError("Refund percentage must be between 0 and 100")
        await session.execute(
            text("""
                INSERT INTO admin_settings (setting_key, value) 
                VALUES ('refund_percentage', :value)
                ON DUPLICATE KEY UPDATE value = :value, updated_at = CURRENT_TIMESTAMP
            """),
            {"value": str(percentage)}
        )
        await session.commit()
        return True
    except Exception as e:
        print(f"[Refund Percentage] Error saving setting: {e}")
        await session.rollback()
        return False

def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user

@router.post('/admin/booking-items/{booking_item_id}/assign-vendor')
async def assign_vendor_to_item(
    booking_item_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    vendor_id = request.get('vendor_id')
    if not vendor_id:
        raise HTTPException(status_code=400, detail='vendor_id is required')
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    
    # Load booking and item details for WhatsApp message
    # Join with Venue to get venue name for WhatsApp message
    rs_booking = await session.execute(
        select(Booking, Venue)
        .join(Venue, Booking.venue_id == Venue.id)
        .where(Booking.id == bi.booking_id)
    )
    result = rs_booking.first()
    if result:
        booking, venue = result
    else:
        booking = None
        venue = None
    
    rs_item = await session.execute(select(Item).where(Item.id == bi.item_id))
    item = rs_item.scalars().first()
    
    rs_vendor = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
    vendor = rs_vendor.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail='Vendor not found')
    
    # Check if this vendor has previously rejected this item
    rs_rejection = await session.execute(
        select(BookingItemRejection).where(
            BookingItemRejection.booking_item_id == booking_item_id,
            BookingItemRejection.vendor_id == vendor_id
        )
    )
    existing_rejection = rs_rejection.scalars().first()
    if existing_rejection:
        raise HTTPException(
            status_code=400, 
            detail=f'This vendor has previously rejected this item. Reason: {existing_rejection.rejection_note or "Not provided"}'
        )
    
    # Store data needed for notification BEFORE committing
    vendor_phone = vendor.contact_phone
    vendor_company = vendor.company_name or vendor.username
    item_name = item.name if item else f'Item #{bi.item_id}'
    event_date_str = bi.event_date.strftime('%B %d, %Y') if bi.event_date else 'TBD'
    venue_name = venue.name if venue else 'Venue'
    booking_ref = booking.booking_reference if booking else None
    item_quantity = bi.quantity
    
    bi.vendor_id = vendor_id
    # Set booking_status to 'pending' so vendor sees it as a new assignment
    if not bi.booking_status or bi.booking_status not in ['pending', 'confirmed', 'cancelled']:
        bi.booking_status = 'pending'
    # Reset rejection status if this is a reassignment
    if bi.rejection_status:
        bi.rejection_status = False
        bi.rejection_note = None
        bi.rejected_at = None
    await session.commit()
    
    # Send WhatsApp message in background thread (non-blocking)
    if vendor_phone:
        import threading
        import time
        
        def send_whatsapp_notification(phone_num, company, item_nm, qty, event_dt, venue_nm, ref, v_id):
            """Send WhatsApp notification in background thread"""
            # Small delay to ensure main session is fully released
            time.sleep(0.5)
            
            try:
                from ..services.route_mobile import send_session_message
                import asyncio
                
                # Format phone number (ensure it starts with +)
                phone = phone_num.strip()
                if not phone.startswith('+'):
                    # Add country code if missing (assuming India +91)
                    if not phone.startswith('91'):
                        phone = '+91' + phone.lstrip('0')
                    else:
                        phone = '+' + phone
                
                # Create message
                message = f"Hello {company},\n\n"
                message += f"You have been assigned to supply the following item:\n"
                message += f"• Item: {item_nm}\n"
                message += f"• Quantity: {qty}\n"
                message += f"• Event Date: {event_dt}\n"
                message += f"• Venue: {venue_nm}\n"
                if ref:
                    message += f"• Booking Reference: {ref}\n"
                message += f"\nPlease confirm your availability and prepare accordingly.\n\n"
                message += f"Thank you!"
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                import asyncio
                
                async def send_whatsapp():
                    try:
                        await asyncio.wait_for(
                            send_session_message(phone, text=message),
                            timeout=10.0  # 10 second timeout
                        )
                    except asyncio.TimeoutError:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"WhatsApp send timed out for vendor {v_id}")
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Failed to send WhatsApp to vendor {v_id}: {str(e)}")
                
                run_async_in_thread(send_whatsapp)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to send WhatsApp to vendor {v_id}: {str(e)}")
        
        # Start thread - this won't block the response
        thread = threading.Thread(
            target=send_whatsapp_notification,
            args=(vendor_phone, vendor_company, item_name, item_quantity, event_date_str, venue_name, booking_ref, vendor_id),
            daemon=True
        )
        thread.start()
    
    # Return immediately - WhatsApp will be sent in background
    return {
        'ok': True,
        'booking_item_id': booking_item_id,
        'vendor_id': vendor_id,
        'vendor_company': vendor.company_name,
        'vendor_phone': vendor.contact_phone,
        'vendor_email': vendor.contact_email,
    }


@router.get('/admin/bookings')
async def list_bookings(
    status: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    admin_only: bool = Query(False, description="If true, return only admin bookings (is_admin_booking=True)"),
    my_admin_only: bool = Query(False, description="If true, return only admin bookings created by the current admin user"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List bookings with joined user info.

    Adds user_name (combined first/last or username) and preserves event_type & booking_type.
    Returns a list of plain JSON objects instead of raw ORM instances for lighter payloads
    and forward compatibility (client expects user_name & event_type).
    
    Now includes pagination to prevent memory issues with large datasets.
    """
    import traceback
    import logging
    # func is already imported at module level (line 8), don't import it locally
    logger = logging.getLogger(__name__)
    
    try:
        base_stmt = (
            select(
                Booking,
                User.first_name,
                User.last_name,
                User.username,
            )
            .join(User, User.id == Booking.user_id)
        )
        
        # Apply admin-only filters if requested
        if my_admin_only:
            base_stmt = base_stmt.where(Booking.is_admin_booking == True, Booking.user_id == admin.id)
        elif admin_only:
            base_stmt = base_stmt.where(Booking.is_admin_booking == True)

        if status:
            base_stmt = base_stmt.where(Booking.status == status)
        
        # Get total count for pagination
        # Count directly from Booking table with same WHERE conditions (more efficient than subquery)
        try:
            count_stmt = select(func.count(Booking.id))
            # Mirror WHERE conditions from base_stmt
            if my_admin_only:
                count_stmt = count_stmt.where(Booking.is_admin_booking == True, Booking.user_id == admin.id)
            elif admin_only:
                count_stmt = count_stmt.where(Booking.is_admin_booking == True)
            if status:
                count_stmt = count_stmt.where(Booking.status == status)
            total_result = await session.execute(count_stmt)
            total = total_result.scalar() or 0
        except Exception as count_error:
            logger.error(f"[Admin Bookings] Error counting bookings: {str(count_error)}")
            logger.error(f"[Admin Bookings] Traceback: {traceback.format_exc()}")
            total = 0  # Default to 0 if count fails
        
        # Apply pagination
        try:
            offset = (page - 1) * page_size
            stmt = base_stmt.order_by(Booking.created_at.desc(), Booking.start_datetime.desc()).offset(offset).limit(page_size)
            rs = await session.execute(stmt)
            rows = rs.all()
        except Exception as query_error:
            logger.error(f"[Admin Bookings] Error querying bookings: {str(query_error)}")
            logger.error(f"[Admin Bookings] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error fetching bookings. Please try again."
            )

        # Import Payment model for calculating paid_amount
        from app.models import Payment
        # func is already imported at the top of the function
        
        # Get all booking IDs
        booking_ids = [booking.id for booking, _, _, _ in rows]
        
        # Bulk query all payments for these bookings in one go
        payments_dict = {}
        if booking_ids:
            try:
                stmt_all_payments = (
                    select(
                        Payment.booking_id,
                        func.sum(Payment.amount).label('total_paid')
                    )
                    .where(
                        Payment.booking_id.in_(booking_ids),
                        Payment.status.in_(['success', 'completed', 'confirmed', 'paid'])
                    )
                    .group_by(Payment.booking_id)
                )
                rs_all_payments = await session.execute(stmt_all_payments)
                payments_dict = {row.booking_id: float(row.total_paid or 0.0) for row in rs_all_payments}
            except Exception as payment_error:
                logger.error(f"[Admin Bookings] Error fetching payments: {str(payment_error)}")
                logger.error(f"[Admin Bookings] Traceback: {traceback.format_exc()}")
                payments_dict = {}  # Continue without payment data
        
        # Bulk query audio note counts for these bookings
        audio_counts_dict = {}
        if booking_ids:
            try:
                from app.models_client_enhanced import ClientAudioNote
                stmt_audio = (
                    select(
                        ClientAudioNote.booking_id,
                        func.count(ClientAudioNote.id).label('audio_count')
                    )
                    .where(ClientAudioNote.booking_id.in_(booking_ids))
                    .group_by(ClientAudioNote.booking_id)
                )
                rs_audio = await session.execute(stmt_audio)
                audio_counts_dict = {row.booking_id: int(row.audio_count or 0) for row in rs_audio}
            except Exception as e:
                # If ClientAudioNote model doesn't exist or table doesn't exist, just continue without audio counts
                logger.warning(f"[Admin Bookings] Could not fetch audio counts: {e}")
                audio_counts_dict = {}
        
        out = []
        for booking, first_name, last_name, username in rows:
            user_name = f"{first_name or ''} {last_name or ''}".strip() or username
            
            # Get discount_amount from applied_offers table (if exists) - get this first
            discount_amount = 0.0
            try:
                stmt_offer = text("""
                    SELECT discount_amount 
                    FROM applied_offers 
                    WHERE booking_id = :booking_id 
                    LIMIT 1
                """)
                rs_offer = await session.execute(stmt_offer, {'booking_id': booking.id})
                result = rs_offer.first()
                if result:
                    discount_amount = float(result[0] or 0.0)
            except Exception:
                # Table might not exist or column might be different, default to 0
                discount_amount = 0.0
            
            # Calculate final amount after discount
            total_amount = float(booking.total_amount or 0.0)
            final_amount_after_discount = max(0.0, total_amount - discount_amount)
            
            # Get paid_amount from the bulk query result
            paid_amount = payments_dict.get(booking.id, 0.0)
            
            # For admin display: Use paid_amount if available, otherwise use final_amount_after_discount
            # This ensures we show the amount after discount, not the full amount
            if paid_amount == 0.0:
                # If no payment record, use the amount after discount as the display amount
                paid_amount = final_amount_after_discount
            # If paid_amount exists, it's already the actual paid amount (which should be after discount)
            
            # Get audio note count for this booking
            audio_count = audio_counts_dict.get(booking.id, 0)
            
            out.append({
                'id': booking.id,
                'booking_reference': booking.booking_reference,
                'series_reference': getattr(booking, 'series_reference', None),
                'user_id': booking.user_id,
                'user_name': user_name,
                'user': {
                    'id': booking.user_id,
                    'name': user_name,
                    'username': username,
                },
                'venue_id': booking.venue_id,
                'space_id': booking.space_id,
                'start_datetime': booking.start_datetime.isoformat(),
                'end_datetime': booking.end_datetime.isoformat(),
                'attendees': booking.attendees,
                'status': booking.status,
                'total_amount': total_amount,
                'paid_amount': paid_amount,
                'discount_amount': discount_amount,
                'booking_type': getattr(booking, 'booking_type', None),
                'event_type': getattr(booking, 'event_type', None),
                'customer_note': booking.customer_note,
                'admin_note': booking.admin_note,
                'is_admin_booking': getattr(booking, 'is_admin_booking', False),
                'banner_image_url': getattr(booking, 'banner_image_url', None),
                'stage_banner_url': getattr(booking, 'stage_banner_url', None),
                'created_at': booking.created_at.isoformat() if getattr(booking, 'created_at', None) else None,
                'audio_count': audio_count,  # Number of audio notes for this booking
            })
        
        # Also fetch rack orders for admin
        try:
            from ..models_rack import RackOrder
            rack_orders_stmt = select(RackOrder, User.first_name, User.last_name, User.username).join(
                User, User.id == RackOrder.user_id
            ).order_by(RackOrder.created_at.desc())
            
            if status:
                if status == 'cancelled':
                    rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'cancelled')
                elif status == 'pending':
                    rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'pending')
                elif status == 'approved' or status == 'confirmed':
                    rack_orders_stmt = rack_orders_stmt.where(RackOrder.status.in_(['confirmed', 'shipped', 'delivered']))
                elif status == 'completed':
                    rack_orders_stmt = rack_orders_stmt.where(RackOrder.status == 'delivered')
            
            rack_orders_rs = await session.execute(rack_orders_stmt)
            rack_orders_rows = rack_orders_rs.all()
        except Exception as rack_error:
            logger.error(f"[Admin Bookings] Error fetching rack orders: {str(rack_error)}")
            logger.error(f"[Admin Bookings] Traceback: {traceback.format_exc()}")
            rack_orders_rows = []  # Continue without rack orders
        
        # Get surprise gift info for rack orders
        for rack_order, first_name, last_name, username in rack_orders_rows:
            user_name = f"{first_name or ''} {last_name or ''}".strip() or username
            
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
            
            # Get payment amount for rack order
            rack_paid_amount = 0.0
            if rack_order.payment_id:
                from app.models import Payment
                payment_result = await session.execute(
                    select(Payment).where(Payment.id == rack_order.payment_id)
                )
                payment = payment_result.scalar_one_or_none()
                if payment and payment.status in ['success', 'completed', 'confirmed', 'paid']:
                    rack_paid_amount = float(payment.amount)
            
            out.append({
            'id': f"rack_order_{rack_order.id}",  # Prefix to avoid conflicts
            'booking_reference': rack_order.order_reference,
            'series_reference': None,
            'user_id': rack_order.user_id,
            'user_name': user_name,
            'user': {
                'id': rack_order.user_id,
                'name': user_name,
                'username': username,
            },
            'venue_id': None,
            'space_id': None,
            'start_datetime': rack_order.created_at.isoformat() if rack_order.created_at else None,
            'end_datetime': None,
            'attendees': None,
            'status': rack_order.status,
            'total_amount': float(rack_order.total_amount),
            'paid_amount': rack_paid_amount if rack_paid_amount > 0 else float(rack_order.total_amount - (rack_order.discount_amount or 0)),
            'discount_amount': float(rack_order.discount_amount or 0.0),
            'booking_type': 'rack_order',
            'event_type': 'Rack Order',
            'customer_note': None,
            'admin_note': None,
            'is_admin_booking': False,
            'banner_image_url': None,
            'stage_banner_url': None,
            'created_at': rack_order.created_at.isoformat() if rack_order.created_at else None,
            'audio_count': 0,
            # Rack order specific fields
            'rack_order_id': rack_order.id,
            'rack_order_items': rack_order.items_json,
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
            })
        
        # Add pagination metadata
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        
        return {
            "items": out,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Catch any unexpected errors
        error_msg = str(e)
        logger.error(f"[Admin Bookings] Unexpected error in list_bookings: {error_msg}")
        logger.error(f"[Admin Bookings] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching bookings. Please try again."
        )


@router.get('/admin/bookings/{booking_id}')
async def get_booking_detail(booking_id: int, session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    """Get detailed booking information for admin editing."""
    stmt = (
        select(Booking, Space, Venue, User)
        .join(Space, Booking.space_id == Space.id)
        .join(Venue, Booking.venue_id == Venue.id)
        .join(User, Booking.user_id == User.id)
        .where(Booking.id == booking_id)
    )
    rs = await session.execute(stmt)
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    booking, space, venue, user = row
    
    # Get booking items - use raw SQL to avoid performance_team_profile column issue
    sql_query = text("""
        SELECT 
            bi.id, bi.booking_id, bi.item_id, bi.vendor_id, bi.quantity,
            bi.unit_price, bi.total_price, bi.booking_status, bi.is_supplyed,
            bi.rejection_status, bi.rejection_note, bi.rejected_at, bi.accepted_at,
            i.id as item_id_val, i.name as item_name, i.image_url as item_image_url,
            vp.id as vendor_id_val, vp.company_name as vendor_company_name
        FROM booking_items bi
        INNER JOIN items i ON i.id = bi.item_id
        LEFT JOIN vendor_profiles vp ON vp.id = bi.vendor_id
        WHERE bi.booking_id = :booking_id
    """)
    rs_items = await session.execute(sql_query, {'booking_id': booking_id})
    items_rows = rs_items.all()
    
    items = []
    for row in items_rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        rejected_at = row_dict.get('rejected_at')
        accepted_at = row_dict.get('accepted_at')
        
        items.append({
            'id': row_dict.get('id'),
            'item_id': row_dict.get('item_id_val'),
            'item_name': row_dict.get('item_name'),
            'quantity': row_dict.get('quantity'),
            'unit_price': float(row_dict.get('unit_price', 0)),
            'total_price': float(row_dict.get('total_price', 0)),
            'vendor_id': row_dict.get('vendor_id'),
            'vendor_name': row_dict.get('vendor_company_name'),
            'booking_status': row_dict.get('booking_status'),
            'is_supplied': bool(row_dict.get('is_supplyed', False)),
            'rejection_status': bool(row_dict.get('rejection_status', False)),
            'rejection_note': row_dict.get('rejection_note'),
            'rejected_at': rejected_at.isoformat() if rejected_at else None,
            'accepted_at': accepted_at.isoformat() if accepted_at else None,
            'image_url': row_dict.get('item_image_url'),
        })
    
    # Calculate paid_amount from successful payments (check multiple statuses)
    from app.models import Payment
    stmt_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status.in_(['success', 'completed', 'confirmed', 'paid'])
    )
    rs_payments = await session.execute(stmt_payments)
    paid_amount = float(rs_payments.scalar() or 0.0)
    
    # Fallback: If no payments found but booking status suggests payment was made,
    # use total_amount as paid_amount (for cases where payment records might be missing)
    if paid_amount == 0.0 and booking.status in ['paid', 'approved', 'confirmed', 'completed']:
        paid_amount = float(booking.total_amount or 0.0)
    
    # Get discount_amount from applied_offers table (if exists)
    discount_amount = 0.0
    try:
        stmt_offer = text("""
            SELECT discount_amount 
            FROM applied_offers 
            WHERE booking_id = :booking_id 
            LIMIT 1
        """)
        rs_offer = await session.execute(stmt_offer, {'booking_id': booking_id})
        result = rs_offer.first()
        if result:
            discount_amount = float(result[0] or 0.0)
    except Exception:
        # Table might not exist or column might be different, default to 0
        discount_amount = 0.0
    
    # Parse transport_locations from customer_note (stored as JSON after ||TRANSPORT_LOCATIONS:)
    import json
    transport_locations = None
    customer_note_clean = booking.customer_note or ""
    if "||TRANSPORT_LOCATIONS:" in customer_note_clean:
        parts = customer_note_clean.split("||TRANSPORT_LOCATIONS:")
        if len(parts) == 2:
            customer_note_clean = parts[0].strip()
            try:
                transport_locations = json.loads(parts[1].strip())
            except (json.JSONDecodeError, ValueError):
                transport_locations = None
    
    return {
        'id': booking.id,
        'booking_reference': booking.booking_reference,
        'series_reference': getattr(booking, 'series_reference', None),
        'user_id': booking.user_id,
        'user_name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        'user_mobile': user.mobile,
        'venue_id': booking.venue_id,
        'venue_name': venue.name,
        'space_id': booking.space_id,
        'space_name': space.name,
        'start_datetime': booking.start_datetime.isoformat(),
        'end_datetime': booking.end_datetime.isoformat(),
        'attendees': booking.attendees,
        'status': booking.status,
        'total_amount': float(booking.total_amount),
        'paid_amount': paid_amount,
        'discount_amount': discount_amount,
        'booking_type': getattr(booking, 'booking_type', None),
        'event_type': booking.event_type,
        'customer_note': customer_note_clean,  # Return cleaned customer_note without transport_locations JSON
        'admin_note': booking.admin_note,
        'is_admin_booking': getattr(booking, 'is_admin_booking', False),
        'banner_image_url': getattr(booking, 'banner_image_url', None),
        'stage_banner_url': getattr(booking, 'stage_banner_url', None),
        'items': items,
        'transport_locations': transport_locations,  # Include parsed transport locations
    }


@router.patch('/admin/bookings/{booking_id}')
async def update_booking_admin(
    booking_id: int,
    payload: dict,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Update booking details (admin only). Accepts admin_note and other fields."""
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking = rs.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    prev_status = booking.status
    
    # Update allowed fields
    if 'admin_note' in payload:
        booking.admin_note = payload['admin_note']
    if 'status' in payload:
        booking.status = payload['status']
    if 'attendees' in payload:
        try:
            booking.attendees = int(payload['attendees'])
        except Exception:
            pass
    if 'customer_note' in payload:
        booking.customer_note = payload['customer_note']
    if 'event_type' in payload:
        booking.event_type = payload['event_type']
        # If event type is changed to a program (yoga, zumba), set price to 0
        event_type_lower = (payload['event_type'] or '').lower()
        if event_type_lower in ['yoga', 'zumba']:
            booking.total_amount = 0.0
    
    # Log change if status changed
    if booking.status != prev_status:
        ev = BookingEvent(
            booking_id=booking.id,
            actor_user_id=admin.id,
            from_status=prev_status,
            to_status=booking.status,
            note=payload.get('admin_note') or 'Admin updated booking'
        )
        session.add(ev)
    
    await session.commit()
    await session.refresh(booking)
    
    return {'ok': True, 'booking_id': booking.id, 'status': booking.status}


@router.get('/admin/booking-items')
async def list_booking_items(
    from_date: Optional[str] = Query(default=None, description="Filter items with event_date >= this (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="Filter items with event_date <= this (YYYY-MM-DD)"),
    status: Optional[str] = Query(default=None, description="Filter by booking_items.booking_status"),
    vendor_id: Optional[int] = Query(default=None),
    space_id: Optional[int] = Query(default=None),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """List booking items with joins for admin vendor coordination.

    Returns rows with booking + space + vendor + item details and the per-item flags
    (event_date, booking_status, is_supplyed).
    
    Now includes pagination to prevent memory issues with large datasets.
    """
    base_stmt = (
        select(
            BookingItem,
            Booking,
            Item,
            VendorProfile,
            Space,
            Venue,
            User,
        )
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(Item, Item.id == BookingItem.item_id)
        .join(Space, Space.id == Booking.space_id)
        .join(Venue, Venue.id == Booking.venue_id)
        .join(User, User.id == Booking.user_id)
        .outerjoin(VendorProfile, VendorProfile.id == BookingItem.vendor_id)
    )

    # Build conditions with robust date parsing to avoid DB-specific DATE() function issues
    conditions = []
    if from_date:
        try:
            from datetime import date as _date
            parsed_from = _date.fromisoformat(from_date)
            conditions.append(BookingItem.event_date >= parsed_from)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid from_date format. Use YYYY-MM-DD.")
    if to_date:
        try:
            from datetime import date as _date
            parsed_to = _date.fromisoformat(to_date)
            conditions.append(BookingItem.event_date <= parsed_to)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid to_date format. Use YYYY-MM-DD.")
    if status:
        conditions.append(BookingItem.booking_status == status)
    if vendor_id:
        conditions.append(BookingItem.vendor_id == vendor_id)
    if space_id:
        conditions.append(Booking.space_id == space_id)
    if conditions:
        base_stmt = base_stmt.where(and_(*conditions))

    # Get total count for pagination
    count_stmt = select(func.count(BookingItem.id)).select_from(
        base_stmt.subquery()
    )
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    # MySQL doesn't support NULLS LAST; emulate by ordering by IS NULL first, then value
    stmt = base_stmt.order_by(BookingItem.event_date.is_(None), BookingItem.event_date.asc()).offset(offset).limit(page_size)
    
    rs = await session.execute(stmt)
    rows = rs.all()
    items = []
    for bi, b, it, vp, sp, ve, u in rows:
            user_name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip() or getattr(u, 'username', 'Unknown')
            items.append({
                'booking_item_id': bi.id,
                'booking_id': b.id,
                'booking_reference': b.booking_reference,
                'event_type': getattr(b, 'event_type', None),
                'event_date': getattr(bi, 'event_date', None).isoformat() if getattr(bi, 'event_date', None) else None,
                'booking_status': getattr(bi, 'booking_status', None) or b.status,
                'is_supplyed': bool(getattr(bi, 'is_supplied', False)),
                'supplied_at': getattr(bi, 'supplied_at', None).isoformat() if getattr(bi, 'supplied_at', None) else None,
                'supply_verified': bool(getattr(bi, 'supply_verified', False)),
                'verified_at': getattr(bi, 'verified_at', None).isoformat() if getattr(bi, 'verified_at', None) else None,
                'rejection_status': bool(getattr(bi, 'rejection_status', False)),
                'rejection_note': getattr(bi, 'rejection_note', None),
                'rejected_at': getattr(bi, 'rejected_at', None).isoformat() if getattr(bi, 'rejected_at', None) else None,
                'accepted_at': getattr(bi, 'accepted_at', None).isoformat() if getattr(bi, 'accepted_at', None) else None,
                'quantity': bi.quantity,
                'unit_price': bi.unit_price,
                'total_price': bi.total_price,
                'item_id': it.id,
                'item_name': it.name,
                'image_url': it.image_url,
                'vendor_id': vp.id if vp else None,
                'vendor_company': vp.company_name if vp else None,
                'vendor_phone': vp.contact_phone if vp else None,
                'vendor_email': vp.contact_email if vp else None,
                'space_id': sp.id,
                'space_name': sp.name,
                'venue_id': ve.id,
                'venue_name': ve.name,
                'user_name': user_name,
                'booking_created_at': b.created_at.isoformat() if b.created_at else None,
            })
    
    # Add pagination metadata
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


@router.post('/admin/booking-items/{booking_item_id}/confirm')
async def confirm_booking_item(
    booking_item_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Mark an item as confirmed (required for the event) and optionally notify the vendor.
    Uses booking_items.booking_status to store 'confirmed' and leaves is_supplyed as False.
    """
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    # Update status to confirmed (indicates requirement to vendor)
    bi.booking_status = 'confirmed'
    await session.commit()

    # Send vendor email if vendor has an email (in background to avoid blocking)
    try:
        import threading
        import time
        
        def send_email_in_background(bi_id):
            """Send email notification in background thread"""
            time.sleep(0.2)  # Small delay to ensure main session is released
            
            try:
                from app.db import AsyncSessionLocal
                import asyncio
                
                async def send_email():
                    async with AsyncSessionLocal() as bg_session:
                        try:
                            # Use raw SQL to avoid performance_team_profile column issue
                            sql_query = text("""
                                SELECT 
                                    bi.id as bi_id, bi.booking_id, bi.item_id, bi.vendor_id, 
                                    bi.quantity, bi.unit_price, bi.total_price, bi.event_date,
                                    b.id as booking_id_val, b.booking_reference, b.event_type,
                                    i.id as item_id_val, i.name as item_name,
                                    vp.id as vendor_id_val, vp.contact_email,
                                    s.id as space_id_val, s.name as space_name,
                                    v.id as venue_id_val, v.name as venue_name
                                FROM booking_items bi
                                INNER JOIN bookings b ON b.id = bi.booking_id
                                INNER JOIN items i ON i.id = bi.item_id
                                INNER JOIN spaces s ON s.id = b.space_id
                                INNER JOIN venues v ON v.id = b.venue_id
                                LEFT JOIN vendor_profiles vp ON vp.id = bi.vendor_id
                                WHERE bi.id = :bi_id
                                LIMIT 1
                            """)
                            rs = await bg_session.execute(sql_query, {'bi_id': bi_id})
                            row = rs.first()
                            if row:
                                row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
                                vendor_email = row_dict.get('contact_email')
                                if vendor_email:
                                    details = {
                                        'booking_reference': row_dict.get('booking_reference'),
                                        'event_type': row_dict.get('event_type') or 'Event',
                                        'event_date': row_dict.get('event_date').isoformat() if row_dict.get('event_date') else None,
                                        'venue_name': row_dict.get('venue_name'),
                                        'space_name': row_dict.get('space_name'),
                                        'item_name': row_dict.get('item_name'),
                                        'quantity': row_dict.get('quantity'),
                                        'unit_price': row_dict.get('unit_price'),
                                        'total_price': row_dict.get('total_price'),
                                    }
                                    await NotificationService.send_vendor_item_confirmation_email(vendor_email, details)
                        except Exception as e:
                            print(f"[ADMIN] Background email error: {e}")
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                import asyncio
                
                async def send_email_safe():
                    try:
                        await asyncio.wait_for(send_email(), timeout=10.0)
                    except asyncio.TimeoutError:
                        print(f"[ADMIN] Email send timed out for booking item {bi_id}")
                    except Exception as e:
                        print(f"[ADMIN] Background email error: {e}")
                
                run_async_in_thread(send_email_safe)
            except Exception as e:
                print(f"[ADMIN] Background email thread error: {e}")
        
        # Use thread pool instead of creating unlimited threads
        from app.utils.thread_pool import submit_task
        submit_task(send_email_in_background, booking_item_id)
    except Exception as e:
        print(f"[ADMIN] Failed to start email thread: {e}")

    return {'ok': True, 'booking_item_id': bi.id, 'booking_status': bi.booking_status}


# ================= VENDORS (ADMIN) ================= #

@router.get('/admin/vendors')
async def admin_list_vendors(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    session: AsyncSession = Depends(get_session), 
    admin: User = Depends(admin_required)
):
    """List vendor profiles with basic user info. Paginated to prevent memory issues."""
    from datetime import datetime
    try:
        # Get total count first (lightweight query)
        count_stmt = select(func.count(VendorProfile.id))
        count_rs = await session.execute(count_stmt)
        total_count = count_rs.scalar() or 0
        
        # Fetch paginated results with only needed fields
        rs = await session.execute(
            select(VendorProfile, User)
            .join(User, User.id == VendorProfile.user_id)
            .order_by(VendorProfile.company_name.is_(None), VendorProfile.company_name.asc())
            .offset(skip)
            .limit(limit)
        )
        rows = rs.all()
        vendors = []
        now = datetime.utcnow()
        for vp, u in rows:
            suspended_until = getattr(vp, 'suspended_until', None)
            is_suspended = suspended_until is not None and suspended_until > now
            # Truncate description to prevent large payloads
            description = vp.description
            if description and len(description) > 500:
                description = description[:500] + '...'
            
            vendors.append({
                'id': vp.id,
                'user_id': vp.user_id,
                'username': u.username,
                'role': u.role,
                'company_name': vp.company_name,
                'description': description,
                'contact_email': vp.contact_email,
                'contact_phone': vp.contact_phone,
                'address': getattr(vp, 'address', None),
                'profile_image': getattr(u, 'profile_image', None),
                'suspended_until': suspended_until.isoformat() if suspended_until else None,
                'is_suspended': is_suspended,
                'created_at': getattr(vp, 'created_at', None),
            })
        return {'items': vendors, 'count': len(vendors), 'total': total_count, 'skip': skip, 'limit': limit}
    except Exception as e:
        print(f"[ADMIN VENDORS] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to list vendors: {str(e)}')


@router.get('/admin/vendors/{vendor_id}')
async def admin_get_vendor(vendor_id: int, session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    from datetime import datetime
    rs = await session.execute(
        select(VendorProfile, User)
        .join(User, User.id == VendorProfile.user_id)
        .where(VendorProfile.id == vendor_id)
    )
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Vendor not found')
    vp, u = row
    suspended_until = getattr(vp, 'suspended_until', None)
    now = datetime.utcnow()
    is_suspended = suspended_until is not None and suspended_until > now
    return {
        'id': vp.id,
        'user_id': vp.user_id,
        'username': u.username,
        'role': u.role,
        'company_name': vp.company_name,
        'description': vp.description,
        'contact_email': vp.contact_email,
        'contact_phone': vp.contact_phone,
        'address': getattr(vp, 'address', None),
        'profile_image': getattr(u, 'profile_image', None),
        'suspended_until': suspended_until.isoformat() if suspended_until else None,
        'is_suspended': is_suspended,
        'created_at': getattr(vp, 'created_at', None),
    }


@router.get('/admin/vendors/candidates')
async def admin_vendor_candidates(
    booking_item_id: Optional[int] = Query(default=None, description="Booking item ID to exclude vendors who rejected it"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List all vendors. If booking_item_id is provided, exclude vendors who have rejected that item."""
    # Get all vendors
    rs = await session.execute(
        select(VendorProfile, User)
        .join(User, VendorProfile.user_id == User.id)
        .where(User.role == 'vendor')
    )
    vendors_data = rs.all()
    
    # Get rejected vendor IDs for this booking item if provided
    rejected_vendor_ids = set()
    rejection_reasons = {}  # Map vendor_id -> rejection_note
    if booking_item_id:
        rs_rejections = await session.execute(
            select(BookingItemRejection)
            .where(BookingItemRejection.booking_item_id == booking_item_id)
        )
        rejections = rs_rejections.scalars().all()
        for rej in rejections:
            rejected_vendor_ids.add(rej.vendor_id)
            rejection_reasons[rej.vendor_id] = rej.rejection_note
    
    result = []
    for vp, u in vendors_data:
        is_rejected = vp.id in rejected_vendor_ids
        result.append({
            'id': vp.id,
            'user_id': vp.user_id,
            'username': u.username,
            'company_name': vp.company_name,
            'contact_email': vp.contact_email,
            'contact_phone': vp.contact_phone,
            'profile_image': getattr(u, 'profile_image', None),
            'is_rejected': is_rejected,
            'rejection_reason': rejection_reasons.get(vp.id) if is_rejected else None,
        })
    
    return result


@router.post('/admin/vendors')
async def admin_create_vendor(
    user_id: Optional[int] = Form(default=None),
    username: Optional[str] = Form(default=None),
    company_name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    contact_email: Optional[str] = Form(default=None),
    contact_phone: Optional[str] = Form(default=None),
    address: Optional[str] = Form(default=None),
    send_invite: bool = Form(default=True),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """
    Create a Vendor profile.

    Two modes:
    - Existing user: pass user_id. We'll create the VendorProfile and set role to 'vendor'.
    - New vendor user: don't pass user_id; provide contact_email (required) and optional username.
      We'll create a new User with role 'vendor', generated username (if not provided), and a temporary
      password, then create the VendorProfile and email credentials to contact_email.
    """

    created_user = None
    temp_password = None

    if user_id is None:
        # New user flow: require contact_email
        if not contact_email:
            raise HTTPException(status_code=422, detail='contact_email is required to create a new vendor user')

        # Build a base username from explicit username, company_name, or email local-part
        base = (username or (company_name or '').strip()) or contact_email.split('@')[0]
        base = base.lower().strip()
        # normalize to allowed chars [a-z0-9_]
        base = re.sub(r'[^a-z0-9_]+', '_', base) or 'vendor'
        candidate = base
        n = 0
        # ensure uniqueness
        while True:
            rs_u = await session.execute(select(User).where(User.username == candidate))
            if not rs_u.scalars().first():
                break
            n += 1
            candidate = f"{base}{n}"

        # generate temp password
        temp_password = secrets.token_urlsafe(8)
        created_user = User(
            username=candidate,
            password_hash=hash_password(temp_password),
            role='vendor',
            mobile=contact_phone,
        )
        session.add(created_user)
        await session.flush()  # get created_user.id
        actual_user_id = created_user.id
    else:
        # existing user path
        rs = await session.execute(select(User).where(User.id == user_id))
        user = rs.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        actual_user_id = user.id

        # Ensure no duplicate profile
        rs2 = await session.execute(select(VendorProfile).where(VendorProfile.user_id == actual_user_id))
        if rs2.scalars().first():
            raise HTTPException(status_code=400, detail='Vendor profile already exists for this user')
        # ensure role vendor
        if user.role != 'vendor':
            user.role = 'vendor'

    # Create vendor profile
    vp = VendorProfile(
        user_id=actual_user_id,
        company_name=company_name,
        description=description,
        contact_email=contact_email,
        contact_phone=contact_phone,
        address=address,
    )
    session.add(vp)
    await session.commit()
    await session.refresh(vp)

    # If we created a new user, send invitation email in background
    if created_user and contact_email and send_invite:
        try:
            import threading
            import time
            
            def send_vendor_invite_email_in_background(email, username, pwd):
                """Send vendor invitation email in background thread"""
                time.sleep(0.2)  # Small delay to ensure main session is released
                
                # CRITICAL FIX: Use asyncio.run() instead of creating new event loops
                # This prevents memory leaks from unclosed event loops
                try:
                    from app.utils.async_thread_helper import run_async_in_thread
                    import asyncio
                    
                    async def send_email():
                        try:
                            await asyncio.wait_for(
                                NotificationService.send_vendor_invitation_email(
                                    to_email=email,
                                    username=username,
                                    temp_password=pwd
                                ),
                                timeout=10.0
                            )
                        except asyncio.TimeoutError:
                            print(f"[ADMIN] Vendor invite email send timed out for {email}")
                        except Exception as e:
                            print(f"[ADMIN] Background vendor invite email error: {e}")
                    
                    # Use safe async runner instead of creating new event loop
                    run_async_in_thread(send_email)
                except Exception as e:
                    print(f"[ADMIN] Background vendor invite email thread error: {e}")
            
            # Start email in background thread
            thread = threading.Thread(
                target=send_vendor_invite_email_in_background,
                args=(contact_email, created_user.username, temp_password or ''),
                daemon=True
            )
            thread.start()
        except Exception as e:
            print(f"[ADMIN] Failed to start vendor invite email thread: {e}")

    return {
        'ok': True,
        'id': vp.id,
        'user_id': actual_user_id,
        'username': (created_user.username if created_user else None),
        'temp_password': (temp_password if created_user else None),
        'invited': bool(created_user is not None and send_invite),
    }


@router.post('/admin/vendors/{vendor_id}/invite')
async def admin_invite_vendor(
    vendor_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Generate a new temporary password and email credentials to the vendor's contact_email."""
    rs = await session.execute(
        select(VendorProfile, User).join(User, User.id == VendorProfile.user_id).where(VendorProfile.id == vendor_id)
    )
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Vendor not found')
    vp, user = row
    to_email = vp.contact_email
    if not to_email:
        raise HTTPException(status_code=400, detail='Vendor contact_email is not set')

    # Generate a new temp password and set it
    new_password = secrets.token_urlsafe(8)
    user.password_hash = hash_password(new_password)
    await session.commit()

    # Send invitation email in background thread to avoid blocking
    try:
        import threading
        import time
        
        def send_vendor_invite_email_in_background(email, username, pwd):
            """Send vendor invitation email in background thread"""
            time.sleep(0.2)  # Small delay to ensure main session is released
            
            try:
                import asyncio
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                import asyncio
                
                async def send_email():
                    try:
                        await asyncio.wait_for(
                            NotificationService.send_vendor_invitation_email(
                                to_email=email,
                                username=username,
                                temp_password=pwd
                            ),
                            timeout=10.0
                        )
                    except asyncio.TimeoutError:
                        print(f"[ADMIN] Vendor invite email send timed out for {email}")
                    except Exception as e:
                        print(f"[ADMIN] Background vendor invite email error: {e}")
                
                run_async_in_thread(send_email)
            except Exception as e:
                print(f"[ADMIN] Background vendor invite email thread error: {e}")
        
        # Start email in background thread
        thread = threading.Thread(
            target=send_vendor_invite_email_in_background,
            args=(to_email, user.username, new_password),
            daemon=True
        )
        thread.start()
    except Exception as e:
        print(f"[ADMIN] Failed to start vendor invite email thread: {e}")
        # Don't raise error - email sending failure shouldn't block the response

    return {'ok': True, 'vendor_id': vendor_id, 'username': user.username}


@router.put('/admin/vendors/{vendor_id}')
async def admin_update_vendor(
    vendor_id: int,
    company_name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    contact_email: Optional[str] = Form(default=None),
    contact_phone: Optional[str] = Form(default=None),
    address: Optional[str] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Update vendor profile details."""
    rs = await session.execute(
        select(VendorProfile).where(VendorProfile.id == vendor_id)
    )
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor not found')
    
    # Update fields if provided
    if company_name is not None:
        vp.company_name = company_name
    if description is not None:
        vp.description = description
    if contact_email is not None:
        vp.contact_email = contact_email
    if contact_phone is not None:
        vp.contact_phone = contact_phone
    if address is not None:
        vp.address = address
    
    await session.commit()
    await session.refresh(vp)
    
    return {
        'ok': True,
        'vendor_id': vendor_id,
        'company_name': vp.company_name,
        'description': vp.description,
        'contact_email': vp.contact_email,
        'contact_phone': vp.contact_phone,
        'address': vp.address,
    }


@router.post('/admin/vendors/{vendor_id}/suspend')
async def admin_suspend_vendor(
    vendor_id: int,
    suspended_until: Optional[str] = Form(default=None),  # ISO format datetime string
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Suspend a vendor until a specific date. If suspended_until is None or empty, unsuspend the vendor."""
    rs = await session.execute(
        select(VendorProfile).where(VendorProfile.id == vendor_id)
    )
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor not found')
    
    if suspended_until:
        try:
            # Handle both date-only (YYYY-MM-DD) and ISO datetime strings
            if 'T' in suspended_until or '+' in suspended_until or 'Z' in suspended_until:
                # ISO format datetime string
                suspended_until_dt = datetime.fromisoformat(suspended_until.replace('Z', '+00:00'))
                # Convert to UTC if timezone-aware, otherwise assume UTC
                if suspended_until_dt.tzinfo:
                    suspended_until_dt = suspended_until_dt.astimezone(timedelta(hours=0)).replace(tzinfo=None)
            else:
                # Date-only format (YYYY-MM-DD) - set to end of day in UTC
                from datetime import date as date_type
                date_parts = suspended_until.split('-')
                if len(date_parts) == 3:
                    year, month, day = int(date_parts[0]), int(date_parts[1]), int(date_parts[2])
                    suspended_until_dt = datetime(year, month, day, 23, 59, 59)
                else:
                    raise ValueError('Invalid date format')
            vp.suspended_until = suspended_until_dt
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f'Invalid date format: {e}')
    else:
        # Unsuspend by setting to None
        vp.suspended_until = None
    
    await session.commit()
    await session.refresh(vp)
    
    return {
        'ok': True,
        'vendor_id': vendor_id,
        'suspended_until': vp.suspended_until.isoformat() if vp.suspended_until else None,
        'is_suspended': vp.suspended_until is not None and vp.suspended_until > datetime.utcnow()
    }


# ================= BROKERS (ADMIN) ================= #

@router.get('/admin/brokers')
async def admin_list_brokers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    session: AsyncSession = Depends(get_session), 
    admin: User = Depends(admin_required)
):
    """List broker profiles with basic user info. Paginated to prevent memory issues."""
    from datetime import datetime
    try:
        # Get total count first (lightweight query)
        count_stmt = select(func.count(BrokerProfile.id))
        count_rs = await session.execute(count_stmt)
        total_count = count_rs.scalar() or 0
        
        # Fetch paginated results with only needed fields
        rs = await session.execute(
            select(BrokerProfile, User)
            .join(User, User.id == BrokerProfile.user_id)
            .order_by(BrokerProfile.company_name.is_(None), BrokerProfile.company_name.asc())
            .offset(skip)
            .limit(limit)
        )
        rows = rs.all()
        brokers = []
        now = datetime.utcnow()
        for bp, u in rows:
            suspended_until = getattr(bp, 'suspended_until', None)
            is_suspended = suspended_until is not None and suspended_until > now
            # Truncate description to prevent large payloads
            description = bp.description
            if description and len(description) > 500:
                description = description[:500] + '...'
            
            brokers.append({
                'id': bp.id,
                'user_id': bp.user_id,
                'username': u.username,
                'role': u.role,
                'company_name': bp.company_name,
                'description': description,
                'contact_email': bp.contact_email,
                'contact_phone': bp.contact_phone,
                'address': getattr(bp, 'address', None),
                'brokerage_percentage': float(getattr(bp, 'brokerage_percentage', 0.0)),
                'bank_account_name': getattr(bp, 'bank_account_name', None),
                'bank_account_number': getattr(bp, 'bank_account_number', None),
                'bank_ifsc_code': getattr(bp, 'bank_ifsc_code', None),
                'bank_name': getattr(bp, 'bank_name', None),
                'profile_image': getattr(u, 'profile_image', None),
                'suspended_until': suspended_until.isoformat() if suspended_until else None,
                'is_suspended': is_suspended,
                'is_approved': getattr(bp, 'is_approved', False),
                'created_at': getattr(bp, 'created_at', None),
            })
        return {'items': brokers, 'count': len(brokers), 'total': total_count, 'skip': skip, 'limit': limit}
    except Exception as e:
        print(f"[ADMIN BROKERS] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to list brokers: {str(e)}')


@router.get('/admin/brokers/{broker_id}')
async def admin_get_broker(broker_id: int, session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    from datetime import datetime
    rs = await session.execute(
        select(BrokerProfile, User)
        .join(User, User.id == BrokerProfile.user_id)
        .where(BrokerProfile.id == broker_id)
    )
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Broker not found')
    bp, u = row
    suspended_until = getattr(bp, 'suspended_until', None)
    now = datetime.utcnow()
    is_suspended = suspended_until is not None and suspended_until > now
    return {
        'id': bp.id,
        'user_id': bp.user_id,
        'username': u.username,
        'role': u.role,
        'company_name': bp.company_name,
        'description': bp.description,
        'contact_email': bp.contact_email,
        'contact_phone': bp.contact_phone,
        'address': getattr(bp, 'address', None),
        'brokerage_percentage': float(getattr(bp, 'brokerage_percentage', 0.0)),
        'bank_account_name': getattr(bp, 'bank_account_name', None),
        'bank_account_number': getattr(bp, 'bank_account_number', None),
        'bank_ifsc_code': getattr(bp, 'bank_ifsc_code', None),
        'bank_name': getattr(bp, 'bank_name', None),
        'profile_image': getattr(u, 'profile_image', None),
        'suspended_until': suspended_until.isoformat() if suspended_until else None,
        'is_suspended': is_suspended,
        'is_approved': getattr(bp, 'is_approved', False),
        'created_at': getattr(bp, 'created_at', None),
    }


@router.post('/admin/brokers')
async def admin_create_broker(
    user_id: Optional[int] = Form(default=None),
    username: Optional[str] = Form(default=None),
    company_name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    contact_email: Optional[str] = Form(default=None),
    contact_phone: Optional[str] = Form(default=None),
    address: Optional[str] = Form(default=None),
    brokerage_percentage: Optional[float] = Form(default=None),
    send_invite: bool = Form(default=True),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """
    Create a Broker profile.

    Two modes:
    - Existing user: pass user_id. We'll create the BrokerProfile and set role to 'broker'.
    - New broker user: don't pass user_id; provide contact_email (required) and optional username.
      We'll create a new User with role 'broker', generated username (if not provided), and a temporary
      password, then create the BrokerProfile and email credentials to contact_email.
    """

    created_user = None
    temp_password = None

    if user_id is None:
        # New user flow: require contact_email
        if not contact_email:
            raise HTTPException(status_code=422, detail='contact_email is required to create a new broker user')

        # Build a base username from explicit username, company_name, or email local-part
        base = (username or (company_name or '').strip()) or contact_email.split('@')[0]
        base = base.lower().strip()
        # normalize to allowed chars [a-z0-9_]
        base = re.sub(r'[^a-z0-9_]+', '_', base) or 'broker'
        candidate = base
        n = 0
        # ensure uniqueness
        while True:
            rs_u = await session.execute(select(User).where(User.username == candidate))
            if not rs_u.scalars().first():
                break
            n += 1
            candidate = f"{base}{n}"

        # generate temp password
        temp_password = secrets.token_urlsafe(8)
        created_user = User(
            username=candidate,
            password_hash=hash_password(temp_password),
            role='broker',
            mobile=contact_phone,
        )
        session.add(created_user)
        await session.flush()  # get created_user.id
        actual_user_id = created_user.id
    else:
        # existing user path
        rs = await session.execute(select(User).where(User.id == user_id))
        user = rs.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        actual_user_id = user.id

        # Ensure no duplicate profile
        rs2 = await session.execute(select(BrokerProfile).where(BrokerProfile.user_id == actual_user_id))
        if rs2.scalars().first():
            raise HTTPException(status_code=400, detail='Broker profile already exists for this user')
        # ensure role broker
        if user.role != 'broker':
            user.role = 'broker'

    # Validate brokerage percentage if provided
    final_brokerage_percentage = 0.0
    if brokerage_percentage is not None:
        if brokerage_percentage < 0 or brokerage_percentage > 100:
            raise HTTPException(status_code=400, detail='Brokerage percentage must be between 0 and 100')
        final_brokerage_percentage = float(brokerage_percentage)
    
    # Create broker profile
    bp = BrokerProfile(
        user_id=actual_user_id,
        company_name=company_name,
        description=description,
        contact_email=contact_email,
        contact_phone=contact_phone,
        address=address,
        brokerage_percentage=final_brokerage_percentage,
    )
    session.add(bp)
    await session.commit()
    await session.refresh(bp)

    # If we created a new user, send invitation email in background (reuse vendor invitation template)
    if created_user and contact_email and send_invite:
        try:
            import threading
            import time
            
            def send_broker_invite_email_in_background(email, username, pwd):
                """Send broker invitation email in background thread"""
                time.sleep(0.2)  # Small delay to ensure main session is released
                
                try:
                    import asyncio
                    
                    # CRITICAL FIX: Use safe async runner instead of creating new event loop
                    from app.utils.async_thread_helper import run_async_in_thread
                    import asyncio
                    
                    async def send_email():
                        try:
                            await asyncio.wait_for(
                                NotificationService.send_vendor_invitation_email(
                                    to_email=email,
                                    username=username,
                                    temp_password=pwd
                                ),
                                timeout=10.0
                            )
                        except asyncio.TimeoutError:
                            print(f"[ADMIN] Broker invite email send timed out for {email}")
                        except Exception as e:
                            print(f"[ADMIN] Background broker invite email error: {e}")
                    
                    run_async_in_thread(send_email)
                except Exception as e:
                    print(f"[ADMIN] Background broker invite email thread error: {e}")
            
            # Start email in background thread
            thread = threading.Thread(
                target=send_broker_invite_email_in_background,
                args=(contact_email, created_user.username, temp_password or ''),
                daemon=True
            )
            thread.start()
        except Exception as e:
            print(f"[ADMIN] Failed to start broker invite email thread: {e}")

    return {
        'ok': True,
        'id': bp.id,
        'user_id': actual_user_id,
        'username': (created_user.username if created_user else None),
        'temp_password': (temp_password if created_user else None),
        'invited': bool(created_user is not None and send_invite),
    }


@router.post('/admin/brokers/{broker_id}/invite')
async def admin_invite_broker(
    broker_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Send invitation email to broker with credentials."""
    rs = await session.execute(
        select(BrokerProfile, User).join(User, User.id == BrokerProfile.user_id).where(BrokerProfile.id == broker_id)
    )
    row = rs.first()
    if not row:
        raise HTTPException(status_code=404, detail='Broker not found')
    bp, u = row
    
    if not bp.contact_email:
        raise HTTPException(status_code=400, detail='Broker has no contact email')
    
    # Generate new temp password
    temp_password = secrets.token_urlsafe(8)
    u.password_hash = hash_password(temp_password)
    await session.commit()
    
    # Send invitation email in background thread to avoid blocking
    try:
        import threading
        import time
        
        def send_broker_invite_email_in_background(email, username, pwd):
            """Send broker invitation email in background thread"""
            time.sleep(0.2)  # Small delay to ensure main session is released
            
            try:
                import asyncio
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                import asyncio
                
                async def send_email():
                    try:
                        await asyncio.wait_for(
                            NotificationService.send_vendor_invitation_email(
                                to_email=email,
                                username=username,
                                temp_password=pwd
                            ),
                            timeout=10.0
                        )
                    except asyncio.TimeoutError:
                        print(f"[ADMIN] Broker invite email send timed out for {email}")
                    except Exception as e:
                        print(f"[ADMIN] Background broker invite email error: {e}")
                
                run_async_in_thread(send_email)
            except Exception as e:
                print(f"[ADMIN] Background broker invite email thread error: {e}")
        
        # Start email in background thread
        thread = threading.Thread(
            target=send_broker_invite_email_in_background,
            args=(bp.contact_email, u.username, temp_password),
            daemon=True
        )
        thread.start()
    except Exception as e:
        print(f"[ADMIN] Failed to start broker invite email thread: {e}")
        # Don't raise error - email sending failure shouldn't block the response
    
    return {'ok': True, 'message': 'Invitation sent'}


@router.put('/admin/brokers/{broker_id}')
async def admin_update_broker(
    broker_id: int,
    company_name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    contact_email: Optional[str] = Form(default=None),
    contact_phone: Optional[str] = Form(default=None),
    address: Optional[str] = Form(default=None),
    brokerage_percentage: Optional[float] = Form(default=None),
    bank_account_name: Optional[str] = Form(default=None),
    bank_account_number: Optional[str] = Form(default=None),
    bank_ifsc_code: Optional[str] = Form(default=None),
    bank_name: Optional[str] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Update broker profile details."""
    rs = await session.execute(
        select(BrokerProfile).where(BrokerProfile.id == broker_id)
    )
    bp = rs.scalars().first()
    if not bp:
        raise HTTPException(status_code=404, detail='Broker not found')
    
    # Update fields if provided
    if company_name is not None:
        bp.company_name = company_name
    if description is not None:
        bp.description = description
    if contact_email is not None:
        bp.contact_email = contact_email
    if contact_phone is not None:
        bp.contact_phone = contact_phone
    if address is not None:
        bp.address = address
    if brokerage_percentage is not None:
        if brokerage_percentage < 0 or brokerage_percentage > 100:
            raise HTTPException(status_code=400, detail='Brokerage percentage must be between 0 and 100')
        bp.brokerage_percentage = float(brokerage_percentage)
    if bank_account_name is not None:
        bp.bank_account_name = bank_account_name
    if bank_account_number is not None:
        bp.bank_account_number = bank_account_number
    if bank_ifsc_code is not None:
        bp.bank_ifsc_code = bank_ifsc_code
    if bank_name is not None:
        bp.bank_name = bank_name
    
    await session.commit()
    await session.refresh(bp)
    
    return {
        'ok': True,
        'broker_id': broker_id,
        'company_name': bp.company_name,
        'description': bp.description,
        'contact_email': bp.contact_email,
        'contact_phone': bp.contact_phone,
        'address': bp.address,
        'brokerage_percentage': float(bp.brokerage_percentage),
        'bank_account_name': getattr(bp, 'bank_account_name', None),
        'bank_account_number': getattr(bp, 'bank_account_number', None),
        'bank_ifsc_code': getattr(bp, 'bank_ifsc_code', None),
        'bank_name': getattr(bp, 'bank_name', None),
    }


@router.post('/admin/brokers/{broker_id}/approve')
async def admin_approve_broker(
    broker_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Approve a broker account"""
    rs = await session.execute(
        select(BrokerProfile).where(BrokerProfile.id == broker_id)
    )
    bp = rs.scalar_one_or_none()
    if not bp:
        raise HTTPException(status_code=404, detail='Broker not found')
    
    bp.is_approved = True
    await session.commit()
    
    return {'ok': True, 'message': 'Broker approved successfully'}


@router.post('/admin/brokers/{broker_id}/suspend')
async def admin_suspend_broker(
    broker_id: int,
    suspended_until: Optional[str] = Form(default=None),  # ISO format datetime string
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Suspend a broker until a specific date. If suspended_until is None or empty, unsuspend the broker."""
    rs = await session.execute(
        select(BrokerProfile).where(BrokerProfile.id == broker_id)
    )
    bp = rs.scalars().first()
    if not bp:
        raise HTTPException(status_code=404, detail='Broker not found')
    
    if suspended_until:
        try:
            # Handle both date-only (YYYY-MM-DD) and ISO datetime strings
            if 'T' in suspended_until or '+' in suspended_until or 'Z' in suspended_until:
                # ISO format datetime string
                suspended_until_dt = datetime.fromisoformat(suspended_until.replace('Z', '+00:00'))
                # Convert to UTC if timezone-aware, otherwise assume UTC
                if suspended_until_dt.tzinfo:
                    suspended_until_dt = suspended_until_dt.astimezone(timedelta(hours=0)).replace(tzinfo=None)
            else:
                # Date-only format (YYYY-MM-DD) - set to end of day in UTC
                from datetime import date as date_type
                date_parts = suspended_until.split('-')
                if len(date_parts) == 3:
                    year, month, day = int(date_parts[0]), int(date_parts[1]), int(date_parts[2])
                    suspended_until_dt = datetime(year, month, day, 23, 59, 59)
                else:
                    raise ValueError('Invalid date format')
            bp.suspended_until = suspended_until_dt
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f'Invalid date format: {e}')
    else:
        # Unsuspend by setting to None
        bp.suspended_until = None
    
    await session.commit()
    await session.refresh(bp)
    
    return {
        'ok': True,
        'broker_id': broker_id,
        'suspended_until': bp.suspended_until.isoformat() if bp.suspended_until else None,
        'is_suspended': bp.suspended_until is not None and bp.suspended_until > datetime.utcnow()
    }


# ================= CUSTOMERS/CLIENTS (ADMIN) ================= #

@router.get('/admin/customers')
async def admin_list_customers(session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    """List all customer users."""
    from datetime import datetime
    rs = await session.execute(
        select(User)
        .where(User.role == 'customer')
        .order_by(User.created_at.desc())
    )
    users = rs.scalars().all()
    customers = []
    now = datetime.utcnow()
    for u in users:
        suspended_until = getattr(u, 'suspended_until', None)
        is_suspended = suspended_until is not None and suspended_until > now
        customers.append({
            'id': u.id,
            'user_id': u.id,
            'username': u.username,
            'role': u.role,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'mobile': u.mobile,
            'profile_image': getattr(u, 'profile_image', None),
            'suspended_until': suspended_until.isoformat() if suspended_until else None,
            'is_suspended': is_suspended,
            'created_at': u.created_at.isoformat() if u.created_at else None,
        })
    return {'items': customers, 'count': len(customers)}


@router.get('/admin/customers/{user_id}')
async def admin_get_customer(user_id: int, session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    """Get customer details by user ID."""
    from datetime import datetime
    rs = await session.execute(select(User).where(User.id == user_id, User.role == 'customer'))
    u = rs.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail='Customer not found')
    
    suspended_until = getattr(u, 'suspended_until', None)
    now = datetime.utcnow()
    is_suspended = suspended_until is not None and suspended_until > now
    
    return {
        'id': u.id,
        'user_id': u.id,
        'username': u.username,
        'role': u.role,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'mobile': u.mobile,
        'profile_image': getattr(u, 'profile_image', None),
        'suspended_until': suspended_until.isoformat() if suspended_until else None,
        'is_suspended': is_suspended,
        'created_at': u.created_at.isoformat() if u.created_at else None,
    }


@router.post('/admin/customers/{user_id}/suspend')
async def admin_suspend_customer(
    user_id: int,
    suspended_until: Optional[str] = Form(default=None),  # ISO format datetime string
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Suspend a customer until a specific date. If suspended_until is None or empty, unsuspend the customer."""
    rs = await session.execute(select(User).where(User.id == user_id, User.role == 'customer'))
    user = rs.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail='Customer not found')
    
    if suspended_until:
        try:
            # Handle both date-only (YYYY-MM-DD) and ISO datetime strings
            if 'T' in suspended_until or '+' in suspended_until or 'Z' in suspended_until:
                # ISO format datetime string
                suspended_until_dt = datetime.fromisoformat(suspended_until.replace('Z', '+00:00'))
                # Convert to UTC if timezone-aware, otherwise assume UTC
                if suspended_until_dt.tzinfo:
                    suspended_until_dt = suspended_until_dt.astimezone(timedelta(hours=0)).replace(tzinfo=None)
            else:
                # Date-only format (YYYY-MM-DD) - set to end of day in UTC
                date_parts = suspended_until.split('-')
                if len(date_parts) == 3:
                    year, month, day = int(date_parts[0]), int(date_parts[1]), int(date_parts[2])
                    suspended_until_dt = datetime(year, month, day, 23, 59, 59)
                else:
                    raise ValueError('Invalid date format')
            user.suspended_until = suspended_until_dt
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f'Invalid date format: {e}')
    else:
        # Unsuspend by setting to None
        user.suspended_until = None
    
    await session.commit()
    await session.refresh(user)
    
    return {
        'ok': True,
        'user_id': user_id,
        'suspended_until': user.suspended_until.isoformat() if user.suspended_until else None,
        'is_suspended': user.suspended_until is not None and user.suspended_until > datetime.utcnow()
    }


@router.get('/admin/vendors/{vendor_id}/items')
async def admin_vendor_items(
    vendor_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    # Use raw SQL to avoid performance_team_profile column issue
    sql_query = text("""
        SELECT 
            bi.id as booking_item_id, bi.booking_id, bi.vendor_id, bi.quantity, 
            bi.unit_price, bi.total_price, bi.event_date, bi.booking_status,
            bi.is_supplyed, bi.rejection_status, bi.rejection_note, bi.rejected_at,
            bi.accepted_at,
            b.id as booking_id_val, b.booking_reference, b.event_type, b.status as booking_status_main,
            i.id as item_id, i.name as item_name, i.image_url as item_image_url,
            s.id as space_id, s.name as space_name,
            v.id as venue_id, v.name as venue_name
        FROM booking_items bi
        INNER JOIN bookings b ON b.id = bi.booking_id
        INNER JOIN items i ON i.id = bi.item_id
        INNER JOIN spaces s ON s.id = b.space_id
        INNER JOIN venues v ON v.id = b.venue_id
        WHERE bi.vendor_id = :vendor_id
        ORDER BY 
            CASE WHEN bi.event_date IS NULL THEN 1 ELSE 0 END,
            bi.event_date ASC
    """)
    rs = await session.execute(sql_query, {'vendor_id': vendor_id})
    rows = rs.all()
    items = []
    for row in rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        event_date = row_dict.get('event_date')
        rejected_at = row_dict.get('rejected_at')
        accepted_at = row_dict.get('accepted_at')
        
        items.append({
            'booking_item_id': row_dict.get('booking_item_id'),
            'booking_id': row_dict.get('booking_id_val'),
            'booking_reference': row_dict.get('booking_reference'),
            'event_type': row_dict.get('event_type'),
            'event_date': event_date.isoformat() if event_date else None,
            'booking_status': row_dict.get('booking_status') or row_dict.get('booking_status_main'),
            'is_supplyed': bool(row_dict.get('is_supplyed', False)),
            'rejection_status': bool(row_dict.get('rejection_status', False)),
            'rejection_note': row_dict.get('rejection_note'),
            'rejected_at': rejected_at.isoformat() if rejected_at else None,
            'accepted_at': accepted_at.isoformat() if accepted_at else None,
            'quantity': row_dict.get('quantity'),
            'unit_price': row_dict.get('unit_price'),
            'total_price': row_dict.get('total_price'),
            'item_id': row_dict.get('item_id'),
            'item_name': row_dict.get('item_name'),
            'item_image_url': row_dict.get('item_image_url'),
            'space_id': row_dict.get('space_id'),
            'space_name': row_dict.get('space_name'),
            'venue_id': row_dict.get('venue_id'),
            'venue_name': row_dict.get('venue_name'),
        })
    return {'items': items, 'count': len(items)}


@router.post('/admin/booking-items/{booking_item_id}/supplied')
async def mark_booking_item_supplied(
    booking_item_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Mark booking item as supplied or unsupplied. Admin only."""
    supplied = request.get('supplied', True)  # Default to True if not provided
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    
    bi.is_supplied = bool(supplied)
    
    # If marking as unsupplied, also clear supply_verified and related timestamps
    if not supplied:
        bi.supply_verified = False
        bi.verified_at = None
        bi.supplied_at = None
    elif supplied and not bi.supplied_at:
        # If marking as supplied and supplied_at is not set, set it now
        bi.supplied_at = datetime.utcnow()
    
    await session.commit()
    return {'ok': True, 'booking_item_id': bi.id, 'is_supplied': bool(bi.is_supplied)}


@router.post('/admin/booking-items/{booking_item_id}/verify-supply')
async def verify_supply(
    booking_item_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Admin verifies that a vendor has supplied an item"""
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    
    if not bi.is_supplied:
        raise HTTPException(status_code=400, detail='Item must be marked as supplied before verification')
    
    bi.supply_verified = True
    bi.verified_at = datetime.utcnow()
    await session.commit()
    
    return {'ok': True, 'booking_item_id': bi.id, 'supply_verified': True, 'verified_at': bi.verified_at.isoformat() if bi.verified_at else None}


@router.post('/admin/booking-items/{booking_item_id}/cancel-vendor')
async def cancel_vendor_assignment(
    booking_item_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Cancel/unassign vendor from a booking item with admin note"""
    cancellation_note = request.get('cancellation_note', '').strip()
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    
    if not bi.vendor_id:
        raise HTTPException(status_code=400, detail='No vendor assigned to this item')
    
    # Store the previous vendor info for logging
    previous_vendor_id = bi.vendor_id
    rs_vendor = await session.execute(select(VendorProfile).where(VendorProfile.id == previous_vendor_id))
    previous_vendor = rs_vendor.scalars().first()
    
    # Unassign vendor and store cancellation note in rejection_note field
    # (we'll use rejection_note to store admin cancellation notes)
    bi.vendor_id = None
    bi.rejection_status = True  # Mark as cancelled by admin
    bi.rejection_note = f"[Admin Cancelled] {cancellation_note}" if cancellation_note else "[Admin Cancelled] No note provided"
    bi.rejected_at = datetime.utcnow()
    bi.booking_status = 'approved'  # Reset to approved so it can be reassigned
    bi.accepted_at = None  # Clear acceptance if any
    
    await session.commit()
    
    return {
        'ok': True,
        'booking_item_id': booking_item_id,
        'previous_vendor_id': previous_vendor_id,
        'previous_vendor_name': previous_vendor.company_name if previous_vendor else None,
        'cancellation_note': cancellation_note,
        'cancelled_at': bi.rejected_at.isoformat() if bi.rejected_at else None
    }


@router.post('/admin/booking-items/{booking_item_id}/reassign-vendor')
async def reassign_vendor(
    booking_item_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Reassign a rejected booking item to another vendor"""
    vendor_id = request.get('vendor_id')
    if not vendor_id:
        raise HTTPException(status_code=400, detail='vendor_id is required')
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Booking item not found')
    
    # Check if this vendor has previously rejected this item
    rs_rejection = await session.execute(
        select(BookingItemRejection).where(
            BookingItemRejection.booking_item_id == booking_item_id,
            BookingItemRejection.vendor_id == vendor_id
        )
    )
    existing_rejection = rs_rejection.scalars().first()
    if existing_rejection:
        raise HTTPException(
            status_code=400, 
            detail=f'This vendor has previously rejected this item. Reason: {existing_rejection.rejection_note or "Not provided"}'
        )
    
    rs_vendor = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
    vendor = rs_vendor.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail='Vendor not found')
    
    # Store data needed for notification BEFORE committing
    vendor_phone = vendor.contact_phone
    vendor_company = vendor.company_name or 'Vendor'
    
    # Reset rejection status when reassigning (even if it was admin cancelled)
    bi.vendor_id = vendor_id
    bi.rejection_status = False
    bi.rejection_note = None
    bi.rejected_at = None
    bi.booking_status = 'pending'  # Reset to pending for new vendor
    await session.commit()
    
    # Load item details for notification BEFORE committing
    rs_item = await session.execute(select(Item).where(Item.id == bi.item_id))
    item = rs_item.scalars().first()
    item_name = item.name if item else f'Item #{bi.item_id}'
    item_quantity = bi.quantity
    booking_id = bi.booking_id
    
    # Send WhatsApp notification in background thread (non-blocking)
    if vendor_phone:
        import threading
        import time
        
        def send_whatsapp_notification(phone_num, company, item_nm, qty, bk_id):
            """Send WhatsApp notification in background thread"""
            # Small delay to ensure main session is fully released
            time.sleep(0.2)
            
            try:
                from ..services.route_mobile import send_session_message
                import asyncio
                
                # Format phone number
                phone = phone_num.strip()
                if not phone.startswith('+'):
                    if not phone.startswith('91'):
                        phone = '+91' + phone.lstrip('0')
                    else:
                        phone = '+' + phone
                
                message = f"Hello {company},\n\n"
                message += f"You have been assigned to supply:\n"
                message += f"• Item: {item_nm}\n"
                message += f"• Quantity: {qty}\n"
                message += f"• Booking ID: #{bk_id}\n"
                message += f"\nPlease confirm your availability.\n\nThank you!"
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                import asyncio
                
                async def send_whatsapp():
                    try:
                        await asyncio.wait_for(
                            send_session_message(phone, text=message),
                            timeout=10.0
                        )
                    except asyncio.TimeoutError:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"WhatsApp send timed out for vendor {vendor_id}")
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Failed to send WhatsApp to vendor {vendor_id}: {str(e)}")
                
                run_async_in_thread(send_whatsapp)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to send WhatsApp to vendor {vendor_id}: {str(e)}")
        
        # Start thread - this won't block the response
        thread = threading.Thread(
            target=send_whatsapp_notification,
            args=(vendor_phone, vendor_company, item_name, item_quantity, booking_id),
            daemon=True
        )
        thread.start()
    
    return {
        'ok': True,
        'booking_item_id': booking_item_id,
        'vendor_id': vendor_id,
        'vendor_company': vendor.company_name,
    }


@router.post('/admin/bookings/{booking_id}/approve')
async def approve_booking(booking_id: int, note: Optional[str] = None, background_tasks: BackgroundTasks = BackgroundTasks(), session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    try:
        rs = await session.execute(select(Booking).where(Booking.id == booking_id))
        booking = rs.scalars().first()
        if not booking:
            raise HTTPException(status_code=404, detail='Booking not found')
        
        prev = booking.status
        # Update status
        booking.status = 'approved'
        if note is not None:
            booking.admin_note = note
        
        # Auto-assign vendors for booking items that already have a vendor_id
        # This happens when items have a default vendor assigned in the catalog
        # Use raw SQL to avoid performance_team_profile column issue
        sql_query = text("""
            SELECT 
                bi.id, bi.booking_id, bi.item_id, bi.vendor_id, bi.booking_status,
                bi.rejection_status, bi.rejection_note, bi.rejected_at,
                i.id as item_id_val, i.vendor_id as item_vendor_id,
                v.id as venue_id_val
            FROM booking_items bi
            INNER JOIN items i ON i.id = bi.item_id
            INNER JOIN bookings b ON b.id = bi.booking_id
            INNER JOIN venues v ON v.id = b.venue_id
            WHERE bi.booking_id = :booking_id
        """)
        rs_items = await session.execute(sql_query, {'booking_id': booking.id})
        items_data = rs_items.all()
        
        # Fetch BookingItem objects for updates
        booking_items_query = select(BookingItem).where(BookingItem.booking_id == booking.id)
        rs_booking_items = await session.execute(booking_items_query)
        booking_items_map = {bi.id: bi for bi in rs_booking_items.scalars().all()}
        
        # Load Item and Venue objects for all booking items
        item_ids = [row_dict.get('item_id') for row in items_data for row_dict in [dict(row._mapping) if hasattr(row, '_mapping') else dict(row)] if row_dict.get('item_id')]
        items_map = {}
        if item_ids:
            rs_items = await session.execute(select(Item).where(Item.id.in_(item_ids)))
            items_map = {item.id: item for item in rs_items.scalars().all()}
        
        # Load venue (same for all items in a booking)
        venue = None
        if booking.venue_id:
            rs_venue = await session.execute(select(Venue).where(Venue.id == booking.venue_id))
            venue = rs_venue.scalar_one_or_none()
        
        booking_items_with_vendors = []
        for row in items_data:
            row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
            bi_id = row_dict.get('id')
            bi = booking_items_map.get(bi_id)
            
            if not bi:
                continue
            
            # Get item for this booking item
            item_id = row_dict.get('item_id')
            item = items_map.get(item_id) if item_id else None
                
            vendor_assigned = False
            # If booking item doesn't have a vendor_id but the item has one, assign it
            if not bi.vendor_id and row_dict.get('item_vendor_id'):
                bi.vendor_id = row_dict.get('item_vendor_id')
                vendor_assigned = True
                # Set booking_status to 'pending' so vendor sees it as a new assignment
                if not bi.booking_status or bi.booking_status not in ['pending', 'confirmed', 'cancelled']:
                    bi.booking_status = 'pending'
                booking_items_with_vendors.append((bi, item, venue, vendor_assigned))
            # If booking item already has a vendor_id, ensure it's properly assigned
            elif bi.vendor_id:
                vendor_assigned = True
                # Set booking_status to 'pending' if not already set or if it was rejected
                if not bi.booking_status or bi.booking_status not in ['pending', 'confirmed', 'cancelled']:
                    bi.booking_status = 'pending'
                # Reset rejection status if this is a reassignment after approval
                if bi.rejection_status:
                    bi.rejection_status = False
                    bi.rejection_note = None
                    bi.rejected_at = None
                booking_items_with_vendors.append((bi, item, venue, vendor_assigned))
        
        # Try to record the event before committing (in same transaction)
        try:
            ev = BookingEvent(
                booking_id=booking.id, 
                actor_user_id=admin.id, 
                from_status=prev, 
                to_status='approved', 
                note=note or 'Booking approved'
            )
            session.add(ev)
        except Exception as e:
            # If BookingEvent table doesn't exist or has issues, log but continue
            print(f"[ADMIN] Warning: failed to create BookingEvent (approve): {e}")
        
        # Commit the status change, vendor assignments, and event (if it was added)
        await session.commit()
        await session.refresh(booking)
        
        # IMPORTANT: Store data needed for notifications BEFORE closing session
        # This ensures we capture everything we need from the session
        response_data = {'ok': True, 'booking_id': booking.id}
        user_id = booking.user_id
        space_id = booking.space_id
        venue_id = booking.venue_id
        # Don't shadow the function parameter - use booking.id directly or a different variable
        stored_booking_id = booking.id
        booking_ref = booking.booking_reference
        
        # Store vendor assignment data for notifications (before session closes)
        vendor_notifications = []
        for bi, item, venue, was_just_assigned in booking_items_with_vendors:
            if bi.vendor_id:
                # Load vendor details
                rs_vendor = await session.execute(
                    select(VendorProfile).where(VendorProfile.id == bi.vendor_id)
                )
                vendor = rs_vendor.scalars().first()
                if vendor:
                    # Ensure item and venue are loaded if not already
                    if not item:
                        rs_item = await session.execute(select(Item).where(Item.id == bi.item_id))
                        item = rs_item.scalars().first()
                    if not venue:
                        if booking.venue_id:
                            rs_venue = await session.execute(select(Venue).where(Venue.id == booking.venue_id))
                            venue = rs_venue.scalars().first()
                    
                    vendor_notifications.append({
                        'vendor_id': vendor.id,
                        'vendor_phone': vendor.contact_phone,
                        'vendor_company': vendor.company_name or vendor.username,
                        'item_name': item.name if item else f'Item #{bi.item_id}',
                        'item_quantity': bi.quantity,
                        'event_date': bi.event_date.strftime('%B %d, %Y') if bi.event_date else 'TBD',
                        'venue_name': venue.name if venue else 'Venue',
                        'booking_ref': booking_ref,
                        'was_just_assigned': was_just_assigned,
                    })
        
        # Note: Session will be closed automatically by FastAPI dependency injection
        # after the function returns, releasing the connection back to the pool

        # Schedule notifications in the current event loop to avoid thread issues
        vendor_notifications_for_task = vendor_notifications.copy()

        async def run_async_notifications():
            from app.db import AsyncSessionLocal
            from app.notifications import NotificationService
            from app.models import Booking as BookingModel
            from sqlalchemy import select as sa_select

            try:
                async with AsyncSessionLocal() as async_session:
                    # Load fresh entities inside this task
                    user_rs = await async_session.execute(sa_select(User).where(User.id == user_id))
                    user_obj = user_rs.scalars().first()
                    space_rs = await async_session.execute(sa_select(Space).where(Space.id == space_id))
                    space_obj = space_rs.scalars().first()
                    venue_rs = await async_session.execute(sa_select(Venue).where(Venue.id == venue_id))
                    venue_obj = venue_rs.scalars().first()
                    booking_rs = await async_session.execute(sa_select(BookingModel).where(BookingModel.id == stored_booking_id))
                    bg_booking = booking_rs.scalars().first()

                    if not (user_obj and space_obj and venue_obj and bg_booking):
                        print(f"[ADMIN] Async notifications skipped due to missing data: user={bool(user_obj)} space={bool(space_obj)} venue={bool(venue_obj)} booking={bool(bg_booking)}")
                        return

                    user_display_name = f"{user_obj.first_name or ''} {user_obj.last_name or ''}".strip() or user_obj.username
                    print(f"[ADMIN] Starting async notifications for booking {stored_booking_id} (user={user_display_name})")

                    # User notification
                    await NotificationService.send_booking_approved_notification(
                        booking=bg_booking,
                        user=user_obj,
                        space=space_obj,
                        venue=venue_obj,
                        session=async_session,
                    )
                    print(f"[ADMIN] ✓ User notification sent successfully")

                    # Vendor notifications (non-critical)
                    try:
                        await NotificationService.send_vendor_notifications_after_payment(
                            booking=bg_booking,
                            space=space_obj,
                            venue=venue_obj,
                            session=async_session,
                        )
                        print(f"[ADMIN] ✓ Vendor notifications sent successfully")
                    except Exception as vendor_error:
                        print(f"[ADMIN] Vendor notification error (non-critical): {vendor_error}")

                    # WhatsApp notifications to auto-assigned vendors
                    if vendor_notifications_for_task:
                        from app.services.route_mobile import send_session_message
                        print(f"[ADMIN] Sending WhatsApp to {len(vendor_notifications_for_task)} auto-assigned vendors")
                        for vn in vendor_notifications_for_task:
                            if vn['vendor_phone'] and vn['was_just_assigned']:
                                try:
                                    phone = vn['vendor_phone'].strip()
                                    if not phone.startswith('+'):
                                        if not phone.startswith('91'):
                                            phone = '+91' + phone.lstrip('0')
                                        else:
                                            phone = '+' + phone
                                    message = (
                                        f"Hello {vn['vendor_company']},\n\n"
                                        f"You have been automatically assigned to supply the following item:\n"
                                        f"• Item: {vn['item_name']}\n"
                                        f"• Quantity: {vn['item_quantity']}\n"
                                        f"• Event Date: {vn['event_date']}\n"
                                        f"• Venue: {vn['venue_name']}\n"
                                        + (f"• Booking Reference: {vn['booking_ref']}\n" if vn['booking_ref'] else "")
                                        + "\nPlease confirm your availability and prepare accordingly.\n\nThank you!"
                                    )
                                    await send_session_message(phone, text=message)
                                    print(f"[ADMIN] ✓ WhatsApp sent to vendor {vn['vendor_id']} ({vn['vendor_company']})")
                                except Exception as whatsapp_error:
                                    print(f"[ADMIN] WhatsApp error for vendor {vn['vendor_id']} (non-critical): {whatsapp_error}")

            except Exception as async_error:
                print(f"[ADMIN] Async notification error (approve): {async_error}")

        import asyncio
        asyncio.create_task(run_async_notifications())

        # Return immediately - task runs independently
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN] Error approving booking {booking_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to approve booking: {str(e)}')


@router.post('/admin/bookings/{booking_id}/reject')
async def reject_booking(booking_id: int, note: Optional[str] = None, background_tasks: BackgroundTasks = BackgroundTasks(), session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking = rs.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    prev = booking.status
    # Commit status update first so missing booking_events table doesn't block rejection
    booking.status = 'rejected'
    booking.admin_note = note
    await session.commit()

    # Try to record the event in a separate transaction; ignore if table missing
    try:
        ev = BookingEvent(booking_id=booking.id, actor_user_id=admin.id, from_status=prev, to_status='rejected', note=note)
        session.add(ev)
        await session.commit()
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN] Warning: failed to insert BookingEvent (reject): {e}")
    
    # IMPORTANT: Store data needed for notifications BEFORE closing session
    user_id = booking.user_id
    space_id = booking.space_id
    venue_id = booking.venue_id
    stored_booking_id = booking.id
    stored_admin_note = note  # Store the rejection note separately
    
    # Note: Session will be closed automatically by FastAPI dependency injection
    # after the function returns, releasing the connection back to the pool
    
    # Schedule notifications in the current event loop (avoid threads)
    async def run_async_notifications_reject():
        from app.db import AsyncSessionLocal
        from app.notifications import NotificationService
        from app.models import Booking as BookingModel
        from sqlalchemy import select as sa_select

        try:
            async with AsyncSessionLocal() as async_session:
                user_rs = await async_session.execute(sa_select(User).where(User.id == user_id))
                user_obj = user_rs.scalars().first()
                space_rs = await async_session.execute(sa_select(Space).where(Space.id == space_id))
                space_obj = space_rs.scalars().first()
                venue_rs = await async_session.execute(sa_select(Venue).where(Venue.id == venue_id))
                venue_obj = venue_rs.scalars().first()
                booking_rs = await async_session.execute(sa_select(BookingModel).where(BookingModel.id == stored_booking_id))
                bg_booking = booking_rs.scalars().first()

                if not (user_obj and space_obj and venue_obj and bg_booking):
                    print(f"[ADMIN] Async reject notifications skipped due to missing data: user={bool(user_obj)} space={bool(space_obj)} venue={bool(venue_obj)} booking={bool(bg_booking)}")
                    return

                # Ensure admin_note set
                if stored_admin_note:
                    bg_booking.admin_note = stored_admin_note

                user_display_name = f"{user_obj.first_name or ''} {user_obj.last_name or ''}".strip() or user_obj.username
                print(f"[ADMIN] Starting async reject notifications for booking {stored_booking_id} (user={user_display_name})")

                await NotificationService.send_booking_rejected_notification(
                    booking=bg_booking,
                    user=user_obj,
                    space=space_obj,
                    venue=venue_obj,
                    session=async_session,
                )
                print(f"[ADMIN] ✓ Rejection notification sent successfully")
        except Exception as async_error:
            print(f"[ADMIN] Async notification error (reject): {async_error}")

    import asyncio
    asyncio.create_task(run_async_notifications_reject())

    # Return immediately - task runs independently
    return {'ok': True, 'booking_id': booking.id}


@router.get('/admin/settings/auto-approve')
async def get_auto_approve_setting(session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    """Get auto-approve setting"""
    global _auto_approve_enabled_cache
    try:
        enabled = await get_auto_approve_from_db(session)
        _auto_approve_enabled_cache = enabled
        return {'enabled': enabled}
    except Exception as e:
        print(f"[Auto-Approve] Error getting setting: {e}")
        # Return cached value or default
        return {'enabled': _auto_approve_enabled_cache if _auto_approve_enabled_cache is not None else False}


@router.post('/admin/settings/auto-approve')
async def set_auto_approve_setting(
    body: dict,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Set auto-approve setting"""
    global _auto_approve_enabled_cache
    enabled = body.get('enabled', False)
    try:
        success = await set_auto_approve_in_db(session, enabled)
        if success:
            _auto_approve_enabled_cache = enabled
            return {'ok': True, 'enabled': enabled}
        else:
            raise HTTPException(status_code=500, detail='Failed to save setting')
    except Exception as e:
        print(f"[Auto-Approve] Error setting value: {e}")
        raise HTTPException(status_code=500, detail=f'Error saving setting: {str(e)}')


@router.get('/admin/settings/refund-percentage')
async def get_refund_percentage_setting(session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    """Get refund percentage setting"""
    try:
        percentage = await get_refund_percentage_from_db(session)
        return {'percentage': percentage}
    except Exception as e:
        print(f"[Refund Percentage] Error getting setting: {e}")
        return {'percentage': 40.0}  # Default


@router.post('/admin/settings/refund-percentage')
async def set_refund_percentage_setting(
    body: dict,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Set refund percentage setting"""
    percentage = body.get('percentage', 40.0)
    try:
        percentage_float = float(percentage)
        if percentage_float < 0 or percentage_float > 100:
            raise HTTPException(status_code=400, detail='Refund percentage must be between 0 and 100')
        success = await set_refund_percentage_in_db(session, percentage_float)
        if success:
            return {'ok': True, 'percentage': percentage_float}
        else:
            raise HTTPException(status_code=500, detail='Failed to save setting')
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f'Invalid percentage value: {str(e)}')
    except Exception as e:
        print(f"[Refund Percentage] Error setting value: {e}")
        raise HTTPException(status_code=500, detail=f'Error saving setting: {str(e)}')


@router.post('/admin/supply-reminders/send')
async def send_supply_reminders_manual(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Manually trigger supply reminder check (admin only)"""
    try:
        from app.services.supply_reminder import send_supply_reminders
        count = await send_supply_reminders(session)
        return {
            'ok': True,
            'reminders_sent': count,
            'message': f'Successfully sent {count} supply reminder(s)'
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to send supply reminders: {str(e)}')


@router.get('/admin/badges/counts')
async def get_admin_badge_counts(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Get counts of new bookings and new clients for admin sidebar badges"""
    try:
        # Check if admin_viewed_at column exists by trying to access it defensively
        # If column doesn't exist, return 0 for both counts
        try:
            # Count new bookings (admin_viewed_at is NULL)
            # Use raw SQL to check if column exists and count
            result = await session.execute(
                text("SELECT COUNT(*) as cnt FROM bookings WHERE admin_viewed_at IS NULL")
            )
            new_bookings_count = result.scalar() or 0
        except Exception as e:
            # Column doesn't exist yet - return 0 (expected until migration is run)
            # Only log once to avoid spam, use debug level
            if "admin_viewed_at" in str(e).lower() and "unknown column" in str(e).lower():
                # Expected error - column doesn't exist yet, suppress noisy logging
                pass
            else:
                # Unexpected error - log it
                print(f"[Badge Counts] Unexpected error in bookings count: {e}")
            new_bookings_count = 0
        
        try:
            # Count new clients (users with role 'client' or 'customer' where admin_viewed_at is NULL)
            # Exclude admin and vendor roles
            # Use raw SQL to check if column exists and count
            result = await session.execute(
                text("SELECT COUNT(*) as cnt FROM users WHERE admin_viewed_at IS NULL AND role NOT IN ('admin', 'vendor')")
            )
            new_clients_count = result.scalar() or 0
        except Exception as e:
            # Column doesn't exist yet - return 0 (expected until migration is run)
            # Only log once to avoid spam, use debug level
            if "admin_viewed_at" in str(e).lower() and "unknown column" in str(e).lower():
                # Expected error - column doesn't exist yet, suppress noisy logging
                pass
            else:
                # Unexpected error - log it
                print(f"[Badge Counts] Unexpected error in users count: {e}")
            new_clients_count = 0
        
        return {
            'new_bookings': int(new_bookings_count),
            'new_clients': int(new_clients_count),
        }
    except Exception as e:
        # Fallback: return 0 for both if anything fails
        print(f"[Badge Counts] Error getting badge counts: {e}")
        return {
            'new_bookings': 0,
            'new_clients': 0,
        }


@router.post('/admin/bookings/mark-viewed')
async def mark_bookings_viewed(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Mark all bookings as viewed by admin (reset badge)"""
    try:
        # Check if column exists first
        try:
            now = datetime.utcnow()
            await session.execute(
                text("UPDATE bookings SET admin_viewed_at = :now WHERE admin_viewed_at IS NULL"),
                {'now': now}
            )
            await session.commit()
            return {'ok': True, 'message': 'All bookings marked as viewed'}
        except Exception as e:
            # Column doesn't exist - return success anyway (no-op)
            print(f"[Mark Viewed] admin_viewed_at column not found in bookings: {e}")
            return {'ok': True, 'message': 'Column not found - migration may be needed'}
    except Exception as e:
        print(f"[Mark Viewed] Error marking bookings as viewed: {e}")
        return {'ok': False, 'message': f'Error: {str(e)}'}


@router.post('/admin/clients/mark-viewed')
async def mark_clients_viewed(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Mark all clients as viewed by admin (reset badge)"""
    try:
        # Check if column exists first
        try:
            now = datetime.utcnow()
            await session.execute(
                text("UPDATE users SET admin_viewed_at = :now WHERE admin_viewed_at IS NULL AND role NOT IN ('admin', 'vendor')"),
                {'now': now}
            )
            await session.commit()
            return {'ok': True, 'message': 'All clients marked as viewed'}
        except Exception as e:
            # Column doesn't exist - return success anyway (no-op)
            print(f"[Mark Viewed] admin_viewed_at column not found in users: {e}")
            return {'ok': True, 'message': 'Column not found - migration may be needed'}
    except Exception as e:
        print(f"[Mark Viewed] Error marking clients as viewed: {e}")
        return {'ok': False, 'message': f'Error: {str(e)}'}


@router.get('/admin/refunds')
async def list_refunds(
    status: Optional[str] = Query(default=None, description="Filter by refund status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List all refunds with booking details for admin."""
    try:
        # First, check if refunds table exists and has data
        stmt_count = select(func.count(Refund.id))
        rs_count = await session.execute(stmt_count)
        total_refunds_count = rs_count.scalar() or 0
        print(f"[ADMIN REFUNDS] Total refunds in database: {total_refunds_count}")
        
        # Build query with joins
        stmt = (
            select(
                Refund,
                Booking,
                User.first_name,
                User.last_name,
                User.username,
                User.mobile,
                Space.name.label('space_name'),
                Venue.name.label('venue_name'),
            )
            .join(Booking, Booking.id == Refund.booking_id)
            .join(User, User.id == Booking.user_id)
            .join(Space, Space.id == Booking.space_id)
            .join(Venue, Venue.id == Booking.venue_id)
            .order_by(Refund.created_at.desc())
        )
        
        # Apply status filter
        if status:
            stmt = stmt.where(Refund.status == status)
        
        # Execute query
        rs = await session.execute(stmt)
        rows = rs.all()
        print(f"[ADMIN REFUNDS] Found {len(rows)} refund(s) matching criteria")
        
        # Calculate pagination
        total = len(rows)
        total_pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_rows = rows[start_idx:end_idx]
        
        # Serialize results
        refunds_list = []
        for refund, booking, first_name, last_name, username, mobile, space_name, venue_name in paginated_rows:
            user_name = f"{first_name or ''} {last_name or ''}".strip() or username
            refunds_list.append({
                'id': refund.id,
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'amount': float(refund.amount),
                'reason': refund.reason,
                'status': refund.status,
                'refund_type': refund.refund_type,
                'refund_method': refund.refund_method,
                'refund_reference': refund.refund_reference,
                'processed_at': refund.processed_at.isoformat() if refund.processed_at else None,
                'created_at': refund.created_at.isoformat(),
                'notes': refund.notes,
                'booking': {
                    'id': booking.id,
                    'booking_reference': booking.booking_reference,
                    'start_datetime': booking.start_datetime.isoformat(),
                    'end_datetime': booking.end_datetime.isoformat(),
                    'attendees': booking.attendees,
                    'status': booking.status,
                    'total_amount': float(booking.total_amount),
                    'event_type': booking.event_type,
                    'customer_note': booking.customer_note,
                    'admin_note': booking.admin_note,
                },
                'user': {
                    'id': booking.user_id,
                    'name': user_name,
                    'username': username,
                    'mobile': mobile,
                },
                'space_name': space_name,
                'venue_name': venue_name,
            })
        
        return {
            'refunds': refunds_list,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': total_pages,
            },
            'debug': {
                'total_in_db': total_refunds_count,
                'returned': len(refunds_list),
            }
        }
    except Exception as e:
        print(f"[ADMIN REFUNDS] ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to fetch refunds: {str(e)}')


@router.get('/admin/refunds/test/{booking_id}')
async def test_refunds_for_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Test endpoint to check refunds for a specific booking."""
    try:
        # Check refunds
        stmt_refunds = select(Refund).where(Refund.booking_id == booking_id)
        rs_refunds = await session.execute(stmt_refunds)
        refunds = rs_refunds.scalars().all()
        
        # Check payments
        from app.models import Payment
        stmt_payments = select(Payment).where(Payment.booking_id == booking_id)
        rs_payments = await session.execute(stmt_payments)
        payments = rs_payments.scalars().all()
        
        # Check booking
        rs_booking = await session.execute(select(Booking).where(Booking.id == booking_id))
        booking = rs_booking.scalars().first()
        
        return {
            'booking_id': booking_id,
            'booking_status': booking.status if booking else None,
            'booking_total': float(booking.total_amount) if booking else None,
            'payments': [
                {
                    'id': p.id,
                    'amount': float(p.amount),
                    'status': p.status,
                    'created_at': p.created_at.isoformat(),
                }
                for p in payments
            ],
            'refunds': [
                {
                    'id': r.id,
                    'amount': float(r.amount),
                    'status': r.status,
                    'refund_type': r.refund_type,
                    'created_at': r.created_at.isoformat(),
                    'reason': r.reason,
                }
                for r in refunds
            ],
            'total_payments': len(payments),
            'total_refunds': len(refunds),
        }
    except Exception as e:
        print(f"[TEST REFUNDS] ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to test refunds: {str(e)}')


@router.post('/admin/refunds/{refund_id}/process')
async def process_refund(
    refund_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Process a refund using Razorpay. Admin only."""
    try:
        # Get refund record
        rs = await session.execute(select(Refund).where(Refund.id == refund_id))
        refund = rs.scalars().first()
        
        if not refund:
            raise HTTPException(status_code=404, detail='Refund not found')
        
        if refund.status != 'pending':
            raise HTTPException(status_code=400, detail=f'Refund is already {refund.status}. Only pending refunds can be processed.')
        
        # Get booking to find payment
        rs_booking = await session.execute(select(Booking).where(Booking.id == refund.booking_id))
        booking = rs_booking.scalars().first()
        
        if not booking:
            raise HTTPException(status_code=404, detail='Booking not found')
        
        # Get the payment for this booking (look for successful payment, preferably Razorpay)
        from app.models import Payment
        # First try to find Razorpay payment
        stmt_payment = (
            select(Payment)
            .where(
                Payment.booking_id == refund.booking_id,
                Payment.provider == 'razorpay',
                Payment.status == 'success'
            )
            .order_by(Payment.created_at.desc())
        )
        rs_payment = await session.execute(stmt_payment)
        payment = rs_payment.scalars().first()
        
        # If no Razorpay payment found, try to find any successful payment
        if not payment:
            stmt_payment_any = (
                select(Payment)
                .where(
                    Payment.booking_id == refund.booking_id,
                    Payment.status == 'success'
                )
                .order_by(Payment.created_at.desc())
            )
            rs_payment_any = await session.execute(stmt_payment_any)
            payment = rs_payment_any.scalars().first()
            print(f"[PROCESS REFUND] Found payment with provider: {payment.provider if payment else 'None'}")
        
        if not payment:
            # Get all payments for debugging
            stmt_all = select(Payment).where(Payment.booking_id == refund.booking_id)
            rs_all = await session.execute(stmt_all)
            all_payments = rs_all.scalars().all()
            payment_details = [
                f"Payment {p.id}: provider={p.provider}, status={p.status}, payment_id={p.provider_payment_id}, order_id={p.order_id}"
                for p in all_payments
            ]
            raise HTTPException(
                status_code=404,
                detail=f'No successful payment found for booking {refund.booking_id}. Available payments: {"; ".join(payment_details) if payment_details else "None"}'
            )
        
        print(f"[PROCESS REFUND] Found payment ID: {payment.id}, provider: {payment.provider}, payment_id: {payment.provider_payment_id}, order_id: {payment.order_id}")
        
        # Check if this is a Razorpay payment
        if payment.provider != 'razorpay':
            raise HTTPException(
                status_code=400,
                detail=f'Payment provider is "{payment.provider}", but Razorpay refunds require provider to be "razorpay". Payment ID: {payment.id}'
            )
        
        if not payment.provider_payment_id:
            raise HTTPException(
                status_code=400,
                detail=f'Payment {payment.id} does not have a Razorpay payment ID. Order ID: {payment.order_id or "N/A"}'
            )
        
        # Get Razorpay service
        from app.razorpay_service import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        # Convert refund amount to paise (Razorpay expects amount in smallest currency unit)
        refund_amount_paise = int(refund.amount * 100)
        
        # Prepare refund notes (Razorpay allows notes as dict which gets converted)
        refund_notes = {
            'refund_id': str(refund.id),
            'booking_id': str(refund.booking_id),
            'booking_reference': booking.booking_reference or '',
            'reason': refund.reason or 'Refund processed by admin',
            'order_id': payment.order_id or '',
            'payment_id': payment.provider_payment_id,
        }
        
        print(f"[PROCESS REFUND] Processing refund via Razorpay:")
        print(f"  - Payment ID (Razorpay): {payment.provider_payment_id}")
        print(f"  - Order ID: {payment.order_id}")
        print(f"  - Refund Amount: {refund.amount} INR ({refund_amount_paise} paise)")
        print(f"  - Booking ID: {refund.booking_id}")
        
        # Update refund status to processing
        refund.status = 'processing'
        refund.refund_method = 'original_payment'
        await session.flush()
        
        # Process refund via Razorpay
        try:
            print(f"[PROCESS REFUND] Calling Razorpay refund API...")
            print(f"[PROCESS REFUND] Endpoint: /payments/{payment.provider_payment_id}/refund")
            print(f"[PROCESS REFUND] Amount: {refund_amount_paise} paise")
            
            refund_response = razorpay_service.refund_payment(
                payment_id=payment.provider_payment_id,
                amount=refund_amount_paise,
                notes=refund_notes
            )
            
            print(f"[PROCESS REFUND] Razorpay refund response: {json.dumps(refund_response, indent=2)}")
            
            # Extract refund ID from Razorpay response
            razorpay_refund_id = refund_response.get('id', '')
            
            # Update refund record
            refund.status = 'completed'
            refund.refund_reference = razorpay_refund_id
            refund.processed_at = datetime.utcnow()
            refund.updated_at = datetime.utcnow()
            
            # Store Razorpay response in notes or create a separate field
            if not refund.notes:
                refund.notes = f'Razorpay Refund ID: {razorpay_refund_id}\n'
            else:
                refund.notes += f'\nRazorpay Refund ID: {razorpay_refund_id}\n'
            refund.notes += f'Processed at: {datetime.utcnow().isoformat()}\n'
            refund.notes += f'Response: {json.dumps(refund_response)}'
            
            await session.commit()
            
            # Send WhatsApp notification for refund initiated
            try:
                from app.models import User
                rs_user = await session.execute(select(User).where(User.id == booking.user_id))
                user = rs_user.scalars().first()
                if user and user.mobile:
                    customer_name = f"{user.first_name} {user.last_name}".strip() or user.username or "Customer"
                    refund_mode = refund.refund_method or "Original Payment Method"
                    transaction_id = razorpay_refund_id or refund.refund_reference or "N/A"
                    from app.notifications import NotificationService
                    await NotificationService.send_refund_initiated_whatsapp(
                        mobile=user.mobile,
                        customer_name=customer_name,
                        refund_amount=refund.amount,
                        refund_mode=refund_mode,
                        transaction_id=transaction_id,
                        refund_time="3-5 working days"
                    )
            except Exception as whatsapp_error:
                print(f"[PROCESS REFUND] WhatsApp notification error (non-critical): {whatsapp_error}")
            
            return {
                'ok': True,
                'message': 'Refund processed successfully',
                'refund_id': refund.id,
                'razorpay_refund_id': razorpay_refund_id,
                'status': 'completed',
                'amount': refund.amount,
            }
        except Exception as razorpay_error:
            # Update refund status to failed
            refund.status = 'failed'
            refund.notes = f'Refund processing failed: {str(razorpay_error)}\nPrevious notes: {refund.notes or ""}'
            await session.commit()
            
            raise HTTPException(
                status_code=500,
                detail=f'Failed to process refund via Razorpay: {str(razorpay_error)}'
            )
            
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[PROCESS REFUND] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to process refund: {str(e)}')


@router.get('/admin/refunds/{refund_id}/invoice')
async def download_refund_invoice(
    refund_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Download refund invoice/receipt as PDF. Admin only."""
    try:
        # Get refund with booking details
        stmt = (
            select(
                Refund,
                Booking,
                User.first_name,
                User.last_name,
                User.username,
                User.mobile,
                Space.name.label('space_name'),
                Venue.name.label('venue_name'),
            )
            .join(Booking, Booking.id == Refund.booking_id)
            .join(User, User.id == Booking.user_id)
            .join(Space, Space.id == Booking.space_id)
            .join(Venue, Venue.id == Booking.venue_id)
            .where(Refund.id == refund_id)
        )
        rs = await session.execute(stmt)
        row = rs.first()
        
        if not row:
            raise HTTPException(status_code=404, detail='Refund not found')
        
        refund, booking, first_name, last_name, username, mobile, space_name, venue_name = row
        user_name = f"{first_name or ''} {last_name or ''}".strip() or username
        
        # Only allow invoice download for completed refunds
        if refund.status != 'completed':
            raise HTTPException(
                status_code=400,
                detail=f'Invoice can only be downloaded for completed refunds. Current status: {refund.status}'
            )
        
        # Generate PDF invoice
        try:
            import reportlab
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail='PDF generation requires reportlab library. Please install it with: pip install reportlab'
            )
        
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import HexColor
        import tempfile
        import os
        from pathlib import Path
        
        # Use temporary file instead of BytesIO to avoid loading entire PDF into memory
        temp_file = tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False)
        temp_path = temp_file.name
        temp_file.close()  # Close so reportlab can write to it
        
        # Company details
        company_name = "BRQ ASSOCIATES"
        company_tagline = "India's No.1 in Auditing Excellence"
        company_tagline2 = "Feel the Expertise"
        company_address = "2nd Floor, BRQ Tower, Karandakkad Kasaragod, Kerala, India - 671121"
        company_phone = "+91 96-33-18-18-98"
        company_phone2 = "04994-225-895/896/897/898"
        company_email = "brqgst@gmail.com"
        
        # Create PDF document
        doc = SimpleDocTemplate(
            temp_path,  # Use temp file path instead of buffer
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1.5*inch,
            bottomMargin=0.4*inch
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=HexColor('#2D5016'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        story.append(Paragraph("REFUND RECEIPT", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Invoice details
        invoice_num = f"REF-{refund.id}-{datetime.utcnow().strftime('%Y%m%d')}"
        
        # Customer details
        customer_data = [
            ['Customer Name:', user_name],
            ['Email:', username],
            ['Mobile:', mobile or 'N/A'],
        ]
        
        # Refund details
        refund_data = [
            ['Refund ID:', f"#{refund.id}"],
            ['Receipt Number:', invoice_num],
            ['Booking Reference:', booking.booking_reference or f"#{booking.id}"],
            ['Refund Amount:', f"{refund.amount:.2f}"],
            ['Refund Date:', refund.processed_at.strftime('%Y-%m-%d %H:%M:%S') if refund.processed_at else 'N/A'],
            ['Refund Reference:', refund.refund_reference or 'N/A'],
            ['Reason:', refund.reason or 'N/A'],
        ]
        
        # Combine tables
        details_table_data = [
            ['Field', 'Value'],
        ]
        details_table_data.extend(customer_data)
        details_table_data.extend([['', '']])  # Spacer
        details_table_data.extend(refund_data)
        
        details_table = Table(details_table_data, colWidths=[2.5*inch, 4*inch])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#2D5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#F9FAFB')]),
        ]))
        story.append(details_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Total amount highlighted
        total_style = ParagraphStyle(
            'TotalStyle',
            parent=styles['Normal'],
            fontSize=16,
            textColor=HexColor('#2D5016'),
            fontName='Helvetica-Bold',
            alignment=TA_CENTER
        )
        story.append(Paragraph(f"Total Refund Amount: {refund.amount:.2f}", total_style))
        
        # Letterhead function
        def add_letterhead(canvas_obj, doc):
            canvas_obj.saveState()
            # Header golden band
            canvas_obj.setFillColor(HexColor('#FFD700'))
            canvas_obj.rect(0, letter[1] - 1.2*inch, letter[0], 1.2*inch, fill=1, stroke=0)
            
            # Company name (white text)
            canvas_obj.setFillColor(colors.white)
            canvas_obj.setFont("Helvetica-Bold", 20)
            text_width = canvas_obj.stringWidth(company_name, "Helvetica-Bold", 20)
            canvas_obj.drawString((letter[0] - text_width) / 2, letter[1] - 0.5*inch, company_name)
            
            # Tagline
            canvas_obj.setFont("Helvetica", 10)
            tagline_width = canvas_obj.stringWidth(company_tagline, "Helvetica", 10)
            canvas_obj.drawString((letter[0] - tagline_width) / 2, letter[1] - 0.75*inch, company_tagline)
            
            # Footer band
            canvas_obj.setFillColor(HexColor('#FFD700'))
            canvas_obj.rect(0, 0, letter[0], 0.35*inch, fill=1, stroke=0)
            
            # Footer text (centered)
            canvas_obj.setFillColor(HexColor('#2D5016'))
            canvas_obj.setFont("Helvetica", 7)
            footer_text = f"{company_phone} | {company_email}"
            footer_width = canvas_obj.stringWidth(footer_text, "Helvetica", 7)
            canvas_obj.drawString((letter[0] - footer_width) / 2, 0.15*inch, footer_text)
            
            canvas_obj.restoreState()
        
        # Build PDF to temporary file
        filename = f"refund_receipt_{refund.id}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        
        try:
            doc.build(story, onFirstPage=add_letterhead, onLaterPages=add_letterhead)
            
            # Stream file in chunks to avoid loading entire PDF into memory
            from fastapi.responses import StreamingResponse
            from typing import Generator
            
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
        print(f"[REFUND INVOICE] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to generate refund invoice: {str(e)}')


# ================= INVOICE MANAGEMENT (ADMIN) ================= #

@router.get('/admin/invoices')
async def list_invoices(
    status: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, description="Filter bookings with start_datetime >= this (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="Filter bookings with start_datetime <= this (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List all bookings that can have invoices generated. Admin only."""
    try:
        stmt = (
            select(
                Booking,
                User.first_name,
                User.last_name,
                User.username,
            )
            .join(User, User.id == Booking.user_id)
            .order_by(Booking.created_at.desc())
        )
        
        conditions = []
        if status:
            conditions.append(Booking.status == status)
        if from_date:
            conditions.append(func.date(Booking.start_datetime) >= from_date)
        if to_date:
            conditions.append(func.date(Booking.start_datetime) <= to_date)
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        rs = await session.execute(stmt)
        rows = rs.all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to fetch bookings: {str(e)}')
    
    invoices = []
    from datetime import datetime, timezone
    
    if not rows:
        return {'invoices': [], 'count': 0}
    
    for booking, first_name, last_name, username in rows:
        try:
            user_name = f"{first_name or ''} {last_name or ''}".strip() or username
            status_lower = (booking.status or '').lower()
            
            # Determine invoice type based on event completion (same logic as booking invoice)
            is_event_completed = False
            if booking.start_datetime:
                now = datetime.utcnow()
                booking_date = booking.start_datetime
                
                # Handle timezone-aware and naive datetimes
                if booking_date.tzinfo is not None:
                    booking_date_utc = booking_date.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    booking_date_utc = booking_date
                
                # Event is completed if the start date has passed
                is_event_completed = booking_date_utc < now
            
            # Invoice type logic:
            # - Tax Invoice: Event date has passed AND status is approved/confirmed/paid
            # - Proforma Invoice: Event date hasn't passed OR status is pending
            is_tax_invoice = is_event_completed and status_lower in ['approved', 'confirmed', 'confirm', 'paid']
            is_proforma_invoice = not is_tax_invoice and status_lower in ['pending', 'approved', 'confirmed', 'confirm', 'paid']
            
            # Determine invoice type label
            if is_tax_invoice:
                invoice_type = 'TAX INVOICE'
            elif is_proforma_invoice:
                invoice_type = 'PROFORMA INVOICE'
            else:
                invoice_type = 'INVOICE'
            
            invoices.append({
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'invoice_number': f"BK-{booking.booking_reference}",
                'customer_name': user_name,
                'customer_email': username,
                'status': booking.status,
                'invoice_type': invoice_type,
                'total_amount': float(booking.total_amount),
                'start_datetime': booking.start_datetime.isoformat() if booking.start_datetime else None,
                'created_at': booking.created_at.isoformat() if getattr(booking, 'created_at', None) else None,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            # Continue with other bookings even if one fails
            continue
    
    return {'invoices': invoices, 'count': len(invoices)}


@router.get('/admin/invoices/{booking_id}/data')
async def get_invoice_data_admin(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get invoice data for editing. Admin only."""
    try:
        from app.utils.invoice_helper import get_invoice_data
        invoice_data = await get_invoice_data(session, booking_id)
        return invoice_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to get invoice data: {str(e)}')


@router.post('/admin/invoices/{booking_id}/save')
async def save_invoice_edit(
    booking_id: int,
    invoice_data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Save edited invoice data. Admin only."""
    try:
        from app.models import InvoiceEdit, Booking
        
        # Verify booking exists
        rs = await session.execute(select(Booking).where(Booking.id == booking_id))
        booking = rs.scalars().first()
        if not booking:
            raise HTTPException(status_code=404, detail='Booking not found')
        
        # Check if edit already exists
        rs_edit = await session.execute(select(InvoiceEdit).where(InvoiceEdit.booking_id == booking_id))
        invoice_edit = rs_edit.scalars().first()
        
        if invoice_edit:
            # Update existing edit
            invoice_edit.invoice_number = invoice_data.get('invoice_number')
            invoice_edit.invoice_date = invoice_data.get('invoice_date')
            invoice_edit.customer_name = invoice_data.get('customer_name')
            invoice_edit.gst_rate = invoice_data.get('gst_rate')
            invoice_edit.brokerage_amount = invoice_data.get('brokerage_amount')
            invoice_edit.notes = invoice_data.get('notes')
            invoice_edit.items = invoice_data.get('items')
            invoice_edit.edited_by_user_id = admin.id
            invoice_edit.updated_at = datetime.utcnow()
        else:
            # Create new edit
            invoice_edit = InvoiceEdit(
                booking_id=booking_id,
                invoice_number=invoice_data.get('invoice_number'),
                invoice_date=invoice_data.get('invoice_date'),
                customer_name=invoice_data.get('customer_name'),
                gst_rate=invoice_data.get('gst_rate'),
                brokerage_amount=invoice_data.get('brokerage_amount'),
                notes=invoice_data.get('notes'),
                items=invoice_data.get('items'),
                edited_by_user_id=admin.id
            )
            session.add(invoice_edit)
        
        await session.commit()
        await session.refresh(invoice_edit)
        
        return {
            'message': 'Invoice edit saved successfully',
            'booking_id': booking_id,
            'saved_at': invoice_edit.updated_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        error_msg = str(e)
        print(f"[SAVE INVOICE EDIT] Error: {error_msg}")
        import traceback
        traceback.print_exc()
        # Check if it's a table doesn't exist error
        if 'invoice_edits' in error_msg.lower() or 'no such table' in error_msg.lower():
            raise HTTPException(
                status_code=500, 
                detail='Invoice edits table does not exist. Please run database migration to create the invoice_edits table.'
            )
        raise HTTPException(status_code=500, detail=f'Failed to save invoice edit: {error_msg}')


@router.delete('/admin/invoices/{booking_id}/edit')
async def delete_invoice_edit(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Delete saved invoice edit (revert to original). Admin only."""
    try:
        from app.models import InvoiceEdit
        
        rs = await session.execute(select(InvoiceEdit).where(InvoiceEdit.booking_id == booking_id))
        invoice_edit = rs.scalars().first()
        
        if invoice_edit:
            await session.delete(invoice_edit)
            await session.commit()
            return {'message': 'Invoice edit deleted successfully', 'booking_id': booking_id}
        else:
            raise HTTPException(status_code=404, detail='No saved invoice edit found')
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f'Failed to delete invoice edit: {str(e)}')


@router.post('/admin/invoices/{booking_id}/preview')
async def preview_invoice_admin(
    booking_id: int,
    custom_data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Preview invoice with custom data. Returns JSON preview. Admin only."""
    try:
        from app.utils.invoice_helper import get_invoice_data
        invoice_data = await get_invoice_data(session, booking_id, custom_data, use_saved_edit=False)
        return invoice_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[INVOICE PREVIEW] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to preview invoice: {str(e)}')


@router.post('/admin/invoices/{booking_id}/download')
async def download_invoice_admin_post(
    booking_id: int,
    custom_data: dict = Body(default=None, description="Custom invoice data (optional)"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Download invoice as PDF with optional custom data. Admin only. POST version."""
    return await download_invoice_admin_internal(booking_id, custom_data, session, admin)


@router.get('/admin/invoices/{booking_id}/download')
async def download_invoice_admin(
    booking_id: int,
    custom_data: Optional[str] = Query(default=None, description="JSON string of custom invoice data"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Download invoice as PDF. Admin only. GET version with query param."""
    custom_dict = None
    if custom_data:
        try:
            custom_dict = json.loads(custom_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail='Invalid JSON in custom_data parameter')
    return await download_invoice_admin_internal(booking_id, custom_dict, session, admin)


async def download_invoice_admin_internal(
    booking_id: int,
    custom_data: Optional[dict],
    session: AsyncSession,
    admin: User
):
    """Internal function to generate invoice PDF. Uses the same structure as client/vendor invoices."""
    try:
        from app.utils.invoice_helper import get_invoice_data
        from app.models import Booking, User, Space, Venue
        
        # If custom_data is provided, don't use saved edits (for preview/download of unsaved edits)
        # Otherwise, use saved edits if available
        use_saved_edit = custom_data is None
        invoice_data = await get_invoice_data(session, booking_id, custom_data, use_saved_edit=use_saved_edit)
        
        # Verify booking access (admin can access any booking)
        stmt = (
            select(Booking, User, Space, Venue)
            .join(User, User.id == Booking.user_id)
            .join(Space, Space.id == Booking.space_id)
            .join(Venue, Venue.id == Booking.venue_id)
            .where(Booking.id == booking_id)
        )
        rs = await session.execute(stmt)
        row = rs.first()
        if not row:
            raise HTTPException(status_code=404, detail='Booking not found')
        
        booking, user, space, venue = row
        
        # Extract values from invoice_data (may include saved edits)
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
        
        # Check if reportlab is available
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
        from io import BytesIO
        import os
        
        buffer = BytesIO()
        
        # Company details - BRQ Associates (matching client invoice exactly)
        company_name = "BRQ ASSOCIATES"
        company_services = "Chartered Accountant Services"
        company_tagline = "Feel the Expertise"
        company_address = "Second Floor, City Complex, NH Road, Karandakkad, Kasaragod - 671121"
        company_phone = "04994 225 895, 896, 897, 898"
        company_mobile = "96 33 18 18 98"
        company_email = "brqgst@gmail.com"
        company_website = "www.brqassociates.in"
        
        # Create PDF document in temporary file (same margins as client invoice)
        doc = SimpleDocTemplate(
            buffer,  # Use BytesIO buffer for PDF generation
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1.5*inch,  # Adjusted for structured header
            bottomMargin=0.4*inch  # Minimal footer
        )
        
        # Letterhead function (exact same as client invoice)
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
        
        # Invoice title based on event completion (same as client invoice)
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
        
        # Invoice details (matching client invoice format exactly)
        invoice_number_str = invoice_number if invoice_number else f"{booking.id:05d}"
        # Parse invoice_date if it's a string, otherwise use current date
        try:
            if invoice_date:
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
        
        # Invoice info in table format (matching client invoice exactly)
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
        
        # Billed To section (matching client invoice exactly)
        user_name = customer_name if customer_name else (f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username)
        
        # Billed To in table format for better alignment (matching client invoice)
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
        
        # Items table (matching client invoice exactly - same columns and format)
        items_data = [['Sl. No.', 'Product/Service Description', 'Qty.', 'Rate', 'Discount', 'Value', 'TOTAL']]
        
        sl_no = 1
        for item in items:
            discount = 0.0  # Default discount
            value = item.get('total_price', item.get('unit_price', 0) * item.get('quantity', 0)) - discount
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
        items_data.append(['', 'GRAND TOTAL', '', '', '', f"{total_amount:.2f}", f"{total_amount:.2f}"])
        
        # Calculate column widths to fit page (6 inches usable width) - same as client invoice
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
            # Alignment
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
        
        # Amount in words (same as client invoice)
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
        
        # Amount in words (properly aligned) - same as client invoice
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
        
        # Remarks section (properly aligned) - use notes from invoice_data
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
        
        # Certification statement (properly aligned) - same as client invoice
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
        
        # Authorized signatory section (properly aligned to right) - same as client invoice
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
        
        # Computer generated note (centered) - same as client invoice
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
        
        # Build PDF to temporary file
        invoice_type_name = "tax_invoice" if is_tax_invoice else ("proforma_invoice" if is_proforma_invoice else "invoice")
        filename = f"{invoice_type_name}_{invoice_data.get('booking_reference', booking_id)}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        
        try:
            doc.build(story, onFirstPage=add_letterhead, onLaterPages=add_letterhead)
            
            # Get PDF content from buffer
            pdf_content = buffer.getvalue()
            
            return StreamingResponse(
                iter([pdf_content]),  # Wrap bytes in iterable for StreamingResponse
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                }
            )
        except Exception as e:
            # No cleanup needed since using BytesIO buffer
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ADMIN INVOICE DOWNLOAD] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to generate invoice: {str(e)}')