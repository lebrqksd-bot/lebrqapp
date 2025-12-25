"""
Notification service for sending booking updates to users
Supports: Email, SMS, In-App, and WhatsApp notifications
"""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from .core import settings
from .models import User, Booking, Space, Venue, BookingItem, Item, VendorProfile
from .services.whatsapp_route_mobile import RouteMobileWhatsAppClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


class NotificationService:
    """Handle all types of notifications"""
    
    @staticmethod
    def _normalize_phone_number(mobile: str) -> str:
        """
        Normalize phone numbers to extract only the 10-digit number (without country code).
        
        Always returns exactly 10 digits by:
        - Removing all non-digit characters
        - Removing ALL country code prefixes (91, 9191, etc.)
        - Taking the last 10 digits if number is still longer
        
        Args:
            mobile: Phone number in any format (e.g., +91918129104784, 91919895431737, 8129104784)
            
        Returns:
            Normalized phone number without country code (exactly 10 digits, e.g., 8129104784)
        """
        if not mobile:
            return ""
        
        # Remove all non-digit characters
        digits = "".join(ch for ch in mobile.strip() if ch.isdigit())
        
        if not digits:
            return ""
        
        # Remove ALL country code prefixes (91, 9191, etc.) until we get to 10 digits
        # Keep removing "91" from the start until we have 10 digits or no more "91" prefix
        original_digits = digits
        iterations = 0
        while len(digits) > 10 and digits.startswith("91"):
            digits = digits[2:]  # Remove "91" prefix
            iterations += 1
            if iterations > 10:  # Safety limit to prevent infinite loop
                break
        
        # If still longer than 10, take last 10 digits (safety fallback)
        if len(digits) > 10:
            digits = digits[-10:]
        
        # If shorter than 10, return what we have (shouldn't happen for valid Indian numbers)
        if len(digits) < 10:
            print(f"[NORMALIZE] WARNING: Phone number too short after normalization: {mobile} -> {digits} (length: {len(digits)})")
            return digits
        
        # Log normalization for debugging (only if it changed)
        if original_digits != digits:
            print(f"[NORMALIZE] Phone number normalized: {mobile} -> {original_digits} -> {digits} (removed {iterations} '91' prefix(es))")
        
        # Return exactly 10 digits
        return digits[:10]
    
    # =============== REGISTRATION (WELCOME) ==================
    @staticmethod
    async def send_registration_welcome(user: User, website_link: Optional[str] = None) -> None:
        """Send welcome notifications (Email + WhatsApp) after successful registration for customers and vendors."""
        try:
            display_name = (f"{user.first_name or ''} {user.last_name or ''}").strip() or (user.username or "")
            # Use lebrq.com as the website link for all registration communications
            site = "https://lebrq.com"

            # Send Email (registration success message)
            if user.username:
                try:
                    await NotificationService._send_registration_email(user.username, display_name, site)
                except Exception as email_err:
                    print(f"[NOTIFICATION] Registration email failed for {user.username}: {email_err}")
                    # Continue with WhatsApp even if email fails

            # Send WhatsApp (registration success message)
            if user.mobile:
                try:
                    await NotificationService._send_registration_whatsapp(user.mobile, display_name, site)
                except Exception as whatsapp_err:
                    print(f"[NOTIFICATION] Registration WhatsApp failed for {user.mobile}: {whatsapp_err}")
                    # Continue even if WhatsApp fails

        except Exception as e:
            print(f"[NOTIFICATION] Registration welcome error: {e}")
            # Don't raise - notification failures shouldn't block registration

    @staticmethod
    async def _send_registration_email(email: str, customer_name: str, website_link: str) -> None:
        """Send registration success email with welcome message."""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send registration welcome to {email}")
                return

            subject = "Registration Successful! – Welcome to LeBRQ"
            # Use lebrq.com as the website link
            website_url = "https://lebrq.com"
            html_content = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
                <title>Welcome to LeBRQ</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f7fa;padding:40px 20px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:40px 32px;text-align:center;">
                                        <div style="font-size:32px;line-height:1.2;color:#ffffff;font-weight:700;letter-spacing:-0.5px;margin-bottom:8px;">Registration Successful!</div>
                                        <div style="font-size:16px;color:#d1fae5;font-weight:500;letter-spacing:0.5px;">Welcome to LeBRQ</div>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding:40px 32px;">
                                        <p style="margin:0 0 20px 0;font-size:18px;line-height:1.6;color:#111827;font-weight:600;">Dear {customer_name},</p>
                                        <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#374151;">
                                            Thank you for registering with <strong style="color:#10B981;">LeBRQ</strong>! Your registration has been successfully completed. 
                                            We're thrilled to have you as part of our community.
                                        </p>
                                        <p style="margin:0 0 32px 0;font-size:16px;line-height:1.7;color:#374151;">
                                            Stay tuned for updates and exclusive offers. We're here to help you plan amazing events and discover exceptional services.
                                        </p>
                                        
                                        <!-- CTA Button -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                                            <tr>
                                                <td align="center" style="padding:0;">
                                                    <a href="{website_url}" style="display:inline-block;background-color:#10B981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(16,185,129,0.25);transition:all 0.3s ease;">Visit Our Website</a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Info Box -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;background-color:#f9fafb;border-left:4px solid #10B981;border-radius:6px;">
                                            <tr>
                                                <td style="padding:20px 24px;">
                                                    <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#111827;">Need Help?</p>
                                                    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                                                        If you have any questions or need assistance, feel free to reply to this email or visit our website at 
                                                        <a href="{website_url}" style="color:#10B981;text-decoration:none;font-weight:500;">lebrq.com</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:32px;text-align:center;">
                                        <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;line-height:1.6;">
                                            Warm regards,<br/>
                                            <strong style="color:#111827;font-size:15px;">Team LeBRQ</strong>
                                        </p>
                                        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
                                            <a href="{website_url}" style="color:#10B981;text-decoration:none;">lebrq.com</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Bottom Spacing -->
                            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;margin-top:24px;">
                                <tr>
                                    <td style="padding:0 32px;text-align:center;">
                                        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                                            This is an automated message. Please do not reply to this email.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            await NotificationService._send_email(email, subject, html_content)
            print(f"[NOTIFICATION] ✓ Registration success email sent to {email}")
        except Exception as e:
            print(f"[NOTIFICATION] Registration email error: {e}")
            # Don't raise - email failure shouldn't block registration

    @staticmethod
    async def _send_registration_whatsapp(mobile: str, customer_name: str, website_link: str) -> None:
        """Send registration WhatsApp using approved template (Route Mobile preferred, Twilio fallback).
        
        Approved template format:
        - BODY: *Registration Successful!* Dear {{1}}, Thank you for registering with *LeBRQ*! 
          Your registration has been successfully completed. We're thrilled to have you part of 
          our community. Stay turned for updates and exclusive offers.
        - FOOTER: Team LeBRQ
        - BUTTON: Visit website (URL: https://lebrq.com/)
        
        Parameters:
        - {{1}} in body: customer_name
        - Button parameter: website_link
        """
        try:
            # Prefer Route Mobile template send
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                to = NotificationService._normalize_phone_number(mobile)
                print(f"[NOTIFICATION] Sending WhatsApp to: {to} (formatted from: {mobile})")
                # Body parameter: only customer name ({{1}})
                body_params = [customer_name]
                # Button parameter: website link for "Visit website" button
                button_params = [website_link]
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name=settings.ROUTEMOBILE_TEMPLATE_REG,
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE,
                    body_parameters=body_params,
                    button_parameters=button_params,
                )
                if not res.get("ok"):
                    print(f"[NOTIFICATION] Route Mobile reg template failed for {mobile}: {res}")
                else:
                    print(f"[NOTIFICATION] ✓ WhatsApp registration sent successfully to {to}")
                return

            # Twilio WhatsApp fallback (non-template free text)
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                body = (
                    f"🎉 Registration Successful!\n\n"
                    f"Dear {customer_name},\n\n"
                    f"Thank you for registering with LeBRQ! Your registration has been successfully completed.\n\n"
                    f"We’re thrilled to have you as part of our community. Stay tuned for updates and exclusive offers.\n\n"
                    f"Visit us anytime: {website_link}\n\n"
                    f"Warm regards,\nTeam LeBRQ"
                )
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=body,
                    from_=f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}",
                    to=f"whatsapp:{mobile}"
                )
                print(f"[NOTIFICATION] WhatsApp reg sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send registration welcome to {mobile}")
        except Exception as e:
            print(f"[NOTIFICATION] Registration WhatsApp error: {e}")
    
    @staticmethod
    async def send_booking_approved_notification(
        booking: Booking,
        user: User,
        space: Space,
        venue: Venue,   
        session: AsyncSession
    ):
        """Send notification when booking is approved"""
        
        # Format booking details
        booking_details = {
            'booking_reference': booking.booking_reference,
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'venue_name': venue.name,
            'space_name': space.name,
            'start_datetime': booking.start_datetime.strftime('%B %d, %Y at %I:%M %p'),
            'end_datetime': booking.end_datetime.strftime('%B %d, %Y at %I:%M %p'),
            'total_amount': f"₹{booking.total_amount:,.2f}",
            'event_type': booking.event_type or 'General Event',
        }
        
        # Send Email
        if user.username:  # username is email
            await NotificationService._send_approval_email(user.username, booking_details)
        
        # Send SMS (if mobile and Twilio configured)
        if user.mobile and settings.TWILIO_ACCOUNT_SID:
            await NotificationService._send_approval_sms(user.mobile, booking_details)
        
        # Send WhatsApp (Route Mobile preferred; Twilio fallback handled inside)
        if user.mobile:
            # Use RouteMobile with template 'booking_temp' and correct phone
            rm_client = RouteMobileWhatsAppClient()
            to = NotificationService._normalize_phone_number(user.mobile or '')
            print(f"[NOTIFICATION] Attempting WhatsApp send to mobile: {to} for user_id: {user.id}")
            if not to:
                print(f"[NOTIFICATION] No mobile number for WhatsApp notification.")
            else:
                # Format variables according to booking_temp template:
                # {{1}} = name
                # {{2}} = check-in date (DD-MM-YYYY)
                # {{3}} = check-in time (e.g., "9 AM")
                # {{4}} = check-out date (DD-MM-YYYY)
                # {{5}} = check-out time (e.g., "5 pm")
                # {{6}} = booking reference
                start_date = booking.start_datetime.strftime('%d-%m-%Y')
                start_time = booking.start_datetime.strftime('%I:%M %p').lstrip('0').replace(':00', '').strip()
                if start_time.startswith(' '):
                    start_time = start_time[1:]
                # Convert to lowercase for pm/am
                if 'PM' in start_time:
                    start_time = start_time.replace('PM', 'pm')
                elif 'AM' in start_time:
                    start_time = start_time.replace('AM', 'am')
                
                end_date = booking.end_datetime.strftime('%d-%m-%Y')
                end_time = booking.end_datetime.strftime('%I:%M %p').lstrip('0').replace(':00', '').strip()
                if end_time.startswith(' '):
                    end_time = end_time[1:]
                # Convert to lowercase for pm/am
                if 'PM' in end_time:
                    end_time = end_time.replace('PM', 'pm')
                elif 'AM' in end_time:
                    end_time = end_time.replace('AM', 'am')
                
                variables = [
                    booking_details.get('user_name', ''),  # {{1}} - name
                    start_date,  # {{2}} - check-in date (DD-MM-YYYY)
                    start_time,  # {{3}} - check-in time (e.g., "9 AM")
                    end_date,  # {{4}} - check-out date (DD-MM-YYYY)
                    end_time,  # {{5}} - check-out time (e.g., "5 pm")
                    booking.booking_reference,  # {{6}} - booking reference
                ]
                # Button parameter: website URL for "Visit website" button
                button_params = ["https://lebrq.com/"]
                
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name="booking_temp",
                    language="en",
                    body_parameters=variables,
                    button_parameters=button_params,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile send failed for {to}: {res}")
                else:
                    print(f"[NOTIFICATION] ✓ Booking confirmation WhatsApp sent to {to}")
        
        # Save in-app notification
        await NotificationService._create_in_app_notification(
            user_id=user.id,
            title="Booking Approved! 🎉",
            message=f"Your booking {booking.booking_reference} has been approved.",
            booking_id=booking.id,
            session=session
        )
    
    @staticmethod
    async def send_booking_confirmation_after_payment(
        booking: Booking,
        user: User,
        space: Space,
        venue: Venue,
        session: AsyncSession
    ):
        """Send booking confirmation WhatsApp notification after successful payment using booking_temp template.
        
        Template format:
        {{1}} = name
        {{2}} = check-in date (DD-MM-YYYY)
        {{3}} = check-in time (e.g., "9 AM")
        {{4}} = check-out date (DD-MM-YYYY)
        {{5}} = check-out time (e.g., "5 pm")
        {{6}} = booking reference
        """
        try:
            if not user.mobile:
                print(f"[NOTIFICATION] No mobile number for booking confirmation notification.")
                return
            
            rm_client = RouteMobileWhatsAppClient()
            to = NotificationService._normalize_phone_number(user.mobile or '')
            print(f"[NOTIFICATION] Sending booking confirmation WhatsApp to: {to} for booking {booking.id}")
            
            if not to:
                print(f"[NOTIFICATION] No valid mobile number for WhatsApp notification.")
                return
            
            # Format variables according to booking_temp template
            user_name = f"{user.first_name} {user.last_name}".strip() or user.username or "User"
            
            # Format dates as DD-MM-YYYY
            start_date = booking.start_datetime.strftime('%d-%m-%Y')
            end_date = booking.end_datetime.strftime('%d-%m-%Y')
            
            # Format times (e.g., "9 AM", "5 pm")
            # Format as "HH:MM AM/PM" then clean up
            start_time_str = booking.start_datetime.strftime('%I:%M %p')
            # Remove leading zero from hour and :00 if it's a whole hour
            if ':00' in start_time_str:
                start_time = start_time_str.replace(':00', '').lstrip('0').strip()
            else:
                start_time = start_time_str.lstrip('0').strip()
            if start_time.startswith(':'):
                start_time = start_time[1:]
            # Convert to lowercase for pm/am
            if 'PM' in start_time:
                start_time = start_time.replace('PM', 'pm')
            elif 'AM' in start_time:
                start_time = start_time.replace('AM', 'am')
            
            end_time_str = booking.end_datetime.strftime('%I:%M %p')
            # Remove leading zero from hour and :00 if it's a whole hour
            if ':00' in end_time_str:
                end_time = end_time_str.replace(':00', '').lstrip('0').strip()
            else:
                end_time = end_time_str.lstrip('0').strip()
            if end_time.startswith(':'):
                end_time = end_time[1:]
            # Convert to lowercase for pm/am
            if 'PM' in end_time:
                end_time = end_time.replace('PM', 'pm')
            elif 'AM' in end_time:
                end_time = end_time.replace('AM', 'am')
            
            variables = [
                user_name,  # {{1}} - name
                start_date,  # {{2}} - check-in date (DD-MM-YYYY)
                start_time,  # {{3}} - check-in time (e.g., "9 AM")
                end_date,  # {{4}} - check-out date (DD-MM-YYYY)
                end_time,  # {{5}} - check-out time (e.g., "5 pm")
                booking.booking_reference,  # {{6}} - booking reference
            ]
            
            # Button parameter: website URL for "Visit website" button
            button_params = ["https://lebrq.com/"]
            
            res = await rm_client.send_template(
                to_mobile=to,
                template_name="booking_temp",
                language="en",
                body_parameters=variables,
                button_parameters=button_params,
            )
            
            if res.get('ok'):
                print(f"[NOTIFICATION] ✓ Booking confirmation WhatsApp sent to {to} after payment")
            else:
                print(f"[NOTIFICATION] ✗ Booking confirmation WhatsApp failed for {to}: {res}")
                
        except Exception as e:
            print(f"[NOTIFICATION] Error sending booking confirmation after payment: {e}")
    
    @staticmethod
    async def send_vendor_notifications_after_payment(
        booking: Booking,
        space: Space,
        venue: Venue,
        session: AsyncSession
    ):
        """Send vendor notifications after successful payment.
        
        Groups booking items by vendor and sends separate notifications to each vendor.
        Items without vendors are sent to admin.
        
        Template format (vendor):
        {{1}} = Vendor name
        {{2}} = Delivery Date (e.g., "june -10-2025")
        {{3}} = Delivery Time (e.g., "10 am")
        {{4}} = Delivery Location (e.g., "LeBRQ Banquet Hall, Kochi")
        {{5}} = Items list (formatted string)
        {{6}} = Total Amount (e.g., "₹35,000")
        """
        try:
            from collections import defaultdict
            from sqlalchemy import select
            
            # Fetch all booking items with their items and vendor info
            stmt = select(BookingItem, Item, VendorProfile, User).outerjoin(
                Item, BookingItem.item_id == Item.id
            ).outerjoin(
                VendorProfile, BookingItem.vendor_id == VendorProfile.id
            ).outerjoin(
                User, VendorProfile.user_id == User.id
            ).where(BookingItem.booking_id == booking.id)
            
            rs = await session.execute(stmt)
            rows = rs.all()
            
            if not rows:
                print(f"[NOTIFICATION] No booking items found for booking {booking.id}")
                return
            
            # Group items by vendor_id (None for items without vendor)
            vendor_items_map: dict[Optional[int], list[tuple[BookingItem, Item, Optional[VendorProfile], Optional[User]]]] = defaultdict(list)
            
            for bi, item, vp, vendor_user in rows:
                vendor_id = bi.vendor_id if bi.vendor_id else None
                vendor_items_map[vendor_id].append((bi, item, vp, vendor_user))
            
            # Format delivery date and time
            # Format: "june -10-2025" (month name lowercase, space-dash, day, dash, year)
            month_day_year = booking.start_datetime.strftime('%B-%d-%Y').lower()
            # Replace first dash with space-dash: "june-10-2025" -> "june -10-2025"
            delivery_date = month_day_year.replace('-', ' -', 1)  # "june -10-2025"
            # Format: "10 am" (hour without leading zero, lowercase am/pm)
            delivery_time = booking.start_datetime.strftime('%I %p').lstrip('0').strip().lower()  # "10 am"
            if delivery_time.startswith(' '):
                delivery_time = delivery_time[1:]
            
            # Format delivery location
            delivery_location = f"{space.name}, {venue.city or venue.name or 'Location'}"
            
            # Send notifications to each vendor
            for vendor_id, items_list in vendor_items_map.items():
                if not items_list:
                    continue
                
                # Format items list
                items_lines = []
                total_amount = 0.0
                item_num = 1
                
                for bi, item, vp, vendor_user in items_list:
                    item_name = item.name if item else f"Item {bi.id}"
                    quantity = bi.quantity
                    category = getattr(item, 'category', 'Standard') if item else 'Standard'
                    unit_price = float(bi.unit_price or 0)
                    item_total = float(bi.total_price or (unit_price * quantity))
                    total_amount += item_total
                    
                    # Format: "1. Flower Decoration – 10 sets – Premium – ₹2,000 – ₹20,000"
                    items_lines.append(
                        f"{item_num}. {item_name} – {quantity} sets – {category} – ₹{int(unit_price):,} – ₹{int(item_total):,}"
                    )
                    item_num += 1
                
                # Join items with space separator (as per template example)
                items_text = " ".join(items_lines)
                total_amount_str = f"₹{int(total_amount):,}"
                
                if vendor_id:
                    # Send to vendor
                    vendor_user = items_list[0][3]  # Get vendor user from first item
                    vp = items_list[0][2]  # Get vendor profile
                    
                    if not vendor_user:
                        print(f"[NOTIFICATION] Vendor user not found for vendor_id {vendor_id}")
                        continue
                    
                    vendor_name = f"{vendor_user.first_name} {vendor_user.last_name}".strip() or vendor_user.username or "Vendor"
                    vendor_mobile = vendor_user.mobile
                    vendor_email = vp.contact_email if vp and vp.contact_email else vendor_user.username
                    
                    # Send WhatsApp
                    if vendor_mobile:
                        try:
                            rm_client = RouteMobileWhatsAppClient()
                            to = NotificationService._normalize_phone_number(vendor_mobile)
                            if to:
                                variables = [
                                    vendor_name,  # {{1}}
                                    delivery_date,  # {{2}}
                                    delivery_time,  # {{3}}
                                    delivery_location,  # {{4}}
                                    items_text,  # {{5}}
                                    total_amount_str,  # {{6}}
                                ]
                                
                                res = await rm_client.send_template(
                                    to_mobile=to,
                                    template_name="vendor",
                                    language="en",
                                    body_parameters=variables,
                                )
                                
                                if res.get('ok'):
                                    print(f"[NOTIFICATION] ✓ Vendor WhatsApp sent to {vendor_name} ({to})")
                                else:
                                    print(f"[NOTIFICATION] ✗ Vendor WhatsApp failed for {vendor_name}: {res}")
                        except Exception as wa_error:
                            print(f"[NOTIFICATION] Vendor WhatsApp error: {wa_error}")
                    
                    # Send Email
                    if vendor_email:
                        try:
                            await NotificationService._send_vendor_delivery_email(
                                vendor_email=vendor_email,
                                vendor_name=vendor_name,
                                delivery_date=delivery_date,
                                delivery_time=delivery_time,
                                delivery_location=delivery_location,
                                items_text=items_text,
                                total_amount=total_amount_str,
                                booking_reference=booking.booking_reference
                            )
                            print(f"[NOTIFICATION] ✓ Vendor email sent to {vendor_email}")
                        except Exception as email_error:
                            print(f"[NOTIFICATION] Vendor email error: {email_error}")
                else:
                    # Send to admin (items without vendor)
                    try:
                        # Get first admin user
                        admin_stmt = select(User).where(User.role == 'admin').limit(1)
                        admin_rs = await session.execute(admin_stmt)
                        admin_user = admin_rs.scalar_one_or_none()
                        
                        if admin_user:
                            admin_name = f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.username or "Admin"
                            admin_mobile = admin_user.mobile
                            admin_email = admin_user.username
                            
                            # Send WhatsApp to admin
                            if admin_mobile:
                                try:
                                    rm_client = RouteMobileWhatsAppClient()
                                    to = NotificationService._normalize_phone_number(admin_mobile)
                                    if to:
                                        variables = [
                                            admin_name,  # {{1}}
                                            delivery_date,  # {{2}}
                                            delivery_time,  # {{3}}
                                            delivery_location,  # {{4}}
                                            items_text,  # {{5}}
                                            total_amount_str,  # {{6}}
                                        ]
                                        
                                        res = await rm_client.send_template(
                                            to_mobile=to,
                                            template_name="vendor",
                                            language="en",
                                            body_parameters=variables,
                                        )
                                        
                                        if res.get('ok'):
                                            print(f"[NOTIFICATION] ✓ Admin WhatsApp sent for unassigned items ({to})")
                                        else:
                                            print(f"[NOTIFICATION] ✗ Admin WhatsApp failed: {res}")
                                except Exception as wa_error:
                                    print(f"[NOTIFICATION] Admin WhatsApp error: {wa_error}")
                            
                            # Send Email to admin
                            if admin_email:
                                try:
                                    await NotificationService._send_vendor_delivery_email(
                                        vendor_email=admin_email,
                                        vendor_name=admin_name,
                                        delivery_date=delivery_date,
                                        delivery_time=delivery_time,
                                        delivery_location=delivery_location,
                                        items_text=items_text,
                                        total_amount=total_amount_str,
                                        booking_reference=booking.booking_reference,
                                        is_admin=True
                                    )
                                    print(f"[NOTIFICATION] ✓ Admin email sent for unassigned items to {admin_email}")
                                except Exception as email_error:
                                    print(f"[NOTIFICATION] Admin email error: {email_error}")
                        else:
                            print(f"[NOTIFICATION] No admin user found to notify for unassigned items")
                    except Exception as admin_error:
                        print(f"[NOTIFICATION] Error sending admin notification: {admin_error}")
                        
        except Exception as e:
            print(f"[NOTIFICATION] Error sending vendor notifications after payment: {e}")
    
    @staticmethod
    async def _send_vendor_delivery_email(
        vendor_email: str,
        vendor_name: str,
        delivery_date: str,
        delivery_time: str,
        delivery_location: str,
        items_text: str,
        total_amount: str,
        booking_reference: str,
        is_admin: bool = False
    ):
        """Send delivery notification email to vendor or admin"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send vendor delivery email to {vendor_email}")
                return
            
            recipient_type = "Admin" if is_admin else "Vendor"
            subject = f"Delivery Request - Booking {booking_reference}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Delivery Request - LeBRQ</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f7f9f8;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f8; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #2D5016 0%, #3d6b1f 100%); padding: 40px 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Delivery Request</h1>
                                        <p style="color: #e6f7e6; margin: 8px 0 0 0; font-size: 14px;">Booking Reference: {booking_reference}</p>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Dear <strong>{vendor_name}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">
                                            Please deliver the following items:
                                        </p>
                                        
                                        <!-- Delivery Details Card -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; margin: 0 0 30px 0;">
                                            <tr>
                                                <td style="padding: 25px;">
                                                    <table width="100%" cellpadding="8" cellspacing="0">
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; width: 160px; vertical-align: top;">
                                                                <strong>Delivery Date:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; font-weight: 600;">
                                                                {delivery_date}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Delivery Time:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {delivery_time}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Delivery Location:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {delivery_location}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Items List -->
                                        <div style="background-color: #f9fafb; border-left: 4px solid #2D5016; padding: 20px; border-radius: 6px; margin: 0 0 30px 0;">
                                            <h3 style="color: #2D5016; margin: 0 0 15px 0; font-size: 18px; font-weight: 700;">Items:</h3>
                                            <p style="color: #1f2937; font-size: 14px; line-height: 1.8; margin: 0; white-space: pre-line;">{items_text}</p>
                                        </div>
                                        
                                        <!-- Total Amount -->
                                        <div style="background-color: #d1fae5; border: 2px solid #10B981; border-radius: 10px; padding: 20px; margin: 0 0 30px 0;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="color: #065f46; font-size: 18px; font-weight: 700;">
                                                        Total Amount:
                                                    </td>
                                                    <td align="right" style="color: #065f46; font-size: 24px; font-weight: 700;">
                                                        {total_amount}
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                                            Kindly confirm delivery schedule.
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 15px; margin: 20px 0 0 0;">
                                            Best regards,<br>
                                            <strong>Team LeBRQ</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                                        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                                            <strong style="color: #2D5016;">LeBRQ Events & Venues</strong><br>
                                            This is an automated message. Please confirm delivery schedule.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            await NotificationService._send_email(vendor_email, subject, html_content)
            
        except Exception as e:
            print(f"[NOTIFICATION] Error sending vendor delivery email: {e}")
    
    @staticmethod
    async def send_class_booking_confirmation(
        booking: Booking,
        user: User,
        space: Space,
        venue: Venue,
        session: AsyncSession
    ):
        """Send class booking confirmation (yoga/zumba) after successful payment.
        
        Template format (lebrq_class_confirmed):
        {{1}} = User name (e.g., "Sruthi")
        {{2}} = Class type (e.g., "zumba fitness class")
        {{3}} = Date (e.g., "june 25, 2025")
        {{4}} = Time (e.g., "7.00 AM- 8.00 AM")
        {{5}} = Venue (e.g., "LeBRQ")
        {{6}} = Instructor (e.g., "Priya Menon")
        {{7}} = Booking ID/Entry Pass (e.g., "ZB2215")
        """
        try:
            from app.models import ProgramParticipant
            
            # Check if this booking is for a class (yoga/zumba)
            rs_participant = await session.execute(
                select(ProgramParticipant).where(
                    ProgramParticipant.booking_id == booking.id,
                    ProgramParticipant.program_type.in_(['yoga', 'zumba'])
                ).limit(1)
            )
            participant = rs_participant.scalar_one_or_none()
            
            if not participant:
                # Not a class booking, skip
                return
            
            program_type = participant.program_type.lower()  # 'yoga' or 'zumba'
            
            # Format user name
            user_name = f"{user.first_name} {user.last_name}".strip() or user.username or "User"
            
            # Format class type
            class_type_map = {
                'yoga': 'yoga fitness class',
                'zumba': 'zumba fitness class'
            }
            class_type = class_type_map.get(program_type, f"{program_type} fitness class")
            
            # Format date: "june 25, 2025"
            booking_date = booking.start_datetime.strftime('%B %d, %Y').lower()  # "june 25, 2025"
            # Capitalize first letter
            booking_date = booking_date[0].upper() + booking_date[1:] if booking_date else booking_date
            
            # Format time: "7.00 AM- 8.00 AM"
            start_time = booking.start_datetime.strftime('%I.%M %p').lstrip('0').strip()  # "7.00 AM"
            end_time = booking.end_datetime.strftime('%I.%M %p').lstrip('0').strip()  # "8.00 AM"
            if start_time.startswith('.'):
                start_time = '0' + start_time
            if end_time.startswith('.'):
                end_time = '0' + end_time
            time_range = f"{start_time}- {end_time}"  # "7.00 AM- 8.00 AM"
            
            # Venue name
            venue_name = venue.name or "LeBRQ"
            
            # Instructor name - try to get from customer_note, admin_note, or use default
            instructor = "Instructor"
            if booking.customer_note:
                # Try to extract instructor from note (format: "Instructor: Name" or similar)
                note_lower = booking.customer_note.lower()
                if 'instructor' in note_lower or 'trainer' in note_lower:
                    # Try to find name after instructor/trainer keyword
                    import re
                    match = re.search(r'(?:instructor|trainer)[:\s]+([A-Za-z\s]+)', booking.customer_note, re.IGNORECASE)
                    if match:
                        instructor = match.group(1).strip()
                    else:
                        # Use first part of note as instructor if it looks like a name
                        parts = booking.customer_note.split(',')
                        if len(parts) > 0 and len(parts[0].strip().split()) <= 3:
                            instructor = parts[0].strip()
            elif booking.admin_note:
                # Similar logic for admin_note
                import re
                match = re.search(r'(?:instructor|trainer)[:\s]+([A-Za-z\s]+)', booking.admin_note, re.IGNORECASE)
                if match:
                    instructor = match.group(1).strip()
            
            # Generate Entry Pass ID from booking reference
            # Example: "BK-ABC123DEF4" -> "ZB2215" (first 2 letters of program type + last 4 digits)
            entry_pass = booking.booking_reference
            if len(entry_pass) >= 4:
                # Use program type prefix + last 4 alphanumeric chars
                prefix = program_type[:2].upper()  # "YO" or "ZU"
                # Extract last 4 alphanumeric characters
                alphanumeric = ''.join(c for c in entry_pass if c.isalnum())
                if len(alphanumeric) >= 4:
                    entry_pass = prefix + alphanumeric[-4:].upper()
                else:
                    entry_pass = prefix + entry_pass[-4:].upper()
            else:
                # Fallback: use program type + booking ID
                entry_pass = f"{program_type[:2].upper()}{booking.id:04d}"
            
            # Send WhatsApp
            if user.mobile:
                try:
                    rm_client = RouteMobileWhatsAppClient()
                    to = NotificationService._normalize_phone_number(user.mobile)
                    if to:
                        variables = [
                            user_name,  # {{1}}
                            class_type,  # {{2}}
                            booking_date,  # {{3}}
                            time_range,  # {{4}}
                            venue_name,  # {{5}}
                            instructor,  # {{6}}
                            entry_pass,  # {{7}}
                        ]
                        
                        res = await rm_client.send_template(
                            to_mobile=to,
                            template_name="lebrq_class_confirmed",
                            language="en",
                            body_parameters=variables,
                        )
                        
                        if res.get('ok'):
                            print(f"[NOTIFICATION] ✓ Class booking WhatsApp sent to {user_name} ({to})")
                        else:
                            print(f"[NOTIFICATION] ✗ Class booking WhatsApp failed for {user_name}: {res}")
                except Exception as wa_error:
                    print(f"[NOTIFICATION] Class booking WhatsApp error: {wa_error}")
            
            # Send Email
            if user.username:
                try:
                    await NotificationService._send_class_booking_email(
                        user_email=user.username,
                        user_name=user_name,
                        class_type=class_type,
                        booking_date=booking_date,
                        time_range=time_range,
                        venue_name=venue_name,
                        instructor=instructor,
                        entry_pass=entry_pass,
                        booking_reference=booking.booking_reference
                    )
                    print(f"[NOTIFICATION] ✓ Class booking email sent to {user.username}")
                except Exception as email_error:
                    print(f"[NOTIFICATION] Class booking email error: {email_error}")
                    
        except Exception as e:
            print(f"[NOTIFICATION] Error sending class booking confirmation: {e}")
    
    @staticmethod
    async def _send_class_booking_email(
        user_email: str,
        user_name: str,
        class_type: str,
        booking_date: str,
        time_range: str,
        venue_name: str,
        instructor: str,
        entry_pass: str,
        booking_reference: str
    ):
        """Send class booking confirmation email"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send class booking email to {user_email}")
                return
            
            subject = f"Class Booking Confirmed - {booking_reference}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Class Booking Confirmed - LeBRQ</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f7f9f8;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f8; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #2D5016 0%, #3d6b1f 100%); padding: 40px 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Class Booking Confirmed</h1>
                                        <p style="color: #e6f7e6; margin: 8px 0 0 0; font-size: 14px;">Booking Reference: {booking_reference}</p>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Dear <strong>{user_name}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">
                                            your booking for <strong>{class_type}</strong> at LeBRQ has been confirmed.
                                        </p>
                                        
                                        <!-- Booking Details Card -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; margin: 0 0 30px 0;">
                                            <tr>
                                                <td style="padding: 25px;">
                                                    <table width="100%" cellpadding="8" cellspacing="0">
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; width: 160px; vertical-align: top;">
                                                                <strong>Date:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; font-weight: 600;">
                                                                {booking_date}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Time:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {time_range}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Venue:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {venue_name}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Instructor:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {instructor}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Entry Pass -->
                                        <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin: 0 0 30px 0; text-align: center;">
                                            <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                                                Booking ID (Entry Pass):
                                            </p>
                                            <p style="color: #1e40af; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 2px;">
                                                {entry_pass}
                                            </p>
                                            <p style="color: #1e40af; font-size: 13px; margin: 12px 0 0 0;">
                                                Please show this Booking ID at the entrance.
                                            </p>
                                        </div>
                                        
                                        <p style="color: #1f2937; font-size: 15px; margin: 20px 0 0 0;">
                                            Best regards,<br>
                                            <strong>Team LeBRQ</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                                        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                                            <strong style="color: #2D5016;">LeBRQ Events & Venues</strong><br>
                                            This is an automated confirmation message.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            await NotificationService._send_email(user_email, subject, html_content)
            
        except Exception as e:
            print(f"[NOTIFICATION] Error sending class booking email: {e}")
    
    @staticmethod
    async def send_live_show_booking_confirmation(
        booking: Booking,
        user: User,
        space: Space,
        venue: Venue,
        session: AsyncSession
    ):
        """Send live show booking confirmation after successful payment.
        
        Template format (live_show_booking):
        {{1}} = User name (e.g., "Krishna")
        {{2}} = Show Name (e.g., "Rhythm of Lights – Music Fest")
        {{3}} = Show Date (e.g., "June 30, 2025")
        {{4}} = Entry Time (e.g., "10 AM")
        {{5}} = Number of Tickets (e.g., "2")
        {{6}} = Price per Ticket (e.g., "₹750")
        {{7}} = Total Amount (e.g., "₹1500")
        {{8}} = Booking ID/Entry Pass (e.g., "LS894")
        """
        try:
            from app.models import ProgramParticipant
            
            # Check if this booking is for a live show
            rs_participant = await session.execute(
                select(ProgramParticipant).where(
                    ProgramParticipant.booking_id == booking.id,
                    ProgramParticipant.program_type == 'live'
                ).limit(1)
            )
            participant = rs_participant.scalar_one_or_none()
            
            if not participant:
                # Not a live show booking, skip
                return
            
            # Format user name
            user_name = f"{user.first_name} {user.last_name}".strip() or user.username or "User"
            
            # Show name from event_type or booking reference
            show_name = booking.event_type or "Live Show"
            if not show_name or show_name.strip() == "":
                show_name = "Live Show"
            
            # Format date: "June 30, 2025"
            show_date = booking.start_datetime.strftime('%B %d, %Y')  # "June 30, 2025"
            
            # Format entry time: "10 AM"
            entry_time = booking.start_datetime.strftime('%I %p').lstrip('0').strip()  # "10 AM"
            if entry_time.startswith(' '):
                entry_time = entry_time[1:]
            
            # Number of tickets
            ticket_quantity = participant.ticket_quantity or 1
            num_tickets = str(ticket_quantity)
            
            # Calculate price per ticket
            total_amount = float(booking.total_amount or 0)
            price_per_ticket = total_amount / ticket_quantity if ticket_quantity > 0 else total_amount
            price_per_ticket_str = f"₹{int(price_per_ticket):,}"
            
            # Total amount
            total_amount_str = f"₹{int(total_amount):,}"
            
            # Generate Entry Pass ID from booking reference
            # Example: "BK-ABC123DEF4" -> "LS894" (LS prefix + last 3 digits)
            entry_pass = booking.booking_reference
            # Extract digits from booking reference
            digits = ''.join(c for c in entry_pass if c.isdigit())
            if len(digits) >= 3:
                # Use "LS" prefix + last 3 digits
                entry_pass = "LS" + digits[-3:]
            else:
                # Fallback: use "LS" + booking ID (last 3 digits)
                booking_id_str = str(booking.id)
                if len(booking_id_str) >= 3:
                    entry_pass = "LS" + booking_id_str[-3:]
                else:
                    entry_pass = f"LS{booking.id:03d}"
            
            # Send WhatsApp
            if user.mobile:
                try:
                    rm_client = RouteMobileWhatsAppClient()
                    to = NotificationService._normalize_phone_number(user.mobile)
                    if to:
                        variables = [
                            user_name,  # {{1}}
                            show_name,  # {{2}}
                            show_date,  # {{3}}
                            entry_time,  # {{4}}
                            num_tickets,  # {{5}}
                            price_per_ticket_str,  # {{6}}
                            total_amount_str,  # {{7}}
                            entry_pass,  # {{8}}
                        ]
                        
                        res = await rm_client.send_template(
                            to_mobile=to,
                            template_name="live_show_booking",
                            language="en",
                            body_parameters=variables,
                        )
                        
                        if res.get('ok'):
                            print(f"[NOTIFICATION] ✓ Live show booking WhatsApp sent to {user_name} ({to})")
                        else:
                            print(f"[NOTIFICATION] ✗ Live show booking WhatsApp failed for {user_name}: {res}")
                except Exception as wa_error:
                    print(f"[NOTIFICATION] Live show booking WhatsApp error: {wa_error}")
            
            # Send Email
            if user.username:
                try:
                    await NotificationService._send_live_show_booking_email(
                        user_email=user.username,
                        user_name=user_name,
                        show_name=show_name,
                        show_date=show_date,
                        entry_time=entry_time,
                        num_tickets=num_tickets,
                        price_per_ticket=price_per_ticket_str,
                        total_amount=total_amount_str,
                        entry_pass=entry_pass,
                        booking_reference=booking.booking_reference
                    )
                    print(f"[NOTIFICATION] ✓ Live show booking email sent to {user.username}")
                except Exception as email_error:
                    print(f"[NOTIFICATION] Live show booking email error: {email_error}")
                    
        except Exception as e:
            print(f"[NOTIFICATION] Error sending live show booking confirmation: {e}")
    
    @staticmethod
    async def _send_live_show_booking_email(
        user_email: str,
        user_name: str,
        show_name: str,
        show_date: str,
        entry_time: str,
        num_tickets: str,
        price_per_ticket: str,
        total_amount: str,
        entry_pass: str,
        booking_reference: str
    ):
        """Send live show booking confirmation email"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send live show booking email to {user_email}")
                return
            
            subject = f"Live Show Ticket Confirmed - {booking_reference}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Live Show Ticket Confirmed - LeBRQ</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f7f9f8;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f8; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #2D5016 0%, #3d6b1f 100%); padding: 40px 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Live Show Ticket Confirmed</h1>
                                        <p style="color: #e6f7e6; margin: 8px 0 0 0; font-size: 14px;">Booking Reference: {booking_reference}</p>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Dear <strong>{user_name}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">
                                            Thank you for booking with LeBRQ! Your live show ticket has been confirmed.
                                        </p>
                                        
                                        <!-- Show Details Card -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; margin: 0 0 30px 0;">
                                            <tr>
                                                <td style="padding: 25px;">
                                                    <table width="100%" cellpadding="8" cellspacing="0">
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; width: 180px; vertical-align: top;">
                                                                <strong>Show Name:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; font-weight: 600;">
                                                                {show_name}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Show Date:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {show_date}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Entry Time:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {entry_time}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Number of Tickets:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {num_tickets}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Price per Ticket:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {price_per_ticket}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Total Amount:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px; font-weight: 600;">
                                                                {total_amount}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Entry Pass -->
                                        <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin: 0 0 30px 0; text-align: center;">
                                            <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                                                Booking ID (Entry Pass):
                                            </p>
                                            <p style="color: #1e40af; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 2px;">
                                                {entry_pass}
                                            </p>
                                            <p style="color: #1e40af; font-size: 13px; margin: 12px 0 0 0;">
                                                Please bring your Booking ID or show this email at entry.
                                            </p>
                                        </div>
                                        
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                                            We look forward to seeing you at the event!
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 15px; margin: 20px 0 0 0;">
                                            Best regards,<br>
                                            <strong>Team LeBRQ</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                                        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                                            <strong style="color: #2D5016;">LeBRQ Events & Venues</strong><br>
                                            This is an automated confirmation message.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            await NotificationService._send_email(user_email, subject, html_content)
            
        except Exception as e:
            print(f"[NOTIFICATION] Error sending live show booking email: {e}")
    
    @staticmethod
    async def send_booking_rejected_notification(
        booking: Booking,
        user: User,
        space: Space,
        venue: Venue,
        session: AsyncSession
    ):
        """Send notification when booking is rejected"""
        
        booking_details = {
            'booking_reference': booking.booking_reference,
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'venue_name': venue.name,
            'space_name': space.name,
            'start_datetime': booking.start_datetime.strftime('%B %d, %Y at %I:%M %p'),
            'admin_note': booking.admin_note or 'No reason provided',
        }
        
        # Send Email
        if user.username:
            await NotificationService._send_rejection_email(user.username, booking_details)
        
        # Send SMS
        if user.mobile and settings.TWILIO_ACCOUNT_SID:
            await NotificationService._send_rejection_sms(user.mobile, booking_details)
        
        # Send WhatsApp (Route Mobile preferred; Twilio fallback handled inside)
        if user.mobile:
            print(f"[NOTIFICATION] Sending rejection WhatsApp to user mobile: {user.mobile}")
            await NotificationService._send_rejection_whatsapp(user.mobile, booking_details)
        else:
            print(f"[NOTIFICATION] ⚠️  User {booking_details.get('user_name', 'Unknown')} has no mobile number - cannot send WhatsApp rejection notification")
        
        # Save in-app notification
        await NotificationService._create_in_app_notification(
            user_id=user.id,
            title="Booking Update",
            message=f"Your booking {booking.booking_reference} was not approved. {booking.admin_note or ''}",
            booking_id=booking.id,
            session=session
        )
    
    @staticmethod
    async def send_live_show_vendor_whatsapp(
        vendor_mobile: str,
        vendor_name: str,
        delivery_date: str,
        delivery_time: str,
        delivery_location: str,
        items_list: str,  # Formatted items string
        total_amount: str,
    ) -> None:
        """
        Send live show booking WhatsApp notification to vendor using the live_show_booking template.
        
        Template parameters:
        {{1}} - Vendor name
        {{2}} - Delivery date
        {{3}} - Delivery time
        {{4}} - Delivery location
        {{5}} - Items list (formatted)
        {{6}} - Total amount
        """
        try:
            rm_client = RouteMobileWhatsAppClient()
            if not rm_client.is_configured():
                print(f"[NOTIFICATION] Route Mobile not configured. Would send live show booking to {vendor_mobile}")
                return
            
            # Normalize mobile number
            to = NotificationService._normalize_phone_number(vendor_mobile or '')
            print(f"[NOTIFICATION] Sending live show WhatsApp to: {to} (formatted from: {vendor_mobile})")
            
            # Prepare template parameters
            variables = [
                vendor_name,
                delivery_date,
                delivery_time,
                delivery_location,
                items_list,
                total_amount,
            ]
            
            # Send template
            res = await rm_client.send_template(
                to_mobile=to,
                template_name=settings.ROUTEMOBILE_TEMPLATE_LIVE_SHOW,
                language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE,
                body_parameters=variables,
            )
            
            if res.get("ok"):
                print(f"[NOTIFICATION] ✓ Live show booking WhatsApp sent to vendor {vendor_mobile}")
            else:
                print(f"[NOTIFICATION] ✗ Live show booking WhatsApp failed for {vendor_mobile}: {res}")
                
        except Exception as e:
            print(f"[NOTIFICATION] Live show WhatsApp error: {e}")
    
    @staticmethod
    async def send_vendor_item_confirmation_email(
        vendor_email: str,
        details: dict,
    ):
        """Send an email to vendor informing that an item is confirmed/required for an event.

        details should include: booking_reference, venue_name, space_name, event_type,
        event_date, item_name, quantity, unit_price, total_price, contact fields optional.
        """
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would notify vendor {vendor_email} about confirmed item: {details}")
                return

            subject = f"Item Required - {details.get('booking_reference', '')}"

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; background:#f7f9f8;">
                <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
                    <div style="background:#2D5016;color:#fff;padding:16px 20px;font-weight:700">LeBrq Vendor Notification</div>
                    <div style="padding:20px">
                        <h2 style="margin:0 0 12px 0;color:#111827">Confirmed Item Required</h2>
                        <p style="margin:0 0 16px 0;color:#374151">Please prepare the following item for the event.</p>
                        <table width="100%" cellpadding="6" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
                            <tr><td style="color:#6b7280;width:160px">Booking Ref</td><td style="color:#111827;font-weight:600">{details.get('booking_reference','')}</td></tr>
                            <tr><td style="color:#6b7280;">Event Date</td><td style="color:#111827;">{details.get('event_date','')}</td></tr>
                            <tr><td style="color:#6b7280;">Event Type</td><td style="color:#111827;">{details.get('event_type','')}</td></tr>
                            <tr><td style="color:#6b7280;">Venue</td><td style="color:#111827;">{details.get('venue_name','')}</td></tr>
                            <tr><td style="color:#6b7280;">Space</td><td style="color:#111827;">{details.get('space_name','')}</td></tr>
                        </table>
                        <div style="height:12px"></div>
                        <table width="100%" cellpadding="6" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
                            <tr><td style="color:#6b7280;width:160px">Item</td><td style="color:#111827;font-weight:600">{details.get('item_name','')}</td></tr>
                            <tr><td style="color:#6b7280;">Quantity</td><td style="color:#111827;">{details.get('quantity','')}</td></tr>
                            <tr><td style="color:#6b7280;">Unit Price</td><td style="color:#111827;">₹{details.get('unit_price','')}</td></tr>
                            <tr><td style="color:#6b7280;">Total</td><td style="color:#111827;font-weight:700">₹{details.get('total_price','')}</td></tr>
                        </table>
                    </div>
                </div>
            </body>
            </html>
            """

            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = vendor_email
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [vendor_email], msg.as_string())
        except Exception as e:
            print(f"[NOTIFICATION] Vendor email error: {e}")

    @staticmethod
    async def send_vendor_invitation_email(to_email: str, username: str, temp_password: str):
        """Send login credentials to a newly created vendor user."""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send vendor invite to {to_email} with username={username}")
                return

            subject = "Your LeBrq Vendor Account"
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; background:#f7f9f8;">
                <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
                    <div style="background:#2D5016;color:#fff;padding:16px 20px;font-weight:700">Welcome to LeBrq Vendors</div>
                    <div style="padding:20px">
                        <p style="color:#111827;margin:0 0 12px 0;">Hello,</p>
                        <p style="color:#374151;margin:0 0 16px 0;">Your vendor account has been created. Use the credentials below to sign in:</p>
                        <table width="100%" cellpadding="6" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
                            <tr><td style="color:#6b7280;width:160px">Username</td><td style="color:#111827;font-weight:600">{username}</td></tr>
                            <tr><td style="color:#6b7280;">Temporary Password</td><td style="color:#111827;">{temp_password}</td></tr>
                        </table>
                        <p style="color:#374151;margin:16px 0 0 0;">For security, please change your password after logging in.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = to_email
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        except Exception as e:
            print(f"[NOTIFICATION] Vendor invite email error: {e}")

    # ==================== EMAIL ====================
    
    @staticmethod
    async def _send_approval_email(email: str, details: dict):
        """Send approval email"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send approval to {email}")
                return
            
            subject = f"Booking Approved - {details['booking_reference']}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Booking Approved - LeBrq</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9f8;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f8; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden;">
                                
                                <!-- Header with Brand -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #2D5016 0%, #3d6b1f 100%); padding: 40px 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                                            LeBrq Events & Venues
                                        </h1>
                                        <p style="color: #e6f7e6; margin: 8px 0 0 0; font-size: 14px; letter-spacing: 0.5px;">
                                            YOUR EVENT, PERFECTLY PLANNED
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Success Badge -->
                                <tr>
                                    <td style="padding: 30px 30px 20px 30px; text-align: center;">
                                        <div style="display: inline-block; background-color: #d1fae5; border-radius: 50px; padding: 12px 24px;">
                                            <span style="color: #065f46; font-size: 16px; font-weight: 600;">
                                                ✓ BOOKING APPROVED
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 0 40px 30px 40px;">
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Dear <strong>{details['user_name']}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">
                                            Great news! We're delighted to confirm that your booking request has been approved. 
                                            Your event space is now reserved and ready for your special occasion.
                                        </p>
                                        
                                        <!-- Booking Details Card -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; margin: 0 0 30px 0;">
                                            <tr>
                                                <td style="padding: 25px;">
                                                    <h2 style="color: #2D5016; margin: 0 0 20px 0; font-size: 18px; font-weight: 700;">
                                                        📋 Booking Details
                                                    </h2>
                                                    
                                                    <table width="100%" cellpadding="8" cellspacing="0">
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; width: 140px; vertical-align: top;">
                                                                <strong>Reference No:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; font-weight: 600;">
                                                                {details['booking_reference']}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Event Type:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {details['event_type']}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Venue:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {details['venue_name']}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Space:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {details['space_name']}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>Start Date & Time:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {details['start_datetime']}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">
                                                                <strong>End Date & Time:</strong>
                                                            </td>
                                                            <td style="color: #1f2937; font-size: 14px; padding-top: 12px;">
                                                                {details['end_datetime']}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    
                                                    <!-- Total Amount -->
                                                    <div style="margin-top: 20px; padding-top: 20px; border-top: 2px dashed #d1d5db;">
                                                        <table width="100%" cellpadding="0" cellspacing="0">
                                                            <tr>
                                                                <td style="color: #2D5016; font-size: 16px; font-weight: 700;">
                                                                    Total Amount:
                                                                </td>
                                                                <td align="right" style="color: #2D5016; font-size: 20px; font-weight: 700;">
                                                                    {details['total_amount']}
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Next Steps -->
                                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 6px; margin: 0 0 30px 0;">
                                            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                                <strong>⚡ Next Steps:</strong><br>
                                                Please complete your payment to confirm the booking. If you have already made the payment, you can disregard this message.
                                            </p>
                                        </div>
                                        
                                        <!-- Call to Action Button -->
                                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                            <tr>
                                                <td align="center">
                                                    <a href="http://localhost:19006/" style="display: inline-block; background-color: #2D5016; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(45,80,22,0.2);">
                                                        View My Bookings
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="color: #4b5563; font-size: 14px; line-height: 1.7; margin: 0;">
                                            We look forward to hosting your event. If you have any questions or need assistance, 
                                            please don't hesitate to contact us.
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 15px; margin: 20px 0 0 0;">
                                            Best regards,<br>
                                            <strong>The LeBrq Team</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 12px 0;">
                                                        <strong style="color: #2D5016;">LeBrq Events & Venues</strong><br>
                                                        Kasaragod, Kerala, India
                                                    </p>
                                                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                                                        This is an automated message. Please do not reply to this email.<br>
                                                        For support, contact us through our app or website.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            await NotificationService._send_email(email, subject, html_content)
            print(f"[NOTIFICATION] Approval email sent to {email}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send approval email: {e}")
    
    @staticmethod
    async def _send_rejection_email(email: str, details: dict):
        """Send rejection email"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send rejection to {email}")
                return
            
            subject = f"Booking Update - {details['booking_reference']}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7f9f8;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h1 style="color: #2D5016; margin-bottom: 20px;">Booking Update</h1>
                    
                    <p>Dear {details['user_name']},</p>
                    
                    <p>We regret to inform you that your booking could not be approved at this time.</p>
                    
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                        <h3 style="color: #991b1b; margin-top: 0;">Booking Details:</h3>
                        <p><strong>Reference:</strong> {details['booking_reference']}</p>
                        <p><strong>Venue:</strong> {details['venue_name']}</p>
                        <p><strong>Space:</strong> {details['space_name']}</p>
                        <p><strong>Date:</strong> {details['start_datetime']}</p>
                        <p><strong>Reason:</strong> {details['admin_note']}</p>
                    </div>
                    
                    <p>Please feel free to book another time slot or contact us for assistance.</p>
                    
                    <p>Thank you for your understanding.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e6e8ea; margin: 20px 0;">
                    <p style="color: #667085; font-size: 12px;">LeBrq Events & Venues<br>
                    If you have any questions, please contact us.</p>
                </div>
            </body>
            </html>
            """
            
            await NotificationService._send_email(email, subject, html_content)
            print(f"[NOTIFICATION] Rejection email sent to {email}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send rejection email: {e}")
    
    @staticmethod
    async def _send_email(to_email: str, subject: str, html_content: str):
        """Send email using SMTP"""
        if not settings.SMTP_HOST:
            print(f"[NOTIFICATION] SMTP not configured (SMTP_HOST is not set). Cannot send email to {to_email}")
            return
        
        try:
            print(f"[NOTIFICATION] Attempting to send email to {to_email} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")
            
            msg = MIMEMultipart('alternative')
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            print(f"[NOTIFICATION] Connecting to SMTP server: {settings.SMTP_HOST}:{settings.SMTP_PORT}")
            
            # Try SMTP_SSL first if port is 465, otherwise use regular SMTP
            use_ssl = settings.SMTP_PORT == 465
            
            if use_ssl:
                print(f"[NOTIFICATION] Using SMTP_SSL (port 465 requires SSL)")
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            else:
                print(f"[NOTIFICATION] Using regular SMTP with timeout=30")
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            
            try:
                # Set debug level for troubleshooting (set to 0 to disable verbose output)
                server.set_debuglevel(0)
                
                if not use_ssl and settings.SMTP_USE_TLS:
                    print(f"[NOTIFICATION] Starting TLS...")
                    server.starttls()
                
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    print(f"[NOTIFICATION] Logging in to SMTP server as {settings.SMTP_USERNAME}")
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                else:
                    print(f"[NOTIFICATION] No SMTP credentials provided, attempting without authentication")
                
                print(f"[NOTIFICATION] Sending email message...")
                server.send_message(msg)
                print(f"[NOTIFICATION] ✓ Email successfully sent to {to_email}")
            finally:
                server.quit()
                
        except smtplib.SMTPAuthenticationError as e:
            print(f"[ERROR] SMTP Authentication failed: {e}")
            print(f"[ERROR] Check your SMTP_USERNAME and SMTP_PASSWORD in .env file")
            raise
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected) as e:
            print(f"[ERROR] SMTP Connection failed: {e}")
            print(f"[ERROR] Check your SMTP settings:")
            print(f"[ERROR]   SMTP_HOST: {settings.SMTP_HOST}")
            print(f"[ERROR]   SMTP_PORT: {settings.SMTP_PORT}")
            print(f"[ERROR]   SMTP_USE_TLS: {settings.SMTP_USE_TLS}")
            print(f"[ERROR] Possible issues:")
            print(f"[ERROR]   1. Firewall blocking port {settings.SMTP_PORT}")
            print(f"[ERROR]   2. Wrong SMTP_HOST or SMTP_PORT")
            print(f"[ERROR]   3. Network connectivity issues")
            print(f"[ERROR]   4. If using Gmail, try port 465 with SMTP_USE_TLS=False (uses SSL instead)")
            raise
        except smtplib.SMTPException as e:
            print(f"[ERROR] SMTP error: {e}")
            raise
        except Exception as e:
            print(f"[ERROR] Unexpected error sending email: {type(e).__name__}: {e}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            raise
    
    # ==================== SMS ====================
    
    @staticmethod
    async def _send_approval_sms(mobile: str, details: dict):
        """Send approval SMS via Twilio"""
        try:
            if not settings.TWILIO_ACCOUNT_SID:
                print(f"[NOTIFICATION] SMS not configured. Would send approval SMS to {mobile}")
                return
            
            from twilio.rest import Client
            
            message_body = f"""✅ Booking Approved!

