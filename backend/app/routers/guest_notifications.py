"""
Guest Notification Endpoints
Handles WhatsApp notifications to booking guests
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from ..db import get_session
from ..auth import get_current_user
from ..models import Booking, User
from ..models_booking_guests import BookingGuest
from ..services.route_mobile import send_session_message
from ..services.whatsapp_route_mobile import RouteMobileWhatsAppClient
from ..core import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["guest-notifications"])


class GuestNotificationResponse(BaseModel):
    success: bool
    message: str
    sent_count: int
    failed_count: int
    details: List[dict]


@router.post("/bookings/{booking_id}/notify-guests", response_model=GuestNotificationResponse)
async def notify_booking_guests(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Send WhatsApp messages to all guests with transportation needs for a booking.
    Message: "Hi <Guest Name>, your pickup for the event is scheduled. Please send your current location on WhatsApp before pickup. Pickup point: <Pickup Location> – Team Le BRQ"
    """
    # Get booking
    stmt = select(Booking).where(Booking.id == booking_id)
    result = await session.execute(stmt)
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user owns the booking or is admin
    if current_user.role != 'admin' and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to notify guests for this booking")
    
    # Get guests with transportation needs
    guests_stmt = select(BookingGuest).where(
        BookingGuest.booking_id == booking_id,
        BookingGuest.needs_transportation == True
    )
    guests_result = await session.execute(guests_stmt)
    guests = guests_result.scalars().all()
    
    if not guests:
        return GuestNotificationResponse(
            success=True,
            message="No guests with transportation needs found",
            sent_count=0,
            failed_count=0,
            details=[]
        )
    
    # Send messages
    sent_count = 0
    failed_count = 0
    details = []
    
    for guest in guests:
        try:
            # Format phone number (ensure +91 prefix)
            phone = guest.mobile.strip()
            if not phone.startswith('+'):
                if not phone.startswith('91'):
                    phone = '+91' + phone.lstrip('0')
                else:
                    phone = '+' + phone
            
            # Get pickup location (use guest's specific location or default)
            pickup_location = guest.pickup_location or "Venue"
            
            # Create message
            message = f"Hi {guest.name}, your pickup for the event is scheduled. Please send your current location on WhatsApp before pickup. Pickup point: {pickup_location} – Team Le BRQ"
            
            # Send WhatsApp message
            try:
                await send_session_message(phone, text=message)
                sent_count += 1
                details.append({
                    "guest_name": guest.name,
                    "mobile": phone,
                    "status": "sent",
                    "message": message
                })
                logger.info(f"[GUEST NOTIF] Sent WhatsApp to {guest.name} ({phone}) for booking {booking_id}")
            except Exception as send_error:
                failed_count += 1
                details.append({
                    "guest_name": guest.name,
                    "mobile": phone,
                    "status": "failed",
                    "error": str(send_error)
                })
                logger.error(f"[GUEST NOTIF] Failed to send WhatsApp to {guest.name} ({phone}): {send_error}")
        except Exception as e:
            failed_count += 1
            details.append({
                "guest_name": guest.name,
                "mobile": guest.mobile,
                "status": "error",
                "error": str(e)
            })
            logger.error(f"[GUEST NOTIF] Error processing guest {guest.id}: {e}")
    
    return GuestNotificationResponse(
        success=sent_count > 0,
        message=f"Sent {sent_count} messages, {failed_count} failed",
        sent_count=sent_count,
        failed_count=failed_count,
        details=details
    )


@router.post("/rack-orders/{order_id}/birthday-surprise", response_model=dict)
async def send_birthday_surprise(
    order_id: int,
    buyer_name: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Send birthday surprise WhatsApp message to recipient after rack order payment.
    Message: "🎉 Surprise from Le BRQ! You've received a birthday gift from {{buyer name}}"
    
    Note: This endpoint should be called after payment is confirmed.
    The order should have surprise_gift data with occasion_type = 'birthday'
    """
    from ..models_rack import RackOrder
    from ..notifications import NotificationService
    from sqlalchemy import select
    
    # Get rack order from database
    stmt = select(RackOrder).where(RackOrder.id == order_id)
    rs = await session.execute(stmt)
    rack_order = rs.scalar_one_or_none()
    
    if not rack_order:
        raise HTTPException(status_code=404, detail="Rack order not found")
    
    # Verify user owns this order or is admin
    if rack_order.user_id != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="You don't have permission to access this order")
    
    # Check if it's a surprise gift with birthday occasion
    if not rack_order.is_surprise_gift:
        raise HTTPException(status_code=400, detail="This order is not a surprise gift")
    
    if rack_order.occasion_type != 'birthday':
        raise HTTPException(status_code=400, detail="This order is not for a birthday occasion")
    
    if not rack_order.recipient_mobile:
        raise HTTPException(status_code=400, detail="Recipient mobile number is missing")
    
    # Get buyer name
    if not buyer_name:
        buyer_name = current_user.first_name or current_user.username or "Someone"
        if current_user.last_name:
            buyer_name = f"{buyer_name} {current_user.last_name}"
    
    # Send birthday surprise WhatsApp
    try:
        await NotificationService.send_birthday_surprise_whatsapp(
            mobile=rack_order.recipient_mobile,
            buyer_name=buyer_name
        )
        return {
            "success": True,
            "message": "Birthday surprise message sent successfully",
            "recipient_mobile": rack_order.recipient_mobile
        }
    except Exception as e:
        logger.error(f"[BIRTHDAY SURPRISE] Failed to send: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

