"""
Client Notifications API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import User
from ..services.client_notification_service import ClientNotificationService

router = APIRouter(prefix="/client/notifications", tags=["client-notifications"])


def customer_required(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("customer", "admin"):
        raise HTTPException(status_code=403, detail="Customer access only")
    return user


@router.get("")
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    notifications = await ClientNotificationService.get_notifications(
        session=session,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    unread_count = await ClientNotificationService.get_unread_count(session, current_user.id)
    return {"items": notifications, "unread_count": unread_count}


@router.get("/unread-count")
async def unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    count = await ClientNotificationService.get_unread_count(session, current_user.id)
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    success = await ClientNotificationService.mark_read(session, notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    updated = await ClientNotificationService.mark_all_read(session, current_user.id)
    return {"updated": updated}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    success = await ClientNotificationService.delete_notification(session, notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.delete("/clear-all")
async def clear_all_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    deleted = await ClientNotificationService.clear_all(session, current_user.id)
    return {"deleted": deleted}