Reference: {details['booking_reference']}
Venue: {details['venue_name']}
Date: {details['start_datetime']}
Amount: {details['total_amount']}

Thank you for choosing LeBrq!"""
            
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=mobile
            )
            
            print(f"[NOTIFICATION] SMS sent to {mobile}: {message.sid}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send SMS: {e}")
    
    @staticmethod
    async def _send_rejection_sms(mobile: str, details: dict):
        """Send rejection SMS via Twilio"""
        try:
            if not settings.TWILIO_ACCOUNT_SID:
                print(f"[NOTIFICATION] SMS not configured. Would send rejection SMS to {mobile}")
                return
            
            from twilio.rest import Client
            
            message_body = f"""Booking Update

Reference: {details['booking_reference']}
Status: Not Approved
Reason: {details['admin_note']}

Please contact us for assistance or book another time slot.

- LeBrq Team"""
            
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=mobile
            )
            
            print(f"[NOTIFICATION] SMS sent to {mobile}: {message.sid}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send SMS: {e}")
    
    # ==================== WHATSAPP ====================
    
    @staticmethod
    async def _send_approval_whatsapp(mobile: str, details: dict):
        """Send approval WhatsApp message"""
        try:
            # If Route Mobile is configured, prefer it
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                # Normalize phone number
                to = NotificationService._normalize_phone_number(mobile or '')
                print(f"[NOTIFICATION] Sending approval WhatsApp to: {to}")
                variables = [
                    details.get('user_name', ''),
                    details.get('booking_reference', ''),
                    details.get('venue_name', ''),
                    details.get('space_name', ''),
                    details.get('start_datetime', ''),
                    details.get('end_datetime', ''),
                    details.get('total_amount', ''),
                    details.get('event_type', ''),
                    'approved',
                ]
                res = await rm_client.send_bookingreg(
                    to_mobile=to,
                    variables=variables,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile send failed for {mobile}: {res}")
                return

            # Fallback to Twilio WhatsApp Sandbox if configured
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""🎉 *Booking Approved!*

*Reference:* {details['booking_reference']}
*Venue:* {details['venue_name']}
*Space:* {details['space_name']}
*Event:* {details['event_type']}
*Start:* {details['start_datetime']}
*Amount:* {details['total_amount']}

✅ Your booking has been confirmed! Please complete payment if pending.

Thank you for choosing LeBrq!"""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send approval to {mobile}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send WhatsApp: {e}")
    
    @staticmethod
    async def _send_rejection_whatsapp(mobile: str, details: dict):
        """Send rejection WhatsApp message using lebrq_rejected_booking template"""
        try:
            # If Route Mobile is configured, prefer it
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                # Normalize to 10 digits first, then format for Route Mobile (needs +91 prefix)
                normalized = NotificationService._normalize_phone_number(mobile or '')
                # Route Mobile expects international format: +91XXXXXXXXXX
                if normalized and len(normalized) == 10:
                    to = f"+91{normalized}"
                else:
                    # If normalization failed, try to use original with + prefix if missing
                    to = mobile if mobile.startswith('+') else f"+{mobile}"
                print(f"[NOTIFICATION] Sending rejection WhatsApp to: {to}")
                # Template: lebrq_rejected_booking
                # Variables: customer_name, reason, booking_ref
                variables = [
                    details.get('user_name', 'Customer'),
                    details.get('admin_note', 'No reason provided'),
                    details.get('booking_reference', ''),
                ]
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_rejected_booking',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                )
                if res.get('ok'):
                    print(f"[NOTIFICATION] ✓ Rejection WhatsApp sent successfully via Route Mobile to {to}")
                else:
                    print(f"[NOTIFICATION] ✗ Route Mobile rejection send failed for {mobile}: {res}")
                return

            # Fallback to Twilio WhatsApp Sandbox if configured
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""*Booking Update – LeBRQ*

