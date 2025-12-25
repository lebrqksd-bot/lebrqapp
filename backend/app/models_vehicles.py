"""
Vehicle Models for Transportation System

Comprehensive models for managing transportation vehicles and bookings
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base


class Vehicle(Base):
    """Vehicle Master Table"""
    __tablename__ = 'vehicles'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    vehicle_name = Column(String(100), nullable=False)
    vehicle_capacity = Column(Integer, nullable=False)
    base_fare = Column(Numeric(10, 2), nullable=False, default=0.00)
    per_km_rate = Column(Numeric(10, 2), nullable=False, default=0.00)
    minimum_km = Column(Integer, default=0)
    vehicle_image = Column(Text, nullable=True)
    extra_charges = Column(Numeric(10, 2), default=0.00)
    waiting_charges_per_hour = Column(Numeric(10, 2), default=0.00)
    night_charges = Column(Numeric(10, 2), default=0.00)
    peak_hour_multiplier = Column(Numeric(3, 2), default=1.00)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    vendor_id = Column(Integer, ForeignKey('vendor_profiles.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    vendor = relationship("VendorProfile", foreign_keys=[vendor_id])
    vehicle_bookings = relationship("VehicleBooking", back_populates="vehicle")


class VehicleBooking(Base):
    """Vehicle Booking Details"""
    __tablename__ = 'vehicle_bookings'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey('bookings.id'), nullable=False)
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'), nullable=False)
    number_of_guests = Column(Integer, nullable=False)
    guest_contact_number = Column(String(15), nullable=False)
    pickup_location = Column(Text, nullable=False)
    drop_location = Column(Text, nullable=True)
    estimated_distance_km = Column(Numeric(10, 2), nullable=True)
    base_fare = Column(Numeric(10, 2), nullable=False)
    per_km_rate = Column(Numeric(10, 2), nullable=False)
    calculated_cost = Column(Numeric(10, 2), nullable=False)
    extra_charges = Column(Numeric(10, 2), default=0.00)
    total_amount = Column(Numeric(10, 2), nullable=False)
    booking_status = Column(String(50), default='pending')
    driver_assigned = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="vehicle_bookings")
    # booking = relationship("Booking", back_populates="vehicle_booking")

