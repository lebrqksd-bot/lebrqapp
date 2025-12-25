from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Form, Response, Body
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_session
from app.auth import get_current_user
from app.models import BookingItem, VendorProfile, User, Item, Booking, Venue, BookingItemRejection
from pydantic import BaseModel

router = APIRouter()


def vendor_required(user: User = Depends(get_current_user)):
    if user.role != 'vendor':
        raise HTTPException(status_code=403, detail='Vendor only')
    return user


@router.get('/vendor/profile')
async def vendor_profile(session: AsyncSession = Depends(get_session), user: User = Depends(vendor_required)):
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    # counts
    items_count = (await session.execute(select(func.count()).select_from(Item).where(Item.vendor_id == vp.id))).scalar_one()
    orders_count = (await session.execute(select(func.count()).select_from(BookingItem).where(BookingItem.vendor_id == vp.id))).scalar_one()
    supplied_count = (await session.execute(select(func.count()).select_from(BookingItem).where(BookingItem.vendor_id == vp.id, BookingItem.is_supplied == True))).scalar_one()  # noqa: E712

    # Today's report (UTC)
    today = datetime.utcnow().date()
    new_today = (await session.execute(
        select(func.count()).select_from(BookingItem).where(
            BookingItem.vendor_id == vp.id,
            func.date(BookingItem.created_at) == today,
        )
    )).scalar_one()
    pending_count = (await session.execute(
        select(func.count()).select_from(BookingItem).where(
            BookingItem.vendor_id == vp.id,
            BookingItem.booking_status == 'pending',
        )
    )).scalar_one()
    cancelled_count = (await session.execute(
        select(func.count()).select_from(BookingItem).where(
            BookingItem.vendor_id == vp.id,
            BookingItem.booking_status == 'cancelled',
        )
    )).scalar_one()
    return {
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'mobile': user.mobile,
        'email': getattr(user, 'email', None),
        'profile_image': getattr(user, 'profile_image', None),
        'vendor_profile': {
            'id': vp.id,
            'user_id': vp.user_id,
            'company_name': vp.company_name,
            'description': vp.description,
            'contact_email': vp.contact_email,
            'contact_phone': vp.contact_phone,
            'address': getattr(vp, 'address', None),
        },
        'stats': {
            'items': int(items_count or 0),
            'orders': int(orders_count or 0),
            'supplied_orders': int(supplied_count or 0),
        },
        'report': {
            'new_today': int(new_today or 0),
            'pending': int(pending_count or 0),
            'confirmed': int(supplied_count or 0),
            'cancelled': int(cancelled_count or 0),
        }
    }