Dear {details.get('user_name', 'Customer')}, we regret to inform you that your booking at LeBRQ has been *rejected*.

Reason: {details.get('admin_note', 'No reason provided')}

Booking Ref: {details.get('booking_reference', '')}

For further assistance, please contact our support team.
Thank you for choosing LeBRQ."""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send rejection to {mobile}")
            
        except Exception as e:
            print(f"[ERROR] Failed to send WhatsApp: {e}")
    
    @staticmethod
    async def send_refund_initiated_whatsapp(mobile: str, customer_name: str, refund_amount: float, refund_mode: str, transaction_id: str, refund_time: str = "3-5 working days"):
        """Send refund initiated WhatsApp message using lebrq_refund_initiated template"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                to = NotificationService._normalize_phone_number(mobile or '')
                print(f"[NOTIFICATION] Sending refund initiated WhatsApp to: {to}")
                # Template: lebrq_refund_initiated
                # Variables: customer_name, refund_amount, refund_mode, transaction_id, refund_time
                variables = [
                    customer_name,
                    f"₹{refund_amount:.2f}",
                    refund_mode,
                    transaction_id,
                    refund_time,
                ]
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_refund_initiated',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile refund initiated send failed for {mobile}: {res}")
                return

            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""*Refund Initiated – LeBRQ*

