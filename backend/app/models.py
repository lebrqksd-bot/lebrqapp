
from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List, List
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, Date, Text, Float, ForeignKey, Boolean, JSON
from .db import Base

class ProgramParticipant(Base):
    __tablename__ = "program_participants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False)
    program_type: Mapped[str] = mapped_column(String(16), nullable=False)  # yoga|zumba|live
    subscription_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # daily|monthly
    ticket_quantity: Mapped[int] = mapped_column(Integer, default=1)  # Number of tickets/participants
    # Optional: link a participant entry to a specific booking (e.g., live show booking)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    amount_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # Track if subscription is still active
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # Track if participant entry is verified
    scan_count: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)  # Track number of times ticket has been scanned
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # When entry was verified


from datetime import datetime, date
from typing import Optional, List
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, Date, Text, Float, ForeignKey, Boolean, JSON

from .db import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    date_text: Mapped[str] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schedule: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    start_time: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # HH:MM:SS format for program start time
    end_time: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)    # HH:MM:SS format for program end time
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft|pending|approved|rejected
    poster_url: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    event_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("events.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    profile_image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="editor")  # admin|approver|editor|customer|vendor|broker
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True, comment="User date of birth for birthday offers")
    suspended_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="User suspended until this date (for customers)")
    admin_viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="When admin viewed this user (for badge tracking)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --- Vendor profile (links to users with role 'vendor') ---
class VendorProfile(Base):
    __tablename__ = "vendor_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Vendor address
    suspended_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Vendor suspended until this date
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --- Broker profile (links to users with role 'broker') ---
class BrokerProfile(Base):
    __tablename__ = "broker_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Broker address
    brokerage_percentage: Mapped[float] = mapped_column(Float, default=0.0, comment="Brokerage percentage for this broker")
    # Bank account details for settlements
    bank_account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    bank_ifsc_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, comment="Broker approval status - must be approved by admin before access")
    suspended_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Broker suspended until this date
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --- Venues and Spaces ---
class Venue(Base):
    __tablename__ = "venues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(80), default="UTC")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Space(Base):
    __tablename__ = "spaces"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    venue_id: Mapped[int] = mapped_column(Integer, ForeignKey("venues.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    price_per_hour: Mapped[float] = mapped_column(Float, default=0.0)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    pricing_overrides: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    event_types: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    # Admin-configurable arrays for stage decorations and banner sizes
    stage_options: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    banner_sizes: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Timeslot(Base):
    __tablename__ = "timeslots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    space_id: Mapped[int] = mapped_column(Integer, ForeignKey("spaces.id"), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    start_time: Mapped[str] = mapped_column(String(8), nullable=False)  # HH:MM:SS
    end_time: Mapped[str] = mapped_column(String(8), nullable=False)
    price_modifier: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


# --- Items and booking items ---
class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendor_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("vendor_profiles.id"), nullable=True)
    # Catalog classification
    main_category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="Main event category: social-life|cultural-religious|corporate-business|educational-academic|health-wellness-sports|cake-others")
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="Legacy category: cake|food|team|transport")
    subcategory: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="Subcategory: birthday-party|engagement-ring-ceremony|breakfast|lunch|etc.")
    type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # e.g., veg|non-veg
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Pricing system (three-tier: vendor price, markup, final price)
    vendor_price: Mapped[float] = mapped_column(Float, default=0.0, comment="Base price from vendor (cost)")
    admin_markup_percent: Mapped[float] = mapped_column(Float, default=0.0, comment="Admin markup percentage")
    price: Mapped[float] = mapped_column(Float, default=0.0, comment="Final customer price (calculated)")
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Performance team specific fields
    video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Video URL for performance team (legacy, use item_media for multiple)")
    profile_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Profile photo URL for performance team")
    profile_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Profile information/description for performance team")
    # Comprehensive performance team profile data (JSON structure)
    performance_team_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="Complete performance team profile: history, experience, team members, achievements, contact info, etc.")
    # Optional scoping to a space (e.g., Grant Hall)
    space_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("spaces.id"), nullable=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    item_status: Mapped[str] = mapped_column(String(32), default="available", comment="Item status: available, under_maintenance, out_of_stock")
    preparation_time_minutes: Mapped[int] = mapped_column(Integer, default=0, comment="Minimum preparation time in minutes")
    # Hour-based pricing for paid add-ons (catering, photo point, RGB lights, singers, MC, dancers, etc.)
    base_hours_included: Mapped[int] = mapped_column(Integer, default=0, comment="Base hours included in price (e.g., 3 hours)")
    rate_per_extra_hour: Mapped[float] = mapped_column(Float, default=0.0, comment="Rate per extra hour beyond base hours (e.g., ₹1000/hour)")
    # Offer eligibility flag
    is_eligible_for_space_offer: Mapped[bool] = mapped_column(Boolean, default=True, comment="Whether this item is eligible for space offers (halls, meeting rooms, programs)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class ItemMedia(Base):
    """Multiple images and videos for items"""
    __tablename__ = "item_media"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False, comment="image or video")
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_reference: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # Optional reference to group related bookings (series)
    series_reference: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    broker_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("broker_profiles.id"), nullable=True, comment="Broker who made this booking")
    venue_id: Mapped[int] = mapped_column(Integer, ForeignKey("venues.id"), nullable=False)
    space_id: Mapped[int] = mapped_column(Integer, ForeignKey("spaces.id"), nullable=False)
    # time_slot_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("timeslots.id"), nullable=True)
    start_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attendees: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    brokerage_amount: Mapped[float] = mapped_column(Float, default=0.0, comment="Brokerage amount for broker")
    # currency: Mapped[str] = mapped_column(String(8), default="USD")
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Classification for booking type (e.g., 'one_day', 'live-', 'daily')
    # Default to 'one_day' to satisfy NOT NULL constraint in deployed DB
    booking_type: Mapped[str] = mapped_column(String(50), nullable=False, default="one_day")
    event_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_admin_booking: Mapped[Optional[bool]] = mapped_column(Boolean, default=False, nullable=True)
    banner_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stage_banner_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Broker settlement fields
    broker_settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="Whether broker payment has been settled")
    broker_settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="When broker payment was settled")
    broker_settled_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, comment="User who marked broker as settled")
    admin_viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="When admin viewed this booking (for badge tracking)")


