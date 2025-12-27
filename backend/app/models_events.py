"""
Event Ticketing Models
New models for the event ticketing system.
These are optional additions that work alongside existing tables.
"""
from __future__ import annotations
from datetime import datetime, date, time
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, Date, Time, Text, Float, ForeignKey, Boolean, DECIMAL

from .db import Base


class EventDefinition(Base):
    """Master event definition/template table.
    
    Stores reusable event templates like:
    - yoga-morning: Daily yoga session
    - zumba-morning: Daily zumba class
    - live-show-xyz: One-time live show
    
    Supports recurring events via recurrence_type and recurrence_days.
    """
    __tablename__ = "event_definitions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Event identification
    event_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # 'yoga-morning', 'live-show-xyz'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Classification
    event_category: Mapped[str] = mapped_column(String(50), nullable=False)  # 'wellness', 'live-show', 'workshop'
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'yoga', 'zumba', 'concert', 'comedy'
    
    # Recurrence pattern
    recurrence_type: Mapped[str] = mapped_column(String(20), nullable=False, default='none')  # 'none', 'daily', 'weekly'
    recurrence_days: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # '1,2,3,4,5,6,7' for weekdays
    
    # Default timing (for recurring events)
    default_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)  # 07:00:00
    default_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)    # 08:00:00
    default_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    
    # Capacity & Pricing
    max_tickets: Mapped[int] = mapped_column(Integer, default=50)
    default_ticket_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0.00)
    
    # Venue linkage
    space_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("spaces.id", ondelete="SET NULL"), nullable=True)
    venue_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True)
    
    # Display
    banner_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    poster_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voice_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Voice instructions for the event
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    schedules: Mapped[list["EventSchedule"]] = relationship("EventSchedule", back_populates="definition", lazy="dynamic")
    ticket_types: Mapped[list["TicketType"]] = relationship("TicketType", back_populates="event_definition", lazy="selectin")


class EventSchedule(Base):
    """Specific occurrence/instance of an event.
    
    Generated automatically for recurring events or created manually for one-time events.
    Tracks ticket sales and availability per occurrence.
    """
    __tablename__ = "event_schedules"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Link to definition
    event_definition_id: Mapped[int] = mapped_column(Integer, ForeignKey("event_definitions.id", ondelete="CASCADE"), nullable=False)
    
    # Link to booking (for backward compatibility with admin-created events)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    
    # Schedule specifics
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    
    # Capacity for this specific occurrence
    max_tickets: Mapped[int] = mapped_column(Integer, nullable=False)
    tickets_sold: Mapped[int] = mapped_column(Integer, default=0)
    
    # Pricing override (if different from default)
    ticket_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default='scheduled')  # 'scheduled', 'cancelled', 'completed'
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)  # Blocks slot without selling tickets
    
    # Notes
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    definition: Mapped["EventDefinition"] = relationship("EventDefinition", back_populates="schedules")
    
    @property
    def tickets_available(self) -> int:
        """Calculate available tickets."""
        return self.max_tickets - self.tickets_sold
    
    @property
    def effective_price(self) -> float:
        """Get the effective price (override or default)."""
        if self.ticket_price is not None:
            return float(self.ticket_price)
        return float(self.definition.default_ticket_price) if self.definition else 0.0


class TicketType(Base):
    """Ticket type variants for events (Standard, VIP, etc.).
    
    Optional table for events that need multiple ticket tiers.
    """
    __tablename__ = "ticket_types"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_definition_id: Mapped[int] = mapped_column(Integer, ForeignKey("event_definitions.id", ondelete="CASCADE"), nullable=False)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # 'Standard', 'VIP', 'Early Bird'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    max_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # NULL = unlimited
    
    # Features/perks included with this ticket type
    perks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array or comma-separated list
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event_definition: Mapped["EventDefinition"] = relationship("EventDefinition", back_populates="ticket_types")
