"""
Vendor Payment Summary and Invoice Generation API Router
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, Body
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy import select, and_, or_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..db import get_session
from ..auth import get_current_user, get_current_admin
from ..models import BookingItem, VendorProfile, User, Item, Booking, Payment

router = APIRouter(prefix="/vendor/payments", tags=["vendor-payments"])


def vendor_required(user: User = Depends(get_current_user)):
    if user.role != 'vendor':
        raise HTTPException(status_code=403, detail='Vendor only')
    return user


class PaymentSummaryItem(BaseModel):
    booking_item_id: int
    booking_id: int
    booking_reference: Optional[str]
    item_name: str
    quantity: int
    unit_price: float
    total_price: float
    supplied_at: Optional[str]
    verified_at: Optional[str]
    event_date: Optional[str]


class PaymentSummary(BaseModel):
    period: str  # weekly, monthly, yearly
    start_date: str
    end_date: str
    total_items: int
    total_amount: float
    items: List[PaymentSummaryItem]


@router.get("/summary")
async def get_payment_summary(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    vendor_id: Optional[int] = Query(None, description="Vendor ID (admin only)"),
    include_unverified: bool = Query(False, description="Include items that are supplied but not yet verified by admin"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get payment summary for a vendor. 
    By default, only includes supplied AND verified items.
    Set include_unverified=True to also include items marked as supplied but not yet verified.
    """
    # Admin can view any vendor, vendors can only view their own
    if user.role == 'admin' and vendor_id:
        target_vendor_id = vendor_id
    elif user.role == 'vendor':
        rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
        vp = rs.scalars().first()
        if not vp:
            raise HTTPException(status_code=404, detail='Vendor profile not found')
        target_vendor_id = vp.id
    else:
        raise HTTPException(status_code=403, detail='Access denied')
    
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
        BookingItem.vendor_id == target_vendor_id,
        BookingItem.is_supplied == True,  # Must be marked as supplied
    ]
    
    # For date filtering: include items that were either:
    # 1. Supplied within the period (supplied_at >= start_date), OR
    # 2. Settled within the period (payment_settled_at >= start_date) - for settled items
    # This ensures settled items show up based on when they were settled, not just when supplied
    date_condition = or_(
        (BookingItem.supplied_at.isnot(None)) & (BookingItem.supplied_at >= start_date),
        (BookingItem.payment_settled_at.isnot(None)) & (BookingItem.payment_settled_at >= start_date)
    )
    
    if include_unverified:
        # Include items that are supplied (verified or not)
        # Use the date condition above to include both supplied and settled items
        conditions.append(date_condition)
    else:
        # Only include verified items (unless they're settled, in which case include them)
        # For settled items, we include them regardless of verification status
        # For non-settled items, they must be verified
        conditions.append(
            or_(
                # Settled items (include regardless of verification)
                (BookingItem.payment_settled == True),
                # Non-settled items (must be verified)
                and_(
                    BookingItem.supply_verified == True,
                    BookingItem.verified_at.isnot(None)
                )
            )
        )
        conditions.append(date_condition)
    
    # Query supplied items (and optionally verified)
    stmt = (
        select(
            BookingItem,
            Booking,
            Item,
        )
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(Item, Item.id == BookingItem.item_id)
        .where(and_(*conditions))
    )
    
    # Order by settlement date (if settled) or supplied date (if not settled)
    # This ensures settled items are ordered by when they were settled
    stmt = stmt.order_by(
        case(
            (BookingItem.payment_settled_at.isnot(None), BookingItem.payment_settled_at),
            (BookingItem.supplied_at.isnot(None), BookingItem.supplied_at),
            else_=BookingItem.verified_at
        ).desc()
    )
    
    rs = await session.execute(stmt)
    rows = rs.all()
    
    items = []
    total_amount = 0.0
    
    for bi, b, it in rows:
        # Calculate vendor price (cost) - use vendor_price from Item, not the customer price
        vendor_unit_price = float(it.vendor_price or 0.0)
        vendor_total_price = vendor_unit_price * bi.quantity
        
        items.append({
            'booking_item_id': bi.id,
            'booking_id': b.id,
            'booking_reference': b.booking_reference,
            'item_name': it.name,
            'item_image_url': it.image_url,
            'quantity': bi.quantity,
            'unit_price': vendor_unit_price,  # Vendor cost price
            'total_price': vendor_total_price,  # Vendor cost total
            'customer_unit_price': float(bi.unit_price),  # Customer price for reference
            'customer_total_price': float(bi.total_price),  # Customer price for reference
            'supplied_at': bi.supplied_at.isoformat() if bi.supplied_at else None,
            'verified_at': bi.verified_at.isoformat() if bi.verified_at else None,
            'is_supplied': bool(bi.is_supplied),
            'supply_verified': bool(bi.supply_verified),
            'payment_settled': getattr(bi, 'payment_settled', False),
            'payment_settled_at': getattr(bi, 'payment_settled_at', None).isoformat() if getattr(bi, 'payment_settled_at', None) else None,
            'event_date': bi.event_date.isoformat() if bi.event_date else None,
        })
        total_amount += vendor_total_price  # Use vendor price for settlement
    
    return {
        'period': period_label,
        'start_date': start_date.isoformat(),
        'end_date': now.isoformat(),
        'total_items': len(items),
        'total_amount': total_amount,
        'items': items,
    }


