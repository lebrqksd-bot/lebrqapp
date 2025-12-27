from __future__ import annotations
from pydantic import BaseModel, Field, AliasChoices
from datetime import datetime
from typing import List, Optional, Any, Dict


class BookingItemIn(BaseModel):
    item_id: int
    quantity: int = Field(default=1, gt=0)
    hours_used: Optional[int] = None  # For hour-based pricing items


class BookingCustomItemIn(BaseModel):
    """Optional way to attach ad-hoc items by name/price when item catalog IDs aren't known on the client.
    Backend will upsert an Item by name and use the provided unit price for this booking item.
    """
    name: str
    quantity: int = Field(default=1, gt=0)
    unit_price: float = Field(default=0.0, ge=0.0)
    code: Optional[str] = None


class GuestIn(BaseModel):
    """Guest information for a booking"""
    id: Optional[str] = None  # Client-side ID
    name: str
    mobile: str
    pickupLocation: Optional[str] = None
    needsTransportation: bool = False


class BookingCreate(BaseModel):
    space_id: int
    start_datetime: datetime
    end_datetime: datetime
    attendees: Optional[int] = None
    items: Optional[List[BookingItemIn]] = []
    custom_items: Optional[List[BookingCustomItemIn]] = []
    customer_note: Optional[str] = None
    # Allow passing event_type from client (e.g., "Birthday Party")
    event_type: Optional[str] = None
    # Allow passing booking_type from client (e.g., "live-", "one_day", "monthly")
    booking_type: Optional[str] = None
    # Admin booking support
    is_admin_booking: Optional[bool] = None
    # Accept both admin_note and admin_notes from client payloads
    admin_note: Optional[str] = Field(default=None, validation_alias=AliasChoices("admin_note", "admin_notes"))
    # Banner image URL for the booking (accept both banner_image_url and banner_img_url)
    banner_image_url: Optional[str] = Field(default=None, validation_alias=AliasChoices("banner_image_url", "banner_img_url"))
    # Stage banner image URL (for events with stages, e.g., Live Show)
    stage_banner_url: Optional[str] = None
    # Guest list for transportation
    guest_list: Optional[List[GuestIn]] = None
    default_pickup_location: Optional[str] = None
    # Transport locations with guest details
    transport_locations: Optional[List[Dict[str, Any]]] = None
    # Event ticketing system integration
    event_schedule_id: Optional[int] = None
    event_definition_id: Optional[int] = None


class BookingOut(BaseModel):
    id: int
    booking_reference: str
    status: str
    start_datetime: datetime
    end_datetime: datetime
    total_amount: float

    class Config:
        from_attributes = True
