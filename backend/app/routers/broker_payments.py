"""
Broker Payment Summary and Settlement API Router
"""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Body
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy import select, and_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..db import get_session
from ..auth import get_current_user, get_current_admin
from ..models import Booking, BrokerProfile, User, Payment

router = APIRouter(prefix="/broker/payments", tags=["broker-payments"])


def broker_required(user: User = Depends(get_current_user)):
    if user.role != 'broker':
        raise HTTPException(status_code=403, detail='Broker only')
    return user


class BrokerPaymentSummaryItem(BaseModel):
    booking_id: int
    booking_reference: str
    total_amount: float
    brokerage_amount: float
    brokerage_percentage: float
    booking_date: Optional[str]
    payment_settled: bool
    payment_settled_at: Optional[str]


class BrokerPaymentSummary(BaseModel):
    period: str
    start_date: str
    end_date: str
    total_bookings: int
    total_brokerage: float
    settled_brokerage: float
    pending_brokerage: float
    items: List[BrokerPaymentSummaryItem]


@router.get("/summary")
async def get_broker_payment_summary(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    broker_id: Optional[int] = Query(None, description="Broker ID (admin only)"),
    include_settled: bool = Query(True, description="Include already settled bookings"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get brokerage payment summary for a broker."""
    try:
        # Admin can view any broker, brokers can only view their own
        if user.role == 'admin' and broker_id:
            target_broker_id = broker_id
        elif user.role == 'broker':
            # Add timeout to broker profile lookup
            rs = await asyncio.wait_for(
                session.execute(select(BrokerProfile).where(BrokerProfile.user_id == user.id)),
                timeout=5.0
            )
            bp = rs.scalars().first()
            if not bp:
                raise HTTPException(status_code=404, detail='Broker profile not found')
            target_broker_id = bp.id
        else:
            raise HTTPException(status_code=403, detail='Access denied')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='Request timeout - database query took too long')
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BROKER PAYMENTS] Error determining broker ID: {e}")
        raise HTTPException(status_code=500, detail='Failed to determine broker')
    
    # Calculate date range
    now = datetime.utcnow()
    if period == 'weekly':
        start_date = now - timedelta(days=7)
        period_label = 'Weekly'
    elif period == 'monthly':
        start_date = now - timedelta(days=30)
        period_label = 'Monthly'
    elif period == 'yearly':
        start_date = now - timedelta(days=365)
        period_label = 'Yearly'
    else:
        raise HTTPException(status_code=400, detail='Invalid period. Use: weekly, monthly, or yearly')
    
    # Build query conditions
    conditions = [
        Booking.broker_id == target_broker_id,
        Booking.brokerage_amount > 0,  # Only bookings with brokerage
        Booking.created_at >= start_date,  # Filter by booking date
    ]
    
    if not include_settled:
        # Only include unsettled bookings
        # For brokers, we'll use a custom field or check payment status
        # For now, we'll include all bookings and mark settlement separately
        pass
    
    # First, get broker profile separately to avoid join issues
    try:
        rs_broker = await asyncio.wait_for(
            session.execute(select(BrokerProfile).where(BrokerProfile.id == target_broker_id)),
            timeout=5.0
        )
        broker_profile = rs_broker.scalars().first()
        if not broker_profile:
            raise HTTPException(status_code=404, detail='Broker profile not found')
        brokerage_percentage = float(getattr(broker_profile, 'brokerage_percentage', 0.0))
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='Request timeout - database query took too long')
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BROKER PAYMENTS] Error fetching broker profile: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch broker profile')
    
    # Query bookings with brokerage - simpler query without join
    # Add limit to prevent fetching too many records
    try:
        stmt = (
            select(Booking)
            .where(and_(*conditions))
            .order_by(Booking.created_at.desc())
            .limit(1000)  # Limit to prevent slow queries
        )
        
        # Use asyncio.wait_for to add a timeout to the database query
        try:
            rs = await asyncio.wait_for(
                session.execute(stmt),
                timeout=10.0  # 10 second timeout for the query
            )
            rows = rs.scalars().all()
        except asyncio.TimeoutError:
            print(f"[BROKER PAYMENTS] Query timeout for broker_id={target_broker_id}")
            raise HTTPException(status_code=504, detail='Request timeout - database query took too long')
    except HTTPException:
        raise
    except Exception as e:
        # Log error and return empty result instead of hanging
        print(f"[BROKER PAYMENTS] Query error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Database query failed: {str(e)}')
    
    items = []
    total_brokerage = 0.0
    settled_brokerage = 0.0
    pending_brokerage = 0.0
    
    # For now, we'll use a simple approach: check if booking status indicates settlement
    # In the future, you might want to add a broker_settlement table similar to vendor settlements
    for booking in rows:
        # Skip if booking is None
        if not booking:
            continue
            
        brokerage_amount = float(getattr(booking, 'brokerage_amount', 0.0))
        if brokerage_amount <= 0:
            continue
        
        # Check if settled using broker_settled field
        is_settled = getattr(booking, 'broker_settled', False)
        settled_at = None
        if is_settled and hasattr(booking, 'broker_settled_at') and booking.broker_settled_at:
            try:
                settled_at = booking.broker_settled_at.isoformat()
            except Exception:
                pass
        
        if is_settled:
            settled_brokerage += brokerage_amount
        else:
            pending_brokerage += brokerage_amount
        
        total_brokerage += brokerage_amount
        
        # Get booking created_at safely
        booking_date = None
        if hasattr(booking, 'created_at') and booking.created_at:
            try:
                booking_date = booking.created_at.isoformat()
            except Exception:
                pass
        
        items.append({
            'booking_id': booking.id,
            'booking_reference': booking.booking_reference,
            'total_amount': float(booking.total_amount),
            'brokerage_amount': brokerage_amount,
            'brokerage_percentage': brokerage_percentage,
            'booking_date': booking_date,
            'payment_settled': is_settled,
            'payment_settled_at': settled_at,
        })
    
    return {
        'period': period_label,
        'start_date': start_date.isoformat(),
        'end_date': now.isoformat(),
        'total_bookings': len(items),
        'total_brokerage': total_brokerage,
        'settled_brokerage': settled_brokerage,
        'pending_brokerage': pending_brokerage,
        'items': items,
    }


@router.post("/settle")
async def mark_broker_payment_settled(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(get_current_admin),
):
    """Mark broker payments as settled. Admin only."""
    from datetime import datetime
    
    booking_ids = request.get('booking_ids', [])
    if not booking_ids:
        raise HTTPException(status_code=400, detail='No booking IDs provided')
    
    # Update bookings to mark brokerage as settled
    settled_count = 0
    for booking_id in booking_ids:
        rs = await session.execute(select(Booking).where(Booking.id == booking_id))
        booking = rs.scalars().first()
        if booking and booking.broker_id:
            # Mark as settled using broker_settled field
            if not getattr(booking, 'broker_settled', False):
                booking.broker_settled = True
                booking.broker_settled_at = datetime.utcnow()
                booking.broker_settled_by_user_id = admin.id
                settled_count += 1
    
    await session.commit()
    
    return {
        'ok': True,
        'message': f'Marked {settled_count} booking(s) as settled',
        'settled_count': settled_count,
    }


@router.post("/prepare-payment")
async def prepare_broker_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Prepare payment for a brokerage item. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    booking_id = request.get('booking_id')
    if not booking_id:
        raise HTTPException(status_code=400, detail='booking_id is required')
    
    # Get booking and verify it has brokerage
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking = rs.scalars().first()
    
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    if not booking.broker_id:
        raise HTTPException(status_code=400, detail='This booking has no broker')
    
    brokerage_amount = float(getattr(booking, 'brokerage_amount', 0.0))
    if brokerage_amount <= 0:
        raise HTTPException(status_code=400, detail='No brokerage amount to pay')
    
    if getattr(booking, 'broker_settled', False):
        raise HTTPException(status_code=400, detail='Broker payment already settled')
    
    # Import payment service
    try:
        from ..routers.payments import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        if not razorpay_service.is_configured():
            raise HTTPException(status_code=503, detail='Payment service is not available. Please contact support.')
        
        # Create Razorpay order
        amount_paise = int(brokerage_amount * 100)
        razorpay_order = razorpay_service.create_order(
            amount=amount_paise,
            currency='INR',
            receipt=f"broker_{booking_id}_{int(datetime.utcnow().timestamp())}",
            description=f"Brokerage payment for booking {booking.booking_reference}",
            notes={
                'booking_id': booking_id,
                'payment_type': 'broker_payment',
                'broker_id': booking.broker_id,
            }
        )
        
        if not razorpay_order or 'id' not in razorpay_order:
            logger.error(f"[Broker Payment] Invalid order response: {razorpay_order}")
            raise HTTPException(status_code=503, detail='Payment service encountered an error. Please try again.')
        
        order_id = razorpay_order.get('id')
        logger.info(f"[Broker Payment] Order created for booking {booking_id}: {order_id}")
        
        return {
            'ok': True,
            'order_id': order_id,
            'amount': brokerage_amount,
            'currency': 'INR',
            'booking_id': booking_id,
            'booking_reference': booking.booking_reference,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Broker Payment] Error preparing payment: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail='Payment service is temporarily unavailable. Please try again later.')


@router.post("/verify-payment")
async def verify_broker_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Verify and process broker payment. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    booking_id = request.get('booking_id')
    payment_data = request.get('payment_data', {})
    
    if not booking_id:
        raise HTTPException(status_code=400, detail='booking_id is required')
    
    # Get booking
    rs = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking = rs.scalars().first()
    
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    
    if not booking.broker_id:
        raise HTTPException(status_code=400, detail='This booking has no broker')
    
    if getattr(booking, 'broker_settled', False):
        raise HTTPException(status_code=400, detail='Broker payment already settled')
    
    # Verify payment with Razorpay
    try:
        from ..routers.payments import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        razorpay_payment_id = payment_data.get('razorpay_payment_id') or payment_data.get('payment_id')
        razorpay_order_id = payment_data.get('razorpay_order_id') or payment_data.get('order_id')
        razorpay_signature = payment_data.get('razorpay_signature') or payment_data.get('signature')
        
        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            raise HTTPException(status_code=400, detail='Missing payment verification data')
        
        # Verify payment signature
        is_valid = razorpay_service.verify_payment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )
        
        if not is_valid:
            raise HTTPException(status_code=400, detail='Payment verification failed - invalid signature')
        
        # Fetch payment details from Razorpay
        payment_details = razorpay_service.fetch_payment(razorpay_payment_id)
        
        # Create payment record
        brokerage_amount = float(getattr(booking, 'brokerage_amount', 0.0))
        payment = Payment(
            booking_id=booking_id,
            amount=brokerage_amount,
            currency='INR',
            provider='razorpay',
            provider_payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
            status='success',
            paid_at=datetime.utcnow(),
            details={
                'payment_type': 'broker_payment',
                'broker_id': booking.broker_id,
                'booking_reference': booking.booking_reference,
            },
            gateway_response=payment_details
        )
        session.add(payment)
        
        # Mark broker as settled
        booking.broker_settled = True
        booking.broker_settled_at = datetime.utcnow()
        booking.broker_settled_by_user_id = user.id
        
        await session.commit()
        
        return {
            'ok': True,
            'message': 'Broker payment verified and settled successfully',
            'payment_id': payment.id,
            'booking_id': booking_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[BROKER PAYMENT] Error verifying payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Payment verification failed: {str(e)}')


@router.post("/prepare-bulk-payment")
async def prepare_bulk_broker_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Prepare bulk payment for all unsettled brokerage items. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    broker_id = request.get('broker_id')
    period = request.get('period', 'monthly')
    
    if not broker_id:
        raise HTTPException(status_code=400, detail='broker_id is required')
    
    # Get all unsettled bookings for this broker
    now = datetime.utcnow()
    if period == 'weekly':
        start_date = now - timedelta(days=7)
    elif period == 'monthly':
        start_date = now - timedelta(days=30)
    elif period == 'yearly':
        start_date = now - timedelta(days=365)
    else:
        raise HTTPException(status_code=400, detail='Invalid period')
    
    conditions = [
        Booking.broker_id == broker_id,
        Booking.brokerage_amount > 0,
        Booking.created_at >= start_date,
    ]
    
    stmt = select(Booking).where(and_(*conditions))
    rs = await session.execute(stmt)
    bookings = rs.scalars().all()
    
    # Filter unsettled bookings
    unsettled_bookings = [
        b for b in bookings 
        if not getattr(b, 'broker_settled', False) and b.brokerage_amount > 0
    ]
    
    if not unsettled_bookings:
        raise HTTPException(status_code=400, detail='No unsettled bookings found')
    
    total_amount = sum(float(getattr(b, 'brokerage_amount', 0.0)) for b in unsettled_bookings)
    booking_ids = [b.id for b in unsettled_bookings]
    
    # Create Razorpay order
    try:
        from ..routers.payments import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        if not razorpay_service.is_configured():
            raise HTTPException(status_code=500, detail='Payment gateway not configured')
        
        amount_paise = int(total_amount * 100)
        razorpay_order = razorpay_service.create_order(
            amount=amount_paise,
            currency='INR',
            receipt=f"broker_bulk_{broker_id}_{int(datetime.utcnow().timestamp())}",
            description=f"Bulk brokerage payment for {len(booking_ids)} bookings",
            notes={
                'broker_id': broker_id,
                'payment_type': 'broker_bulk_payment',
                'booking_ids': booking_ids,
                'count': len(booking_ids),
            }
        )
        
        if not razorpay_order or 'id' not in razorpay_order:
            raise HTTPException(status_code=500, detail='Failed to create payment order')
        
        order_id = razorpay_order.get('id')
        
        return {
            'ok': True,
            'order_id': order_id,
            'amount': total_amount,
            'currency': 'INR',
            'broker_id': broker_id,
            'booking_ids': booking_ids,
            'booking_count': len(booking_ids),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BROKER BULK PAYMENT] Error preparing payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to prepare payment: {str(e)}')


@router.post("/verify-bulk-payment")
async def verify_bulk_broker_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Verify and process bulk broker payment. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    broker_id = request.get('broker_id')
    booking_ids = request.get('booking_ids', [])
    payment_data = request.get('payment_data', {})
    
    if not broker_id or not booking_ids:
        raise HTTPException(status_code=400, detail='broker_id and booking_ids are required')
    
    # Get all bookings
    stmt = select(Booking).where(Booking.id.in_(booking_ids))
    rs = await session.execute(stmt)
    bookings = rs.scalars().all()
    
    if len(bookings) != len(booking_ids):
        raise HTTPException(status_code=404, detail='Some bookings not found')
    
    # Verify all bookings belong to the broker
    for booking in bookings:
        if booking.broker_id != broker_id:
            raise HTTPException(status_code=400, detail='Booking does not belong to this broker')
        if getattr(booking, 'broker_settled', False):
            raise HTTPException(status_code=400, detail='Some bookings are already settled')
    
    # Verify payment with Razorpay
    try:
        from ..routers.payments import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        razorpay_payment_id = payment_data.get('razorpay_payment_id') or payment_data.get('payment_id')
        razorpay_order_id = payment_data.get('razorpay_order_id') or payment_data.get('order_id')
        razorpay_signature = payment_data.get('razorpay_signature') or payment_data.get('signature')
        
        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            raise HTTPException(status_code=400, detail='Missing payment verification data')
        
        # Verify payment signature
        is_valid = razorpay_service.verify_payment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )
        
        if not is_valid:
            raise HTTPException(status_code=400, detail='Payment verification failed - invalid signature')
        
        # Fetch payment details
        payment_details = razorpay_service.fetch_payment(razorpay_payment_id)
        
        # Calculate total amount
        total_amount = sum(float(getattr(b, 'brokerage_amount', 0.0)) for b in bookings)
        
        # Create payment record
        payment = Payment(
            booking_id=None,  # Bulk payment doesn't have a single booking_id
            amount=total_amount,
            currency='INR',
            provider='razorpay',
            provider_payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
            status='success',
            paid_at=datetime.utcnow(),
            details={
                'payment_type': 'broker_bulk_payment',
                'broker_id': broker_id,
                'booking_ids': booking_ids,
                'booking_count': len(booking_ids),
            },
            gateway_response=payment_details
        )
        session.add(payment)
        
        # Mark all brokers as settled
        for booking in bookings:
            booking.broker_settled = True
            booking.broker_settled_at = datetime.utcnow()
            booking.broker_settled_by_user_id = user.id
        
        await session.commit()
        
        return {
            'ok': True,
            'message': f'Bulk broker payment verified and {len(bookings)} booking(s) marked as settled',
            'payment_id': payment.id,
            'broker_id': broker_id,
            'settled_count': len(bookings),
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[BROKER BULK PAYMENT] Error verifying payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Payment verification failed: {str(e)}')

