"""
Admin-Vendor Communication API Router

Allows admins to send messages and notifications to vendors
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from ..db import get_session
from ..auth import get_current_user
from ..models import User, VendorProfile
from ..models_vendor_enhanced import VendorMessage
from ..services.vendor_notification_service import VendorNotificationService

router = APIRouter(prefix="/admin/vendors", tags=["admin-vendor"])


def admin_required(user: User = Depends(get_current_user)):
    """Ensure user is an admin"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin access only')
    return user


class SendVendorMessageRequest(BaseModel):
    subject: Optional[str] = None
    message: str
    booking_id: Optional[int] = None
    booking_item_id: Optional[int] = None


class SendVendorNotificationRequest(BaseModel):
    type: str = 'message'
    title: str
    message: str
    booking_id: Optional[int] = None
    booking_item_id: Optional[int] = None
    link: Optional[str] = None
    priority: str = 'normal'
    send_whatsapp: bool = False
    send_email: bool = False


@router.post("/{vendor_id}/messages")
async def send_message_to_vendor(
    vendor_id: int,
    payload: SendVendorMessageRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Send a message to a specific vendor
    Creates a new thread or continues existing conversation
    """
    # Get vendor profile to find user_id
    vendor_profile = await session.get(VendorProfile, vendor_id)
    if not vendor_profile:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_user = await session.get(User, vendor_profile.user_id)
    if not vendor_user:
        raise HTTPException(status_code=404, detail="Vendor user not found")
    
    # Generate thread_id
    thread_id = f"admin_{current_user.id}_vendor_{vendor_user.id}_{int(datetime.utcnow().timestamp())}"
    
    # Create message
    message = VendorMessage(
        thread_id=thread_id,
        sender_id=current_user.id,
        recipient_id=vendor_user.id,
        subject=payload.subject or "Message from Admin",
        message=payload.message,
        booking_id=payload.booking_id,
        booking_item_id=payload.booking_item_id,
        is_read=False,
        created_at=datetime.utcnow()
    )
    
    session.add(message)
    await session.commit()
    await session.refresh(message)
    
    # Create notification for vendor
    try:
        await VendorNotificationService.create_notification(
            session=session,
            vendor_user_id=vendor_user.id,
            type='message',
            title="New message from Admin",
            message=payload.message[:100] + ('...' if len(payload.message) > 100 else ''),
            booking_id=payload.booking_id,
            booking_item_id=payload.booking_item_id,
            link=f"/vendor/messages?thread={thread_id}",
            priority='normal',
            send_whatsapp=False,
            send_email=True,
        )
    except Exception as e:
        print(f"[ADMIN_VENDOR] Failed to create notification: {e}")
    
    return {
        'ok': True,
        'message_id': message.id,
        'thread_id': thread_id,
        'vendor_user_id': vendor_user.id,
        'created_at': message.created_at.isoformat() if message.created_at else None
    }


@router.post("/{vendor_id}/notifications")
async def send_notification_to_vendor(
    vendor_id: int,
    payload: SendVendorNotificationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Send a notification to a specific vendor
    Supports multi-channel delivery (WhatsApp, Email, In-App)
    """
    # Get vendor profile to find user_id
    vendor_profile = await session.get(VendorProfile, vendor_id)
    if not vendor_profile:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_user = await session.get(User, vendor_profile.user_id)
    if not vendor_user:
        raise HTTPException(status_code=404, detail="Vendor user not found")
    
    # Create notification
    notification = await VendorNotificationService.create_notification(
        session=session,
        vendor_user_id=vendor_user.id,
        type=payload.type,
        title=payload.title,
        message=payload.message,
        booking_id=payload.booking_id,
        booking_item_id=payload.booking_item_id,
        link=payload.link,
        priority=payload.priority,
        send_whatsapp=payload.send_whatsapp,
        send_email=payload.send_email,
    )
    
    return {
        'ok': True,
        'notification_id': notification.id,
        'vendor_user_id': vendor_user.id,
        'channels_sent': {
            'in_app': True,
            'whatsapp': payload.send_whatsapp,
            'email': payload.send_email,
        }
    }


@router.get("/{vendor_id}/messages")
async def get_vendor_messages(
    vendor_id: int,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Get all messages exchanged with a specific vendor
    """
    # Get vendor profile to find user_id
    vendor_profile = await session.get(VendorProfile, vendor_id)
    if not vendor_profile:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_user_id = vendor_profile.user_id
    
    # Get messages
    stmt = text("""
        SELECT 
            id, thread_id, sender_id, recipient_id, subject, message,
            booking_id, booking_item_id, is_read, created_at, read_at
        FROM vendor_messages
        WHERE (sender_id = :vendor_user_id OR recipient_id = :vendor_user_id)
            AND (sender_id = :admin_id OR recipient_id = :admin_id)
            AND is_deleted_by_sender = FALSE
            AND is_deleted_by_recipient = FALSE
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    
    result = await session.execute(stmt, {
        'vendor_user_id': vendor_user_id,
        'admin_id': current_user.id,
        'limit': limit,
        'offset': offset
    })
    
    messages = []
    for row in result.all():
        messages.append({
            'id': row.id,
            'thread_id': row.thread_id,
            'sender_id': row.sender_id,
            'recipient_id': row.recipient_id,
            'subject': row.subject,
            'message': row.message,
            'booking_id': row.booking_id,
            'booking_item_id': row.booking_item_id,
            'is_read': row.is_read,
            'created_at': row.created_at.isoformat() if row.created_at else None,
            'read_at': row.read_at.isoformat() if row.read_at else None,
        })
    
    return {
        'messages': messages,
        'count': len(messages),
        'vendor_id': vendor_id,
        'vendor_user_id': vendor_user_id
    }


@router.get("/{vendor_id}/notifications")
async def get_vendor_notifications(
    vendor_id: int,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Get all notifications sent to a specific vendor
    """
    # Get vendor profile to find user_id
    vendor_profile = await session.get(VendorProfile, vendor_id)
    if not vendor_profile:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_user_id = vendor_profile.user_id
    
    # Get notifications
    notifications = await VendorNotificationService.get_vendor_notifications(
        session=session,
        vendor_user_id=vendor_user_id,
        limit=limit,
        offset=offset,
        unread_only=False,
    )
    
    return {
        'notifications': notifications,
        'count': len(notifications),
        'vendor_id': vendor_id,
        'vendor_user_id': vendor_user_id
    }


@router.get("/{vendor_id}/activity")
async def get_vendor_activity(
    vendor_id: int,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Get activity log for a specific vendor
    """
    # Get vendor profile to find user_id
    vendor_profile = await session.get(VendorProfile, vendor_id)
    if not vendor_profile:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_user_id = vendor_profile.user_id
    
    # Get activity log
    stmt = text("""
        SELECT 
            id, action, entity_type, entity_id, details,
            ip_address, user_agent, created_at
        FROM vendor_activity_log
        WHERE vendor_user_id = :vendor_user_id
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    
    result = await session.execute(stmt, {
        'vendor_user_id': vendor_user_id,
        'limit': limit,
        'offset': offset
    })
    
    activities = []
    for row in result.all():
        activities.append({
            'id': row.id,
            'action': row.action,
            'entity_type': row.entity_type,
            'entity_id': row.entity_id,
            'details': row.details,
            'ip_address': row.ip_address,
            'user_agent': row.user_agent,
            'created_at': row.created_at.isoformat() if row.created_at else None,
        })
    
    return {
        'activities': activities,
        'count': len(activities),
        'vendor_id': vendor_id,
        'vendor_user_id': vendor_user_id
    }


@router.post("/broadcast/notification")
async def broadcast_notification_to_all_vendors(
    payload: SendVendorNotificationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(admin_required),
):
    """
    Broadcast a notification to ALL vendors
    Use carefully - will send to every vendor in the system
    """
    # Get all vendor profiles
    stmt = select(VendorProfile)
    result = await session.execute(stmt)
    vendor_profiles = result.scalars().all()
    
    sent_count = 0
    failed_count = 0
    
    for vp in vendor_profiles:
        try:
            await VendorNotificationService.create_notification(
                session=session,
                vendor_user_id=vp.user_id,
                type=payload.type,
                title=payload.title,
                message=payload.message,
                booking_id=payload.booking_id,
                booking_item_id=payload.booking_item_id,
                link=payload.link,
                priority=payload.priority,
                send_whatsapp=payload.send_whatsapp,
                send_email=payload.send_email,
            )
            sent_count += 1
        except Exception as e:
            print(f"[ADMIN_VENDOR] Failed to send to vendor {vp.id}: {e}")
            failed_count += 1
    
    return {
        'ok': True,
        'sent_count': sent_count,
        'failed_count': failed_count,
        'total_vendors': len(vendor_profiles),
        'message': f"Notification sent to {sent_count} vendor(s)"
    }