Dear {customer_name}, your refund request has been successfully *initiated*.

Refund Amount: ₹{refund_amount:.2f}
Refund Mode: {refund_mode}
Transaction ID: {transaction_id}

You can expect the refund to be processed within {refund_time}.

Thank you for your patience."""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp refund initiated sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send refund initiated to {mobile}")
        except Exception as e:
            print(f"[NOTIFICATION] Refund initiated WhatsApp error: {e}")
    
    @staticmethod
    async def send_booking_cancelled_whatsapp(mobile: str, customer_name: str, booking_ref: str, cancelled_date: str):
        """Send booking cancelled WhatsApp message using lebrq_booking_cancelled template"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                to = NotificationService._normalize_phone_number(mobile or '')
                print(f"[NOTIFICATION] Sending booking cancelled WhatsApp to: {to}")
                # Template: lebrq_booking_cancelled
                # Variables: customer_name, booking_ref, cancelled_date
                variables = [
                    customer_name,
                    booking_ref,
                    cancelled_date,
                ]
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_booking_cancelled',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile booking cancelled send failed for {mobile}: {res}")
                return

            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""*Booking Cancelled – LeBRQ*

Dear {customer_name}, your booking at LeBRQ has been *cancelled*.

Booking Ref: {booking_ref}
Cancelled On: {cancelled_date}

