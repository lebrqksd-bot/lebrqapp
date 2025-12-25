"""
Offers & Coupons API
Handles offer management (admin) and offer application (users)
"""
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from ..db import get_session
from ..models import User, Offer, Coupon, OfferUsage, CouponUsage, Booking, OfferNotification
from ..auth import get_current_user

router = APIRouter(tags=["offers"])


def admin_required(user: User = Depends(get_current_user)):
    """Require admin role"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== OFFER ENGINE (Core Logic) ====================

async def get_applicable_offers(
    session: AsyncSession,
    user: Optional[User] = None,
    coupon_code: Optional[str] = None,
    purchase_amount: float = 0.0,
    is_rack_purchase: bool = False
) -> Dict[str, Any]:
    """
    Get all applicable offers for a user based on priority.
    Returns the best offer to apply.
    
    Args:
        is_rack_purchase: If True, only return rack offers. If False, only return space offers (festival, birthday, first_x_users).
    """
    now = datetime.utcnow()
    today = now.date()
    
    applicable_offers = []
    
    # If this is a rack purchase, only show rack offers
    if is_rack_purchase:
        # RACK OFFERS (Priority 40)
        # Build query conditions
        conditions = [
            Offer.offer_type == 'rack',
            Offer.is_active == True
        ]
        
        # Date filtering: offer must be within valid date range
        conditions.append(Offer.start_date <= today)
        conditions.append(Offer.end_date >= today)
        
        stmt = select(Offer).where(and_(*conditions))
        rs = await session.execute(stmt)
        rack_offers = rs.scalars().all()
        
        for offer in rack_offers:
            # Filter by min_purchase_amount if set
            if offer.min_purchase_amount and purchase_amount < offer.min_purchase_amount:
                continue  # Skip offers that don't meet minimum purchase requirement
            
            applicable_offers.append({
                'type': 'rack',
                'id': offer.id,
                'title': offer.title,
                'description': offer.description,
                'discount_type': offer.discount_type,
                'discount_value': offer.discount_value or 0,  # Handle None for surprise-gift-only offers
                'min_purchase_amount': offer.min_purchase_amount,
                'max_discount_amount': offer.max_discount_amount,
                'surprise_gift_name': offer.surprise_gift_name,
                'surprise_gift_image_url': offer.surprise_gift_image_url,
                'priority': 40
            })
        
        # Sort by priority and return
        if applicable_offers:
            applicable_offers.sort(key=lambda x: x['priority'], reverse=True)
            return {
                'has_offer': True,
                'best_offer': applicable_offers[0],
                'all_applicable': applicable_offers
            }
        
        return {
            'has_offer': False,
            'best_offer': None,
            'all_applicable': []
        }
    
    # For space purchases, show space offers (festival, birthday, first_x_users)
    
    # 1. COUPON CODE (Priority 100) - if provided
    if coupon_code:
        coupon_code_upper = coupon_code.strip().upper()
        stmt = select(Coupon).where(
            Coupon.code == coupon_code_upper,
            Coupon.is_active == True
        )
        rs = await session.execute(stmt)
        coupon = rs.scalars().first()
        
        if coupon:
            # Check all validity conditions
            is_valid = True
            
            # Check validity dates
            if coupon.valid_from and now < coupon.valid_from:
                is_valid = False  # Not yet valid
            elif coupon.valid_until and now > coupon.valid_until:
                is_valid = False  # Expired
            # Check min purchase
            elif coupon.min_purchase_amount and purchase_amount < coupon.min_purchase_amount:
                is_valid = False  # Below minimum
            # Check max usage total
            elif coupon.max_usage_total and coupon.current_usage_count >= coupon.max_usage_total:
                is_valid = False  # Max usage reached
            # Check max usage per user
            elif coupon.max_usage_per_user and user:
                stmt_usage = select(func.count(CouponUsage.id)).where(
                    CouponUsage.coupon_id == coupon.id,
                    CouponUsage.user_id == user.id
                )
                rs_usage = await session.execute(stmt_usage)
                user_usage_count = rs_usage.scalar() or 0
                if user_usage_count >= coupon.max_usage_per_user:
                    is_valid = False  # User max usage reached
            
            # Add coupon if all checks passed
            if is_valid:
                applicable_offers.append({
                    'type': 'coupon',
                    'id': coupon.id,
                    'code': coupon.code,
                    'title': coupon.title,
                    'description': coupon.description,
                    'discount_type': coupon.discount_type,
                    'discount_value': coupon.discount_value,
                    'min_purchase_amount': coupon.min_purchase_amount,
                    'max_discount_amount': coupon.max_discount_amount,
                    'priority': 100
                })
    
    # 2. FESTIVAL OFFERS (Priority 50)
    # Show festival offers if they're active and within date range
    # Note: min_purchase_amount check is done later when applying, not here
    # This allows offers to show in popup even if current purchase is 0
    stmt = select(Offer).where(
        Offer.offer_type == 'festival',
        Offer.is_active == True,
        Offer.start_date <= today,
        Offer.end_date >= today
    )
    rs = await session.execute(stmt)
    festival_offers = rs.scalars().all()
    
    for offer in festival_offers:
        # Don't filter by min_purchase_amount here - show all active festival offers
        # The min_purchase check will happen when applying the offer
        applicable_offers.append({
            'type': 'festival',
            'id': offer.id,
            'title': offer.title,
            'description': offer.description,
            'festival_name': offer.festival_name,
            'discount_type': offer.discount_type,
            'discount_value': offer.discount_value,
            'min_purchase_amount': offer.min_purchase_amount,
            'max_discount_amount': offer.max_discount_amount,
            'priority': 50
        })
    
    # 3. BIRTHDAY OFFERS (Priority 30) - if user has DOB
    if user and user.date_of_birth:
        user_dob = user.date_of_birth
        # Check if today is user's birthday (month and day match)
        if today.month == user_dob.month and today.day == user_dob.day:
            stmt = select(Offer).where(
                Offer.offer_type == 'birthday',
                Offer.is_active == True
            )
            rs = await session.execute(stmt)
            birthday_offers = rs.scalars().all()
            
            for offer in birthday_offers:
                # Don't filter by min_purchase_amount here - show all active birthday offers
                applicable_offers.append({
                    'type': 'birthday',
                    'id': offer.id,
                    'title': offer.title,
                    'description': offer.description,
                    'discount_type': offer.discount_type,
                    'discount_value': offer.discount_value,
                    'min_purchase_amount': offer.min_purchase_amount,
                    'max_discount_amount': offer.max_discount_amount,
                    'priority': 30
                })
    
    # 4. FIRST X USERS OFFERS (Priority 10)
    stmt = select(Offer).where(
        Offer.offer_type == 'first_x_users',
        Offer.is_active == True
    )
    rs = await session.execute(stmt)
    first_x_offers = rs.scalars().all()
    
    for offer in first_x_offers:
        if offer.number_of_users and offer.claimed_count >= offer.number_of_users:
            continue  # Already reached max users
        # Don't filter by min_purchase_amount here - show all active first_x_users offers
        applicable_offers.append({
            'type': 'first_x_users',
            'id': offer.id,
            'title': offer.title,
            'description': offer.description,
            'discount_type': offer.discount_type,
            'discount_value': offer.discount_value,
            'min_purchase_amount': offer.min_purchase_amount,
            'max_discount_amount': offer.max_discount_amount,
            'number_of_users': offer.number_of_users,
            'claimed_count': offer.claimed_count,
            'priority': 10
        })
    
    # Sort by priority (highest first) and return the best one
    if applicable_offers:
        applicable_offers.sort(key=lambda x: x['priority'], reverse=True)
        return {
            'has_offer': True,
            'best_offer': applicable_offers[0],
            'all_applicable': applicable_offers
        }
    
    return {
        'has_offer': False,
        'best_offer': None,
        'all_applicable': []
    }


def calculate_discount(
    offer: Dict[str, Any],
    purchase_amount: float
) -> Dict[str, Any]:
    """
    Calculate discount amount based on offer configuration.
    Returns: {discount_amount, final_amount, applied_offer}
    """
    discount_type = offer.get('discount_type')
    discount_value = offer.get('discount_value', 0)
    min_purchase = offer.get('min_purchase_amount', 0) or 0
    max_discount = offer.get('max_discount_amount')
    
    # Validate inputs
    if purchase_amount < 0:
        return {
            'discount_amount': 0.0,
            'final_amount': purchase_amount,
            'applied_offer': None,
            'error': 'Purchase amount cannot be negative'
        }
    
    if discount_value < 0:
        return {
            'discount_amount': 0.0,
            'final_amount': purchase_amount,
            'applied_offer': None,
            'error': 'Discount value cannot be negative'
        }
    
    # Check minimum purchase
    if purchase_amount < min_purchase:
        return {
            'discount_amount': 0.0,
            'final_amount': purchase_amount,
            'applied_offer': None,
            'error': f'Minimum purchase of ₹{min_purchase:.2f} required'
        }
    
    # Calculate discount
    if discount_type == 'percentage':
        if discount_value > 100:
            return {
                'discount_amount': 0.0,
                'final_amount': purchase_amount,
                'applied_offer': None,
                'error': 'Percentage discount cannot exceed 100%'
            }
        discount_amount = (purchase_amount * discount_value) / 100.0
        if max_discount:
            discount_amount = min(discount_amount, max_discount)
    elif discount_type == 'flat':
        discount_amount = discount_value
    else:
        return {
            'discount_amount': 0.0,
            'final_amount': purchase_amount,
            'applied_offer': None,
            'error': f'Invalid discount_type: {discount_type}. Must be "percentage" or "flat"'
        }
    
    # Ensure discount doesn't exceed purchase amount
    discount_amount = min(discount_amount, purchase_amount)
    final_amount = max(0.0, purchase_amount - discount_amount)
    
    return {
        'discount_amount': round(discount_amount, 2),
        'final_amount': round(final_amount, 2),
        'applied_offer': offer,
        'error': None
    }


# ==================== USER ENDPOINTS ====================

@router.get("/offers/check")
async def check_applicable_offers(
    coupon_code: Optional[str] = Query(None),
    purchase_amount: float = Query(0.0, ge=0),
    is_rack_purchase: bool = Query(False, description="Whether this is a rack purchase"),
    session: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Check what offers are applicable for the current user.
    Returns the best offer to apply.
    
    Args:
        is_rack_purchase: If True, only return rack offers. If False, only return space offers.
    """
    result = await get_applicable_offers(
        session=session,
        user=user if user and user.role == 'customer' else None,
        coupon_code=coupon_code,
        purchase_amount=purchase_amount,
        is_rack_purchase=is_rack_purchase
    )
    return result


