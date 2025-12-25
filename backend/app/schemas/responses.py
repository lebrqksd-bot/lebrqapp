"""
Standard API Response Schemas

Unified response format for all API endpoints to ensure consistent
error/success handling across the application.

Usage:
    return SuccessResponse(message="Booking created successfully", data={...})
    raise HTTPException(status_code=400, detail="Email already exists")
"""

from typing import Any, Dict, List, Optional, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar('T')


class BaseResponse(BaseModel):
    """Base response model for all API responses"""
    success: bool = Field(..., description="Indicates if the request was successful")
    message: str = Field(..., description="Human-readable message")
    code: Optional[str] = Field(None, description="Machine-readable code (e.g., 'EMAIL_EXISTS')")


class SuccessResponse(BaseResponse, Generic[T]):
    """Standard success response"""
    success: bool = Field(default=True)
    data: Optional[T] = Field(None, description="Response payload")
    meta: Optional[Dict[str, Any]] = Field(None, description="Metadata (pagination, etc.)")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Booking created successfully",
                "code": "BOOKING_CREATED",
                "data": {"id": 123, "reference": "BK-ABC123"},
                "meta": None
            }
        }


class ErrorResponse(BaseResponse):
    """Standard error response"""
    success: bool = Field(default=False)
    errors: Optional[List[Dict[str, str]]] = Field(None, description="Detailed validation errors")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "message": "Validation failed",
                "code": "VALIDATION_ERROR",
                "errors": [
                    {"field": "email", "message": "Email already exists"},
                    {"field": "mobile", "message": "Invalid phone number"}
                ]
            }
        }


# Common error codes for consistency
class ErrorCodes:
    # Authentication & Authorization
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    UNAUTHORIZED = "UNAUTHORIZED"
    ACCESS_DENIED = "ACCESS_DENIED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    
    # Validation
    VALIDATION_ERROR = "VALIDATION_ERROR"
    REQUIRED_FIELD = "REQUIRED_FIELD"
    INVALID_FORMAT = "INVALID_FORMAT"
    
    # User Management
    EMAIL_EXISTS = "EMAIL_EXISTS"
    USERNAME_EXISTS = "USERNAME_EXISTS"
    MOBILE_EXISTS = "MOBILE_EXISTS"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    
    # Booking & Payment
    BOOKING_NOT_FOUND = "BOOKING_NOT_FOUND"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    INSUFFICIENT_AMOUNT = "INSUFFICIENT_AMOUNT"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    
    # Resources
    ITEM_NOT_AVAILABLE = "ITEM_NOT_AVAILABLE"
    SPACE_NOT_AVAILABLE = "SPACE_NOT_AVAILABLE"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    
    # Generic
    SERVER_ERROR = "SERVER_ERROR"
    NOT_FOUND = "NOT_FOUND"
    BAD_REQUEST = "BAD_REQUEST"


# Common success codes for consistency
class SuccessCodes:
    # User Management
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGOUT_SUCCESS = "LOGOUT_SUCCESS"
    
    # Booking & Payment
    BOOKING_CREATED = "BOOKING_CREATED"
    BOOKING_UPDATED = "BOOKING_UPDATED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"
    PAYMENT_VERIFIED = "PAYMENT_VERIFIED"
    
    # Messaging & Notifications
    MESSAGE_SENT = "MESSAGE_SENT"
    NOTIFICATION_SENT = "NOTIFICATION_SENT"
    
    # Generic
    SUCCESS = "SUCCESS"
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"


def create_success_response(
    message: str,
    data: Any = None,
    code: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Helper function to create a standardized success response
    
    Args:
        message: Human-readable success message
        data: Response payload
        code: Machine-readable success code
        meta: Additional metadata
        
    Returns:
        Standardized success response dictionary
    """
    response = {
        "success": True,
        "message": message,
    }
    
    if code:
        response["code"] = code
    if data is not None:
        response["data"] = data
    if meta:
        response["meta"] = meta
        
    return response


def create_error_response(
    message: str,
    code: Optional[str] = None,
    errors: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Helper function to create a standardized error response
    
    Args:
        message: Human-readable error message
        code: Machine-readable error code
        errors: Detailed validation errors
        
    Returns:
        Standardized error response dictionary
    """
    response = {
        "success": False,
        "message": message,
    }
    
    if code:
        response["code"] = code
    if errors:
        response["errors"] = errors
        
    return response


# Validation error helper
def create_validation_error(field: str, message: str) -> Dict[str, str]:
    """Create a standardized validation error"""
    return {"field": field, "message": message}

