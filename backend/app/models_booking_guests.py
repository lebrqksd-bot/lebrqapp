"""
Booking Guests Model
Stores individual guest information for bookings
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, Text, Boolean, ForeignKey
from .db import Base


class BookingGuest(Base):
    """Guest information for a booking"""
    __tablename__ = "booking_guests"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile: Mapped[str] = mapped_column(String(15), nullable=False)
    pickup_location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    needs_transportation: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # booking: Mapped["Booking"] = relationship("Booking", back_populates="guests")

