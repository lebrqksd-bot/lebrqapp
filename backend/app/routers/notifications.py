"""
Notifications API for frontend
Allows users to view, mark as read, and manage their notifications
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_session
from ..models import User
from ..auth import get_current_user
from .auth import require_role
from ..services.whatsapp_route_mobile import RouteMobileWhatsAppClient
from .whatsapp import _push  # reuse chat store for visibility
from ..core import settings
from sqlalchemy import select
from ..notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    booking_id: Optional[int]
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class MarkAsReadRequest(BaseModel):
    notification_ids: List[int]


class WhatsAppTestRequest(BaseModel):
    phone: str
    template_name: Optional[str] = None
    variables: Optional[List[str]] = None
    language: Optional[str] = None


@router.get("", response_model=List[NotificationOut])
async def get_user_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get notifications for the current user
    - **limit**: Number of notifications to return (default: 20)
    - **offset**: Pagination offset (default: 0)
    - **unread_only**: Only return unread notifications (default: False)
    """
    try:
        # Build query based on filters
        unread_filter = "AND is_read = FALSE" if unread_only else ""
        
        query = f"""
            SELECT id, user_id, title, message, booking_id, is_read, created_at
            FROM notifications 
            WHERE user_id = :user_id {unread_filter}
            ORDER BY created_at DESC 
            LIMIT :limit OFFSET :offset
        """
        
        result = await session.execute(
            text(query),
            {
                'user_id': current_user.id,
                'limit': limit,
                'offset': offset
            }
        )
        
        rows = result.fetchall()
        
        notifications = []
        for row in rows:
            notifications.append({
                'id': row[0],
                'title': row[2],
                'message': row[3],
                'booking_id': row[4],
                'is_read': bool(row[5]),
                'created_at': row[6]
            })
        
        return notifications
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch notifications: {e}")
        # Return empty list if table doesn't exist yet
        return []


@router.get("/count")
async def get_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    last_updated: Optional[str] = Query(None, description="Client's last known update timestamp to check if changed")
):
    """
    Get count of unread notifications for current user.
    Returns: {"unread_count": number, "last_updated": ISO timestamp}
    
    If last_updated is provided and hasn't changed, returns 304 Not Modified.
    """
    try:
        # Get count and max updated_at timestamp for unread notifications
        result = await session.execute(
            text("""
                SELECT 
                    COUNT(*) as count,
                    COALESCE(MAX(updated_at), MAX(created_at), NOW()) as last_updated
                FROM notifications 
                WHERE user_id = :user_id AND is_read = FALSE
            """),
            {'user_id': current_user.id}
        )
        
        row = result.fetchone()
        count = row[0] if row else 0
        last_updated_db = row[1] if row and len(row) > 1 else None
        
        # Convert to ISO string if datetime object
        if last_updated_db and hasattr(last_updated_db, 'isoformat'):
            last_updated_str = last_updated_db.isoformat()
        elif last_updated_db:
            last_updated_str = str(last_updated_db)
        else:
            from datetime import datetime, timezone
            last_updated_str = datetime.now(timezone.utc).isoformat()
        
        # If client provided last_updated and it matches, return minimal response
        if last_updated and last_updated == last_updated_str:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=200,
                content={"unread_count": count, "last_updated": last_updated_str, "unchanged": True}
            )
        
        return {
            "unread_count": count,
            "last_updated": last_updated_str
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"unread_count": 0, "last_updated": None}


