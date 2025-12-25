"""
Vendor Messaging System API Router

Admin-Vendor two-way communication with threading support
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from ..db import get_session
from ..auth import get_current_user
from ..models import User
from ..models_vendor_enhanced import VendorMessage

router = APIRouter(prefix="/vendor/messages", tags=["vendor-messages"])


def vendor_required(user: User = Depends(get_current_user)):
    """Ensure user is a vendor"""
    if user.role != 'vendor':
        raise HTTPException(status_code=403, detail='Vendor access only')
    return user


class SendMessageRequest(BaseModel):
    recipient_id: int
    subject: Optional[str] = None
    message: str
    booking_id: Optional[int] = None
    booking_item_id: Optional[int] = None


class ReplyMessageRequest(BaseModel):
    message: str


@router.get("/threads")
async def get_message_threads(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """
    Get all message threads for the vendor
    Returns list of threads with last message and unread count
    """
    stmt = text("""
        SELECT 
            vm.thread_id,
            vm.subject,
            MAX(vm.created_at) as last_message_at,
            COUNT(CASE WHEN vm.is_read = FALSE AND vm.recipient_id = :user_id THEN 1 END) as unread_count,
            (SELECT message FROM vendor_messages 
             WHERE thread_id = vm.thread_id 
             ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT sender_id FROM vendor_messages 
             WHERE thread_id = vm.thread_id 
             ORDER BY created_at DESC LIMIT 1) as last_sender_id
        FROM vendor_messages vm
        WHERE (vm.sender_id = :user_id OR vm.recipient_id = :user_id)
            AND vm.is_deleted_by_sender = FALSE
            AND vm.is_deleted_by_recipient = FALSE
        GROUP BY vm.thread_id, vm.subject
        ORDER BY last_message_at DESC
    """)
    
    result = await session.execute(stmt, {'user_id': current_user.id})
    threads = []
    
    for row in result.all():
        threads.append({
            'thread_id': row.thread_id,
            'subject': row.subject,
            'last_message': row.last_message,
            'last_message_at': row.last_message_at.isoformat() if row.last_message_at else None,
            'unread_count': int(row.unread_count or 0),
            'last_sender_id': row.last_sender_id,
        })
    
    return {'threads': threads, 'count': len(threads)}


@router.get("/thread/{thread_id}")
async def get_thread_messages(
    thread_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """
    Get all messages in a thread
    Also marks messages as read
    """
    # Verify user has access to this thread
    stmt = select(VendorMessage).where(
        and_(
            VendorMessage.thread_id == thread_id,
            or_(
                VendorMessage.sender_id == current_user.id,
                VendorMessage.recipient_id == current_user.id
            )
        )
    ).order_by(VendorMessage.created_at.asc())
    
    result = await session.execute(stmt)
    messages = result.scalars().all()
    
    if not messages:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    # Mark unread messages as read
    for msg in messages:
        if msg.recipient_id == current_user.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
    
    await session.commit()
    
    # Get sender info for each message
    message_list = []
    for msg in messages:
        sender = await session.get(User, msg.sender_id)
        sender_name = f"{sender.first_name} {sender.last_name}".strip() if sender else "Unknown"
        if not sender_name or sender_name == " ":
            sender_name = sender.username if sender else "Unknown"
        
        message_list.append({
            'id': msg.id,
            'sender_id': msg.sender_id,
            'sender_name': sender_name,
            'message': msg.message,
            'created_at': msg.created_at.isoformat() if msg.created_at else None,
            'is_read': msg.is_read,
            'read_at': msg.read_at.isoformat() if msg.read_at else None,
        })
    
    return {
        'thread_id': thread_id,
        'subject': messages[0].subject if messages else None,
        'messages': message_list,
        'count': len(message_list)
    }


@router.post("")
async def send_message(
    payload: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """
    Send a new message to admin or reply in existing thread
    """
    # Verify recipient exists
    recipient = await session.get(User, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Generate thread_id if new conversation
    thread_id = f"vendor_{current_user.id}_admin_{payload.recipient_id}_{int(datetime.utcnow().timestamp())}"
    
    # Create message
    message = VendorMessage(
        thread_id=thread_id,
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        subject=payload.subject,
        message=payload.message,
        booking_id=payload.booking_id,
        booking_item_id=payload.booking_item_id,
        is_read=False,
        created_at=datetime.utcnow()
    )
    
    session.add(message)
    await session.commit()
    await session.refresh(message)
    
    # Create notification for recipient (admin)
    from ..notifications import NotificationService
    try:
        await NotificationService._create_in_app_notification(
            user_id=payload.recipient_id,
            title=f"New message from {current_user.first_name or 'Vendor'}",
            message=payload.message[:100] + ('...' if len(payload.message) > 100 else ''),
            booking_id=payload.booking_id or 0,
            session=session
        )
    except Exception as e:
        print(f"[VENDOR_MESSAGES] Failed to create notification: {e}")
    
    return {
        'ok': True,
        'message_id': message.id,
        'thread_id': thread_id,
        'created_at': message.created_at.isoformat() if message.created_at else None
    }


@router.post("/{message_id}/reply")
async def reply_to_message(
    message_id: int,
    payload: ReplyMessageRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """
    Reply to an existing message (stays in same thread)
    """
    # Get original message
    original = await session.get(VendorMessage, message_id)
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user has access to this message
    if original.sender_id != current_user.id and original.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine recipient (send to the other person in conversation)
    recipient_id = original.sender_id if original.recipient_id == current_user.id else original.recipient_id
    
    # Create reply
    reply = VendorMessage(
        thread_id=original.thread_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        subject=original.subject,
        message=payload.message,
        booking_id=original.booking_id,
        booking_item_id=original.booking_item_id,
        parent_message_id=message_id,
        is_read=False,
        created_at=datetime.utcnow()
    )
    
    session.add(reply)
    await session.commit()
    await session.refresh(reply)
    
    # Create notification for recipient
    from ..notifications import NotificationService
    try:
        await NotificationService._create_in_app_notification(
            user_id=recipient_id,
            title=f"New reply from {current_user.first_name or 'Vendor'}",
            message=payload.message[:100] + ('...' if len(payload.message) > 100 else ''),
            booking_id=original.booking_id or 0,
            session=session
        )
    except Exception as e:
        print(f"[VENDOR_MESSAGES] Failed to create notification: {e}")
    
    return {
        'ok': True,
        'message_id': reply.id,
        'thread_id': original.thread_id,
        'created_at': reply.created_at.isoformat() if reply.created_at else None
    }


@router.post("/{message_id}/read")
async def mark_message_read(
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Mark a message as read"""
    message = await session.get(VendorMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only mark your own messages as read")
    
    if not message.is_read:
        message.is_read = True
        message.read_at = datetime.utcnow()
        await session.commit()
    
    return {'ok': True, 'message_id': message_id}


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Soft delete a message"""
    message = await session.get(VendorMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Soft delete based on user role
    if message.sender_id == current_user.id:
        message.is_deleted_by_sender = True
    elif message.recipient_id == current_user.id:
        message.is_deleted_by_recipient = True
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await session.commit()
    
    return {'ok': True, 'message_id': message_id}


@router.get("/unread-count")
async def get_unread_message_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(vendor_required),
):
    """Get count of unread messages"""
    stmt = text("""
        SELECT COUNT(*) FROM vendor_messages
        WHERE recipient_id = :user_id 
            AND is_read = FALSE 
            AND is_deleted_by_recipient = FALSE
    """)
    
    result = await session.execute(stmt, {'user_id': current_user.id})
    count = result.scalar() or 0
    
    return {'count': int(count)}