class BookingItem(Base):
    __tablename__ = "booking_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("items.id"), nullable=False)
    vendor_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("vendor_profiles.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total_price: Mapped[float] = mapped_column(Float, default=0.0)
    # New fields: store the booking's event date, the booking's status at time of creation,
    # and whether the item has been supplied (fulfilled) yet.
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    booking_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # Keep DB column name exactly as requested (is_supplyed) while exposing attribute is_supplied in Python
    is_supplied: Mapped[bool] = mapped_column("is_supplyed", Boolean, default=False, nullable=False)
    # Vendor rejection fields
    rejection_status: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rejection_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Supply verification fields
    supplied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    supply_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Payment settlement fields
    payment_settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    payment_settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    payment_settled_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    # Supply reminder field
    supply_reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Vendor acceptance field
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Hour-based pricing: hours used for this booking item (for paid add-ons with hour-based pricing)
    hours_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Hours used for this item (for hour-based pricing)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    provider_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    order_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None, onupdate=datetime.utcnow, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    gateway_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class Refund(Base):
    __tablename__ = "refunds"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|processing|completed|failed
    refund_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # cancellation|edit|admin
    refund_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # original_payment|bank_transfer|wallet
    refund_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # External refund ID
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Additional notes
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class BookingEvent(Base):
    __tablename__ = "booking_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False)
    actor_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    to_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BookingItemRejection(Base):
    """Track all vendor rejections for a booking item"""
    __tablename__ = "booking_item_rejections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("booking_items.id", ondelete="CASCADE"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(Integer, ForeignKey("vendor_profiles.id", ondelete="CASCADE"), nullable=False)
    rejection_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# --- Dynamic Page Content (CMS-like) ---
class PageContent(Base):
    __tablename__ = "page_content"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)  # e.g. 'about', 'privacy-policy'
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # stored as sanitized HTML
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --- Gallery ---
class GalleryImage(Base):
    __tablename__ = "gallery_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)  # relative path under static mount, e.g., 'gallery/abc.jpg'
    media_type: Mapped[str] = mapped_column(String(10), nullable=False, default="image", comment="image or video")
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --- WhatsApp Integration ---
class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversations"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")  # active|closed|archived
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(Integer, ForeignKey("whatsapp_conversations.id"), nullable=False)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)  # inbound|outbound
    message_type: Mapped[str] = mapped_column(String(32), default="text")  # text|image|document|template
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="delivered")  # sent|delivered|read|failed
    message_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WhatsAppKeywordResponse(Base):
    __tablename__ = "whatsapp_keyword_responses"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    keywords: Mapped[str] = mapped_column(String(500), nullable=False)  # Comma-separated keywords
    response: Mapped[str] = mapped_column(Text, nullable=False)  # Response message
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # Enable/disable this keyword response
    match_type: Mapped[str] = mapped_column(String(16), default="contains")  # contains|exact|starts_with|ends_with
    priority: Mapped[int] = mapped_column(Integer, default=0)  # Higher priority checked first
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="Soft delete timestamp")


