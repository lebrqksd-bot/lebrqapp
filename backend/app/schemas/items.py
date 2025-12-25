"""
Pydantic schemas for catalog items with pricing system
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Union
from datetime import datetime
import json


class ItemBase(BaseModel):
    """Base schema for item data"""
    vendor_id: Optional[int] = None
    main_category: Optional[str] = Field(None, description="Main event category: social-life|cultural-religious|corporate-business|educational-academic|health-wellness-sports|cake-others")
    category: Optional[str] = None
    subcategory: Optional[str] = None
    type: Optional[str] = None
    name: str
    description: Optional[str] = None
    vendor_price: float = Field(0.0, ge=0, description="Base price from vendor (cost)")
    admin_markup_percent: float = Field(0.0, ge=0, le=1000, description="Admin markup percentage (0-1000%)")
    image_url: Optional[str] = None
    # Performance team specific fields
    video_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_info: Optional[str] = None
    performance_team_profile: Optional[Dict[str, Any]] = Field(None, description="Complete performance team profile JSON: history, experience, team members, achievements, videos, contact info, etc.")
    space_id: Optional[int] = None
    available: bool = True
    item_status: str = Field("available", description="Item status: available, under_maintenance, out_of_stock")
    preparation_time_minutes: int = Field(0, ge=0, le=10080, description="Minimum preparation time in minutes (max 1 week)")
    # Hour-based pricing for paid add-ons
    base_hours_included: int = Field(0, ge=0, description="Base hours included in price (e.g., 3 hours)")
    rate_per_extra_hour: float = Field(0.0, ge=0, description="Rate per extra hour beyond base hours (e.g., ₹1000/hour)")
    # Offer eligibility
    is_eligible_for_space_offer: bool = Field(True, description="Whether this item is eligible for space offers (halls, meeting rooms, programs)")


class ItemCreate(ItemBase):
    """Schema for creating a new item"""
    pass


class ItemUpdate(BaseModel):
    """Schema for updating an item (all fields optional)"""
    vendor_id: Optional[int] = None
    main_category: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    vendor_price: Optional[float] = Field(None, ge=0)
    admin_markup_percent: Optional[float] = Field(None, ge=0, le=1000)
    image_url: Optional[str] = None
    # Performance team specific fields
    video_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_info: Optional[str] = None
    performance_team_profile: Optional[Union[Dict[str, Any], str]] = Field(None, description="Complete performance team profile JSON: history, experience, team members, achievements, videos, contact info, etc.")
    space_id: Optional[int] = None
    available: Optional[bool] = None
    item_status: Optional[str] = Field(None, description="Item status: available, under_maintenance, out_of_stock")
    preparation_time_minutes: Optional[int] = Field(None, ge=0, le=10080)
    # Hour-based pricing
    base_hours_included: Optional[int] = Field(None, ge=0, description="Base hours included in price")
    rate_per_extra_hour: Optional[float] = Field(None, ge=0, description="Rate per extra hour beyond base hours")
    # Offer eligibility
    is_eligible_for_space_offer: Optional[bool] = Field(None, description="Whether this item is eligible for space offers")
    
    @field_validator('performance_team_profile', mode='before')
    @classmethod
    def parse_performance_team_profile(cls, v):
        """Parse JSON string to dict if needed"""
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            if not v.strip():
                return None
            try:
                parsed = json.loads(v)
                # Ensure it's a dict after parsing (JSON can return other types)
                if isinstance(parsed, dict):
                    return parsed
                # If it's not a dict, wrap it or return None
                # For performance team profile, we expect a dict structure
                return None
            except (json.JSONDecodeError, TypeError) as e:
                # Return None for invalid JSON to avoid validation errors
                # The field is optional, so None is acceptable
                return None
        # For any other type, return None (we expect dict or string)
        return None


class ItemResponse(ItemBase):
    """Schema for item response with calculated fields"""
    id: int
    price: float = Field(description="Final customer price (calculated)")
    profit_amount: float = Field(0.0, description="Admin profit per unit")
    profit_margin: float = Field(0.0, description="Profit margin percentage")
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    @field_validator('price', mode='before')
    @classmethod
    def calculate_price(cls, v, info):
        """Calculate final price from vendor_price and markup"""
        if v is not None:
            return v
        data = info.data
        vendor_price = data.get('vendor_price', 0)
        markup_percent = data.get('admin_markup_percent', 0)
        return round(vendor_price * (1 + markup_percent / 100), 2)
    
    @field_validator('profit_amount', mode='before')
    @classmethod
    def calculate_profit(cls, v, info):
        """Calculate profit amount"""
        if v != 0.0:
            return v
        data = info.data
        vendor_price = data.get('vendor_price', 0)
        markup_percent = data.get('admin_markup_percent', 0)
        return round(vendor_price * (markup_percent / 100), 2)
    
    @field_validator('profit_margin', mode='before')
    @classmethod
    def calculate_margin(cls, v, info):
        """Calculate profit margin percentage"""
        if v != 0.0:
            return v
        data = info.data
        vendor_price = data.get('vendor_price', 0)
        markup_percent = data.get('admin_markup_percent', 0)
        if vendor_price > 0:
            profit = vendor_price * (markup_percent / 100)
            final_price = vendor_price * (1 + markup_percent / 100)
            return round((profit / final_price) * 100, 2) if final_price > 0 else 0
        return 0
    
    model_config = {"from_attributes": True}


class BulkMarkupRequest(BaseModel):
    """Schema for bulk applying markup to vendor's products"""
    vendor_id: int = Field(description="Vendor ID")
    markup_percent: float = Field(ge=0, le=1000, description="Markup percentage to apply (0-1000%)")
    item_ids: Optional[list[int]] = Field(None, description="Specific items (if empty, applies to all)")


class BulkMarkupResponse(BaseModel):
    """Response for bulk markup operation"""
    success: bool
    message: str
    updated_count: int
    items: list[ItemResponse]


class ItemPricingInfo(BaseModel):
    """Detailed pricing information for an item"""
    item_id: int
    item_name: str
    vendor_price: float
    admin_markup_percent: float
    markup_amount: float
    final_price: float
    profit_per_unit: float
    profit_margin_percent: float
    
    model_config = {"from_attributes": True}


class BulkPreparationTimeRequest(BaseModel):
    """Schema for bulk setting preparation time"""
    vendor_id: Optional[int] = Field(None, description="Vendor ID (for vendor/admin bulk update)")
    preparation_time_minutes: int = Field(ge=0, le=10080, description="Preparation time in minutes (0-10080, max 1 week)")
    item_ids: Optional[list[int]] = Field(None, description="Specific items (if empty with vendor_id, applies to all vendor items)")


class BulkPreparationTimeResponse(BaseModel):
    """Response for bulk preparation time operation"""
    success: bool
    message: str
    updated_count: int
    items: list[ItemResponse]