@router.get('/vendor/orders')
async def vendor_orders(session: AsyncSession = Depends(get_session), user: User = Depends(vendor_required)):
    try:
        # find vendor profile
        rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
        vp = rs.scalars().first()
        if not vp:
            raise HTTPException(status_code=404, detail='Vendor profile not found')
        stmt = (
            select(
                BookingItem,
                Booking.booking_reference,
                Booking.status.label('booking_overall_status'),
                Booking.event_type,
                Booking.start_datetime,
                Booking.end_datetime,
                User.first_name,
                User.last_name,
                User.username,
                Venue.address,
                Venue.city,
                Venue.name,
                Item.name,
                Item.image_url,
                Item.category,
            )
            .join(Booking, Booking.id == BookingItem.booking_id)
            .join(Item, Item.id == BookingItem.item_id)
            .join(User, User.id == Booking.user_id)
            .join(Venue, Venue.id == Booking.venue_id)
            .where(
                # Show items assigned to this vendor, including cancelled ones
                BookingItem.vendor_id == vp.id
            )
            .order_by(BookingItem.created_at.desc())
        )
        rs = await session.execute(stmt)
        rows = []
        for (
            bi, booking_reference, booking_overall_status, event_type, start_datetime, end_datetime,
            first_name, last_name, username, address, city, venue_name, item_name, item_image, item_category
        ) in rs.all():
            name = (f"{first_name} {last_name}".strip() if (first_name or last_name) else None) or username
            
            # Safely get accepted_at and supply_reminder_sent_at (may not exist in DB yet)
            accepted_at = None
            supply_reminder_sent_at = None
            try:
                if hasattr(bi, 'accepted_at') and bi.accepted_at:
                    accepted_at = bi.accepted_at.isoformat()
            except (AttributeError, KeyError):
                pass
            try:
                if hasattr(bi, 'supply_reminder_sent_at') and bi.supply_reminder_sent_at:
                    supply_reminder_sent_at = bi.supply_reminder_sent_at.isoformat()
            except (AttributeError, KeyError):
                pass
            
            rows.append({
                'id': bi.id,
                'booking_id': bi.booking_id,
                'ref': booking_reference or f"#{bi.booking_id}",
                'quantity': bi.quantity,
                'unit_price': float(bi.unit_price),
                'total_price': float(bi.total_price),
                'event_date': bi.event_date.isoformat() if bi.event_date else None,
                'start_datetime': start_datetime.isoformat() if start_datetime else None,
                'end_datetime': end_datetime.isoformat() if end_datetime else None,
                'status': bi.booking_status or booking_overall_status or 'pending',
                'is_supplied': bool(bi.is_supplied),
                'supplied_at': bi.supplied_at.isoformat() if bi.supplied_at else None,
                'supply_verified': bool(bi.supply_verified),
                'verified_at': bi.verified_at.isoformat() if bi.verified_at else None,
                'rejection_status': bool(bi.rejection_status),
                'rejection_note': bi.rejection_note,
                'rejected_at': bi.rejected_at.isoformat() if bi.rejected_at else None,
                'accepted_at': accepted_at,
                'supply_reminder_sent_at': supply_reminder_sent_at,
                'customer_name': name,
                'address': ", ".join([p for p in [address, city] if p]) if (address or city) else None,
                'venue_name': venue_name,
                'event_type': event_type,
                'item_name': item_name,
                'item_image': item_image,
                'item_category': item_category,
            })
        return rows
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[VENDOR ORDERS] Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=f'Database operation failed: {str(e)}')


class OrdersPDFRequest(BaseModel):
    orders: List[Dict[str, Any]]