class WhatsAppQuickReply(Base):
    """Quick reply buttons shown after greeting message"""
    __tablename__ = "whatsapp_quick_replies"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("whatsapp_quick_replies.id"), nullable=True, comment="Parent quick reply ID for sub-questions")
    button_text: Mapped[str] = mapped_column(String(200), nullable=False, comment="Text displayed on button (e.g., 'Price', 'Today Slot')")
    message_text: Mapped[str] = mapped_column(String(500), nullable=False, comment="Message sent when button is clicked (e.g., 'price', 'cost', 'today slot')")
    response_type: Mapped[str] = mapped_column(String(50), default="static", comment="Response type: static, price, slots, contact")
    display_order: Mapped[int] = mapped_column(Integer, default=0, comment="Order in which buttons appear (lower = first)")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="Enable/disable this quick reply button")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="Soft delete timestamp")
    
    # Relationship for sub-questions
    # Note: For self-referential relationships, we use remote_side on children and single_parent on parent
    children: Mapped[List["WhatsAppQuickReply"]] = relationship(
        "WhatsAppQuickReply",
        back_populates="parent",
        foreign_keys=[parent_id],
        remote_side=[id],
        cascade="all, delete"
    )
    parent: Mapped[Optional["WhatsAppQuickReply"]] = relationship(
        "WhatsAppQuickReply",
        back_populates="children",
        foreign_keys=[parent_id],
        single_parent=True
    )


# --- HR & Payroll Module ---
class Staff(Base):
    __tablename__ = "staff"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    
    # Personal Details
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aadhar_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    emergency_contact_relation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Job Details
    role: Mapped[str] = mapped_column(String(100), nullable=False)  # Designation
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    salary_type: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")  # monthly|hourly
    fixed_salary: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # For monthly
    hourly_wage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # For hourly
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    # Allowances (stored as JSON for flexibility)
    allowances: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {hra: 5000, travel: 2000, food: 1500, custom: {...}}
    
    # Deductions (stored as JSON for flexibility)
    deductions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {pf: 1800, esi: 500, tds: 2000, custom: {...}}
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    documents: Mapped[List["StaffDocument"]] = relationship("StaffDocument", back_populates="staff", cascade="all, delete-orphan")
    attendance_records: Mapped[List["Attendance"]] = relationship("Attendance", back_populates="staff")
    leaves: Mapped[List["Leave"]] = relationship("Leave", back_populates="staff")
    payrolls: Mapped[List["Payroll"]] = relationship("Payroll", back_populates="staff")
    attendance_otps: Mapped[List["AttendanceOTP"]] = relationship("AttendanceOTP", back_populates="staff")


class StaffDocument(Base):
    __tablename__ = "staff_documents"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)  # id|photo|offer_letter|contract|other
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # in bytes
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    uploaded_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    staff: Mapped["Staff"] = relationship("Staff", back_populates="documents")


