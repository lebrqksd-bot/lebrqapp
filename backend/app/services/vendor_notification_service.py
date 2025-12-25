"""
Vendor Notification Service

Handles all vendor notifications including:
- Real-time notifications
- Email notifications
- WhatsApp notifications
- Activity logging
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, text, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Booking, BookingItem, Item, VendorProfile
from ..models_vendor_enhanced import (
    VendorNotification,
    VendorMessage,
    VendorActivityLog,
    BookingItemStatusHistory
)
from ..services.whatsapp_route_mobile import RouteMobileWhatsAppClient
from ..core import settings


class VendorNotificationService:
    """Service for managing vendor notifications and communication"""
    
    # ==================== VENDOR NOTIFICATIONS ====================
    
    @staticmethod
    async def create_notification(
        session: AsyncSession,
        vendor_user_id: int,
        type: str,
        title: str,
        message: str,
        booking_id: Optional[int] = None,
        booking_item_id: Optional[int] = None,
        link: Optional[str] = None,
        priority: str = 'normal',
        send_whatsapp: bool = False,
        send_email: bool = False,
    ) -> VendorNotification:
        """
        Create a new vendor notification
        
        Args:
            session: Database session
            vendor_user_id: Vendor's user ID
            type: Notification type (new_order, order_update, message, etc.)
            title: Notification title
            message: Notification message
            booking_id: Related booking ID (optional)
            booking_item_id: Related booking item ID (optional)
            link: Direct link to related page (optional)
            priority: Notification priority (low, normal, high, urgent)
            send_whatsapp: Whether to send WhatsApp notification
            send_email: Whether to send email notification
        """
        # Create notification record
        notification = VendorNotification(
            vendor_user_id=vendor_user_id,
            type=type,
            title=title,
            message=message,
            booking_id=booking_id,
            booking_item_id=booking_item_id,
            link=link,
            priority=priority,
            is_read=False,
            created_at=datetime.utcnow()
        )
        
        session.add(notification)
        await session.flush()  # Get ID without committing
        
        # Send WhatsApp if requested
        if send_whatsapp:
            try:
                user = await session.get(User, vendor_user_id)
                if user and user.mobile:
                    await VendorNotificationService._send_whatsapp_notification(
                        user.mobile, title, message
                    )
            except Exception as e:
                print(f"[VENDOR_NOTIF] WhatsApp send error: {e}")
        
        # Send Email if requested
        if send_email:
            try:
                user = await session.get(User, vendor_user_id)
                if user and user.username:
                    await VendorNotificationService._send_email_notification(
                        user.username, title, message
                    )
            except Exception as e:
                print(f"[VENDOR_NOTIF] Email send error: {e}")
        
        await session.commit()
        await session.refresh(notification)
        
        print(f"[VENDOR_NOTIF] Created notification for vendor user {vendor_user_id}: {title}")
        return notification
    
    @staticmethod
    async def notify_vendor_new_order(
        session: AsyncSession,
        booking_item: BookingItem,
        booking: Booking,
        item: Item,
        customer: User,
    ):
        """Notify vendor when a new order is created"""
        if not booking_item.vendor_id:
            return
        
        # Get vendor profile and user
        vendor_profile = await session.get(VendorProfile, booking_item.vendor_id)
        if not vendor_profile:
            return
        
        vendor_user = await session.get(User, vendor_profile.user_id)
        if not vendor_user:
            return
        
        customer_name = f"{customer.first_name} {customer.last_name}".strip() or customer.username
        
        title = f"New Order: {item.name}"
        message = (
            f"You have a new order from {customer_name}\n"
            f"Item: {item.name}\n"
            f"Quantity: {booking_item.quantity}\n"
            f"Total: ₹{booking_item.total_price:,.2f}\n"
            f"Booking Reference: {booking.booking_reference}"
        )
        
        await VendorNotificationService.create_notification(
            session=session,
            vendor_user_id=vendor_user.id,
            type='new_order',
            title=title,
            message=message,
            booking_id=booking.id,
            booking_item_id=booking_item.id,
            link=f"/vendor/orders?item={booking_item.id}",
            priority='high',
            send_whatsapp=True,
            send_email=False,
        )
    
    @staticmethod
    async def notify_vendor_order_update(
        session: AsyncSession,
        booking_item: BookingItem,
        old_status: str,
        new_status: str,
        updated_by_role: str,
        notes: Optional[str] = None,
    ):
        """Notify vendor when order status is updated"""
        if not booking_item.vendor_id:
            return
        
        vendor_profile = await session.get(VendorProfile, booking_item.vendor_id)
        if not vendor_profile:
            return
        
        vendor_user = await session.get(User, vendor_profile.user_id)
        if not vendor_user:
            return
        
        item = await session.get(Item, booking_item.item_id)
        item_name = item.name if item else f"Item #{booking_item.item_id}"
        
        title = f"Order Status Updated: {new_status.upper()}"
        message = (
            f"Order item '{item_name}' status changed\n"
            f"From: {old_status} → To: {new_status}\n"
            f"Updated by: {updated_by_role}"
        )
        if notes:
            message += f"\nNotes: {notes}"
        
        await VendorNotificationService.create_notification(
            session=session,
            vendor_user_id=vendor_user.id,
            type='order_update',
            title=title,
            message=message,
            booking_id=booking_item.booking_id,
            booking_item_id=booking_item.id,
            link=f"/vendor/orders?item={booking_item.id}",
            priority='normal',
            send_whatsapp=False,
            send_email=False,
        )
    
    @staticmethod
    async def notify_admin_vendor_action(
        session: AsyncSession,
        admin_user_ids: List[int],
        vendor: User,
        action: str,
        booking_item: BookingItem,
        details: Optional[str] = None,
    ):
        """Notify admins when vendor takes action (accept/reject/edit order)"""
        from ..notifications import NotificationService
        
        vendor_name = f"{vendor.first_name} {vendor.last_name}".strip() or vendor.username
        
        item = await session.get(Item, booking_item.item_id)
        item_name = item.name if item else f"Item #{booking_item.item_id}"
        
        title = f"Vendor Action: {action.upper()}"
        message = (
            f"Vendor '{vendor_name}' has {action} order\n"
            f"Item: {item_name}\n"
            f"Quantity: {booking_item.quantity}\n"
            f"Total: ₹{booking_item.total_price:,.2f}"
        )
        if details:
            message += f"\nDetails: {details}"
        
        for admin_id in admin_user_ids:
            try:
                await NotificationService._create_in_app_notification(
                    user_id=admin_id,
                    title=title,
                    message=message,
                    booking_id=booking_item.booking_id,
                    session=session
                )
            except Exception as e:
                print(f"[VENDOR_NOTIF] Failed to notify admin {admin_id}: {e}")
    
    @staticmethod
    async def get_vendor_notifications(
        session: AsyncSession,
        vendor_user_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get vendor notifications with pagination"""
        stmt = select(VendorNotification).where(
            and_(
                VendorNotification.vendor_user_id == vendor_user_id,
                VendorNotification.is_deleted == False
            )
        )
        
        if unread_only:
            stmt = stmt.where(VendorNotification.is_read == False)
        
        stmt = stmt.order_by(VendorNotification.created_at.desc())
        stmt = stmt.limit(limit).offset(offset)
        
        result = await session.execute(stmt)
        notifications = result.scalars().all()
        
        return [
            {
                'id': n.id,
                'type': n.type,
                'title': n.title,
                'message': n.message,
                'booking_id': n.booking_id,
                'booking_item_id': n.booking_item_id,
                'link': n.link,
                'is_read': n.is_read,
                'priority': n.priority,
                'created_at': n.created_at.isoformat() if n.created_at else None,
                'read_at': n.read_at.isoformat() if n.read_at else None,
            }
            for n in notifications
        ]
    
    @staticmethod
    async def mark_notification_read(
        session: AsyncSession,
        notification_id: int,
        vendor_user_id: int,
    ) -> bool:
        """Mark a notification as read"""
        stmt = select(VendorNotification).where(
            and_(
                VendorNotification.id == notification_id,
                VendorNotification.vendor_user_id == vendor_user_id
            )
        )
        result = await session.execute(stmt)
        notification = result.scalar_one_or_none()
        
        if notification and not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await session.commit()
            return True
        return False
    
    @staticmethod
    async def mark_all_notifications_read(
        session: AsyncSession,
        vendor_user_id: int,
    ) -> int:
        """Mark all vendor notifications as read"""
        stmt = text("""
            UPDATE vendor_notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE vendor_user_id = :vendor_user_id AND is_read = FALSE
        """)
        result = await session.execute(stmt, {'vendor_user_id': vendor_user_id})
        await session.commit()
        return result.rowcount
    
    @staticmethod
    async def get_unread_count(
        session: AsyncSession,
        vendor_user_id: int,
    ) -> int:
        """Get count of unread notifications"""
        stmt = text("""
            SELECT COUNT(*) FROM vendor_notifications
            WHERE vendor_user_id = :vendor_user_id AND is_read = FALSE AND is_deleted = FALSE
        """)
        result = await session.execute(stmt, {'vendor_user_id': vendor_user_id})
        return result.scalar() or 0
    
    # ==================== ACTIVITY LOGGING ====================
    
    @staticmethod
    async def log_vendor_activity(
        session: AsyncSession,
        vendor_user_id: int,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log vendor activity"""
        log = VendorActivityLog(
            vendor_user_id=vendor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.utcnow()
        )
        session.add(log)
        await session.commit()
    
    # ==================== WHATSAPP & EMAIL ====================
    
    @staticmethod
    async def _send_whatsapp_notification(mobile: str, title: str, message: str):
        """Send WhatsApp notification to vendor"""
        try:
            rm_client = RouteMobileWhatsAppClient()
            if not rm_client.is_configured():
                return
            
            # Format mobile
            digits = "".join(ch for ch in mobile if ch.isdigit())
            if len(digits) == 10:
                to = "91" + digits
            else:
                to = digits
            
            # Use booking_temp template or simple message
            variables = [title, message]
            
            await rm_client.send_template(
                to_mobile=to,
                template_name="booking_temp",  # Or create vendor-specific template
                language="en",
                body_parameters=variables,
            )
            
            print(f"[VENDOR_NOTIF] WhatsApp sent to {to}")
        except Exception as e:
            print(f"[VENDOR_NOTIF] WhatsApp error: {e}")
    
    @staticmethod
    async def _send_email_notification(email: str, title: str, message: str):
        """Send email notification to vendor"""
        try:
            if not settings.SMTP_HOST:
                return
            
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"[LeBRQ Vendor] {title}"
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = email
            
            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #2D5016;">{title}</h2>
                <p style="white-space: pre-line;">{message}</p>
                <hr/>
                <p style="color: #666; font-size: 12px;">
                    This is an automated notification from LeBRQ Vendor Portal
                </p>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(html, 'html'))
            
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            
            print(f"[VENDOR_NOTIF] Email sent to {email}")
        except Exception as e:
            print(f"[VENDOR_NOTIF] Email error: {e}")

