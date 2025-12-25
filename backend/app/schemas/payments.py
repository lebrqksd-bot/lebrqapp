from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime

class PaymentRequest(BaseModel):
    booking_id: int
    billing_address: str
    billing_city: str
    billing_state: str
    billing_zip: str

class PaymentResponse(BaseModel):
    payment_id: str
    order_id: str
    amount: float
    currency: str
    payment_url: str
    encrypted_data: str
    access_code: str

class PaymentStatusResponse(BaseModel):
    payment_id: str
    order_id: str
    amount: float
    currency: str
    payment_status: str
    transaction_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class RefundRequest(BaseModel):
    refund_amount: float
    reason: str

class RefundResponse(BaseModel):
    success: bool
    message: str
    refund_amount: float
    refund_id: str


# leBRQ specific schema for CCAvenue pay button preparation
class LeBrqPaymentRequestDataSchema(BaseModel):
    order_id: str  # Changed from int to str to support Razorpay order IDs
    currency: str
    amount: float
    language: str
    billing_name: str
    billing_address: str
    billing_city: str
    billing_state: str
    billing_zip: str
    billing_country: str
    billing_tel: str
    billing_email: str

    class Config:
        json_schema_extra = {
            "example": {
                "order_id": "order_RcJrOoIz6eLhj3",
                "currency": "INR",
                "amount": 1999.0,
                "language": "EN",
                "billing_name": "John Doe",
                "billing_address": "123 MG Road",
                "billing_city": "Bengaluru",
                "billing_state": "KA",
                "billing_zip": "560001",
                "billing_country": "India",
                "billing_tel": "+91-9999999999",
                "billing_email": "john@example.com"
            }
        }


class PreparePaymentRequest(BaseModel):
    booking_id: Optional[int] = None
    amount: float
    currency: str = "INR"
    language: str = "EN"


class SavePaymentRequest(BaseModel):
    booking_id: int
    provider: str = "ccavenue"
    order_id: str
    currency: str = "INR"
    amount: float
    status: str = "pending"  # pending|success|failed
    # Extended amount breakdown for booking context
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    banner_amount: Optional[float] = None
    stage_amount: Optional[float] = None
    base_amount: Optional[float] = None
    addons_amount: Optional[float] = None
    transport_amount: Optional[float] = None
    # optional billing snapshot
    language: Optional[str] = None
    billing_name: Optional[str] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    billing_country: Optional[str] = None
    billing_tel: Optional[str] = None
    billing_email: Optional[str] = None
    gateway_response: Optional[Dict[str, Any]] = None


class PaymentRecord(BaseModel):
    id: int
    booking_id: Optional[int]
    amount: float
    currency: Optional[str] = None
    provider: Optional[str] = None
    provider_payment_id: Optional[str] = None
    order_id: Optional[str] = None
    status: str
    # Amount breakdown (if saved)
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    banner_amount: Optional[float] = None
    stage_amount: Optional[float] = None
    base_amount: Optional[float] = None
    addons_amount: Optional[float] = None
    transport_amount: Optional[float] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    details: Optional[Dict[str, Any]] = None
    gateway_response: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class AdvancePaymentSettingsRequest(BaseModel):
    enabled: bool
    percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    type: str = "percentage"


class AdvancePaymentSettingsResponse(BaseModel):
    enabled: bool
    percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    type: str