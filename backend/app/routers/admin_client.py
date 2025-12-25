"""
Admin ↔ Client Messaging API

Provides two routers:
- /client/messages for customer-facing messaging APIs
- /admin/client-messages for admin tooling
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Body, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import User
from ..models_client_enhanced import ClientMessage
from ..notifications import NotificationService
from ..services.client_notification_service import ClientNotificationService


client_router = APIRouter(prefix="/client/messages", tags=["client-messages"])
admin_router = APIRouter(prefix="/admin/client-messages", tags=["admin-client-messages"])


def customer_required(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("customer", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customers only")
    return user


def admin_required(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


class ClientComposeRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=1, max_length=4000)
    booking_id: Optional[int] = None


class ReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class AdminComposeRequest(BaseModel):
    client_id: int
    subject: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=1, max_length=4000)
    booking_id: Optional[int] = None


async def _get_default_admin(session: AsyncSession) -> User:
    stmt = select(User).where(User.role == "admin").order_by(User.id.asc())
    rs = await session.execute(stmt)
    admin = rs.scalars().first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No admin available")
    return admin


async def _get_thread_participants(session: AsyncSession, thread_id: str) -> List[int]:
    stmt = (
        select(ClientMessage.sender_id, ClientMessage.recipient_id)
        .where(ClientMessage.thread_id == thread_id)
        .limit(1)
    )
    rs = await session.execute(stmt)
    row = rs.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return [row.sender_id, row.recipient_id]


async def _record_client_notification(
    session: AsyncSession,
    user_id: int,
    thread_id: str,
    subject: Optional[str],
    message_preview: str,
    booking_id: Optional[int],
) -> None:
    preview = (message_preview or "").strip()
    if len(preview) > 140:
        preview = f"{preview[:137]}..."
    try:
        await ClientNotificationService.create_notification(
            session=session,
            user_id=user_id,
            type="admin_message",
            title=subject or "Message from Admin",
            message=preview or "You have a new message from the admin team.",
            booking_id=booking_id,
            link=f"/messages?thread={thread_id}",
            priority="normal",
        )
    except Exception as exc:  # pragma: no cover - non-blocking
        print(f"[CLIENT MSG] Notification failure for user {user_id}: {exc}")


# -----------------------------
# Client-facing endpoints
# -----------------------------


@client_router.get("/threads")
async def list_client_threads(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    stmt = text(
        """
        SELECT
            cm.thread_id,
            MAX(cm.created_at) AS last_message_at,
            MAX(cm.subject) AS subject,
            MAX(cm.booking_id) AS booking_id,
            SUM(CASE WHEN cm.is_read = 0 AND cm.recipient_id = :user_id THEN 1 ELSE 0 END) AS unread_count,
            (SELECT message FROM client_messages WHERE thread_id = cm.thread_id ORDER BY created_at DESC LIMIT 1) AS last_message
        FROM client_messages cm
        WHERE (cm.sender_id = :user_id OR cm.recipient_id = :user_id)
          AND cm.is_deleted_by_sender = FALSE
          AND cm.is_deleted_by_recipient = FALSE
        GROUP BY cm.thread_id
        ORDER BY last_message_at DESC
        """
    )
    rows = await session.execute(stmt, {"user_id": current_user.id})
    threads = []
    for row in rows:
        threads.append(
            {
                "thread_id": row.thread_id,
                "subject": row.subject,
                "booking_id": row.booking_id,
                "last_message": row.last_message,
                "last_message_at": row.last_message_at.isoformat() if row.last_message_at else None,
                "unread_count": int(row.unread_count or 0),
            }
        )
    return {"threads": threads, "count": len(threads)}


@client_router.get("/thread/{thread_id}")
async def get_client_thread(
    thread_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    stmt = (
        select(ClientMessage)
        .where(
            and_(
                ClientMessage.thread_id == thread_id,
                or_(
                    ClientMessage.sender_id == current_user.id,
                    ClientMessage.recipient_id == current_user.id,
                ),
            )
        )
        .order_by(ClientMessage.created_at.asc())
    )
    rs = await session.execute(stmt)
    messages = rs.scalars().all()
    if not messages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    for msg in messages:
        if msg.recipient_id == current_user.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
    await session.commit()

    formatted = []
    for msg in messages:
        sender = await session.get(User, msg.sender_id)
        sender_name = (
            f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            or sender.username
            if sender
            else "User"
        )
        formatted.append(
            {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "sender_name": sender_name,
                "message": msg.message,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "is_read": msg.is_read,
            }
        )

    return {
        "thread_id": thread_id,
        "subject": messages[0].subject if messages else None,
        "booking_id": messages[0].booking_id if messages else None,
        "messages": formatted,
    }


@client_router.post("")
async def create_client_message(
    payload: ClientComposeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    admin_user = await _get_default_admin(session)
    thread_id = f"client_{current_user.id}_{uuid.uuid4().hex[:8]}"
    message = ClientMessage(
        thread_id=thread_id,
        sender_id=current_user.id,
        recipient_id=admin_user.id,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        booking_id=payload.booking_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)

    # Notify admin (in-app)
    try:
        await NotificationService._create_in_app_notification(
            user_id=admin_user.id,
            title=f"New client message: {payload.subject.strip()}",
            message=payload.message[:120] + ("..." if len(payload.message) > 120 else ""),
            booking_id=payload.booking_id or 0,
            session=session,
        )
    except Exception as exc:  # pragma: no cover
        print(f"[CLIENT MSG] Failed to create admin notification: {exc}")

    return {"ok": True, "thread_id": thread_id, "message_id": message.id}


@client_router.post("/threads/{thread_id}/reply")
async def reply_client_thread(
    thread_id: str,
    payload: ReplyRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    participants = await _get_thread_participants(session, thread_id)
    if current_user.id not in participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    recipient_id = participants[0] if participants[1] == current_user.id else participants[1]

    # Only allow replying to admin recipients
    recipient = await session.get(User, recipient_id)
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient missing")

    stmt = (
        select(ClientMessage)
        .where(ClientMessage.thread_id == thread_id)
        .order_by(ClientMessage.created_at.asc())
        .limit(1)
    )
    rs = await session.execute(stmt)
    first_message = rs.scalars().first()
    subject = first_message.subject if first_message else None
    booking_id = first_message.booking_id if first_message else None

    reply = ClientMessage(
        thread_id=thread_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        subject=subject,
        message=payload.message.strip(),
        booking_id=booking_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    session.add(reply)
    await session.commit()
    await session.refresh(reply)

    # Notify admin of reply
    try:
        await NotificationService._create_in_app_notification(
            user_id=recipient_id,
            title="Client replied to your message",
            message=payload.message[:120] + ("..." if len(payload.message) > 120 else ""),
            booking_id=booking_id or 0,
            session=session,
        )
    except Exception as exc:  # pragma: no cover
        print(f"[CLIENT MSG] Admin notification failed: {exc}")

    return {"ok": True, "message_id": reply.id}


@client_router.get("/unread-count")
async def client_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    stmt = text(
        """
        SELECT COUNT(*) FROM client_messages
        WHERE recipient_id = :user_id AND is_read = FALSE AND is_deleted_by_recipient = FALSE
        """
    )
    rs = await session.execute(stmt, {"user_id": current_user.id})
    count = rs.scalar() or 0
    return {"count": int(count)}


# -----------------------------
# Admin endpoints
# -----------------------------


@admin_router.get("/threads")
async def admin_list_threads(
    client_id: Optional[int] = Query(None, description="Filter by client user ID"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    params = {"admin_id": admin.id}
    where_clause = "1=1"
    if client_id:
        params["client_id"] = client_id
        where_clause = """
            EXISTS (
                SELECT 1 FROM client_messages cmp
                WHERE cmp.thread_id = cm.thread_id
                  AND (cmp.sender_id = :client_id OR cmp.recipient_id = :client_id)
            )
        """

    stmt = text(
        f"""
        SELECT
            cm.thread_id,
            MAX(cm.created_at) AS last_message_at,
            MAX(cm.subject) AS subject,
            MAX(cm.booking_id) AS booking_id,
            SUM(CASE WHEN cm.is_read = 0 AND cm.recipient_id = :admin_id THEN 1 ELSE 0 END) AS unread_count
        FROM client_messages cm
        WHERE (cm.sender_id = :admin_id OR cm.recipient_id = :admin_id)
          AND cm.is_deleted_by_sender = FALSE
          AND cm.is_deleted_by_recipient = FALSE
          AND {where_clause}
        GROUP BY cm.thread_id
        ORDER BY last_message_at DESC
        """
    )
    rows = await session.execute(stmt, params)

    threads = []
    for row in rows:
        first_msg_stmt = (
            select(ClientMessage)
            .where(ClientMessage.thread_id == row.thread_id)
            .order_by(ClientMessage.created_at.asc())
            .limit(1)
        )
        rs_first = await session.execute(first_msg_stmt)
        first_msg = rs_first.scalars().first()
        client_info = None
        if first_msg:
            other_id = first_msg.sender_id if first_msg.sender_id != admin.id else first_msg.recipient_id
            client = await session.get(User, other_id)
            if client:
                client_info = {
                    "id": client.id,
                    "name": f"{client.first_name or ''} {client.last_name or ''}".strip() or client.username,
                    "email": client.username,
                }
        threads.append(
            {
                "thread_id": row.thread_id,
                "subject": row.subject,
                "booking_id": row.booking_id,
                "last_message_at": row.last_message_at.isoformat() if row.last_message_at else None,
                "unread_count": int(row.unread_count or 0),
                "client": client_info,
            }
        )
    return {"threads": threads, "count": len(threads)}


@admin_router.get("/thread/{thread_id}")
async def admin_get_thread(
    thread_id: str,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    stmt = (
        select(ClientMessage)
        .where(
            and_(
                ClientMessage.thread_id == thread_id,
                or_(
                    ClientMessage.sender_id == admin.id,
                    ClientMessage.recipient_id == admin.id,
                ),
            )
        )
        .order_by(ClientMessage.created_at.asc())
    )
    rs = await session.execute(stmt)
    messages = rs.scalars().all()
    if not messages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    for msg in messages:
        if msg.recipient_id == admin.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
    await session.commit()

    formatted = []
    client_data = None
    for msg in messages:
        sender = await session.get(User, msg.sender_id)
        sender_name = (
            f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            or sender.username
            if sender
            else "User"
        )
        formatted.append(
            {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "sender_name": sender_name,
                "message": msg.message,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "is_read": msg.is_read,
            }
        )
        if sender and sender.role == "customer":
            client_data = {
                "id": sender.id,
                "name": sender_name,
                "email": sender.username,
                "mobile": sender.mobile,
            }

    return {
        "thread_id": thread_id,
        "subject": messages[0].subject if messages else None,
        "booking_id": messages[0].booking_id if messages else None,
        "client": client_data,
        "messages": formatted,
    }


@admin_router.post("")
async def admin_start_conversation(
    payload: AdminComposeRequest,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    client = await session.get(User, payload.client_id)
    if not client or client.role != "customer":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    thread_id = f"admin_{admin.id}_{uuid.uuid4().hex[:8]}"
    message = ClientMessage(
        thread_id=thread_id,
        sender_id=admin.id,
        recipient_id=client.id,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        booking_id=payload.booking_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)

    await _record_client_notification(
        session=session,
        user_id=client.id,
        thread_id=thread_id,
        subject=payload.subject.strip(),
        message_preview=payload.message,
        booking_id=payload.booking_id,
    )

    return {"ok": True, "thread_id": thread_id, "message_id": message.id}


@admin_router.post("/threads/{thread_id}/reply")
async def admin_reply_thread(
    thread_id: str,
    payload: ReplyRequest,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    participants = await _get_thread_participants(session, thread_id)
    if admin.id not in participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    recipient_id = participants[0] if participants[1] == admin.id else participants[1]
    recipient = await session.get(User, recipient_id)
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client missing")

    stmt = (
        select(ClientMessage)
        .where(ClientMessage.thread_id == thread_id)
        .order_by(ClientMessage.created_at.asc())
        .limit(1)
    )
    rs = await session.execute(stmt)
    first_message = rs.scalars().first()
    subject = first_message.subject if first_message else None
    booking_id = first_message.booking_id if first_message else None

    reply = ClientMessage(
        thread_id=thread_id,
        sender_id=admin.id,
        recipient_id=recipient_id,
        subject=subject,
        message=payload.message.strip(),
        booking_id=booking_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    session.add(reply)
    await session.commit()
    await session.refresh(reply)

    await _record_client_notification(
        session=session,
        user_id=recipient_id,
        thread_id=thread_id,
        subject=subject or "New message",
        message_preview=payload.message,
        booking_id=booking_id,
    )

    return {"ok": True, "message_id": reply.id}


@admin_router.get("/unread-count")
async def admin_message_unread(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    stmt = text(
        """
        SELECT COUNT(*) FROM client_messages
        WHERE recipient_id = :user_id AND is_read = FALSE AND is_deleted_by_recipient = FALSE
        """
    )
    rs = await session.execute(stmt, {"user_id": admin.id})
    count = rs.scalar() or 0
    return {"count": int(count)}