If this was not done by you or you need further help, please contact our support team.
We hope to serve you again."""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp booking cancelled sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send booking cancelled to {mobile}")
        except Exception as e:
            print(f"[NOTIFICATION] Booking cancelled WhatsApp error: {e}")
    
    @staticmethod
    async def send_item_not_available_whatsapp(mobile: str, customer_name: str, item_name: str, reason: str):
        """Send item not available WhatsApp message using lebrq_item_not_available template"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                to = NotificationService._normalize_phone_number(mobile or '')
                print(f"[NOTIFICATION] Sending item not available WhatsApp to: {to}")
                # Template: lebrq_item_not_available
                # Variables: customer_name, item_name, reason
                variables = [
                    customer_name,
                    item_name,
                    reason,
                ]
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_item_not_available',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile item not available send failed for {mobile}: {res}")
                return

            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""*Delivery Update – LeBRQ*

Dear {customer_name}, we are sorry to inform you that the item `{item_name}` is currently *not available* for delivery.

Reason: {reason}

You may select an alternative item or request a refund.

Thank you for your understanding."""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp item not available sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send item not available to {mobile}")
        except Exception as e:
                print(f"[NOTIFICATION] Item not available WhatsApp error: {e}")
    
    @staticmethod
    async def send_birthday_surprise_whatsapp(mobile: str, buyer_name: str):
        """
        Send birthday surprise WhatsApp message to recipient using approved template.
        
        Note: You need to create an approved WhatsApp template named 'lebrq_birthday_surprise' 
        with the following variables:
        - {{1}} = buyer_name
        
        Template example:
        "🎉 Surprise from Le BRQ!
        You've received a birthday gift from {{1}}"
        """
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                # Normalize to 10 digits first, then format for Route Mobile (needs +91 prefix)
                normalized = NotificationService._normalize_phone_number(mobile or '')
                # Route Mobile expects international format: +91XXXXXXXXXX
                if normalized and len(normalized) == 10:
                    to = f"+91{normalized}"
                else:
                    # If normalization failed, try to use original with + prefix if missing
                    to = mobile if mobile.startswith('+') else f"+{mobile}"
                print(f"[NOTIFICATION] Sending birthday surprise WhatsApp to: {to}")
                
                # Use approved template (required by Route Mobile/WhatsApp Business API)
                # Template: lebrq_birthday_surprise
                # Variables: buyer_name
                variables = [buyer_name]
                
                try:
                    res = await rm_client.send_template(
                        to_mobile=to,
                        template_name='lebrq_birthday_surprise',
                        language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                        body_parameters=variables,
                    )
                    if res.get('ok'):
                        print(f"[NOTIFICATION] Birthday surprise WhatsApp sent successfully to {to}")
                        return
                    else:
                        print(f"[NOTIFICATION] Route Mobile template send failed for {mobile}: {res}")
                        # Fall through to Twilio if template send fails
                except Exception as e:
                    print(f"[NOTIFICATION] Route Mobile template send error: {e}")
                    # Fall through to Twilio on error
            
            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"🎉 Surprise from Le BRQ!\nYou've received a birthday gift from {buyer_name}"
                
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] Birthday surprise WhatsApp sent via Twilio: {message.sid}")
                return
            
            print(f"[NOTIFICATION] No WhatsApp service configured for birthday surprise")
        except Exception as e:
            print(f"[NOTIFICATION] Birthday surprise WhatsApp error: {e}")
            raise
    
    @staticmethod
    async def send_festival_offer_whatsapp(
        mobile: str, 
        customer_name: str, 
        festival_name: str, 
        offer_details: str, 
        discount_percentage: str, 
        valid_until_date: str, 
        website_link: str, 
        contact_number: str
    ):
        """Send festival offer WhatsApp message using lebrq_festival_offer template"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                # Normalize to exactly 10 digits - Route Mobile will add country code automatically
                normalized = NotificationService._normalize_phone_number(mobile or '')
                # Route Mobile expects just the 10-digit number (it adds +91 automatically)
                if normalized and len(normalized) == 10:
                    # Send just the 10-digit number - Route Mobile will add +91
                    to = normalized
                    print(f"[NOTIFICATION] Sending festival offer WhatsApp to: {to} (normalized from: {mobile}, Route Mobile will add +91)")
                else:
                    # Normalization failed - log and skip
                    print(f"[NOTIFICATION] ERROR: Could not normalize phone number: {mobile} (got: {normalized}, length: {len(normalized) if normalized else 0})")
                    return
                # Template: lebrq_festival_offer
                # Template format:
                # LeBRQ Special Offer.
                # Dear {1}, Celebrate this {2} with exclusive offers at LeBRQ!
                # Offer: {3}
                # Discount: {4}
                # Valid Till: {5}
                # Book your program now: {6}
                # For assistance, contact: {7}
                # Variables: customer_name, festival_name, offer_details, discount_percentage, valid_until_date, website_link, contact_number
                
                # Clean and format variables to ensure they're properly formatted
                def clean_var(value: str, default: str) -> str:
                    """Clean variable: strip, remove newlines, ensure it's a valid string"""
                    if not value:
                        return default
                    cleaned = str(value).strip()
                    cleaned = cleaned.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
                    cleaned = ' '.join(cleaned.split())
                    return cleaned
                
                variables = [
                    clean_var(customer_name, 'Customer'),
                    clean_var(festival_name, 'Festival'),
                    clean_var(offer_details, 'Special offer'),
                    clean_var(discount_percentage, 'N/A'),
                    clean_var(valid_until_date, 'N/A'),
                    clean_var(website_link, 'https://lebrq.com'),
                    clean_var(contact_number, 'lebrq.com'),
                ]
                
                # Ensure all variables are non-empty (Route Mobile rejects empty variables)
                variables = [v if v and str(v).strip() else 'N/A' for v in variables]
                
                print(f"[NOTIFICATION] Festival offer variables: {variables}")
                print(f"[NOTIFICATION] Variable count: {len(variables)} (expected: 7)")
                
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_festival_offer',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                )
                if not res.get('ok'):
                    print(f"[NOTIFICATION] Route Mobile festival offer send failed for {mobile}: {res}")
                return

            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""*LeBRQ Festival Special Offer*

