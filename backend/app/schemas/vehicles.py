"""
Vehicle Schemas for API Validation

Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class VehicleBase(BaseModel):
    """Base vehicle schema"""
    vehicle_name: str = Field(..., min_length=1, max_length=100)
    vehicle_capacity: int = Field(..., gt=0, description="Number of passengers")
    base_fare: Decimal = Field(..., ge=0, description="Base fare in INR")
    per_km_rate: Decimal = Field(..., ge=0, description="Per KM rate in INR")
    minimum_km: int = Field(default=0, ge=0)
    vehicle_image: Optional[str] = None
    extra_charges: Decimal = Field(default=0.00, ge=0)
    waiting_charges_per_hour: Decimal = Field(default=0.00, ge=0)
    night_charges: Decimal = Field(default=0.00, ge=0)
    peak_hour_multiplier: Decimal = Field(default=1.00, ge=1.00, le=3.00)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    vendor_id: Optional[int] = Field(None, description="Vendor/Supplier ID")


class VehicleCreate(VehicleBase):
    """Schema for creating a new vehicle"""
    pass


class VehicleUpdate(BaseModel):
    """Schema for updating a vehicle"""
    vehicle_name: Optional[str] = Field(None, min_length=1, max_length=100)
    vehicle_capacity: Optional[int] = Field(None, gt=0)
    base_fare: Optional[Decimal] = Field(None, ge=0)
    per_km_rate: Optional[Decimal] = Field(None, ge=0)
    minimum_km: Optional[int] = Field(None, ge=0)
    vehicle_image: Optional[str] = None
    extra_charges: Optional[Decimal] = Field(None, ge=0)
    waiting_charges_per_hour: Optional[Decimal] = Field(None, ge=0)
    night_charges: Optional[Decimal] = Field(None, ge=0)
    peak_hour_multiplier: Optional[Decimal] = Field(None, ge=1.00, le=3.00)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    vendor_id: Optional[int] = Field(None, description="Vendor/Supplier ID")


class VehicleResponse(VehicleBase):
    """Schema for vehicle response"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class VehicleAvailabilityQuery(BaseModel):
    """Query params for checking vehicle availability"""
    guests: int = Field(..., gt=0, description="Number of guests")


class VehicleBookingCreate(BaseModel):
    """Schema for creating a vehicle booking"""
    booking_id: int
    vehicle_id: int
    number_of_guests: int = Field(..., gt=0)
    guest_contact_number: str = Field(..., min_length=10, max_length=15)
    pickup_location: str = Field(..., min_length=1)
    drop_location: Optional[str] = None
    estimated_distance_km: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = None
    
    @validator('guest_contact_number')
    def validate_phone(cls, v):
        # Remove non-digit characters
        cleaned = ''.join(filter(str.isdigit, v))
        if len(cleaned) != 10:
            raise ValueError('Contact number must be exactly 10 digits')
        return cleaned


class VehicleBookingResponse(BaseModel):
    """Schema for vehicle booking response"""
    id: int
    booking_id: int
    vehicle_id: int
    number_of_guests: int
    guest_contact_number: str
    pickup_location: str
    drop_location: Optional[str]
    estimated_distance_km: Optional[Decimal]
    base_fare: Decimal
    per_km_rate: Decimal
    calculated_cost: Decimal
    extra_charges: Decimal
    total_amount: Decimal
    booking_status: str
    driver_assigned: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PriceCalculationRequest(BaseModel):
    """Request for calculating transportation price"""
    vehicle_id: int
    number_of_guests: int = Field(..., gt=0)
    estimated_distance_km: Decimal = Field(..., ge=0)
    is_night: bool = Field(default=False)
    is_peak_hour: bool = Field(default=False)


class PriceCalculationResponse(BaseModel):
    """Response for price calculation"""
    vehicle_id: int
    vehicle_name: str
    base_fare: Decimal
    per_km_rate: Decimal
    distance_cost: Decimal
    night_charges: Decimal
    peak_hour_charges: Decimal
    extra_charges: Decimal
    total_cost: Decimal
    breakdown: dict


class VehicleListResponse(BaseModel):
    """Response for vehicle list"""
    vehicles: list[VehicleResponse]
    total_count: int
    available_count: int