@router.post("/offers/apply")
async def apply_offer(
    data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Apply an offer/coupon to a booking.
    This should be called before payment to calculate final amount.
    """
    offer_id = data.get('offer_id')
    offer_type = data.get('offer_type')  # coupon, festival, birthday, first_x_users
    coupon_code = data.get('coupon_code')
    purchase_amount = float(data.get('purchase_amount', 0))
    booking_id = data.get('booking_id')  # Optional, can be set later
    
    if not offer_id and not coupon_code:
        raise HTTPException(status_code=400, detail="offer_id or coupon_code required")
    
    # Get the offer
    if offer_type == 'coupon' or coupon_code:
        if coupon_code:
            stmt = select(Coupon).where(Coupon.code == coupon_code.strip().upper())
        else:
            stmt = select(Coupon).where(Coupon.id == offer_id)
        rs = await session.execute(stmt)
        offer_obj = rs.scalars().first()
        if not offer_obj:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        # Verify it's active
        if not offer_obj.is_active:
            raise HTTPException(status_code=400, detail="Coupon is not active")
        
        # Verify it's still valid
        now = datetime.utcnow()
        if offer_obj.valid_from and now < offer_obj.valid_from:
            raise HTTPException(status_code=400, detail="Coupon not yet valid")
        if offer_obj.valid_until and now > offer_obj.valid_until:
            raise HTTPException(status_code=400, detail="Coupon expired")
        if offer_obj.min_purchase_amount and purchase_amount < offer_obj.min_purchase_amount:
            raise HTTPException(status_code=400, detail=f"Minimum purchase of ₹{offer_obj.min_purchase_amount:.2f} required")
        if offer_obj.max_usage_total and offer_obj.current_usage_count >= offer_obj.max_usage_total:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        if offer_obj.max_usage_per_user and user:
            stmt_usage = select(func.count(CouponUsage.id)).where(
                CouponUsage.coupon_id == offer_obj.id,
                CouponUsage.user_id == user.id
            )
            rs_usage = await session.execute(stmt_usage)
            user_usage_count = rs_usage.scalar() or 0
            if user_usage_count >= offer_obj.max_usage_per_user:
                raise HTTPException(status_code=400, detail="You have reached the maximum usage limit for this coupon")
        
        offer_dict = {
            'type': 'coupon',
            'id': offer_obj.id,
            'code': offer_obj.code,
            'title': offer_obj.title,
            'description': offer_obj.description,
            'discount_type': offer_obj.discount_type,
            'discount_value': offer_obj.discount_value,
            'min_purchase_amount': offer_obj.min_purchase_amount,
            'max_discount_amount': offer_obj.max_discount_amount,
            'priority': 100
        }
    else:
        stmt = select(Offer).where(Offer.id == offer_id)
        rs = await session.execute(stmt)
        offer_obj = rs.scalars().first()
        if not offer_obj:
            raise HTTPException(status_code=404, detail="Offer not found")
        if not offer_obj.is_active:
            raise HTTPException(status_code=400, detail="Offer is not active")
        
        # Check offer-specific conditions
        if offer_obj.offer_type == 'first_x_users':
            if offer_obj.number_of_users and offer_obj.claimed_count >= offer_obj.number_of_users:
                raise HTTPException(status_code=400, detail="Offer limit reached")
        
        offer_dict = {
            'type': offer_obj.offer_type,
            'id': offer_obj.id,
            'title': offer_obj.title,
            'description': offer_obj.description,
            'discount_type': offer_obj.discount_type,
            'discount_value': offer_obj.discount_value,
            'min_purchase_amount': offer_obj.min_purchase_amount,
            'max_discount_amount': offer_obj.max_discount_amount,
            'priority': offer_obj.priority
        }
    
    # Calculate discount
    discount_result = calculate_discount(offer_dict, purchase_amount)
    if discount_result.get('error'):
        raise HTTPException(status_code=400, detail=discount_result['error'])
    
    # Record usage if booking_id is provided (payment completed)
    if booking_id and offer_obj:
        try:
            if offer_type == 'coupon' or coupon_code:
                # Record coupon usage
                coupon_usage = CouponUsage(
                    coupon_id=offer_obj.id,
                    user_id=user.id if user else None,
                    booking_id=booking_id,
                    discount_amount=discount_result['discount_amount'],
                    original_amount=purchase_amount,
                    final_amount=discount_result['final_amount']
                )
                session.add(coupon_usage)
                # Update coupon usage count
                offer_obj.current_usage_count = (offer_obj.current_usage_count or 0) + 1
            else:
                # Record offer usage
                offer_usage = OfferUsage(
                    offer_id=offer_obj.id,
                    user_id=user.id if user else None,
                    booking_id=booking_id,
                    discount_amount=discount_result['discount_amount'],
                    original_amount=purchase_amount,
                    final_amount=discount_result['final_amount']
                )
                session.add(offer_usage)
                # Update first X users claimed count if applicable
                if offer_obj.offer_type == 'first_x_users':
                    offer_obj.claimed_count = (offer_obj.claimed_count or 0) + 1
            
            await session.commit()
        except Exception as e:
            print(f"[OFFERS] Warning: Failed to record usage: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            # Don't fail the apply request if usage recording fails
    
    return {
        'success': True,
        'discount_amount': discount_result['discount_amount'],
        'original_amount': purchase_amount,
        'final_amount': discount_result['final_amount'],
        'applied_offer': discount_result['applied_offer']
    }


# ==================== ADMIN ENDPOINTS - OFFERS ====================

@router.get("/admin/offers")
async def list_offers(
    offer_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List all offers (admin)"""
    stmt = select(Offer)
    conditions = []
    
    if offer_type:
        conditions.append(Offer.offer_type == offer_type)
    if is_active is not None:
        conditions.append(Offer.is_active == is_active)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.order_by(Offer.priority.desc(), Offer.created_at.desc())
    rs = await session.execute(stmt)
    offers = rs.scalars().all()
    
    return {
        'offers': [{
            'id': o.id,
            'offer_type': o.offer_type,
            'title': o.title,
            'description': o.description,
            'is_active': o.is_active,
            'priority': o.priority,
            'discount_type': o.discount_type,
            'discount_value': o.discount_value,
            'min_purchase_amount': o.min_purchase_amount,
            'max_discount_amount': o.max_discount_amount,
            'festival_name': o.festival_name,
            'start_date': o.start_date.isoformat() if o.start_date else None,
            'end_date': o.end_date.isoformat() if o.end_date else None,
            'number_of_users': o.number_of_users,
            'claimed_count': o.claimed_count,
            'surprise_gift_name': o.surprise_gift_name,
            'surprise_gift_image_url': o.surprise_gift_image_url,
            'created_at': o.created_at.isoformat(),
            'updated_at': o.updated_at.isoformat()
        } for o in offers]
    }


@router.post("/admin/offers")
async def create_offer(
    data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Create a new offer (admin)"""
    offer_type = data.get('offer_type')
    if offer_type not in ['festival', 'birthday', 'first_x_users', 'rack']:
        raise HTTPException(status_code=400, detail="Invalid offer_type. Must be: festival, birthday, first_x_users, rack")
    
    # Validate required fields
    if not data.get('title'):
        raise HTTPException(status_code=400, detail="Title is required")
    
    # For rack offers: either discount_value OR surprise_gift_name is required
    # For other offers: discount_value is required
    surprise_gift_name = data.get('surprise_gift_name', '').strip() if data.get('surprise_gift_name') else None
    discount_value = data.get('discount_value')
    
    if offer_type == 'rack':
        # Rack offers: need either discount OR surprise gift
        has_discount = discount_value and float(discount_value) > 0
        has_surprise_gift = surprise_gift_name and len(surprise_gift_name) > 0
        
        if not has_discount and not has_surprise_gift:
            raise HTTPException(status_code=400, detail="Rack offers require either a discount value or a surprise gift name")
        
        # If discount is provided, validate it
        if has_discount:
            if not data.get('discount_type') or data.get('discount_type') not in ['percentage', 'flat']:
                raise HTTPException(status_code=400, detail="discount_type is required when discount_value is provided and must be 'percentage' or 'flat'")
            discount_value_float = float(discount_value)
            if discount_value_float <= 0:
                raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
            if data.get('discount_type') == 'percentage' and discount_value_float > 100:
                raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")
        else:
            # No discount, so discount_type and discount_value can be None/0
            discount_value_float = 0.0
    else:
        # Other offer types: discount is required
        if not data.get('discount_type') or data.get('discount_type') not in ['percentage', 'flat']:
            raise HTTPException(status_code=400, detail="discount_type is required and must be 'percentage' or 'flat'")
        if not discount_value:
            raise HTTPException(status_code=400, detail="discount_value is required")
        discount_value_float = float(discount_value)
        if discount_value_float <= 0:
            raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
        if data.get('discount_type') == 'percentage' and discount_value_float > 100:
            raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")
    
    # Parse dates
    start_date = None
    end_date = None
    if data.get('start_date'):
        try:
            start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')).date()
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {e}")
    if data.get('end_date'):
        try:
            end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date()
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format: {e}")
    
    # Validate festival dates
    if offer_type == 'festival':
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Festival offers require both start_date and end_date")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="start_date cannot be after end_date")
    
    # Validate rack offers (require dates similar to festival offers)
    if offer_type == 'rack':
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Rack offers require both start_date and end_date")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="start_date cannot be after end_date")
    
    # Validate first_x_users
    if offer_type == 'first_x_users':
        number_of_users = data.get('number_of_users')
        if not number_of_users or number_of_users <= 0:
            raise HTTPException(status_code=400, detail="first_x_users offers require number_of_users > 0")
    
    offer = Offer(
        offer_type=offer_type,
        title=data.get('title', ''),
        description=data.get('description'),
        is_active=data.get('is_active', True),
        priority=data.get('priority', 0),
        discount_type=data.get('discount_type') if (offer_type != 'rack' or (discount_value and float(discount_value) > 0)) else None,  # Only set if discount is provided
        discount_value=discount_value_float,  # Use the validated float value
        min_purchase_amount=data.get('min_purchase_amount'),
        max_discount_amount=data.get('max_discount_amount'),
        festival_name=data.get('festival_name') if offer_type == 'festival' else None,
        start_date=start_date if offer_type in ['festival', 'rack'] else None,
        end_date=end_date if offer_type in ['festival', 'rack'] else None,
        number_of_users=data.get('number_of_users') if offer_type == 'first_x_users' else None,
        surprise_gift_name=surprise_gift_name if offer_type == 'rack' else None,
        surprise_gift_image_url=data.get('surprise_gift_image_url') if offer_type == 'rack' else None,
        claimed_count=0,
        created_by_user_id=admin.id
    )
    
    session.add(offer)
    await session.commit()
    await session.refresh(offer)
    
    return {
        'success': True,
        'offer': {
            'id': offer.id,
            'offer_type': offer.offer_type,
            'title': offer.title,
            'is_active': offer.is_active,
            'created_at': offer.created_at.isoformat()
        }
    }


@router.put("/admin/offers/{offer_id}")
async def update_offer(
    offer_id: int,
    data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Update an offer (admin)"""
    stmt = select(Offer).where(Offer.id == offer_id)
    rs = await session.execute(stmt)
    offer = rs.scalars().first()
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Update fields
    if 'title' in data:
        if not data['title']:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        offer.title = data['title']
    if 'description' in data:
        offer.description = data.get('description')
    if 'is_active' in data:
        offer.is_active = bool(data['is_active'])
    if 'priority' in data:
        offer.priority = data['priority']
    if 'discount_type' in data:
        if data['discount_type'] not in ['percentage', 'flat', None]:
            raise HTTPException(status_code=400, detail="discount_type must be 'percentage', 'flat', or None")
        offer.discount_type = data['discount_type']
    if 'discount_value' in data:
        discount_value = data.get('discount_value')
        if discount_value is not None:
            discount_value_float = float(discount_value)
            # For rack offers, allow 0 if surprise gift is provided (validated later)
            # For other offers, discount must be > 0
            if offer.offer_type != 'rack' and discount_value_float <= 0:
                raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
            if discount_value_float > 0:
                if offer.discount_type == 'percentage' and discount_value_float > 100:
                    raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")
            offer.discount_value = discount_value_float
        else:
            # Allow setting discount_value to None/0 for rack offers (if surprise gift is provided)
            if offer.offer_type == 'rack':
                offer.discount_value = 0.0
            else:
                raise HTTPException(status_code=400, detail="discount_value is required for non-rack offers")
    if 'min_purchase_amount' in data:
        min_purchase = data.get('min_purchase_amount')
        if min_purchase is not None and min_purchase < 0:
            raise HTTPException(status_code=400, detail="min_purchase_amount cannot be negative")
        offer.min_purchase_amount = min_purchase
    if 'max_discount_amount' in data:
        max_discount = data.get('max_discount_amount')
        if max_discount is not None and max_discount < 0:
            raise HTTPException(status_code=400, detail="max_discount_amount cannot be negative")
        offer.max_discount_amount = max_discount
    
    if offer.offer_type == 'festival':
        if 'festival_name' in data:
            offer.festival_name = data.get('festival_name')
        if 'start_date' in data:
            try:
                offer.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')).date() if data.get('start_date') else None
            except (ValueError, AttributeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid start_date format: {e}")
        if 'end_date' in data:
            try:
                offer.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date() if data.get('end_date') else None
            except (ValueError, AttributeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid end_date format: {e}")
        # Validate date range
        if offer.start_date and offer.end_date and offer.start_date > offer.end_date:
            raise HTTPException(status_code=400, detail="start_date cannot be after end_date")
        # Ensure both dates are present for festival offers
        if (offer.start_date is None) != (offer.end_date is None):
            raise HTTPException(status_code=400, detail="Festival offers require both start_date and end_date")
    
    if offer.offer_type == 'rack':
        if 'start_date' in data:
            try:
                offer.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')).date() if data.get('start_date') else None
            except (ValueError, AttributeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid start_date format: {e}")
        if 'end_date' in data:
            try:
                offer.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date() if data.get('end_date') else None
            except (ValueError, AttributeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid end_date format: {e}")
        # Validate date range
        if offer.start_date and offer.end_date and offer.start_date > offer.end_date:
            raise HTTPException(status_code=400, detail="start_date cannot be after end_date")
        # Ensure both dates are present for rack offers
        if (offer.start_date is None) != (offer.end_date is None):
            raise HTTPException(status_code=400, detail="Rack offers require both start_date and end_date")
        # Update surprise gift fields
        if 'surprise_gift_name' in data:
            offer.surprise_gift_name = data.get('surprise_gift_name')
        if 'surprise_gift_image_url' in data:
            offer.surprise_gift_image_url = data.get('surprise_gift_image_url')
        
        # Validate that either discount OR surprise gift is present after update
        has_discount = offer.discount_value and offer.discount_value > 0
        has_surprise_gift = offer.surprise_gift_name and len(offer.surprise_gift_name.strip()) > 0
        
        if not has_discount and not has_surprise_gift:
            raise HTTPException(status_code=400, detail="Rack offers require either a discount value or a surprise gift name (at least one is required)")
        
        # If discount is provided, ensure discount_type is set
        if has_discount and not offer.discount_type:
            raise HTTPException(status_code=400, detail="discount_type is required when discount_value is provided")
    
    if offer.offer_type == 'first_x_users':
        if 'number_of_users' in data:
            number_of_users = data.get('number_of_users')
            if number_of_users is not None and number_of_users <= 0:
                raise HTTPException(status_code=400, detail="number_of_users must be greater than 0")
            offer.number_of_users = number_of_users
    
    offer.updated_at = datetime.utcnow()
    await session.commit()
    
    return {'success': True, 'message': 'Offer updated'}


@router.delete("/admin/offers/{offer_id}")
async def delete_offer(
    offer_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Delete an offer (admin). If in use, fall back to soft deactivation."""
    rs = await session.execute(select(Offer).where(Offer.id == offer_id))
    offer = rs.scalars().first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    try:
        # Best-effort: remove dependent rows to satisfy FK constraints
        try:
            # Some flows record applied offers in a separate table; delete if exists
            await session.execute(text("DELETE FROM applied_offers WHERE offer_id = :oid"), {"oid": offer_id})
        except Exception:
            # Table may not exist; ignore
            pass

        # Delete usage and notifications linked to this offer
        await session.execute(delete(OfferUsage).where(OfferUsage.offer_id == offer_id))
        await session.execute(delete(OfferNotification).where(OfferNotification.offer_id == offer_id))

        # Finally delete the offer
        await session.delete(offer)
        await session.commit()
        return {"success": True, "message": "Offer deleted"}
    except IntegrityError:
        # If still constrained, mark as inactive instead
        await session.rollback()
        offer.is_active = False
        offer.updated_at = datetime.utcnow()
        await session.commit()
        return {"success": True, "message": "Offer deactivated (in use, could not hard-delete)"}


@router.get("/admin/offers/{offer_id}")
async def get_offer(
    offer_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get a single offer by ID (admin)"""
    stmt = select(Offer).where(Offer.id == offer_id)
    rs = await session.execute(stmt)
    offer = rs.scalars().first()
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    return {
        'id': offer.id,
        'offer_type': offer.offer_type,
        'title': offer.title,
        'description': offer.description,
        'is_active': offer.is_active,
        'priority': offer.priority,
        'discount_type': offer.discount_type,
        'discount_value': offer.discount_value,
        'min_purchase_amount': offer.min_purchase_amount,
        'max_discount_amount': offer.max_discount_amount,
        'festival_name': offer.festival_name,
        'start_date': offer.start_date.isoformat() if offer.start_date else None,
        'end_date': offer.end_date.isoformat() if offer.end_date else None,
        'number_of_users': offer.number_of_users,
        'claimed_count': offer.claimed_count,
        'surprise_gift_name': offer.surprise_gift_name,
        'surprise_gift_image_url': offer.surprise_gift_image_url,
        'created_at': offer.created_at.isoformat(),
        'updated_at': offer.updated_at.isoformat()
    }


@router.get("/admin/offers/{offer_id}/usage")
async def get_offer_usage(
    offer_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get usage history for an offer (admin)"""
    # Verify offer exists
    stmt_offer = select(Offer).where(Offer.id == offer_id)
    rs_offer = await session.execute(stmt_offer)
    offer = rs_offer.scalars().first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    stmt = select(OfferUsage).where(OfferUsage.offer_id == offer_id).order_by(OfferUsage.used_at.desc())
    rs = await session.execute(stmt)
    usages = rs.scalars().all()
    
    return {
        'offer_id': offer_id,
        'offer_title': offer.title,
        'total_usage': len(usages),
        'usage_history': [{
            'id': u.id,
            'user_id': u.user_id,
            'booking_id': u.booking_id,
            'discount_amount': float(u.discount_amount),
            'original_amount': float(u.original_amount),
            'final_amount': float(u.final_amount),
            'used_at': u.used_at.isoformat()
        } for u in usages]
    }


# ==================== ADMIN ENDPOINTS - COUPONS ====================

@router.get("/admin/coupons")
async def list_coupons(
    is_active: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """List all coupons (admin)"""
    stmt = select(Coupon)
    
    if is_active is not None:
        stmt = stmt.where(Coupon.is_active == is_active)
    
    stmt = stmt.order_by(Coupon.created_at.desc())
    rs = await session.execute(stmt)
    coupons = rs.scalars().all()
    
    return {
        'coupons': [{
            'id': c.id,
            'code': c.code,
            'title': c.title,
            'description': c.description,
            'is_active': c.is_active,
            'discount_type': c.discount_type,
            'discount_value': c.discount_value,
            'min_purchase_amount': c.min_purchase_amount,
            'max_discount_amount': c.max_discount_amount,
            'max_usage_per_user': c.max_usage_per_user,
            'max_usage_total': c.max_usage_total,
            'current_usage_count': c.current_usage_count,
            'valid_from': c.valid_from.isoformat() if c.valid_from else None,
            'valid_until': c.valid_until.isoformat() if c.valid_until else None,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat()
        } for c in coupons]
    }


@router.post("/admin/coupons")
async def create_coupon(
    data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Create a new coupon (admin)"""
    code = data.get('code', '').strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code is required")
    if len(code) < 3:
        raise HTTPException(status_code=400, detail="Coupon code must be at least 3 characters")
    
    # Check if code already exists
    stmt = select(Coupon).where(Coupon.code == code)
    rs = await session.execute(stmt)
    existing = rs.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    # Validate required fields
    if not data.get('title'):
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.get('discount_type') or data.get('discount_type') not in ['percentage', 'flat']:
        raise HTTPException(status_code=400, detail="discount_type is required and must be 'percentage' or 'flat'")
    discount_value = float(data.get('discount_value', 0))
    if discount_value <= 0:
        raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
    if data.get('discount_type') == 'percentage' and discount_value > 100:
        raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")
    
    # Parse dates
    valid_from = None
    valid_until = None
    if data.get('valid_from'):
        try:
            valid_from = datetime.fromisoformat(data['valid_from'].replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid valid_from format: {e}")
    if data.get('valid_until'):
        try:
            valid_until = datetime.fromisoformat(data['valid_until'].replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid valid_until format: {e}")
    
    # Validate date range
    if valid_from and valid_until and valid_from > valid_until:
        raise HTTPException(status_code=400, detail="valid_from cannot be after valid_until")
    
    coupon = Coupon(
        code=code,
        title=data.get('title', ''),
        description=data.get('description'),
        is_active=data.get('is_active', True),
        discount_type=data.get('discount_type'),  # percentage or flat
        discount_value=discount_value,
        min_purchase_amount=data.get('min_purchase_amount'),
        max_discount_amount=data.get('max_discount_amount'),
        max_usage_per_user=data.get('max_usage_per_user'),
        max_usage_total=data.get('max_usage_total'),
        current_usage_count=0,
        valid_from=valid_from,
        valid_until=valid_until,
        created_by_user_id=admin.id
    )
    
    session.add(coupon)
    await session.commit()
    await session.refresh(coupon)
    
    return {
        'success': True,
        'coupon': {
            'id': coupon.id,
            'code': coupon.code,
            'title': coupon.title,
            'is_active': coupon.is_active,
            'created_at': coupon.created_at.isoformat()
        }
    }


@router.put("/admin/coupons/{coupon_id}")
async def update_coupon(
    coupon_id: int,
    data: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Update a coupon (admin)"""
    stmt = select(Coupon).where(Coupon.id == coupon_id)
    rs = await session.execute(stmt)
    coupon = rs.scalars().first()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Update fields
    if 'code' in data:
        new_code = data['code'].strip().upper()
        if new_code != coupon.code:
            # Check if new code exists
            stmt_check = select(Coupon).where(Coupon.code == new_code, Coupon.id != coupon_id)
            rs_check = await session.execute(stmt_check)
            if rs_check.scalars().first():
                raise HTTPException(status_code=400, detail="Coupon code already exists")
            coupon.code = new_code
    
    if 'title' in data:
        if not data['title']:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        coupon.title = data['title']
    if 'description' in data:
        coupon.description = data.get('description')
    if 'is_active' in data:
        coupon.is_active = data['is_active']
    if 'discount_type' in data:
        if data['discount_type'] not in ['percentage', 'flat']:
            raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'flat'")
        coupon.discount_type = data['discount_type']
    if 'discount_value' in data:
        discount_value = float(data['discount_value'])
        if discount_value <= 0:
            raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
        if coupon.discount_type == 'percentage' and discount_value > 100:
            raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")
        coupon.discount_value = discount_value
    if 'min_purchase_amount' in data:
        min_purchase = data.get('min_purchase_amount')
        if min_purchase is not None and min_purchase < 0:
            raise HTTPException(status_code=400, detail="min_purchase_amount cannot be negative")
        coupon.min_purchase_amount = min_purchase
    if 'max_discount_amount' in data:
        max_discount = data.get('max_discount_amount')
        if max_discount is not None and max_discount < 0:
            raise HTTPException(status_code=400, detail="max_discount_amount cannot be negative")
        coupon.max_discount_amount = max_discount
    if 'max_usage_per_user' in data:
        max_per_user = data.get('max_usage_per_user')
        if max_per_user is not None and max_per_user < 0:
            raise HTTPException(status_code=400, detail="max_usage_per_user cannot be negative")
        coupon.max_usage_per_user = max_per_user
    if 'max_usage_total' in data:
        max_total = data.get('max_usage_total')
        if max_total is not None and max_total < 0:
            raise HTTPException(status_code=400, detail="max_usage_total cannot be negative")
        coupon.max_usage_total = max_total
    if 'valid_from' in data:
        try:
            coupon.valid_from = datetime.fromisoformat(data['valid_from'].replace('Z', '+00:00')) if data.get('valid_from') else None
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid valid_from format: {e}")
    if 'valid_until' in data:
        try:
            coupon.valid_until = datetime.fromisoformat(data['valid_until'].replace('Z', '+00:00')) if data.get('valid_until') else None
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid valid_until format: {e}")
    # Validate date range
    if coupon.valid_from and coupon.valid_until and coupon.valid_from > coupon.valid_until:
        raise HTTPException(status_code=400, detail="valid_from cannot be after valid_until")
    
    coupon.updated_at = datetime.utcnow()
    await session.commit()
    
    return {'success': True, 'message': 'Coupon updated'}


@router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Delete a coupon (admin)"""
    stmt = select(Coupon).where(Coupon.id == coupon_id)
    rs = await session.execute(stmt)
    coupon = rs.scalars().first()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    await session.delete(coupon)
    await session.commit()
    
    return {'success': True, 'message': 'Coupon deleted'}


@router.get("/admin/coupons/{coupon_id}")
async def get_coupon(
    coupon_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get a single coupon by ID (admin)"""
    stmt = select(Coupon).where(Coupon.id == coupon_id)
    rs = await session.execute(stmt)
    coupon = rs.scalars().first()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {
        'id': coupon.id,
        'code': coupon.code,
        'title': coupon.title,
        'description': coupon.description,
        'is_active': coupon.is_active,
        'discount_type': coupon.discount_type,
        'discount_value': coupon.discount_value,
        'min_purchase_amount': coupon.min_purchase_amount,
        'max_discount_amount': coupon.max_discount_amount,
        'max_usage_per_user': coupon.max_usage_per_user,
        'max_usage_total': coupon.max_usage_total,
        'current_usage_count': coupon.current_usage_count,
        'valid_from': coupon.valid_from.isoformat() if coupon.valid_from else None,
        'valid_until': coupon.valid_until.isoformat() if coupon.valid_until else None,
        'created_at': coupon.created_at.isoformat(),
        'updated_at': coupon.updated_at.isoformat()
    }


@router.get("/admin/coupons/{coupon_id}/usage")
async def get_coupon_usage(
    coupon_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get usage history for a coupon (admin)"""
    # Verify coupon exists
    stmt_coupon = select(Coupon).where(Coupon.id == coupon_id)
    rs_coupon = await session.execute(stmt_coupon)
    coupon = rs_coupon.scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    stmt = select(CouponUsage).where(CouponUsage.coupon_id == coupon_id).order_by(CouponUsage.used_at.desc())
    rs = await session.execute(stmt)
    usages = rs.scalars().all()
    
    return {
        'coupon_id': coupon_id,
        'coupon_code': coupon.code,
        'coupon_title': coupon.title,
        'total_usage': len(usages),
        'usage_history': [{
            'id': u.id,
            'user_id': u.user_id,
            'booking_id': u.booking_id,
            'discount_amount': float(u.discount_amount),
            'original_amount': float(u.original_amount),
            'final_amount': float(u.final_amount),
            'used_at': u.used_at.isoformat()
        } for u in usages]
    }


@router.get("/admin/offers/{offer_id}/users")
async def get_users_for_offer_notification(
    offer_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get list of users with their informed status for an offer"""
    # Verify offer exists
    stmt_offer = select(Offer).where(Offer.id == offer_id)
    rs_offer = await session.execute(stmt_offer)
    offer = rs_offer.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Get all customer users
    stmt_users = select(User).where(User.role == 'customer').order_by(User.first_name, User.last_name, User.username)
    rs_users = await session.execute(stmt_users)
    users = rs_users.scalars().all()
    
    # Get informed users for this offer
    stmt_notifications = select(OfferNotification).where(OfferNotification.offer_id == offer_id)
    rs_notifications = await session.execute(stmt_notifications)
    notifications = rs_notifications.scalars().all()
    
    # Create a map of user_id -> notification
    informed_map = {n.user_id: n for n in notifications}
    
    # Build response
    users_list = []
    for user in users:
        notification = informed_map.get(user.id)
        users_list.append({
            'id': user.id,
            'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or 'Unknown',
            'username': user.username,
            'mobile': user.mobile,
            'email': user.username if user.username and '@' in user.username else None,
            'is_informed': notification is not None,
            'informed_at': notification.notified_at.isoformat() if notification else None,
            'channels': {
                'whatsapp': notification.whatsapp_sent if notification else False,
                'sms': notification.sms_sent if notification else False,
                'email': notification.email_sent if notification else False,
            } if notification else None
        })
    
    return {
        'offer_id': offer_id,
        'offer_title': offer.title,
        'total_users': len(users_list),
        'informed_count': len(informed_map),
        'users': users_list
    }


@router.post("/admin/offers/{offer_id}/notify-all")
async def notify_all_users_about_offer(
    offer_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Send notifications to all existing users about a festival offer via selected channels (WhatsApp, SMS, Email)"""
    try:
        # Get selected channels from request body
        channels = request.get('channels', {})
        use_whatsapp = channels.get('whatsapp', True)  # Default to True for backward compatibility
        use_sms = channels.get('sms', False)
        use_email = channels.get('email', False)
        
        if not use_whatsapp and not use_sms and not use_email:
            raise HTTPException(status_code=400, detail="At least one notification channel must be selected")
        # Get the offer
        stmt = select(Offer).where(Offer.id == offer_id)
        rs = await session.execute(stmt)
        offer = rs.scalars().first()
        
        if not offer:
            raise HTTPException(status_code=404, detail="Offer not found")
        
        # Only allow festival offers for now
        if offer.offer_type != 'festival':
            raise HTTPException(status_code=400, detail="Only festival offers can be broadcast to all users")
        
        # Get selected user IDs from request (optional - if not provided, send to all)
        selected_user_ids = request.get('user_ids', [])
        
        # Prepare offer details (before querying users to return faster)
        festival_name = offer.festival_name or "Festival"
        offer_details = offer.description or offer.title or "Special offer"
        # Format discount: "20%" for percentage, "₹100 flat" for flat
        if offer.discount_type == 'percentage':
            discount_percentage = f"{offer.discount_value:.0f}%"
        else:
            discount_percentage = f"₹{offer.discount_value:.0f} flat"
        # Format date as DD-MM-YYYY to match template example (31-12-2025)
        if offer.end_date:
            valid_until_date = offer.end_date.strftime('%d-%m-%Y')
        else:
            valid_until_date = "N/A"
        
        # Get website link and contact number from settings or use defaults
        from ..core import settings
        website_link = settings.WEB_APP_URL.rstrip('/') if hasattr(settings, 'WEB_APP_URL') and settings.WEB_APP_URL else 'https://lebrq.com'
        # Contact number - can be configured in settings if needed, or use default
        contact_number = getattr(settings, 'CONTACT_NUMBER', None) or 'lebrq.com'  # Default to website if no contact number
        
        # Store all data needed for background thread (closure variables)
        stored_offer_id = offer_id
        stored_selected_user_ids = selected_user_ids
        stored_admin_id = admin.id
        stored_use_whatsapp = use_whatsapp
        stored_use_sms = use_sms
        stored_use_email = use_email
        stored_festival_name = festival_name
        stored_offer_details = offer_details
        stored_discount_percentage = discount_percentage
        stored_valid_until_date = valid_until_date
        stored_website_link = website_link
        stored_contact_number = contact_number
        
        # Return immediately - user query will happen in background thread
        estimated_user_count = f"{len(selected_user_ids)} selected users" if selected_user_ids else "all users"
        
        # Use threading for truly non-blocking execution (similar to admin_bookings.py)
        import threading
        import time
        
        def send_notifications_in_thread():
            """Send notifications in completely isolated thread"""
            # Small delay to ensure main session is released
            time.sleep(0.2)
            
            try:
                import asyncio
                from app.db import AsyncSessionLocal, SyncSessionLocal
                from app.models import User as UserModel, OfferNotification
                from sqlalchemy import select as async_select
                from app.notifications import NotificationService
                from datetime import datetime as dt
                import re
                
                # Helper function to validate email
                def is_valid_email(email: str) -> bool:
                    """Check if email is valid"""
                    if not email or not isinstance(email, str):
                        return False
                    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                    return bool(re.match(pattern, email.strip()))
                
                async def send_notifications_async():
                    """Send notifications asynchronously"""
                    # Query users in background thread
                    sync_session = SyncSessionLocal()
                    try:
                        if stored_selected_user_ids:
                            # Send to selected users only
                            users = sync_session.query(UserModel).filter(
                                UserModel.id.in_(stored_selected_user_ids),
                                UserModel.role == 'customer',
                                UserModel.mobile.isnot(None),
                                UserModel.mobile != ''
                            ).all()
                        else:
                            # Send to all users with mobile numbers
                            users = sync_session.query(UserModel).filter(
                                UserModel.role == 'customer',
                                UserModel.mobile.isnot(None),
                                UserModel.mobile != ''
                            ).all()
                        
                        if not users:
                            print(f"[NOTIFY OFFER] No users found")
                            return
                        
                        # Prepare users data
                        users_data = []
                        for user in users:
                            # Try to get email from username (username is typically email in this system)
                            email = None
                            if user.username:
                                # Check if username is a valid email
                                if is_valid_email(user.username):
                                    email = user.username
                                # Also check if there's an email attribute (in case it exists in some users)
                                elif hasattr(user, 'email') and user.email and is_valid_email(user.email):
                                    email = user.email
                            
                            users_data.append({
                                'id': user.id,
                                'mobile': user.mobile,
                                'email': email,  # Will be None if no valid email found
                                'first_name': user.first_name or '',
                                'last_name': user.last_name or '',
                                'username': user.username or 'Customer'
                            })
                    finally:
                        sync_session.close()
                    
                    whatsapp_sent = 0
                    sms_sent = 0
                    email_sent = 0
                    failed_count = 0
                    
                    # Process notifications in parallel batches to avoid rate limiting
                    # WhatsApp has rate limits, so we send in batches of 5 with delays between batches
                    BATCH_SIZE = 5  # Send 5 messages in parallel
                    BATCH_DELAY = 1.0  # 1 second delay between batches
                    
                    async def send_to_user(user_data):
                        """Send notifications to a single user"""
                        nonlocal whatsapp_sent, sms_sent, email_sent, failed_count
                        try:
                            customer_name = f"{user_data['first_name']} {user_data['last_name']}".strip() or user_data['username'] or "Customer"
                            mobile = user_data['mobile']
                            email = user_data['email']
                            
                            # Send WhatsApp, SMS, and Email in parallel for this user
                            tasks = []
                            
                            # Send WhatsApp
                            whatsapp_success = False
                            if stored_use_whatsapp and mobile:
                                tasks.append(('whatsapp', NotificationService.send_festival_offer_whatsapp(
                                    mobile=mobile,
                                    customer_name=customer_name,
                                    festival_name=stored_festival_name,
                                    offer_details=stored_offer_details,
                                    discount_percentage=stored_discount_percentage,
                                    valid_until_date=stored_valid_until_date,
                                    website_link=stored_website_link,
                                    contact_number=stored_contact_number
                                )))
                            
                            # Send SMS
                            sms_success = False
                            if stored_use_sms and mobile:
                                tasks.append(('sms', NotificationService.send_festival_offer_sms(
                                    mobile=mobile,
                                    customer_name=customer_name,
                                    festival_name=stored_festival_name,
                                    offer_details=stored_offer_details,
                                    discount_percentage=stored_discount_percentage,
                                    valid_until_date=stored_valid_until_date,
                                    website_link=stored_website_link,
                                    contact_number=stored_contact_number
                                )))
                            
                            # Send Email (only if valid email address)
                            email_success = False
                            if stored_use_email and email and is_valid_email(email):
                                tasks.append(('email', NotificationService.send_festival_offer_email(
                                    email=email,
                                    customer_name=customer_name,
                                    festival_name=stored_festival_name,
                                    offer_details=stored_offer_details,
                                    discount_percentage=stored_discount_percentage,
                                    valid_until_date=stored_valid_until_date,
                                    website_link=stored_website_link,
                                    contact_number=stored_contact_number
                                )))
                            elif stored_use_email and email and not is_valid_email(email):
                                # Skip invalid emails - log for debugging
                                print(f"[NOTIFY OFFER] Skipping invalid email for user {user_data['id']}: {email}")
                            elif stored_use_email and not email:
                                # No email available for this user
                                print(f"[NOTIFY OFFER] No email available for user {user_data['id']} (username: {user_data.get('username', 'N/A')})")
                            
                            # Execute all tasks for this user in parallel
                            if tasks:
                                results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
                                
                                for idx, (channel, _) in enumerate(tasks):
                                    if not isinstance(results[idx], Exception):
                                        if channel == 'whatsapp':
                                            whatsapp_success = True
                                            whatsapp_sent += 1
                                        elif channel == 'sms':
                                            sms_success = True
                                            sms_sent += 1
                                        elif channel == 'email':
                                            email_success = True
                                            email_sent += 1
                                    else:
                                        print(f"[NOTIFY OFFER] {channel.upper()} failed for user {user_data['id']}: {results[idx]}")
                                        failed_count += 1
                            
                            # Record notification in database if at least one channel succeeded
                            if whatsapp_success or sms_success or email_success:
                                try:
                                    sync_notify_session = SyncSessionLocal()
                                    try:
                                        # Check if notification record already exists
                                        existing = sync_notify_session.query(OfferNotification).filter(
                                            OfferNotification.offer_id == stored_offer_id,
                                            OfferNotification.user_id == user_data['id']
                                        ).first()
                                        
                                        if existing:
                                            # Update existing record
                                            existing.whatsapp_sent = existing.whatsapp_sent or whatsapp_success
                                            existing.sms_sent = existing.sms_sent or sms_success
                                            existing.email_sent = existing.email_sent or email_success
                                            existing.notified_at = datetime.utcnow()
                                        else:
                                            # Create new record
                                            notification = OfferNotification(
                                                offer_id=stored_offer_id,
                                                user_id=user_data['id'],
                                                whatsapp_sent=whatsapp_success,
                                                sms_sent=sms_success,
                                                email_sent=email_success,
                                                notified_by_user_id=stored_admin_id
                                            )
                                            sync_notify_session.add(notification)
                                        
                                        sync_notify_session.commit()
                                    except Exception as e:
                                        sync_notify_session.rollback()
                                        print(f"[NOTIFY OFFER] Failed to record notification for user {user_data['id']}: {e}")
                                    finally:
                                        sync_notify_session.close()
                                except Exception as e:
                                    print(f"[NOTIFY OFFER] Failed to record notification for user {user_data['id']}: {e}")
                            
                            return True
                        except Exception as e:
                            print(f"[NOTIFY OFFER] Failed to send to user {user_data.get('id', 'unknown')}: {e}")
                            failed_count += 1
                            return False
                    
                    # Process users in batches
                    for i in range(0, len(users_data), BATCH_SIZE):
                        batch = users_data[i:i + BATCH_SIZE]
                        print(f"[NOTIFY OFFER] Processing batch {i // BATCH_SIZE + 1} ({len(batch)} users)")
                        
                        # Send batch in parallel
                        await asyncio.gather(*[send_to_user(user_data) for user_data in batch], return_exceptions=True)
                        
                        # Delay between batches to avoid rate limiting (except for last batch)
                        if i + BATCH_SIZE < len(users_data):
                            await asyncio.sleep(BATCH_DELAY)
                    
                    total_sent = whatsapp_sent + sms_sent + email_sent
                    print(f"[NOTIFY OFFER] Background task completed: Total users: {len(users_data)}, WhatsApp: {whatsapp_sent}, SMS: {sms_sent}, Email: {email_sent}, Failed: {failed_count}")
                
                # CRITICAL FIX: Use safe async runner instead of creating new event loop
                from app.utils.async_thread_helper import run_async_in_thread
                run_async_in_thread(send_notifications_async)
            except Exception as e:
                print(f"[NOTIFY OFFER] Thread error: {e}")
                import traceback
                traceback.print_exc()
        
        # Start thread as daemon - won't block server shutdown
        thread = threading.Thread(target=send_notifications_in_thread, daemon=True)
        thread.start()
        
        # Return immediately - thread runs independently
        return {
            'success': True,
            'message': f'Notification process started for {estimated_user_count}. Notifications are being sent in the background.',
            'status': 'processing',
            'note': 'Notifications are being sent asynchronously. Check server logs for detailed progress.'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[NOTIFY OFFER] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send notifications: {str(e)}")