Dear {customer_name},

Celebrate this {festival_name} with exclusive offers at LeBRQ!  
Offer: {offer_details}  
Discount: {discount_percentage}%  
Valid Till: {valid_until_date}

Book your program now: {website_link}  
For assistance, contact: {contact_number}

Wishing you and your family a joyful celebration.
– Team LeBRQ"""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] WhatsApp festival offer sent to {mobile}: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send festival offer to {mobile}")
        except Exception as e:
            print(f"[NOTIFICATION] Festival offer WhatsApp error: {e}")
    
    @staticmethod
    async def send_contest_invitation_whatsapp(
        mobile: str,
        customer_name: str,
        contest_name: str,
        contest_date: str,
        prize: str,
        submission_link: str
    ):
        """Send contest invitation WhatsApp message using lebrq_contest_invitation template"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if rm_client.is_configured():
                # Normalize to exactly 10 digits - Route Mobile will add country code automatically
                normalized = NotificationService._normalize_phone_number(mobile or '')
                # Route Mobile expects just the 10-digit number (it adds +91 automatically)
                if normalized and len(normalized) == 10:
                    # Send just the 10-digit number - Route Mobile will add +91
                    to = normalized
                    print(f"[NOTIFICATION] Sending contest invitation WhatsApp to: {to} (normalized from: {mobile}, Route Mobile will add +91)")
                else:
                    # Normalization failed - log and skip
                    print(f"[NOTIFICATION] ERROR: Could not normalize phone number: {mobile} (got: {normalized}, length: {len(normalized) if normalized else 0})")
                    return
                # Template: lebrq_contest_invitation
                # Variables: customer_name, contest_name, contest_date, prize, submission_link
                # Template example: vaishak, Birthday Eventually, jan-01-2026, free entry, lebrq.com/participant
                
                # Clean and format each variable - remove any problematic characters
                def clean_variable(value: str, default: str) -> str:
                    """Clean variable: strip, remove newlines, ensure it's a valid string"""
                    if not value:
                        return default
                    cleaned = str(value).strip()
                    # Remove any newlines, carriage returns, tabs
                    cleaned = cleaned.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
                    # Collapse multiple spaces to single space
                    cleaned = ' '.join(cleaned.split())
                    # Remove any control characters that might cause issues
                    cleaned = ''.join(char for char in cleaned if ord(char) >= 32 or char in '\n\r\t')
                    return cleaned
                
                variables = [
                    clean_variable(customer_name, 'Customer'),
                    clean_variable(contest_name, 'Contest'),
                    clean_variable(contest_date, 'TBD'),
                    clean_variable(prize, 'Exciting prizes'),
                    clean_variable(submission_link, 'lebrq.com'),
                ]
                
                # Validate variable lengths (Route Mobile typically allows 1024 chars, but be conservative)
                max_length = 200
                variables = [v[:max_length] if len(v) > max_length else v for v in variables]
                
                # Ensure all variables are non-empty strings (Route Mobile rejects empty variables)
                variables = [v if v and str(v).strip() else 'N/A' for v in variables]
                
                print(f"[NOTIFICATION] Contest invitation variables: {variables}")
                print(f"[NOTIFICATION] Variable lengths: {[len(str(v)) for v in variables]}")
                print(f"[NOTIFICATION] Variable types: {[type(v).__name__ for v in variables]}")
                print(f"[NOTIFICATION] Number of variables: {len(variables)} (expected: 5)")
                
                # For templates with image headers, don't pass header_parameters (image is pre-configured)
                # Route Mobile may reject if we pass empty list or None for image headers
                res = await rm_client.send_template(
                    to_mobile=to,
                    template_name='lebrq_contest_invitation',
                    language=settings.ROUTEMOBILE_TEMPLATE_LANGUAGE or 'en',
                    body_parameters=variables,
                    header_parameters=None,  # None for image header (image is pre-configured in template)
                )
                if res.get('ok'):
                    print(f"[NOTIFICATION] ✓ Contest invitation WhatsApp sent successfully via Route Mobile to {to}")
                else:
                    print(f"[NOTIFICATION] ✗ Route Mobile contest invitation send failed for {mobile}")
                    print(f"[NOTIFICATION] Response details: {res}")
                    # Log the full error response for debugging
                    if 'data' in res:
                        print(f"[NOTIFICATION] Error data: {res.get('data')}")
                    if 'error' in res:
                        print(f"[NOTIFICATION] Error message: {res.get('error')}")
                return

            # Fallback to Twilio
            if settings.TWILIO_WHATSAPP_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                message_body = f"""Hello customer {customer_name}, LeBRQ is happy to invite you to join an upcoming contest. This contest is called {contest_name} and it will take place on {contest_date} for all interested participants. In this contest, the prize available is {prize} which will be awarded to the winner. To complete your participation, please submit your details using this link: {submission_link} for a successful entry.

We look forward to your participation. Best of luck from the Team LeBRQ"""

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=message_body,
                    from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                    to=f'whatsapp:{mobile}'
                )
                print(f"[NOTIFICATION] Contest invitation WhatsApp sent via Twilio: {message.sid}")
                return

            print(f"[NOTIFICATION] WhatsApp not configured. Would send contest invitation to {mobile}")
        except Exception as e:
            print(f"[NOTIFICATION] Contest invitation WhatsApp error: {e}")
    
    @staticmethod
    async def send_contest_invitation_sms(
        mobile: str,
        customer_name: str,
        contest_name: str,
        contest_date: str,
        prize: str,
        submission_link: str
    ):
        """Send contest invitation SMS notification"""
        try:
            if not settings.TWILIO_ACCOUNT_SID:
                print(f"[NOTIFICATION] SMS not configured. Would send contest invitation SMS to {mobile}")
                return

            from twilio.rest import Client

            message_body = f"""Hello customer {customer_name}, LeBRQ is happy to invite you to join an upcoming contest. This contest is called {contest_name} and it will take place on {contest_date} for all interested participants. In this contest, the prize available is {prize} which will be awarded to the winner. To complete your participation, please submit your details using this link: {submission_link} for a successful entry.

We look forward to your participation. Best of luck from the Team LeBRQ"""

            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=mobile
            )
            print(f"[NOTIFICATION] Contest invitation SMS sent: {message.sid}")
        except Exception as e:
            print(f"[NOTIFICATION] Contest invitation SMS error: {e}")
    
    @staticmethod
    async def send_contest_invitation_email(
        email: str,
        customer_name: str,
        contest_name: str,
        contest_date: str,
        prize: str,
        submission_link: str
    ):
        """Send contest invitation email notification"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured. Would send contest invitation email to {email}")
                return

            subject = f"LeBRQ Contest Invitation - {contest_name}"

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Contest Invitation - LeBRQ</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f7f9f8;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f8; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #2D5016 0%, #4A7C2A 100%); padding: 40px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Contest Invitation</h1>
                                        <p style="color: #E8F5E9; margin: 10px 0 0 0; font-size: 16px;">LeBRQ Events & Venues</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px;">
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                                            Hello customer <strong>{customer_name}</strong>,
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                                            LeBRQ is happy to invite you to join an upcoming contest. This contest is called <strong>{contest_name}</strong> and it will take place on <strong>{contest_date}</strong> for all interested participants.
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                                            In this contest, the prize available is <strong>{prize}</strong> which will be awarded to the winner.
                                        </p>
                                        
                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="{submission_link}" style="display: inline-block; background-color: #10B981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                                                Submit Your Entry
                                            </a>
                                        </div>
                                        
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.7; margin: 20px 0 0 0;">
                                            To complete your participation, please submit your details using the link above for a successful entry.
                                        </p>
                                        
                                        <p style="color: #1f2937; font-size: 16px; line-height: 1.7; margin: 30px 0 0 0;">
                                            We look forward to your participation. Best of luck from the Team LeBRQ!
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                                        <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 0 0;">
                                            For assistance, visit us at <a href="https://lebrq.com" style="color: #10B981; text-decoration: none; font-weight: 600;">lebrq.com</a> or contact our support team.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """

            await NotificationService._send_email(email, subject, html_content)
            print(f"[NOTIFICATION] Contest invitation email sent to {email}")
        except Exception as e:
            print(f"[NOTIFICATION] Contest invitation email error: {e}")
    
    @staticmethod
    async def send_festival_offer_sms(
        mobile: str,
        customer_name: str,
        festival_name: str,
        offer_details: str,
        discount_percentage: str,
        valid_until_date: str,
        website_link: str,
        contact_number: str
    ):
        """Send festival offer SMS notification"""
        try:
            if not settings.TWILIO_ACCOUNT_SID:
                print(f"[NOTIFICATION] SMS not configured. Would send festival offer SMS to {mobile}")
                return
            
            from twilio.rest import Client
            
            message_body = f"""LeBRQ Festival Special Offer

Dear {customer_name},

Celebrate this {festival_name} with exclusive offers at LeBRQ!
Offer: {offer_details}
Discount: {discount_percentage}
Valid Till: {valid_until_date}

Book now: {website_link}
Contact: {contact_number}

Wishing you a joyful celebration.
- Team LeBRQ"""
            
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=mobile
            )
            print(f"[NOTIFICATION] SMS festival offer sent to {mobile}: {message.sid}")
        except Exception as e:
            print(f"[NOTIFICATION] Festival offer SMS error: {e}")
    
    @staticmethod
    async def send_festival_offer_email(
        email: str,
        customer_name: str,
        festival_name: str,
        offer_details: str,
        discount_percentage: str,
        valid_until_date: str,
        website_link: str,
        contact_number: str
    ):
        """Send festival offer email notification"""
        try:
            if not settings.SMTP_HOST:
                print(f"[NOTIFICATION] Email not configured (SMTP_HOST is not set). Would send festival offer email to {email}")
                return
            
            if not email:
                print(f"[NOTIFICATION] No email address provided for festival offer email")
                return
            
            print(f"[NOTIFICATION] Sending festival offer email to: {email}")
            
            subject = f"🎉 Exclusive {festival_name} Offer at LeBRQ - Limited Time Only!"
            
            html_content = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <title>{festival_name} Special Offer - LeBRQ</title>
                <!--[if mso]>
                <style type="text/css">
                    body, table, td {{font-family: Arial, sans-serif !important;}}
                </style>
                <![endif]-->
            </head>
            <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <!-- Preheader Text -->
                <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
                    Celebrate {festival_name} with exclusive offers at LeBRQ! Get {discount_percentage} off on all bookings.
                </div>
                
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f7fa;">
                    <tr>
                        <td align="center" style="padding: 40px 20px;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); max-width: 600px; width: 100%;">
                                
                                <!-- Header with Gradient -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #F59E0B 0%, #F97316 50%, #FCD34D 100%); padding: 0;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding: 48px 40px 40px 40px;">
                                                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                                        {festival_name} Special Offer
                                                    </h1>
                                                    <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 500; opacity: 0.95; letter-spacing: 0.3px;">
                                                        Exclusive Celebrations at LeBRQ
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 48px 40px;">
                                        <!-- Greeting -->
                                        <p style="margin: 0 0 24px 0; color: #111827; font-size: 18px; line-height: 1.6; font-weight: 500;">
                                            Dear <strong style="color: #F59E0B; font-weight: 700;">{customer_name}</strong>,
                                        </p>
                                        
                                        <!-- Introduction -->
                                        <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 1.7;">
                                            We're thrilled to celebrate <strong style="color: #111827;">{festival_name}</strong> with you! As a valued member of the LeBRQ community, we're offering you an exclusive opportunity to make your celebrations even more special.
                                        </p>
                                        
                                        <!-- Offer Details Card -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 12px; border: 2px solid #FCD34D; margin: 32px 0;">
                                            <tr>
                                                <td style="padding: 32px;">
                                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td style="padding-bottom: 20px; border-bottom: 2px solid rgba(245, 158, 11, 0.2);">
                                                                <p style="margin: 0 0 8px 0; color: #92400E; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                    Offer Details
                                                                </p>
                                                                <p style="margin: 0; color: #111827; font-size: 17px; font-weight: 600; line-height: 1.5;">
                                                                    {offer_details}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 20px 0; border-bottom: 2px solid rgba(245, 158, 11, 0.2);">
                                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                                                    <tr>
                                                                        <td width="50%" style="padding-right: 16px;">
                                                                            <p style="margin: 0 0 6px 0; color: #92400E; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                                Discount
                                                                            </p>
                                                                            <p style="margin: 0; color: #111827; font-size: 24px; font-weight: 800; line-height: 1.2;">
                                                                                {discount_percentage}
                                                                            </p>
                                                                        </td>
                                                                        <td width="50%" style="padding-left: 16px; border-left: 2px solid rgba(245, 158, 11, 0.2);">
                                                                            <p style="margin: 0 0 6px 0; color: #92400E; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                                Valid Until
                                                                            </p>
                                                                            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 700; line-height: 1.2;">
                                                                                {valid_until_date}
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-top: 20px;">
                                                                <p style="margin: 0; color: #92400E; font-size: 13px; font-weight: 600; text-align: center;">
                                                                    ⚡ Limited Time Offer - Don't Miss Out!
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- CTA Button -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0 32px 0;">
                                            <tr>
                                                <td align="center">
                                                    <a href="{website_link}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-weight: 700; font-size: 18px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                                                        Book Your Program Now →
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Contact Information -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 24px; margin: 32px 0;">
                                            <tr>
                                                <td align="center">
                                                    <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 14px; line-height: 1.6;">
                                                        Need assistance? We're here to help!
                                                    </p>
                                                    <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                                                        📧 Visit us at <a href="https://lebrq.com" style="color: #10B981; text-decoration: none; font-weight: 600;">lebrq.com</a>
                                                        {f' | 📞 {contact_number}' if contact_number and contact_number != 'lebrq.com' else ''}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Closing Message -->
                                        <p style="margin: 32px 0 0 0; color: #374151; font-size: 16px; line-height: 1.7; text-align: center;">
                                            Wishing you and your family a <strong style="color: #F59E0B;">joyful and memorable {festival_name}</strong> celebration! 🎉
                                        </p>
                                        
                                        <!-- Signature -->
                                        <p style="margin: 24px 0 0 0; color: #111827; font-size: 16px; line-height: 1.6; font-weight: 600; text-align: center;">
                                            Warm regards,<br>
                                            <span style="color: #F59E0B; font-size: 18px;">Team LeBRQ</span>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px 40px; text-align: center;">
                                        <p style="margin: 0 0 16px 0; color: #9CA3AF; font-size: 14px; line-height: 1.6;">
                                            © {datetime.now().year} LeBRQ. All rights reserved.
                                        </p>
                                        <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                                            You're receiving this email because you're a valued member of the LeBRQ community.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            await NotificationService._send_email(email, subject, html_content)
            print(f"[NOTIFICATION] ✓ Festival offer email process completed for {email}")
        except Exception as e:
            print(f"[NOTIFICATION] ✗ Festival offer email error for {email}: {type(e).__name__}: {e}")
            import traceback
            print(f"[NOTIFICATION] Traceback: {traceback.format_exc()}")
            # Don't raise - allow other notifications to continue
    
    # ==================== IN-APP NOTIFICATIONS ====================
    
    @staticmethod
    async def _create_in_app_notification(
        user_id: int,
        title: str,
        message: str,
        booking_id: int,
        session: AsyncSession
    ):
        """Save notification in database for in-app display"""
        try:
            from sqlalchemy import text
            
            # Create notifications table if it doesn't exist
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    booking_id INT,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_booking_id (booking_id)
                )
            """))
            
            # Insert notification
            await session.execute(
                text("""
                    INSERT INTO notifications (user_id, title, message, booking_id, is_read, created_at)
                    VALUES (:user_id, :title, :message, :booking_id, FALSE, NOW())
                """),
                {
                    'user_id': user_id,
                    'title': title,
                    'message': message,
                    'booking_id': booking_id
                }
            )
            await session.commit()
            
            print(f"[NOTIFICATION] In-app notification created for user {user_id}")
            
        except Exception as e:
            print(f"[ERROR] Failed to create in-app notification: {e}")