@router.post('/vendor/orders/pdf')
async def generate_orders_pdf(
    request: OrdersPDFRequest = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    """Generate PDF for vendor orders"""
    try:
        # Check if reportlab is available
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
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        from io import BytesIO
        
        buffer = BytesIO()
        orders = request.orders
        
        if not orders:
            raise HTTPException(status_code=400, detail='No orders provided')
        
        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.75*inch,
            bottomMargin=0.5*inch
        )
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#111827'),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        )
        story.append(Paragraph("Vendor Orders Report", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Summary info
        summary_style = ParagraphStyle(
            'Summary',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#6B7280'),
            spaceAfter=8,
        )
        story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y at %I:%M %p')}", summary_style))
        story.append(Paragraph(f"Total Orders: {len(orders)}", summary_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Group orders by booking_id
        grouped_orders: Dict[int, List[Dict]] = {}
        for order in orders:
            booking_id = order.get('booking_id', order.get('id'))
            if booking_id not in grouped_orders:
                grouped_orders[booking_id] = []
            grouped_orders[booking_id].append(order)
        
        # Create table for each booking group
        for booking_id, booking_orders in grouped_orders.items():
            main_order = booking_orders[0]
            
            # Booking header
            header_style = ParagraphStyle(
                'BookingHeader',
                parent=styles['Heading2'],
                fontSize=14,
                textColor=colors.HexColor('#111827'),
                spaceAfter=8,
                fontName='Helvetica-Bold',
            )
            ref = main_order.get('ref', f"#{booking_id}")
            story.append(Paragraph(f"Order: {ref}", header_style))
            
            # Booking details
            details_data = [
                ['Event Date:', main_order.get('event_date', '—') or '—'],
                ['Event Type:', main_order.get('event_type', '—') or '—'],
                ['Venue:', main_order.get('venue_name', '—') or '—'],
                ['Address:', main_order.get('address', '—') or '—'],
                ['Customer:', main_order.get('customer_name', '—') or '—'],
                ['Status:', main_order.get('status', '—') or '—'],
            ]
            
            details_table = Table(details_data, colWidths=[2*inch, 4*inch])
            details_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#111827')),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(details_table)
            story.append(Spacer(1, 0.15*inch))
            
            # Items table
            items_data = [['Item', 'Quantity', 'Unit Price', 'Total Price']]
            booking_total = 0.0
            for order in booking_orders:
                item_name = order.get('item_name', 'Item')
                quantity = order.get('quantity', 0)
                unit_price = float(order.get('unit_price', 0) or 0)
                total_price = float(order.get('total_price', 0) or 0)
                booking_total += total_price
                
                items_data.append([
                    item_name,
                    str(quantity),
                    f"{unit_price:.2f}",
                    f"{total_price:.2f}",
                ])
            
            # Add total row
            items_data.append([
                'TOTAL',
                '',
                '',
                f"{booking_total:.2f}",
            ])
            
            items_table = Table(items_data, colWidths=[3*inch, 1*inch, 1.2*inch, 1.2*inch])
            items_table.setStyle(TableStyle([
                # Header row
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1f3a')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                # Data rows
                ('BACKGROUND', (0, 1), (-1, -2), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -2), colors.HexColor('#111827')),
                ('ALIGN', (0, 1), (0, -2), 'LEFT'),
                ('ALIGN', (1, 1), (-1, -2), 'RIGHT'),
                ('FONTSIZE', (0, 1), (-1, -2), 9),
                ('FONTNAME', (0, 1), (0, -2), 'Helvetica'),
                ('FONTNAME', (1, 1), (-1, -2), 'Helvetica'),
                # Total row
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F0FDF4')),
                ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#111827')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, -1), (-1, -1), 10),
                ('ALIGN', (0, -1), (0, -1), 'LEFT'),
                ('ALIGN', (-1, -1), (-1, -1), 'RIGHT'),
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
            ]))
            story.append(items_table)
            story.append(Spacer(1, 0.3*inch))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        filename = f"orders_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        return Response(
            content=buffer.read(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[VENDOR ORDERS PDF] Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to generate PDF: {str(e)}')


@router.get('/vendor/items')
async def vendor_items(session: AsyncSession = Depends(get_session), user: User = Depends(vendor_required)):
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    stmt = select(Item).where(Item.vendor_id == vp.id).order_by(
        Item.space_id.is_(None), Item.space_id.asc(),
        Item.subcategory.is_(None), Item.subcategory.asc(),
        Item.name.asc()
    )
    rs = await session.execute(stmt)
    items = rs.scalars().all()
    return {
        'items': [
            {
                'id': it.id,
                'name': it.name,
                'description': it.description,
                'price': it.price,
                'category': it.category,
                'subcategory': it.subcategory,
                'type': it.type,
                'image_url': it.image_url,
                'video_url': it.video_url,
                'profile_image_url': it.profile_image_url,
                'profile_info': it.profile_info,
                'performance_team_profile': it.performance_team_profile,
                'space_id': it.space_id,
                'available': it.available,
                'item_status': it.item_status,
                'preparation_time_minutes': it.preparation_time_minutes,
            } for it in items
        ],
        'count': len(items)
    }


@router.post('/vendor/items')
async def vendor_create_item(
    name: str = Form(...),
    price: float = Form(...),
    category: Optional[str] = Form(default=None),
    subcategory: Optional[str] = Form(default=None),
    item_type: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    image_url: Optional[str] = Form(default=None),
    performance_team_profile: Optional[str] = Form(default=None, description="JSON string of performance team profile"),
    space_id: Optional[int] = Form(default=None),
    available: bool = Form(default=True),
    item_status: str = Form(default="available"),
    preparation_time_minutes: int = Form(default=0),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    # find vendor profile
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    # basic validation
    if not name or not str(name).strip():
        raise HTTPException(status_code=422, detail=[{"loc": ["form", "name"], "msg": "Name is required", "type": "value_error.missing"}])
    try:
        p = float(price)
        if p <= 0:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=422, detail=[{"loc": ["form", "price"], "msg": "Price must be greater than 0", "type": "value_error"}])

    # Parse performance_team_profile JSON if provided
    import json
    profile_json = None
    if performance_team_profile:
        try:
            profile_json = json.loads(performance_team_profile) if isinstance(performance_team_profile, str) else performance_team_profile
        except (json.JSONDecodeError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid performance_team_profile JSON: {str(e)}")
    
    it = Item(
        name=name,
        price=price,
        category=category,
        subcategory=subcategory,
        type=item_type,
        description=description,
        image_url=image_url,
        performance_team_profile=profile_json,
        vendor_id=vp.id,
        space_id=space_id,
        available=available,
        item_status=item_status,
        preparation_time_minutes=preparation_time_minutes,
    )
    session.add(it)
    await session.commit()
    await session.refresh(it)
    return {'ok': True, 'id': it.id}


@router.put('/vendor/items/{item_id}')
async def vendor_update_item(
    item_id: int,
    name: Optional[str] = Form(default=None),
    price: Optional[float] = Form(default=None),
    category: Optional[str] = Form(default=None),
    subcategory: Optional[str] = Form(default=None),
    item_type: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    image_url: Optional[str] = Form(default=None),
    performance_team_profile: Optional[str] = Form(default=None, description="JSON string of performance team profile"),
    space_id: Optional[int] = Form(default=None),
    available: Optional[bool] = Form(default=None),
    item_status: Optional[str] = Form(default=None),
    preparation_time_minutes: Optional[int] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    # find vendor profile
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    rs = await session.execute(select(Item).where(Item.id == item_id, Item.vendor_id == vp.id))
    it = rs.scalars().first()
    if not it:
        raise HTTPException(status_code=404, detail='Item not found')
    if name is not None and not str(name).strip():
        raise HTTPException(status_code=422, detail=[{"loc": ["form", "name"], "msg": "Name cannot be empty", "type": "value_error"}])
    if price is not None:
        try:
            p = float(price)
            if p <= 0:
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=422, detail=[{"loc": ["form", "price"], "msg": "Price must be greater than 0", "type": "value_error"}])
    # Track item_status change for history
    old_item_status = it.item_status if hasattr(it, 'item_status') else None
    
    # Parse performance_team_profile JSON if provided
    if performance_team_profile is not None:
        import json
        try:
            profile_json = json.loads(performance_team_profile) if isinstance(performance_team_profile, str) else performance_team_profile
            it.performance_team_profile = profile_json
        except (json.JSONDecodeError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid performance_team_profile JSON: {str(e)}")
    
    if name is not None: it.name = name
    if price is not None: it.price = price
    if category is not None: it.category = category
    if subcategory is not None: it.subcategory = subcategory
    if item_type is not None: it.type = item_type
    if description is not None: it.description = description
    if image_url is not None: it.image_url = image_url
    if space_id is not None: it.space_id = space_id
    if available is not None: it.available = available
    if item_status is not None: it.item_status = item_status
    if preparation_time_minutes is not None: it.preparation_time_minutes = preparation_time_minutes
    await session.commit()
    
    # Log item status change to history if status changed
    if item_status is not None and old_item_status != item_status:
        try:
            from ..models_vendor_enhanced import BookingItemStatusHistory
            # Note: Using booking_item_status_history for item status tracking
            # booking_item_id will be NULL for catalog item status changes
            # We'll use notes to indicate this is a catalog item change
            history = BookingItemStatusHistory(
                booking_item_id=None,  # Not applicable for catalog items
                old_status=old_item_status,
                new_status=item_status,
                changed_by_user_id=user.id,
                changed_by_role='vendor',
                reason=f'Catalog item status changed',
                notes=f'Item ID: {item_id}, Item Name: {it.name}',
            )
            session.add(history)
            await session.commit()
            print(f"[VENDOR] Successfully logged item status history: Item {item_id}, {old_item_status} -> {item_status}")
        except Exception as e:
            import traceback
            print(f"[VENDOR] Failed to log item status history: {e}")
            print(f"[VENDOR] Traceback: {traceback.format_exc()}")
            # Don't fail the request if history logging fails
    
    return {'ok': True}


@router.delete('/vendor/items/{item_id}')
async def vendor_delete_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    rs = await session.execute(select(Item).where(Item.id == item_id, Item.vendor_id == vp.id))
    it = rs.scalars().first()
    if not it:
        raise HTTPException(status_code=404, detail='Item not found')
    await session.delete(it)
    await session.commit()
    return {'ok': True}


@router.post('/vendor/orders/{booking_item_id}/supplied')
async def vendor_mark_supplied(
    booking_item_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id, BookingItem.vendor_id == vp.id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Order item not found')
    bi.is_supplied = True
    bi.supplied_at = datetime.utcnow()
    await session.commit()
    
    # Notify admin
    try:
        from ..services.vendor_notification_service import VendorNotificationService
        admin_stmt = select(User).where(User.role == 'admin')
        admin_result = await session.execute(admin_stmt)
        admin_users = admin_result.scalars().all()
        admin_ids = [admin.id for admin in admin_users]
        
        if admin_ids:
            await VendorNotificationService.notify_admin_vendor_action(
                session=session,
                admin_user_ids=admin_ids,
                vendor=user,
                action='supplied',
                booking_item=bi,
                details=f"Order item marked as supplied. Pending verification."
            )
    except Exception as e:
        print(f"[VENDOR] Failed to notify admin: {e}")
    
    return {'ok': True, 'is_supplied': True, 'supplied_at': bi.supplied_at.isoformat() if bi.supplied_at else None}


@router.post('/vendor/orders/{booking_item_id}/accept')
async def vendor_accept_order(
    booking_item_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    """Vendor accepts an order item with enhanced notifications"""
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id, BookingItem.vendor_id == vp.id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Order item not found')
    
    old_status = bi.booking_status
    bi.booking_status = 'confirmed'
    bi.accepted_at = datetime.utcnow()
    await session.commit()
    
    # Log status change history
    try:
        from ..models_vendor_enhanced import BookingItemStatusHistory
        history = BookingItemStatusHistory(
            booking_item_id=bi.id,
            old_status=old_status,
            new_status='confirmed',
            changed_by_user_id=user.id,
            changed_by_role='vendor',
            reason='Vendor accepted order',
            notes=None,
        )
        session.add(history)
        await session.commit()
    except Exception as e:
        print(f"[VENDOR] Failed to log status history: {e}")
    
    # Notify admin
    try:
        from ..services.vendor_notification_service import VendorNotificationService
        # Get all admin users
        admin_stmt = select(User).where(User.role == 'admin')
        admin_result = await session.execute(admin_stmt)
        admin_users = admin_result.scalars().all()
        admin_ids = [admin.id for admin in admin_users]
        
        if admin_ids:
            await VendorNotificationService.notify_admin_vendor_action(
                session=session,
                admin_user_ids=admin_ids,
                vendor=user,
                action='accepted',
                booking_item=bi,
                details=f"Order item confirmed for booking #{bi.booking_id}"
            )
    except Exception as e:
        print(f"[VENDOR] Failed to notify admin: {e}")
    
    # Log activity
    try:
        from ..services.vendor_notification_service import VendorNotificationService
        await VendorNotificationService.log_vendor_activity(
            session=session,
            vendor_user_id=user.id,
            action='accept_order',
            entity_type='booking_item',
            entity_id=bi.id,
            details=f"Accepted order item #{booking_item_id}"
        )
    except Exception as e:
        print(f"[VENDOR] Failed to log activity: {e}")
    
    return {'ok': True, 'status': 'confirmed', 'booking_item_id': bi.id}


@router.post('/vendor/orders/{booking_item_id}/reject')
async def vendor_reject_order(
    booking_item_id: int,
    reason: Optional[str] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(vendor_required),
):
    """Vendor rejects an order item with enhanced notifications"""
    rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    vp = rs.scalars().first()
    if not vp:
        raise HTTPException(status_code=404, detail='Vendor profile not found')
    
    rs = await session.execute(select(BookingItem).where(BookingItem.id == booking_item_id, BookingItem.vendor_id == vp.id))
    bi = rs.scalars().first()
    if not bi:
        raise HTTPException(status_code=404, detail='Order item not found')
    
    if not reason or not reason.strip():
        raise HTTPException(status_code=422, detail='Rejection reason is required')
    
    old_status = bi.booking_status
    bi.booking_status = 'rejected'
    bi.rejection_status = True
    bi.rejection_note = reason.strip()
    bi.rejected_at = datetime.utcnow()
    
    # Record rejection in history table to prevent re-assignment to same vendor
    try:
        from ..models import BookingItemRejection
        # Check if rejection already exists (shouldn't happen, but safety check)
        existing_rejection = await session.execute(
            select(BookingItemRejection).where(
                BookingItemRejection.booking_item_id == bi.id,
                BookingItemRejection.vendor_id == vp.id
            )
        )
        if not existing_rejection.scalars().first():
            rejection_history = BookingItemRejection(
                booking_item_id=bi.id,
                vendor_id=vp.id,
                rejection_note=reason.strip(),
                rejected_at=datetime.utcnow()
            )
            session.add(rejection_history)
    except Exception as e:
        print(f"[VENDOR] Failed to record rejection history: {e}")
    
    await session.commit()
    
    # Log status change history
    try:
        from ..models_vendor_enhanced import BookingItemStatusHistory
        history = BookingItemStatusHistory(
            booking_item_id=bi.id,
            old_status=old_status,
            new_status='rejected',
            changed_by_user_id=user.id,
            changed_by_role='vendor',
            reason=reason or 'Vendor rejected order',
            notes=reason,
        )
        session.add(history)
        await session.commit()
    except Exception as e:
        print(f"[VENDOR] Failed to log status history: {e}")
    
    # Send WhatsApp notification to customer about item not available
    try:
        from ..models import Booking, User, Item
        from ..notifications import NotificationService
        
        # Get booking and user details
        booking_stmt = select(Booking).where(Booking.id == bi.booking_id)
        booking_rs = await session.execute(booking_stmt)
        booking = booking_rs.scalars().first()
        
        if booking:
            user_stmt = select(User).where(User.id == booking.user_id)
            user_rs = await session.execute(user_stmt)
            customer_user = user_rs.scalars().first()
            
            if customer_user and customer_user.mobile:
                # Get item name
                item_stmt = select(Item).where(Item.id == bi.item_id)
                item_rs = await session.execute(item_stmt)
                item = item_rs.scalars().first()
                item_name = item.name if item else f"Item #{bi.item_id}"
                
                customer_name = f"{customer_user.first_name} {customer_user.last_name}".strip() or customer_user.username or "Customer"
                
                await NotificationService.send_item_not_available_whatsapp(
                    mobile=customer_user.mobile,
                    customer_name=customer_name,
                    item_name=item_name,
                    reason=reason.strip() if reason else "Item not available"
                )
    except Exception as whatsapp_error:
        print(f"[VENDOR] WhatsApp notification error (non-critical): {whatsapp_error}")
    
    # Notify admin
    try:
        from ..services.vendor_notification_service import VendorNotificationService
        # Get all admin users
        admin_stmt = select(User).where(User.role == 'admin')
        admin_result = await session.execute(admin_stmt)
        admin_users = admin_result.scalars().all()
        admin_ids = [admin.id for admin in admin_users]
        
        if admin_ids:
            await VendorNotificationService.notify_admin_vendor_action(
                session=session,
                admin_user_ids=admin_ids,
                vendor=user,
                action='rejected',
                booking_item=bi,
                details=f"Order item rejected. Reason: {reason or 'Not provided'}"
            )
    except Exception as e:
        print(f"[VENDOR] Failed to notify admin: {e}")
    
    # Log activity
    try:
        from ..services.vendor_notification_service import VendorNotificationService
        await VendorNotificationService.log_vendor_activity(
            session=session,
            vendor_user_id=user.id,
            action='reject_order',
            entity_type='booking_item',
            entity_id=bi.id,
            details=f"Rejected order item #{booking_item_id}. Reason: {reason or 'Not provided'}"
        )
    except Exception as e:
        print(f"[VENDOR] Failed to log activity: {e}")
    
    return {'ok': True, 'status': 'rejected', 'booking_item_id': bi.id, 'reason': reason}