class Attendance(Base):
    __tablename__ = "attendance"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    
    # Check-in/Check-out
    check_in_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    check_out_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Calculated working hours
    overtime_hours: Mapped[Optional[float]] = mapped_column(Float, default=0.0)  # Overtime hours
    
    # GPS Coordinates
    check_in_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_in_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_out_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_out_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Device Info
    check_in_device_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # mobile|web|tablet
    check_in_ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv4 or IPv6
    check_out_device_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    check_out_ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="present")  # present|absent|half_day|holiday|leave
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)  # True if manually corrected by admin
    manual_correction_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    corrected_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    corrected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    staff: Mapped["Staff"] = relationship("Staff", back_populates="attendance_records")
    corrected_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[corrected_by_user_id])


class Leave(Base):
    __tablename__ = "leaves"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    
    # Leave Details
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # casual|sick|paid|unpaid
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[float] = mapped_column(Float, nullable=False)  # Can be 0.5 for half-day
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Approval Flow
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    approved_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    staff: Mapped["Staff"] = relationship("Staff", back_populates="leaves")


class Payroll(Base):
    __tablename__ = "payroll"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    
    # Payroll Period
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    
    # Working Days Calculation
    total_working_days: Mapped[int] = mapped_column(Integer, nullable=False)  # Total working days in month
    present_days: Mapped[float] = mapped_column(Float, nullable=False)  # Days present
    absent_days: Mapped[float] = mapped_column(Float, default=0.0)
    leave_days: Mapped[float] = mapped_column(Float, default=0.0)
    unpaid_leave_days: Mapped[float] = mapped_column(Float, default=0.0)
    half_days: Mapped[float] = mapped_column(Float, default=0.0)
    holidays: Mapped[int] = mapped_column(Integer, default=0)
    
    # Hours (for hourly employees)
    total_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overtime_hours: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    
    # Salary Calculation
    basic_salary: Mapped[float] = mapped_column(Float, nullable=False)
    calculated_salary: Mapped[float] = mapped_column(Float, nullable=False)  # (Basic / Total Days) * Present Days
    total_allowances: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_pay: Mapped[float] = mapped_column(Float, default=0.0)
    total_deductions: Mapped[float] = mapped_column(Float, default=0.0)
    leave_deductions: Mapped[float] = mapped_column(Float, default=0.0)  # Deduction for unpaid leaves
    net_salary: Mapped[float] = mapped_column(Float, nullable=False)  # Final salary after all calculations
    
    # Breakdown (stored as JSON for detailed view)
    allowances_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    deductions_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|processed|locked
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # Lock after processing
    salary_slip_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # PDF URL
    
    processed_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    staff: Mapped["Staff"] = relationship("Staff", back_populates="payrolls")


class Office(Base):
    __tablename__ = "offices"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    qr_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)  # Unique QR identifier
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    allowed_radius: Mapped[float] = mapped_column(Float, default=100.0)  # in meters, default 100m
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    qr_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Track when QR was generated
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class AttendanceOTP(Base):
    __tablename__ = "attendance_otps"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    otp: Mapped[str] = mapped_column(String(10), nullable=False)  # 4 or 6 digit OTP
    status: Mapped[str] = mapped_column(String(20), default="valid")  # valid|used|expired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Track wrong attempts
    wrong_attempts: Mapped[int] = mapped_column(Integer, default=0)
    blocked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Block attendance for 10 minutes after multiple wrong attempts
    
    # Relationships
    staff: Mapped["Staff"] = relationship("Staff", back_populates="attendance_otps")


class InvoiceEdit(Base):
    """Store edited invoice data for bookings"""
    __tablename__ = "invoice_edits"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    
    # Edited invoice data stored as JSON
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gst_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    brokerage_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Items stored as JSON array
    items: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # List of item dicts
    
    # Metadata
    edited_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --- Offers & Coupons Module ---
