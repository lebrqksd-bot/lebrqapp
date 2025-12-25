"""
Vendor Notifications API Router

Endpoints for vendors to manage their notifications
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ..db import get_session
from ..auth import get_current_user
from ..models import User
from ..services.vendor_notification_service import VendorNotificationService

router = APIRouter(prefix="/vendor/notifications", tags=["vendor-notifications"])


def vendor_required(user: User = Depends(get_current_user)):
    """Ensure user is a vendor"""
    if user.role != 'vendor':
        raise HTTPException(status_code=403, detail='Vendor access only')
    return user


@router.get("")
async def get_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    type: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """
    Get vendor notifications with pagination
    
    Query Parameters:
    - limit: Number of notifications to return (1-100, default 50)
    - offset: Number of notifications to skip (default 0)
    - unread_only: Only return unread notifications (default false)
    - type: Filter by notification type (optional)
    """
    notifications = await VendorNotificationService.get_vendor_notifications(
        session=session,
        vendor_user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    
    unread_count = await VendorNotificationService.get_unread_count(
        session=session,
        vendor_user_id=current_user.id,
    )
    
    return {
        "items": notifications,
        "total": len(notifications),
        "unread_count": unread_count,
        "has_more": len(notifications) == limit,
    }


@router.get("/unread-count")
async def get_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Get count of unread notifications"""
    count = await VendorNotificationService.get_unread_count(
        session=session,
        vendor_user_id=current_user.id,
    )
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Mark a specific notification as read"""
    success = await VendorNotificationService.mark_notification_read(
        session=session,
        notification_id=notification_id,
        vendor_user_id=current_user.id,
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or already read"
        )
    
    return {"ok": True, "notification_id": notification_id}


@router.post("/mark-all-read")
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Mark all notifications as read"""
    updated_count = await VendorNotificationService.mark_all_notifications_read(
        session=session,
        vendor_user_id=current_user.id,
    )
    
    return {
        "ok": True,
        "updated_count": updated_count,
        "message": f"Marked {updated_count} notification(s) as read"
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Soft delete a notification"""
    from sqlalchemy import text
    
    stmt = text("""
        UPDATE vendor_notifications
        SET is_deleted = TRUE
        WHERE id = :notification_id AND vendor_user_id = :vendor_user_id
    """)
    
    result = await session.execute(stmt, {
        'notification_id': notification_id,
        'vendor_user_id': current_user.id
    })
    await session.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"ok": True, "notification_id": notification_id}


@router.post("/clear-all")
async def clear_all_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Soft delete all notifications"""
    from sqlalchemy import text
    
    stmt = text("""
        UPDATE vendor_notifications
        SET is_deleted = TRUE
        WHERE vendor_user_id = :vendor_user_id AND is_deleted = FALSE
    """)
    
    result = await session.execute(stmt, {'vendor_user_id': current_user.id})
    await session.commit()
    
    return {
        "ok": True,
        "deleted_count": result.rowcount,
        "message": f"Cleared {result.rowcount} notification(s)"
    }