@router.post("/mark-as-read")
async def mark_notifications_as_read(
    payload: MarkAsReadRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Mark one or more notifications as read
    """
    try:
        if not payload.notification_ids:
            return {"message": "No notification IDs provided"}
        
        # Create placeholders for the IN clause
        placeholders = ','.join([f':id{i}' for i in range(len(payload.notification_ids))])
        
        # Build parameters dictionary
        params = {'user_id': current_user.id}
        for i, nid in enumerate(payload.notification_ids):
            params[f'id{i}'] = nid
        
        await session.execute(
            text(f"""
                UPDATE notifications 
                SET is_read = TRUE 
                WHERE user_id = :user_id AND id IN ({placeholders})
            """),
            params
        )
        await session.commit()
        
        return {
            "message": f"Marked {len(payload.notification_ids)} notification(s) as read"
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to mark as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notifications")


@router.post("/mark-all-as-read")
async def mark_all_as_read(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read for current user
    """
    try:
        result = await session.execute(
            text("""
                UPDATE notifications 
                SET is_read = TRUE 
                WHERE user_id = :user_id AND is_read = FALSE
            """),
            {'user_id': current_user.id}
        )
        await session.commit()
        
        return {"message": "All notifications marked as read"}
        
    except Exception as e:
        print(f"[ERROR] Failed to mark all as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notifications")


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific notification
    """
    try:
        # Verify notification belongs to user
        result = await session.execute(
            text("""
                SELECT id FROM notifications 
                WHERE id = :notification_id AND user_id = :user_id
            """),
            {
                'notification_id': notification_id,
                'user_id': current_user.id
            }
        )
        
        if not result.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Notification not found or doesn't belong to you"
            )
        
        # Delete the notification
        await session.execute(
            text("""
                DELETE FROM notifications 
                WHERE id = :notification_id AND user_id = :user_id
            """),
            {
                'notification_id': notification_id,
                'user_id': current_user.id
            }
        )
        await session.commit()
        
        return {"message": "Notification deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to delete notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete notification")


@router.delete("/clear-all")
async def clear_all_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete all notifications for current user
    """
    try:
        result = await session.execute(
            text("""
                DELETE FROM notifications 
                WHERE user_id = :user_id
            """),
            {'user_id': current_user.id}
        )
        await session.commit()
        
        return {"message": "All notifications cleared"}
        
    except Exception as e:
        print(f"[ERROR] Failed to clear notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear notifications")


@router.get("/{notification_id}")
async def get_notification_by_id(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific notification by ID
    """
    try:
        result = await session.execute(
            text("""
                SELECT id, user_id, title, message, booking_id, is_read, created_at
                FROM notifications 
                WHERE id = :notification_id AND user_id = :user_id
            """),
            {
                'notification_id': notification_id,
                'user_id': current_user.id
            }
        )
        
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {
            'id': row[0],
            'title': row[2],
            'message': row[3],
            'booking_id': row[4],
            'is_read': bool(row[5]),
            'created_at': row[6]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification")


@router.post("/wa-test")
async def whatsapp_test_send(
    payload: WhatsAppTestRequest,
):
    """
    Admin-only test endpoint to send a WhatsApp template via Route Mobile.

    Body:
    - phone: recipient number (e.g. +9182XXXXXXXX). If 10 digits, +91 is auto-prefixed.
    - template_name: optional template name (default: bookingreg)
    - variables: optional list of variables for the template body
    - language: optional language code (default from settings)
    """
    client = RouteMobileWhatsAppClient()
    if not client.is_configured():
        raise HTTPException(status_code=400, detail="Route Mobile is not configured on server")

    # Use phone number as provided, do not auto-prefix +91
    to = (payload.phone or "").strip()

    template = payload.template_name
    variables = payload.variables or []
    language = payload.language

    # Provide a friendly default sample if variables not given
    if not variables:
        if template == "simple":
            # Use configured simple template alias (1 variable typical)
            template = settings.ROUTEMOBILE_TEMPLATE_SIMPLE if hasattr(settings, "ROUTEMOBILE_TEMPLATE_SIMPLE") else "hello"
            variables = ["Test"]
        elif not template or template == "bookingreg":
            variables = [
                "Sruthi",                      # user_name
                "BK478",                       # booking_reference
                "LeBRQ",                       # venue_name
                "Main Hall",                   # space_name
                "June 20, 2025 - 10 AM",      # start_datetime
                "June 22, 2025 - 5 PM",       # end_datetime
                "₹0.00",                       # total_amount
                "Program",                     # event_type
                "approved",                    # status
            ]
        else:
            # Generic fallback for other templates
            variables = ["Test1", "Test2", "Test3"]

    # Send using bookingreg helper if template unspecified or matches settings
    try:
        # Resolve defaults for debug echo
        resolved_template = template or "bookingreg"
        resolved_language = language or "en"

        if not template or template == "bookingreg":
            res = await client.send_bookingreg(to_mobile=to, variables=variables, language=language)
        else:
            res = await client.send_template(
                to_mobile=to,
                template_name=template,
                language=language or "en",
                body_parameters=variables,
            )

        # Also push this admin template send into the in-memory chat store for visibility
        try:
            _push(to, "out", f"template:{resolved_template}", raw=res)
        except Exception:
            pass

        # Echo back what we attempted to send for easier debugging
        return {
            "to": to,
            "template": resolved_template,
            "language": resolved_language,
            "variables": variables,
            "provider": res,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp: {e}")


class LiveShowVendorNotificationRequest(BaseModel):
    """Request to send live show booking notification to vendor"""
    vendor_mobile: str
    vendor_name: str
    delivery_date: str  # e.g., "June 10, 2025"
    delivery_time: str  # e.g., "10 AM"
    delivery_location: str  # e.g., "LeBRQ Banquet Hall, Kochi"
    items: List[dict]  # List of items with name, quantity, unit, quality, unit_price, total_price
    total_amount: float


@router.post("/live-show-vendor")
async def send_live_show_vendor_notification(
    payload: LiveShowVendorNotificationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send WhatsApp notification to vendor for live show item delivery.
    Uses the 'live_show_booking' template.
    
    Example request:
    ```json
    {
      "vendor_mobile": "+919876543210",
      "vendor_name": "Bindu",
      "delivery_date": "June 10, 2025",
      "delivery_time": "10 AM",
      "delivery_location": "LeBRQ Banquet Hall, Kochi",
      "items": [
        {
          "name": "Flower Decoration",
          "quantity": 10,
          "unit": "sets",
          "quality": "Premium",
          "unit_price": 2000,
          "total_price": 20000
        }
      ],
      "total_amount": 35000
    }
    ```
    """
    try:
        # Format items list
        items_lines = []
        for idx, item in enumerate(payload.items, 1):
            item_line = (
                f"{idx}. {item.get('name', 'Item')} – "
                f"{item.get('quantity', 0)} {item.get('unit', 'unit')} – "
                f"{item.get('quality', '')} – "
                f"₹{item.get('unit_price', 0):,.0f} – "
                f"₹{item.get('total_price', 0):,.0f}"
            )
            items_lines.append(item_line)
        
        items_text = "\n".join(items_lines)
        total_amount_text = f"₹{payload.total_amount:,.0f}"
        
        # Send WhatsApp notification
        await NotificationService.send_live_show_vendor_whatsapp(
            vendor_mobile=payload.vendor_mobile,
            vendor_name=payload.vendor_name,
            delivery_date=payload.delivery_date,
            delivery_time=payload.delivery_time,
            delivery_location=payload.delivery_location,
            items_list=items_text,
            total_amount=total_amount_text,
        )
        
        return {
            "success": True,
            "message": f"WhatsApp notification sent to vendor {payload.vendor_name}",
            "vendor_mobile": payload.vendor_mobile,
            "template": "live_show_booking",
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send live show vendor notification: {str(e)}"
        )


