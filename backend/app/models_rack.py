"""
Rack and Rack Product Models
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, Text, Float, ForeignKey, Boolean, JSON
from .db import Base


class Rack(Base):
    """Rack model for storing rack information"""
    __tablename__ = "racks"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, comment="QR code identifier")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="Category name for the rack")
    category_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Category image URL")
    qr_code_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Permanent QR code URL for this rack")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    meta_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, name="metadata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    products: Mapped[list["RackProduct"]] = relationship("RackProduct", back_populates="rack", cascade="all, delete-orphan")


class RackProduct(Base):
    """Products assigned to a rack"""
    __tablename__ = "rack_products"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rack_id: Mapped[int] = mapped_column(Integer, ForeignKey("racks.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Primary image URL (for backward compatibility)")
    images_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="JSON array of image URLs: ['url1', 'url2', ...]")
    videos_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="JSON array of video URLs: ['url1', 'url2', ...]")
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, comment="Available quantity in stock")
    delivery_time: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="e.g., '2-3 days', 'In stock'")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", comment="active or inactive")
    meta_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, name="metadata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    rack: Mapped["Rack"] = relationship("Rack", back_populates="products")


class RackOrder(Base):
    """Orders placed for rack products"""
    __tablename__ = "rack_orders"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rack_id: Mapped[int] = mapped_column(Integer, ForeignKey("racks.id"), nullable=False, index=True)
    
    # Order details
    order_reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    original_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Amount before discount")
    items_json: Mapped[dict] = mapped_column(JSON, nullable=False, comment="Cart items: [{product_id, name, price, quantity, subtotal}, ...]")
    
    # Offer details
    applied_offer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("offers.id"), nullable=True)
    discount_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Surprise gift fields
    is_surprise_gift: Mapped[bool] = mapped_column(Boolean, default=False)
    recipient_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_mobile: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pin_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    occasion_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="birthday, anniversary, other")
    birthday_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    personal_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Payment details
    payment_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("payments.id"), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(32), default="pending", comment="pending, completed, failed")
    
    # Status
    status: Mapped[str] = mapped_column(String(32), default="pending", comment="pending, confirmed, shipped, delivered, cancelled")
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
