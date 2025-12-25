"""
Invoice Helper Module
Provides functions to generate invoice data and PDFs for bookings
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text


async def get_invoice_data(
    session: AsyncSession,
    booking_id: int,
    custom_data: Optional[Dict[str, Any]] = None,
    use_saved_edit: bool = True
) -> Dict[str, Any]:
    """
    Get invoice data for a booking, with optional custom overrides.
    
    Args:
        session: Database session
        booking_id: Booking ID
        custom_data: Optional custom data to override defaults (takes precedence over saved edits)
            - items: List of custom items
            - customer_name: Custom customer name
            - invoice_number: Custom invoice number
            - invoice_date: Custom invoice date
            - gst_rate: Custom GST rate
            - brokerage_amount: Custom brokerage amount
            - notes: Custom notes
        use_saved_edit: If True, check for saved invoice edits first (default: True)
    
    Returns:
        Dictionary containing all invoice data
    """
    from app.models import Booking, User, Space, Venue, Payment, InvoiceEdit
    
    # Check for saved invoice edit first (unless custom_data is provided or use_saved_edit is False)
    saved_edit_data = None
    if use_saved_edit and custom_data is None:
        stmt_edit = select(InvoiceEdit).where(InvoiceEdit.booking_id == booking_id)
        rs_edit = await session.execute(stmt_edit)
        invoice_edit = rs_edit.scalars().first()
        if invoice_edit:
            saved_edit_data = {
                'items': invoice_edit.items if invoice_edit.items else None,
                'customer_name': invoice_edit.customer_name,
                'invoice_number': invoice_edit.invoice_number,
                'invoice_date': invoice_edit.invoice_date,
                'gst_rate': invoice_edit.gst_rate,
                'brokerage_amount': invoice_edit.brokerage_amount,
                'notes': invoice_edit.notes,
            }
            # Remove None values
            saved_edit_data = {k: v for k, v in saved_edit_data.items() if v is not None}
    
    # Use custom_data if provided, otherwise use saved_edit_data
    effective_custom_data = custom_data if custom_data else saved_edit_data
    
    # Get booking with joins
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
        raise ValueError(f'Booking {booking_id} not found')
    
    booking, user, space, venue = row
    
    # Get booking items
    sql_query = text("""
        SELECT 
            bi.id,
            bi.item_id,
            bi.quantity,
            bi.unit_price,
            bi.total_price,
            i.name as item_name
        FROM booking_items bi
        INNER JOIN items i ON bi.item_id = i.id
        WHERE bi.booking_id = :booking_id
    """)
    rs_items = await session.execute(sql_query, {"booking_id": booking_id})
    booking_items_rows = rs_items.all()
    
    # Use custom items if provided, otherwise use saved edit items, otherwise use database items
    if effective_custom_data and 'items' in effective_custom_data:
        items = effective_custom_data['items']
    else:
        items = []
        
        # Calculate hall rental amount (space rental)
        # This is the base amount for the space booking (duration * price_per_hour)
        # We need to calculate it from booking duration and space price
        hall_rental_amount = 0.0
        duration_hours = 0.0
        
        if booking.start_datetime and booking.end_datetime:
            # Handle timezone-aware datetimes
            if booking.start_datetime.tzinfo is not None:
                from datetime import timezone as tz
                start_utc = booking.start_datetime.astimezone(tz.utc).replace(tzinfo=None)
                end_utc = booking.end_datetime.astimezone(tz.utc).replace(tzinfo=None)
                duration_hours = (end_utc - start_utc).total_seconds() / 3600.0
            else:
                duration_hours = (booking.end_datetime - booking.start_datetime).total_seconds() / 3600.0
            
            # Calculate hall rental: duration * price_per_hour
            price_per_hour = float(space.price_per_hour or 0.0)
            hall_rental_amount = float(duration_hours * price_per_hour)
        
        # Check if hall rental is already in items (shouldn't be, but check to avoid duplicates)
        hall_rental_exists = False
        for row in booking_items_rows:
            item_name_lower = (row.item_name or '').lower()
            if 'hall rental' in item_name_lower or 'space rental' in item_name_lower or 'venue rental' in item_name_lower or 'rental' in item_name_lower:
                hall_rental_exists = True
                break
        
        # Add hall rental as the first item if amount > 0 and not already in items
        # Only skip for program bookings (yoga, zumba) where rental is free
        event_type_lower = (booking.event_type or '').lower()
        is_program = event_type_lower in ['yoga', 'zumba']
        
        if hall_rental_amount > 0 and not hall_rental_exists and not is_program:
            # Add hall rental as first item
            items.append({
                'id': None,
                'item_id': None,
                'name': f'{space.name} Rental ({duration_hours:.1f} hours @ ₹{space.price_per_hour:.2f}/hour)',
                'quantity': 1,
                'unit_price': round(hall_rental_amount, 2),
                'total_price': round(hall_rental_amount, 2),
            })
        
        # Add booking items from database
        for row in booking_items_rows:
            items.append({
                'id': row.id if hasattr(row, 'id') else None,
                'item_id': row.item_id,
                'name': row.item_name or 'Unknown Item',
                'quantity': int(row.quantity),
                'unit_price': float(row.unit_price),
                'total_price': float(row.total_price),
            })
    
    # Calculate paid amount
    stmt_payments = select(func.sum(Payment.amount)).where(
        Payment.booking_id == booking_id,
        Payment.status == 'success'
    )
    rs_payments = await session.execute(stmt_payments)
    paid_amount = float(rs_payments.scalar() or 0.0)
    
    # Determine invoice type based on event completion (same logic as booking invoice)
    status_lower = (booking.status or '').lower()
    is_event_completed = False
    
    if booking.start_datetime:
        now = datetime.utcnow()
        booking_date = booking.start_datetime
        
        # Handle timezone-aware and naive datetimes
        if booking_date.tzinfo is not None:
            from datetime import timezone as tz
            booking_date_utc = booking_date.astimezone(tz.utc).replace(tzinfo=None)
        else:
            # Naive datetime - assume UTC
            booking_date_utc = booking_date
        
        # Event is completed if the start date has passed
        is_event_completed = booking_date_utc < now
    
    # Invoice type logic:
    # - Tax Invoice: Event date has passed AND status is approved/confirmed/paid
    # - Proforma Invoice: Event date hasn't passed OR status is pending
    is_tax_invoice = is_event_completed and status_lower in ['approved', 'confirmed', 'confirm', 'paid']
    is_proforma_invoice = not is_tax_invoice and status_lower in ['pending', 'approved', 'confirmed', 'confirm', 'paid']
    
    # Customer info
    if effective_custom_data and 'customer_name' in effective_custom_data:
        customer_name = effective_custom_data['customer_name']
    else:
        customer_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    
    # Invoice number
    if effective_custom_data and 'invoice_number' in effective_custom_data:
        invoice_number = effective_custom_data['invoice_number']
    else:
        invoice_number = f"BK-{booking.booking_reference}"
    
    # Invoice date
    if effective_custom_data and 'invoice_date' in effective_custom_data:
        invoice_date = effective_custom_data['invoice_date']
    else:
        invoice_date = datetime.utcnow().strftime('%B %d, %Y')
    
    # Brokerage
    if effective_custom_data and 'brokerage_amount' in effective_custom_data:
        brokerage_amount = float(effective_custom_data['brokerage_amount'] or 0)
    else:
        brokerage_amount = float(getattr(booking, 'brokerage_amount', 0.0) or 0.0)
    
    # GST rate (only for tax invoices, not proforma)
    if effective_custom_data and 'gst_rate' in effective_custom_data:
        gst_rate = float(effective_custom_data['gst_rate'] or 0)
    else:
        gst_rate = 18.0 if is_tax_invoice else 0.0
    
    # Calculate totals
    subtotal = sum(item.get('total_price', item.get('unit_price', 0) * item.get('quantity', 0)) for item in items)
    
    if brokerage_amount > 0:
        subtotal += brokerage_amount
    
    # Calculate GST
    if is_tax_invoice and gst_rate > 0:
        gst_amount = subtotal * (gst_rate / 100)
        total_amount = subtotal + gst_amount
    else:
        gst_amount = 0.0
        total_amount = subtotal
    
    # Build invoice data structure
    invoice_data = {
        'booking_id': booking_id,
        'booking_reference': booking.booking_reference,
        'invoice_number': invoice_number,
        'invoice_date': invoice_date,
        'booking_date': booking.start_datetime.strftime('%B %d, %Y') if booking.start_datetime else '',
        'is_tax_invoice': is_tax_invoice,
        'is_proforma_invoice': is_proforma_invoice,
        'invoice_title': 'TAX INVOICE' if is_tax_invoice else ('PROFORMA INVOICE' if is_proforma_invoice else 'INVOICE'),
        
        # Customer details
        'customer': {
            'name': customer_name,
            'email': user.username,
            'phone': user.mobile or 'N/A',
        },
        
        # Booking details
        'booking': {
            'venue': venue.name,
            'space': space.name,
            'event_type': booking.event_type or 'N/A',
            'status': booking.status.upper(),
            'start_datetime': booking.start_datetime.isoformat() if booking.start_datetime else None,
            'end_datetime': booking.end_datetime.isoformat() if booking.end_datetime else None,
        },
        
        # Items
        'items': items,
        
        # Financials
        'subtotal': round(subtotal, 2),
        'brokerage_amount': round(brokerage_amount, 2),
        'gst_rate': gst_rate,
        'gst_amount': round(gst_amount, 2),
        'total_amount': round(total_amount, 2),
        'paid_amount': round(paid_amount, 2),
        'balance_due': round(max(0, total_amount - paid_amount), 2),
        
        # Notes
        'notes': effective_custom_data.get('notes', '') if effective_custom_data else '',
    }
    
    return invoice_data