class Offer(Base):
    """Offers system: Festival, Birthday, First X Users"""
    __tablename__ = "offers"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Offer type: festival, birthday, first_x_users
    offer_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    
    # Common fields
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, comment="Higher priority = applied first. Coupon=100, Festival=50, Birthday=30, FirstX=10")
    
    # Discount configuration
    discount_type: Mapped[str] = mapped_column(String(16), nullable=False)  # percentage or flat
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)  # % or flat amount
    min_purchase_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Minimum purchase amount to apply offer")
    max_discount_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Maximum discount cap (for percentage)")
    
    # Festival offer fields
    festival_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    
    # First X Users offer fields
    number_of_users: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Number of users who can claim (first X users)")
    claimed_count: Mapped[int] = mapped_column(Integer, default=0, comment="How many users have claimed this offer")
    
    # Rack offer surprise gift fields
    surprise_gift_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="Name of the surprise gift for rack offers")
    surprise_gift_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Image URL of the surprise gift for rack offers")
    
    # Metadata
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Coupon(Base):
    """Coupon codes for discounts"""
    __tablename__ = "coupons"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Coupon code (unique, uppercase)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # Discount configuration
    discount_type: Mapped[str] = mapped_column(String(16), nullable=False)  # percentage or flat
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)  # % or flat amount
    min_purchase_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Minimum purchase amount to apply coupon")
    max_discount_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Maximum discount cap (for percentage)")
    
    # Usage limits
    max_usage_per_user: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Max times a single user can use this coupon")
    max_usage_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Total max usage across all users")
    current_usage_count: Mapped[int] = mapped_column(Integer, default=0, comment="Current total usage count")
    
    # Validity
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    
    # Metadata
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OfferNotification(Base):
    """Track which users have been informed about offers"""
    __tablename__ = "offer_notifications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    offer_id: Mapped[int] = mapped_column(Integer, ForeignKey("offers.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification channels used
    whatsapp_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sms_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Metadata
    notified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notified_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Unique constraint: one notification record per offer-user combination
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )


class OfferUsage(Base):
    """Track offer usage by users"""
    __tablename__ = "offer_usage"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    offer_id: Mapped[int] = mapped_column(Integer, ForeignKey("offers.id"), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    
    # Discount applied
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False)
    original_amount: Mapped[float] = mapped_column(Float, nullable=False)
    final_amount: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Metadata
    used_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class CouponUsage(Base):
    """Track coupon usage by users"""
    __tablename__ = "coupon_usage"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    coupon_id: Mapped[int] = mapped_column(Integer, ForeignKey("coupons.id"), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    
    # Discount applied
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False)
    original_amount: Mapped[float] = mapped_column(Float, nullable=False)
    final_amount: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Metadata
    used_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


# ==================== CONTEST SYSTEM ====================

class Contest(Base):
    """Contest/Offer campaigns (birthday, anniversary, etc.)"""
    __tablename__ = "contests"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hero_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Dates
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    
    # Eligibility
    applicable_event_types: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # ["birthday", "anniversary", "other"]
    
    # Rules
    first_x_winners: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Number of winners (first X entries)")
    eligibility_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    per_user_limit: Mapped[int] = mapped_column(Integer, default=1, comment="Max entries per user (email/phone)")
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Prizes
    prizes: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # [{"title": "...", "qty": 1, "details": "..."}]
    
    # Status
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    
    # Metadata
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ContestEntry(Base):
    """Contest entry submissions"""
    __tablename__ = "contest_entries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(Integer, ForeignKey("contests.id"), nullable=False, index=True)
    
    # Participant info
    participant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # birthday, anniversary, other
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    relation: Mapped[str] = mapped_column(String(50), default="self")  # self, family
    booking_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Owner info (for family entries)
    owner_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    owner_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)  # pending, approved, rejected, winner
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # OCR verification (best-effort)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ocr_date_matches: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    ocr_extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata
    reference_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    marked_winner_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ContestEntryFile(Base):
    """Files uploaded as proof for contest entries"""
    __tablename__ = "contest_entry_files"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("contest_entries.id"), nullable=False, index=True)
    
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # image/jpeg, application/pdf, etc.
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ContestNotification(Base):
    """Log of notifications sent to contest participants"""
    __tablename__ = "contest_notifications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("contest_entries.id"), nullable=False, index=True)
    
    # Notification details
    channel: Mapped[str] = mapped_column(String(50), nullable=False)  # email, whatsapp
    recipient_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Provider response
    provider_response: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, sent, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata
    sent_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserEventDate(Base):
    """User's family member event dates (birthdays, anniversaries) for offer notifications"""
    __tablename__ = "user_event_dates"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # User identification (can be email or phone)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    
    # Event details
    person_name: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # birthday, anniversary, other
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    relation: Mapped[str] = mapped_column(String(50), default="family")  # self, family, friend, etc.
    
    # Notification preferences
    notify_on_offers: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)