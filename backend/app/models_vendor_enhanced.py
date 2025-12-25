"""
Enhanced Vendor Models

Additional models for vendor communication and notifications
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .models import Base


class VendorNotification(Base):
    """Vendor-specific notifications"""
    __tablename__ = "vendor_notifications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendor_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # new_order, order_update, message, etc.
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    booking_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("booking_items.id"), nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[str] = mapped_column(String(20), default='normal')  # low, normal, high, urgent
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class VendorMessage(Base):
    """Admin-Vendor messaging system"""
    __tablename__ = "vendor_messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thread_id: Mapped[str] = mapped_column(String(100), nullable=False)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    booking_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("booking_items.id"), nullable=True)
    parent_message_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("vendor_messages.id"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted_by_sender: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted_by_recipient: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class VendorActivityLog(Base):
    """Track vendor actions for analytics"""
    __tablename__ = "vendor_activity_log"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendor_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BookingItemStatusHistory(Base):
    """Track booking item status changes and catalog item status changes"""
    __tablename__ = "booking_item_status_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("booking_items.id"), nullable=True)
    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    changed_by_role: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