@router.get("/invoice")
async def generate_invoice(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    vendor_id: Optional[int] = Query(None, description="Vendor ID (admin only)"),
    booking_id: Optional[int] = Query(None, description="Booking ID to filter by specific booking"),
    format: str = Query("json", description="json or pdf"),
    include_unverified: bool = Query(False, description="Include items that are supplied but not yet verified by admin"),
    settled_only: bool = Query(True, description="Only include settled items in invoice"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate invoice for vendor payments. Returns JSON or PDF.
    By default, only includes settled items (settled_only=True).
    """
    # Initialize invoice_data to None
    invoice_data = None
    
    try:
        # Get payment summary
        summary_data = await get_payment_summary(
            period=period, 
            vendor_id=vendor_id, 
            include_unverified=include_unverified,
            session=session, 
            user=user
        )
        
        # Ensure summary_data has items list
        if not summary_data or 'items' not in summary_data:
            raise HTTPException(status_code=500, detail='Failed to retrieve payment summary data')
        
        # Filter to specific booking_id if provided (before settled_only filter)
        if booking_id:
            original_items = summary_data.get('items', []) or []
            booking_items = [item for item in original_items if item.get('booking_id') == booking_id]
            summary_data['items'] = booking_items
            summary_data['total_amount'] = sum(float(item.get('total_price', 0) or 0) for item in booking_items)
            summary_data['total_items'] = len(booking_items)
        
        # Filter to only settled items if settled_only is True
        if settled_only:
            original_items = summary_data.get('items', []) or []
            settled_items = [item for item in original_items if item.get('payment_settled', False)]
            summary_data['items'] = settled_items
            summary_data['total_amount'] = sum(float(item.get('total_price', 0) or 0) for item in settled_items)
            summary_data['total_items'] = len(settled_items)
        
        # Check if there are items to invoice
        if not summary_data.get('items') or len(summary_data['items']) == 0:
            if settled_only:
                raise HTTPException(status_code=400, detail='No settled items available for invoice generation. Please settle items first.')
            else:
                raise HTTPException(status_code=400, detail='No items available for invoice generation.')
        
        # Get vendor details
        if user.role == 'admin' and vendor_id:
            rs = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
        else:
            rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
        vp = rs.scalars().first()
        if not vp:
            raise HTTPException(status_code=404, detail='Vendor profile not found')
        
        # Get vendor user details
        rs_user = await session.execute(select(User).where(User.id == vp.user_id))
        vendor_user = rs_user.scalars().first()
        
        # Generate invoice number
        invoice_number = f"INV-{vp.id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Determine invoice type based on settlement status
        # If all items are settled → TAX INVOICE
        # If any items are not settled → PROFORMA INVOICE
        invoice_items = summary_data.get('items', [])
        all_items_settled = all(item.get('payment_settled', False) for item in invoice_items) if invoice_items else False
        invoice_type = 'TAX INVOICE' if all_items_settled else 'PROFORMA INVOICE'
        
        invoice_data = {
            'invoice_number': invoice_number,
            'issue_date': datetime.utcnow().isoformat(),
            'invoice_type': invoice_type,
            'vendor': {
                'company_name': vp.company_name,
                'contact_email': vp.contact_email,
                'contact_phone': vp.contact_phone,
            },
            'period': summary_data.get('period', period),
            'start_date': summary_data.get('start_date', datetime.utcnow().isoformat()),
            'end_date': summary_data.get('end_date', datetime.utcnow().isoformat()),
            'items': invoice_items,
            'total_amount': float(summary_data.get('total_amount', 0) or 0),
            'total_items': summary_data.get('total_items', 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[INVOICE] Error preparing invoice data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to prepare invoice data: {str(e)}')
    
    if not invoice_data:
        raise HTTPException(status_code=500, detail='Failed to generate invoice data')
    
    if format == 'pdf':
        # Validate invoice_data before proceeding
        if not invoice_data or not isinstance(invoice_data, dict):
            raise HTTPException(status_code=500, detail='Invalid invoice data structure')
        
        if 'items' not in invoice_data or not invoice_data['items']:
            raise HTTPException(status_code=400, detail='No items in invoice data')
        
        # Generate PDF invoice with modern professional design
        try:
            # First check if reportlab is available
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
            from io import BytesIO
            import os
            from pathlib import Path
            
            buffer = BytesIO()
            
            # Company details - BRQ Associates (from reference)
            company_name = "BRQ ASSOCIATES"
            company_tagline = "India's No.1 in Auditing Excellence"
            company_tagline2 = "Feel the Expertise"
            company_address = "2nd Floor, BRQ Tower, Karandakkad Kasaragod, Kerala, India - 671121"
            company_phone = "+91 96-33-18-18-98"
            company_phone2 = "04994-225-895/896/897/898"
            company_email = "brqgst@gmail.com"
            
            # Try to find logo - check multiple possible locations
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
            
            # BRQ Associates letterhead design (matching reference image)
            class BRQLetterheadTemplate:
                def __init__(self, canvas, doc):
                    self.canvas = canvas
                    self.width, self.height = letter
                    # BRQ color scheme from reference image
                    self.dark_blue = colors.HexColor('#1a1f3a')  # Dark blue header
                    self.gold = colors.HexColor('#D4AF37')  # Golden yellow
                    self.white = colors.white
                    self.black = colors.black
                    
                def draw(self):
                    header_height = 1.2*inch  # Reduced header height
                    footer_height = 0.35*inch  # Reduced footer height
                    
                    # === HEADER SECTION ===
                    # Dark blue header background (left side)
                    header_blue_width = 3.5*inch
                    self.canvas.setFillColor(self.dark_blue)
                    self.canvas.rect(0, self.height - header_height, header_blue_width, header_height, fill=1, stroke=0)
                    
                    # Logo placement (left side in dark blue area)
                    logo_x = 0.3*inch
                    logo_y = self.height - 0.9*inch
                    if logo_path and os.path.exists(logo_path):
                        try:
                            # Try to load logo (horse logo from reference)
                            logo_img = Image(logo_path, width=0.8*inch, height=0.8*inch)
                            logo_img.drawOn(self.canvas, logo_x, logo_y)
                        except:
                            # If logo fails, draw a placeholder
                            self.canvas.setFillColor(self.gold)
                            self.canvas.circle(logo_x + 0.4*inch, logo_y + 0.4*inch, 0.3*inch, fill=1)
                    
                    # Company name (white text in dark blue area)
                    self.canvas.setFont("Helvetica-Bold", 14)
                    self.canvas.setFillColor(self.white)
                    self.canvas.drawString(logo_x + 1.0*inch, logo_y + 0.5*inch, company_name)
                    
                    # Tagline 1
                    self.canvas.setFont("Helvetica", 8)
                    self.canvas.setFillColor(self.white)
                    self.canvas.drawString(logo_x + 1.0*inch, logo_y + 0.25*inch, company_tagline)
                    
                    # Tagline 2 (italic)
                    self.canvas.setFont("Helvetica-Oblique", 7)
                    self.canvas.setFillColor(self.white)
                    self.canvas.drawString(logo_x + 1.0*inch, logo_y + 0.05*inch, company_tagline2)
                    
                    # === YELLOW DIAGONAL BAND ===
                    # Draw diagonal yellow band from top right (matching reference image style)
                    self.canvas.setFillColor(self.gold)
                    self.canvas.setStrokeColor(self.gold)
                    # Create diagonal band using lines to form a polygon shape
                    # Draw the polygon by using multiple line segments
                    from reportlab.pdfgen.canvas import Canvas
                    # Use saveState and manual polygon drawing
                    self.canvas.saveState()
                    # Create path by drawing lines
                    self.canvas.setFillColor(self.gold)
                    # Draw polygon using multiple rectangles (simpler approach)
                    # Top section (wider)
                    self.canvas.rect(self.width - 2.5*inch, self.height - 0.3*inch, 2.5*inch, 0.3*inch, fill=1, stroke=0)
                    # Middle diagonal section (use two rectangles to create diagonal effect)
                    self.canvas.rect(self.width - 2.3*inch, self.height - header_height + 0.3*inch, 2.3*inch, 0.5*inch, fill=1, stroke=0)
                    # Bottom section (narrower)
                    self.canvas.rect(self.width - 2.0*inch, self.height - header_height, 2.0*inch, 0.3*inch, fill=1, stroke=0)
                    self.canvas.restoreState()
                    
                    # Contact info in yellow band (right side) - centered in golden area
                    # Calculate center position within the golden band area
                    band_start_x = self.width - 2.5*inch
                    band_center_x = self.width - (2.5*inch / 2)  # Center of the band
                    contact_y = self.height - 0.5*inch
                    self.canvas.setFont("Helvetica", 6.5)
                    self.canvas.setFillColor(self.black)
                    
                    # Contact info - format address properly
                    address_text = company_address if isinstance(company_address, str) else (", ".join(company_address) if isinstance(company_address, list) else str(company_address))
                    # Split address into two lines if needed
                    if len(address_text) > 35:
                        words = address_text.split()
                        mid = len(words) // 2
                        address_line1 = " ".join(words[:mid])
                        address_line2 = " ".join(words[mid:])
                    else:
                        address_line1 = address_text
                        address_line2 = ""
                    
                    # Draw contact information centered in golden band
                    contact_lines = []
                    if address_line1:
                        contact_lines.append(address_line1)
                    if address_line2:
                        contact_lines.append(address_line2)
                    if company_phone:
                        contact_lines.append(company_phone)
                    if company_phone2:
                        contact_lines.append(company_phone2)
                    if company_email:
                        contact_lines.append(company_email)
                    
                    # Center each line of text in the golden band
                    y_offset = 0
                    for line in contact_lines:
                        if line:
                            text_width = self.canvas.stringWidth(line, "Helvetica", 6.5)
                            # Center the text horizontally in the golden band
                            centered_x = band_center_x - (text_width / 2)
                            self.canvas.drawString(centered_x, contact_y - y_offset, line)
                            y_offset += 0.12*inch
                    
                    # === FOOTER SECTION ===
                    # Yellow footer band (diagonal style matching reference)
                    self.canvas.setFillColor(self.gold)
                    # Draw diagonal footer using overlapping rectangles
                    self.canvas.saveState()
                    # Bottom section (wider)
                    self.canvas.rect(0, 0, 2.5*inch, 0.2*inch, fill=1, stroke=0)
                    # Top section (narrower - creates diagonal effect)
                    self.canvas.rect(0, 0.2*inch, 2.0*inch, footer_height - 0.2*inch, fill=1, stroke=0)
                    self.canvas.restoreState()
                    
                    # Bottom border line
                    self.canvas.setFillColor(colors.HexColor('#E5E7EB'))
                    self.canvas.rect(0, footer_height, self.width, 0.01*inch, fill=1, stroke=0)
                    
                    # Reset color
                    self.canvas.setFillColor(colors.black)
            
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=0.5*inch,
                leftMargin=0.5*inch,
                topMargin=0.75*inch,  # Reduced margin since no letterhead
                bottomMargin=0.5*inch  # Normal margin without footer letterhead
            )
            
            # No letterhead for settlement invoices - just plain invoice
            def add_letterhead(canvas, doc):
                # Empty function - no letterhead needed
                pass
            
            story = []
            styles = getSampleStyleSheet()
            
            # Professional invoice styles with appropriate fonts - compact for single page
            invoice_title_style = ParagraphStyle(
                'InvoiceTitle',
                parent=styles['Heading1'],
                fontSize=22,
                textColor=colors.HexColor('#1a1f3a'),
                spaceAfter=8,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold',
                leading=26,
            )
            
            invoice_subtitle_style = ParagraphStyle(
                'InvoiceSubtitle',
                parent=styles['Normal'],
                fontSize=11,
                textColor=colors.HexColor('#6B7280'),
                spaceAfter=18,
                alignment=TA_CENTER,
                fontName='Helvetica',
                leading=13,
            )
            
            invoice_number_style = ParagraphStyle(
                'InvoiceNumber',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#374151'),
                spaceAfter=3,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold',
                leading=12,
            )
            
            date_style = ParagraphStyle(
                'DateStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#374151'),
                spaceAfter=3,
                alignment=TA_RIGHT,
                fontName='Helvetica-Bold',
                leading=12,
            )
            
            section_header_style = ParagraphStyle(
                'SectionHeader',
                parent=styles['Heading3'],
                fontSize=11,
                textColor=colors.HexColor('#1a1f3a'),
                spaceAfter=8,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold',
                leading=13,
            )
            
            # Main invoice title section (centered) - reduced spacing
            # Determine invoice type: TAX INVOICE if all items are settled, PROFORMA INVOICE if any are not settled
            invoice_title = invoice_data.get('invoice_type', 'SETTLEMENT INVOICE')
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph(invoice_title, invoice_title_style))
            story.append(Spacer(1, 0.1*inch))
            
            # Invoice number and date in elegant layout (no HTML tags)
            invoice_number = invoice_data.get('invoice_number', f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
            invoice_period = invoice_data.get('period', period or 'monthly')
            invoice_total_items = invoice_data.get('total_items', len(invoice_data.get('items', [])))
            invoice_info_data = [
                [f"Invoice Number: {invoice_number}", f"Date: {datetime.utcnow().strftime('%B %d, %Y')}"],
                [f"Period: {invoice_period}", f"Items: {invoice_total_items}"],
            ]
            invoice_info_table = Table(invoice_info_data, colWidths=[3*inch, 3*inch])
            invoice_info_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(invoice_info_table)
            story.append(Spacer(1, 0.2*inch))
            
            # Bill To section with elegant styling
            bill_to_style = ParagraphStyle(
                'BillTo',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#374151'),
                spaceAfter=4,
                alignment=TA_LEFT,
                fontName='Helvetica',
            )
            
            bill_to_header = ParagraphStyle(
                'BillToHeader',
                parent=styles['Normal'],
                fontSize=11,
                textColor=colors.HexColor('#1a1f3a'),
                spaceAfter=8,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold',
            )
            
            # To: Lebrq (our company) - this is an invoice FROM vendor TO Lebrq
            story.append(Paragraph("TO", bill_to_header))
            story.append(Paragraph("Lebrq", bill_to_style))
            story.append(Paragraph("2nd Floor, BRQ Tower, Karandakkad Kasaragod, Kerala, India - 671121", bill_to_style))
            story.append(Paragraph("+91 96-33-18-18-98", bill_to_style))
            story.append(Paragraph("brqgst@gmail.com", bill_to_style))
            story.append(Spacer(1, 0.2*inch))
            
            # From: Vendor (add this section)
            story.append(Paragraph("FROM", bill_to_header))
            vendor_info = invoice_data.get('vendor', {})
            story.append(Paragraph(vendor_info.get('company_name') or "Vendor", bill_to_style))
            if vendor_info.get('contact_email'):
                story.append(Paragraph(vendor_info.get('contact_email'), bill_to_style))
            if vendor_info.get('contact_phone'):
                story.append(Paragraph(vendor_info.get('contact_phone'), bill_to_style))
            story.append(Spacer(1, 0.2*inch))
            
            # Premium items table with enhanced design (no HTML tags)
            table_data = [['ITEM DESCRIPTION', 'QTY', 'UNIT PRICE', 'STATUS', 'TOTAL']]
            for item in invoice_data.get('items', []):
                # Use plain text only
                item_desc = item.get('item_name', 'Item') or 'Item'
                if item.get('booking_reference'):
                    # Add order reference on new line
                    item_desc = f"{item_desc}\nOrder: {item.get('booking_reference', '')}"
                # Use Paragraph for multi-line text support
                item_desc_para = Paragraph(item_desc, ParagraphStyle(
                    'ItemDesc',
                    parent=styles['Normal'],
                    fontSize=9,
                    textColor=colors.HexColor('#111827'),
                    fontName='Helvetica',
                    leading=11,
                ))
                # Determine supply status
                is_supplied = item.get('is_supplied', False)
                supply_verified = item.get('supply_verified', False)
                if supply_verified:
                    status_text = "Verified"
                    status_color = colors.HexColor('#065F46')  # Green
                elif is_supplied:
                    status_text = "Supplied"
                    status_color = colors.HexColor('#F59E0B')  # Orange/Amber
                else:
                    status_text = "Pending"
                    status_color = colors.HexColor('#6B7280')  # Gray
                
                status_para = Paragraph(status_text, ParagraphStyle(
                    'Status',
                    parent=styles['Normal'],
                    fontSize=8,
                    textColor=status_color,
                    fontName='Helvetica-Bold',
                    alignment=TA_CENTER,
                ))
                table_data.append([
                    item_desc_para,
                    str(item.get('quantity', 0) or 0),
                    f"{float(item.get('unit_price', 0) or 0):.2f}",
                    status_para,
                    f"{float(item.get('total_price', 0) or 0):.2f}",
                ])
            
            # Optimize column widths for single page
            table = Table(table_data, colWidths=[2.2*inch, 0.5*inch, 0.8*inch, 0.7*inch, 0.9*inch])
            table.setStyle(TableStyle([
                # Header row - elegant dark background
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1f3a')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (-1, 0), 'CENTER'),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # Right align numbers
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 0), (-1, 0), 12),
                # Data rows with alternating colors
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#111827')),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
                ('FONTNAME', (1, 1), (-1, -1), 'Helvetica'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(table)
            
            story.append(Spacer(1, 0.25*inch))
            
            # Detailed calculation section
            subtotal = float(invoice_data.get('total_amount', 0) or 0)
            tax = 0.0  # No tax for vendor settlement
            grand_total = subtotal
            
            # Calculate item count and breakdown
            invoice_items_list = invoice_data.get('items', [])
            total_quantity = sum(int(item.get('quantity', 0) or 0) for item in invoice_items_list)
            
            # Summary box with detailed calculations (no HTML tags, no rupee symbol) - compact
            summary_table_data = [
                ['Total Items:', f"{invoice_data.get('total_items', 0)}"],
                ['Total Quantity:', f"{total_quantity}"],
                ['Subtotal:', f"{subtotal:.2f}"],
                ['Tax (GST):', f"{tax:.2f}"],
                ['', ''],
                ['TOTAL AMOUNT:', f"{grand_total:.2f}"],
            ]
            summary_table = Table(summary_table_data, colWidths=[2.5*inch, 1.5*inch])
            summary_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (0, 3), 'Helvetica'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Bold for TOTAL
                ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),  # Bold for total amount
                ('FONTSIZE', (0, 0), (0, 3), 9),
                ('FONTSIZE', (0, -1), (-1, -1), 11),  # Larger for TOTAL
                ('FONTSIZE', (1, -1), (1, -1), 12),  # Even larger for total amount
                ('TEXTCOLOR', (0, 0), (1, 3), colors.HexColor('#374151')),
                ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#1a1f3a')),  # Darker for TOTAL
                ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F9FAFB')),  # Middle spacer
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F0FDF4')),  # Light green for TOTAL
                ('LINEBELOW', (0, 4), (-1, 4), 1, colors.HexColor('#E5E7EB')),  # Divider line
                ('LINEBELOW', (0, -1), (-1, -1), 2, colors.HexColor('#2D5016')),  # Bold line under total
                ('BOTTOMPADDING', (0, 0), (-1, 3), 3),
                ('TOPPADDING', (0, 0), (-1, 3), 3),
                ('BOTTOMPADDING', (0, -1), (-1, -1), 5),
                ('TOPPADDING', (0, -1), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(KeepTogether(summary_table))
            
            # End of invoice - no footer sections needed
            
            # Build PDF with modern letterhead - single page only
            # Prevent page breaks to ensure everything fits on one page
            for element in story:
                if hasattr(element, 'keepWithNext'):
                    element.keepWithNext = 0
            
            doc.build(story, onFirstPage=add_letterhead, onLaterPages=add_letterhead)
            buffer.seek(0)
            
            # Get invoice number from invoice_data for filename
            invoice_num = invoice_data.get('invoice_number', f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
            return Response(
                content=buffer.read(),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=invoice_{invoice_num}.pdf"
                }
            )
        except ImportError as ie:
            error_msg = f'PDF generation requires reportlab. Install with: pip install reportlab. Error: {str(ie)}'
            print(f"[INVOICE] ImportError: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except HTTPException:
            # Re-raise HTTPExceptions as-is
            raise
        except Exception as e:
            error_msg = f'Failed to generate PDF invoice: {str(e)}'
            print(f"[INVOICE] Error generating PDF invoice: {error_msg}")
            import traceback
            print(f"[INVOICE] Traceback:")
            traceback.print_exc()
            # Include the exception type in the error message for better debugging
            raise HTTPException(
                status_code=500, 
                detail=f'{error_msg} (Type: {type(e).__name__})'
            )
    else:
        return invoice_data


@router.get("/invoice/test")
async def test_invoice_data(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    vendor_id: Optional[int] = Query(None, description="Vendor ID (admin only)"),
    include_unverified: bool = Query(False),
    settled_only: bool = Query(True),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Test endpoint to check invoice data generation without PDF"""
    try:
        # Get payment summary
        summary_data = await get_payment_summary(
            period=period, 
            vendor_id=vendor_id, 
            include_unverified=include_unverified,
            session=session, 
            user=user
        )
        
        # Filter to only settled items if settled_only is True
        if settled_only:
            original_items = summary_data.get('items', []) or []
            settled_items = [item for item in original_items if item.get('payment_settled', False)]
            summary_data['items'] = settled_items
            summary_data['total_amount'] = sum(float(item.get('total_price', 0) or 0) for item in settled_items)
            summary_data['total_items'] = len(settled_items)
        
        return {
            "success": True,
            "summary_data": summary_data,
            "settled_items_count": len(summary_data.get('items', [])),
            "message": "Invoice data generation test successful"
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }


@router.post("/invoice/share/whatsapp")
async def share_invoice_whatsapp(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    vendor_id: Optional[int] = Query(None, description="Vendor ID (admin only)"),
    include_unverified: bool = Query(False, description="Include unverified items"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Share invoice PDF via WhatsApp to vendor"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    if not vendor_id:
        raise HTTPException(status_code=400, detail='Vendor ID required')
    
    # Get vendor details
    rs = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
    vp = rs.scalars().first()
    if not vp or not vp.contact_phone:
        raise HTTPException(status_code=400, detail='Vendor phone number not available')
    
    # Generate PDF invoice
    pdf_response = await generate_invoice(
        period=period, 
        vendor_id=vendor_id, 
        format="pdf",
        include_unverified=include_unverified,
        session=session, 
        user=user
    )
    
    # Format phone number
    phone = vp.contact_phone.strip()
    if not phone.startswith('+'):
        if not phone.startswith('91'):
            phone = '+91' + phone.lstrip('0')
        else:
            phone = '+' + phone
    
    # Get invoice summary for message
    summary_data = await get_payment_summary(
        period=period, 
        vendor_id=vendor_id,
        include_unverified=include_unverified,
        session=session, 
        user=user
    )
    
    # Create WhatsApp message
    company_phone = "+919633181898"
    message = f"📄 *Settlement Invoice*\n\n"
    message += f"*Invoice Period:* {summary_data['period']}\n"
    message += f"*Total Items:* {summary_data['total_items']}\n"
    message += f"*Total Amount:* ₹{summary_data['total_amount']:.2f}\n\n"
    message += f"Please find your settlement invoice attached.\n"
    message += f"For queries, contact: {company_phone}"
    
    # Send WhatsApp with PDF (Note: This would need WhatsApp Business API with media support)
    # For now, send message and note about PDF
    try:
        from ..services.route_mobile import send_session_message
        await send_session_message(phone, text=message)
        # Note: To send PDF via WhatsApp, you'd need WhatsApp Business API with media upload
        return {'ok': True, 'message': 'Invoice notification sent via WhatsApp. PDF download available in dashboard.'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to send WhatsApp: {str(e)}')


@router.post("/invoice/share/email")
async def share_invoice_email(
    period: str = Query("monthly", description="weekly, monthly, or yearly"),
    vendor_id: Optional[int] = Query(None, description="Vendor ID (admin only)"),
    include_unverified: bool = Query(False, description="Include unverified items"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Share invoice PDF via Email to vendor"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    if not vendor_id:
        raise HTTPException(status_code=400, detail='Vendor ID required')
    
    # Get invoice data
    invoice_data = await generate_invoice(
        period=period, 
        vendor_id=vendor_id, 
        format="json",
        include_unverified=include_unverified,
        session=session, 
        user=user
    )
    
    # Get vendor details
    rs = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
    vp = rs.scalars().first()
    if not vp or not vp.contact_email:
        raise HTTPException(status_code=400, detail='Vendor email not available')
    
    # Generate PDF invoice
    pdf_response = await generate_invoice(
        period=period, 
        vendor_id=vendor_id, 
        format="pdf",
        include_unverified=include_unverified,
        session=session, 
        user=user
    )
    
    # Create email content
    subject = f"Settlement Invoice {invoice_data['invoice_number']} - {invoice_data['period']} Summary"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1f3a;">Settlement Invoice {invoice_data['invoice_number']}</h2>
            <p><strong>Period:</strong> {invoice_data['period']}</p>
            <p><strong>Issue Date:</strong> {invoice_data['issue_date'][:10]}</p>
            <p><strong>Total Items:</strong> {invoice_data['total_items']}</p>
            <p><strong>Grand Total:</strong> ₹{invoice_data['total_amount']:.2f}</p>
            
            <h3>Items Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #1a1f3a; color: white;">
                    <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
                    <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Order ID</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Qty</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Total</th>
                </tr>
    """
    
    for item in invoice_data['items']:
        html_content += f"""
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">{item['item_name']}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">{item['booking_reference'] or '#' + str(item['booking_id'])}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">{item['quantity']}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">₹{item['total_price']:.2f}</td>
                </tr>
        """
    
    html_content += f"""
            </table>
            <p style="font-size: 18px; font-weight: bold; text-align: right; color: #1a1f3a;">
                Grand Total: ₹{invoice_data['total_amount']:.2f}
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Please find the detailed PDF invoice attached to this email.
            </p>
        </div>
    </body>
    </html>
    """
    
    # Send email with PDF attachment
    try:
        from ..notifications import NotificationService
        # Note: Email attachment would require additional email library support
        # For now, send email with summary and note about PDF
        await NotificationService._send_email(vp.contact_email, subject, html_content)
        return {'ok': True, 'message': 'Invoice email sent. PDF download available in dashboard.'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to send email: {str(e)}')


class SettleRequest(BaseModel):
    booking_item_ids: List[int]

@router.post("/settle")
async def mark_payment_settled(
    request: SettleRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark booking items as payment settled. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    from datetime import datetime
    
    booking_item_ids = request.booking_item_ids
    
    if not booking_item_ids or len(booking_item_ids) == 0:
        raise HTTPException(status_code=400, detail='booking_item_ids list cannot be empty')
    
    # Get all booking items
    stmt = select(BookingItem).where(BookingItem.id.in_(booking_item_ids))
    rs = await session.execute(stmt)
    items = rs.scalars().all()
    
    if len(items) != len(booking_item_ids):
        raise HTTPException(status_code=404, detail='Some booking items not found')
    
    # Mark as settled
    settled_count = 0
    for bi in items:
        if not getattr(bi, 'payment_settled', False):
            bi.payment_settled = True
            bi.payment_settled_at = datetime.utcnow()
            bi.payment_settled_by_user_id = user.id
            settled_count += 1
    
    await session.commit()
    
    return {
        'ok': True,
        'settled_count': settled_count,
        'total_items': len(items),
        'message': f'Marked {settled_count} item(s) as payment settled'
    }


@router.post("/unsettle")
async def mark_payment_unsettled(
    request: SettleRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark booking items as payment unsettled (reverse settlement). Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    booking_item_ids = request.booking_item_ids
    
    if not booking_item_ids or len(booking_item_ids) == 0:
        raise HTTPException(status_code=400, detail='booking_item_ids list cannot be empty')
    
    # Get all booking items
    stmt = select(BookingItem).where(BookingItem.id.in_(booking_item_ids))
    rs = await session.execute(stmt)
    items = rs.scalars().all()
    
    if len(items) != len(booking_item_ids):
        raise HTTPException(status_code=404, detail='Some booking items not found')
    
    # Mark as unsettled
    unsettled_count = 0
    for bi in items:
        # Check if item is actually settled
        if bi.payment_settled is True:
            bi.payment_settled = False
            bi.payment_settled_at = None
            bi.payment_settled_by_user_id = None
            unsettled_count += 1
    
    if unsettled_count == 0:
        raise HTTPException(status_code=400, detail='No settled items found to unsettle. All provided items are already unsettled.')
    
    try:
        await session.commit()
    except Exception as e:
        await session.rollback()
        print(f"[UNSETTLE] Error committing unsettle changes: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to unsettle items: {str(e)}')
    
    return {
        'ok': True,
        'unsettled_count': unsettled_count,
        'total_items': len(items),
        'message': f'Marked {unsettled_count} item(s) as payment unsettled'
    }


@router.post("/prepare-payment")
async def prepare_vendor_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Prepare payment for vendor items. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    booking_item_ids = request.get('booking_item_ids', [])
    if not booking_item_ids:
        raise HTTPException(status_code=400, detail='booking_item_ids is required')
    
    # Get booking items and calculate total - use raw SQL to avoid performance_team_profile column issue
    sql_query = text("""
        SELECT 
            bi.id, bi.vendor_id, bi.quantity, bi.payment_settled,
            i.id as item_id, i.vendor_price
        FROM booking_items bi
        INNER JOIN items i ON i.id = bi.item_id
        WHERE bi.id IN :booking_item_ids
    """)
    rs = await session.execute(sql_query, {'booking_item_ids': tuple(booking_item_ids)})
    rows = rs.all()
    
    if len(rows) != len(booking_item_ids):
        raise HTTPException(status_code=404, detail='Some booking items not found')
    
    # Check if already settled
    total_amount = 0.0
    for row in rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        if getattr(row_dict, 'payment_settled', False) or row_dict.get('payment_settled', False):
            raise HTTPException(status_code=400, detail=f'Booking item {row_dict.get("id")} is already settled')
        vendor_unit_price = float(row_dict.get('vendor_price') or 0.0)
        total_amount += vendor_unit_price * row_dict.get('quantity', 0)
    
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail='No amount to pay')
    
    # Create Razorpay order
    try:
        from ..routers.payments import get_razorpay_service
        razorpay_service = get_razorpay_service()
        
        if not razorpay_service.is_configured():
            raise HTTPException(status_code=503, detail='Payment service is not available. Please contact support.')
        
        amount_paise = int(total_amount * 100)
        razorpay_order = razorpay_service.create_order(
            amount=amount_paise,
            currency='INR',
            receipt=f"vendor_{booking_item_ids[0]}_{int(datetime.utcnow().timestamp())}",
            description=f"Vendor payment for {len(booking_item_ids)} item(s)",
            notes={
                'booking_item_ids': booking_item_ids,
                'payment_type': 'vendor_payment',
                'item_count': len(booking_item_ids),
            }
        )
        
        if not razorpay_order or 'id' not in razorpay_order:
            logger.error(f"[Vendor Payment] Invalid order response: {razorpay_order}")
            raise HTTPException(status_code=503, detail='Payment service encountered an error. Please try again.')
        
        order_id = razorpay_order.get('id')
        logger.info(f"[Vendor Payment] Order created: {order_id} for {len(booking_item_ids)} items")
        
        return {
            'ok': True,
            'order_id': order_id,
            'amount': total_amount,
            'currency': 'INR',
            'booking_item_ids': booking_item_ids,
            'item_count': len(booking_item_ids),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Vendor Payment] Error preparing payment: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail='Payment service is temporarily unavailable. Please try again later.')


@router.post("/verify-payment")
async def verify_vendor_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Verify and process vendor payment. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    booking_item_ids = request.get('booking_item_ids', [])
    payment_data = request.get('payment_data', {})
    
    if not booking_item_ids:
        raise HTTPException(status_code=400, detail='booking_item_ids is required')
    
    # Get booking items
    stmt = select(BookingItem, Item).join(Item, Item.id == BookingItem.item_id).where(BookingItem.id.in_(booking_item_ids))
    rs = await session.execute(stmt)
    rows = rs.all()
    
    if len(rows) != len(booking_item_ids):
        raise HTTPException(status_code=404, detail='Some booking items not found')
    
    # Check if already settled
    for bi, it in rows:
        if getattr(bi, 'payment_settled', False):
            raise HTTPException(status_code=400, detail=f'Booking item {bi.id} is already settled')
    
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
        total_amount = 0.0
        for bi, it in rows:
            vendor_unit_price = float(it.vendor_price or 0.0)
            total_amount += vendor_unit_price * bi.quantity
        
        # Create payment record
        payment = Payment(
            booking_id=None,  # Vendor payment is for items, not a single booking
            amount=total_amount,
            currency='INR',
            provider='razorpay',
            provider_payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
            status='success',
            paid_at=datetime.utcnow(),
            details={
                'payment_type': 'vendor_payment',
                'booking_item_ids': booking_item_ids,
                'item_count': len(booking_item_ids),
            },
            gateway_response=payment_details
        )
        session.add(payment)
        
        # Mark all items as settled
        for bi, it in rows:
            bi.payment_settled = True
            bi.payment_settled_at = datetime.utcnow()
            bi.payment_settled_by_user_id = user.id
        
        await session.commit()
        
        return {
            'ok': True,
            'message': f'Vendor payment verified and {len(rows)} item(s) marked as settled',
            'payment_id': payment.id,
            'settled_count': len(rows),
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[VENDOR PAYMENT] Error verifying payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Payment verification failed: {str(e)}')


@router.post("/prepare-bulk-payment")
async def prepare_bulk_vendor_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Prepare bulk payment for all unsettled vendor items. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    vendor_id = request.get('vendor_id')
    period = request.get('period', 'monthly')
    include_unverified = request.get('include_unverified', False)
    
    if not vendor_id:
        raise HTTPException(status_code=400, detail='vendor_id is required')
    
    # Calculate date range
    now = datetime.utcnow()
    if period == 'weekly':
        start_date = now - timedelta(days=7)
    elif period == 'monthly':
        start_date = now - timedelta(days=30)
    elif period == 'yearly':
        start_date = now - timedelta(days=365)
    else:
        raise HTTPException(status_code=400, detail='Invalid period')
    
    # Get unsettled items - use raw SQL to avoid performance_team_profile column issue
    # Build WHERE clause matching original conditions
    where_parts = [
        "bi.vendor_id = :vendor_id",
        "bi.is_supplyed = 1"
    ]
    params = {
        'vendor_id': vendor_id,
        'start_date': start_date
    }
    
    if include_unverified:
        where_parts.append("bi.supplied_at IS NOT NULL AND bi.supplied_at >= :start_date")
    else:
        where_parts.append("bi.supply_verified = 1")
        where_parts.append("bi.supplied_at IS NOT NULL AND bi.supplied_at >= :start_date")
        where_parts.append("bi.verified_at IS NOT NULL")
    
    where_clause = " AND ".join(where_parts)
    
    sql_query = text(f"""
        SELECT 
            bi.id, bi.vendor_id, bi.quantity, bi.payment_settled,
            i.id as item_id, i.vendor_price
        FROM booking_items bi
        INNER JOIN items i ON i.id = bi.item_id
        WHERE {where_clause}
    """)
    rs = await session.execute(sql_query, params)
    rows = rs.all()
    
    # Filter unsettled items
    unsettled_items = []
    for row in rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        if not getattr(row_dict, 'payment_settled', False) and not row_dict.get('payment_settled', False):
            unsettled_items.append(row_dict)
    
    if not unsettled_items:
        raise HTTPException(status_code=400, detail='No unsettled items found')
    
    # Calculate total amount
    total_amount = 0.0
    booking_item_ids = []
    for item in unsettled_items:
        vendor_unit_price = float(item.get('vendor_price') or 0.0)
        total_amount += vendor_unit_price * item.get('quantity', 0)
        booking_item_ids.append(item.get('id'))
    
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
            receipt=f"vendor_bulk_{vendor_id}_{int(datetime.utcnow().timestamp())}",
            description=f"Bulk vendor payment for {len(booking_item_ids)} item(s)",
            notes={
                'vendor_id': vendor_id,
                'payment_type': 'vendor_bulk_payment',
                'booking_item_ids': booking_item_ids,
                'item_count': len(booking_item_ids),
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
            'vendor_id': vendor_id,
            'booking_item_ids': booking_item_ids,
            'item_count': len(booking_item_ids),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[VENDOR BULK PAYMENT] Error preparing payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Failed to prepare payment: {str(e)}')


@router.post("/verify-bulk-payment")
async def verify_bulk_vendor_payment(
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Verify and process bulk vendor payment. Admin only."""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    
    vendor_id = request.get('vendor_id')
    booking_item_ids = request.get('booking_item_ids', [])
    payment_data = request.get('payment_data', {})
    
    if not vendor_id or not booking_item_ids:
        raise HTTPException(status_code=400, detail='vendor_id and booking_item_ids are required')
    
    # Get booking items - use raw SQL to avoid performance_team_profile column issue
    sql_query = text("""
        SELECT 
            bi.id, bi.vendor_id, bi.payment_settled,
            i.id as item_id
        FROM booking_items bi
        INNER JOIN items i ON i.id = bi.item_id
        WHERE bi.id IN :booking_item_ids
    """)
    rs = await session.execute(sql_query, {'booking_item_ids': tuple(booking_item_ids)})
    rows = rs.all()
    
    if len(rows) != len(booking_item_ids):
        raise HTTPException(status_code=404, detail='Some booking items not found')
    
    # Verify all items belong to the vendor and are not settled
    for row in rows:
        row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
        if row_dict.get('vendor_id') != vendor_id:
            raise HTTPException(status_code=400, detail='Item does not belong to this vendor')
        if getattr(row_dict, 'payment_settled', False) or row_dict.get('payment_settled', False):
            raise HTTPException(status_code=400, detail='Some items are already settled')
    
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
        total_amount = 0.0
        for bi, it in rows:
            vendor_unit_price = float(it.vendor_price or 0.0)
            total_amount += vendor_unit_price * bi.quantity
        
        # Create payment record
        payment = Payment(
            booking_id=None,
            amount=total_amount,
            currency='INR',
            provider='razorpay',
            provider_payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
            status='success',
            paid_at=datetime.utcnow(),
            details={
                'payment_type': 'vendor_bulk_payment',
                'vendor_id': vendor_id,
                'booking_item_ids': booking_item_ids,
                'item_count': len(booking_item_ids),
            },
            gateway_response=payment_details
        )
        session.add(payment)
        
        # Mark all items as settled
        for bi, it in rows:
            bi.payment_settled = True
            bi.payment_settled_at = datetime.utcnow()
            bi.payment_settled_by_user_id = user.id
        
        await session.commit()
        
        return {
            'ok': True,
            'message': f'Bulk vendor payment verified and {len(rows)} item(s) marked as settled',
            'payment_id': payment.id,
            'vendor_id': vendor_id,
            'settled_count': len(rows),
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[VENDOR BULK PAYMENT] Error verifying payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Payment verification failed: {str(e)}')

