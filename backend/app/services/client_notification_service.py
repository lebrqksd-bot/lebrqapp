"""
Client Notification Service

Handles creation and management of client notifications.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Booking
from ..models_client_enhanced import ClientNotification


class ClientNotificationService:
    """Manage client notifications, including in-app, email, and future channels."""

    @staticmethod
    async def create_notification(
        session: AsyncSession,
        user_id: int,
        type: str,
        title: str,
        message: str,
        booking_id: Optional[int] = None,
        link: Optional[str] = None,
        priority: str = "normal",
        send_email: bool = False,  # reserved for future use
    ) -> ClientNotification:
        """Create and persist a client notification."""
        notification = ClientNotification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            booking_id=booking_id,
            link=link,
            priority=priority,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        session.add(notification)
        await session.flush()

        await session.commit()
        await session.refresh(notification)
        return notification

    @staticmethod
    async def notify_booking_created(session: AsyncSession, booking: Booking):
        """Send notification when a booking is created."""
        try:
            await ClientNotificationService.create_notification(
                session=session,
                user_id=booking.user_id,
                type="booking_created",
                title="Booking Submitted",
                message=f"Your booking {booking.booking_reference} was created successfully. We'll keep you updated.",
                booking_id=booking.id,
                link=f"/book/{booking.id}",
                priority="normal",
                send_email=True,
            )
        except Exception as exc:
            print(f"[CLIENT NOTIF] booking_created failed: {exc}")

    @staticmethod
    async def get_notifications(
        session: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> List[Dict[str, Any]]:
        stmt = select(ClientNotification).where(
            ClientNotification.user_id == user_id,
            ClientNotification.is_deleted.is_(False),
        )
        if unread_only:
            stmt = stmt.where(ClientNotification.is_read.is_(False))
        stmt = stmt.order_by(ClientNotification.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        notifications = result.scalars().all()
        return [
            {
                "id": note.id,
                "type": note.type,
                "title": note.title,
                "message": note.message,
                "booking_id": note.booking_id,
                "link": note.link,
                "is_read": note.is_read,
                "priority": note.priority,
                "created_at": note.created_at.isoformat() if note.created_at else None,
                "read_at": note.read_at.isoformat() if note.read_at else None,
            }
            for note in notifications
        ]

    @staticmethod
    async def get_unread_count(session: AsyncSession, user_id: int) -> int:
        stmt = text(
            """
            SELECT COUNT(*) FROM client_notifications
            WHERE user_id = :user_id AND is_read = FALSE AND is_deleted = FALSE
            """
        )
        result = await session.execute(stmt, {"user_id": user_id})
        return result.scalar() or 0

    @staticmethod
    async def mark_read(session: AsyncSession, notification_id: int, user_id: int) -> bool:
        note = await session.get(ClientNotification, notification_id)
        if not note or note.user_id != user_id:
            return False
        if not note.is_read:
            note.is_read = True
            note.read_at = datetime.utcnow()
            await session.commit()
        return True

    @staticmethod
    async def mark_all_read(session: AsyncSession, user_id: int) -> int:
        stmt = text(
            """
            UPDATE client_notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE user_id = :user_id AND is_read = FALSE
            """
        )
        result = await session.execute(stmt, {"user_id": user_id})
        await session.commit()
        return result.rowcount or 0

    @staticmethod
    async def delete_notification(session: AsyncSession, notification_id: int, user_id: int) -> bool:
        note = await session.get(ClientNotification, notification_id)
        if not note or note.user_id != user_id:
            return False
        note.is_deleted = True
        await session.commit()
        return True

    @staticmethod
    async def clear_all(session: AsyncSession, user_id: int) -> int:
        stmt = text(
            """
            UPDATE client_notifications
            SET is_deleted = TRUE
            WHERE user_id = :user_id AND is_deleted = FALSE
            """
        )
        result = await session.execute(stmt, {"user_id": user_id})
        await session.commit()
        return result.rowcount or 0

