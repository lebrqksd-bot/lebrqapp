from __future__ import annotations

import asyncio
import gc
import logging
import re
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import create_access_token, hash_password
from ..core import settings
from ..db import get_session
from ..models import User, VendorProfile
from ..notifications import NotificationService
from ..services.otp_service import clear_otp, is_mobile_verified, send_otp, verify_otp

try:
    import phonenumbers
except ImportError:
    phonenumbers = None

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    username: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    mobile_verified: Optional[bool] = False


class SendOTPRequest(BaseModel):
    mobile: str
    
    def validate_mobile_digits(self) -> bool:
        """Validate that mobile has exactly 10 digits."""
        digits = ''.join(ch for ch in self.mobile if ch.isdigit())
        return len(digits) == 10


class VerifyOTPRequest(BaseModel):
    mobile: str
    otp: str


class ResetPasswordRequest(BaseModel):
    mobile: str
    otp: str
    new_password: str


def _normalize_mobile(mobile: str) -> Optional[str]:
    """Normalize mobile number to E.164 format or return None if invalid."""
    if not mobile or not mobile.strip():
        return None
    
    mobile_clean = mobile.strip()
    
    if phonenumbers is not None:
        try:
            # Try parsing without region first
            parsed = phonenumbers.parse(mobile_clean, None)
            if phonenumbers.is_valid_number(parsed):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            try:
                # Try with default region (US/IN)
                parsed = phonenumbers.parse(mobile_clean, 'IN')
                if phonenumbers.is_valid_number(parsed):
                    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            except phonenumbers.NumberParseException:
                return None
    
    # Fallback: simple regex validation
    if re.match(r'^\+?[0-9]{7,15}$', mobile_clean):
        return mobile_clean if mobile_clean.startswith('+') else f'+{mobile_clean}'
    
    return None


def _extract_mobile_digits(mobile: str) -> str:
    """Extract last 10 digits from mobile number for comparison."""
    digits = ''.join(ch for ch in mobile if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


async def _check_mobile_duplicate(session: AsyncSession, normalized_mobile: str) -> Optional[User]:
    """Check if mobile number already exists in database (handles different formats)."""
    if not normalized_mobile:
        return None
    
    # Extract last 10 digits for comparison
    mobile_last_10 = _extract_mobile_digits(normalized_mobile)
    if len(mobile_last_10) != 10:
        return None
    
    # Check exact match first (most common, uses index)
    rs = await session.execute(select(User).where(User.mobile == normalized_mobile))
    existing = rs.scalars().first()
    if existing:
        return existing
    
    # Check for matches in different formats using SQL (NOT loading all users)
    # This handles cases where mobile is stored in different formats
    rs_match = await session.execute(
        select(User)
        .where(User.mobile.isnot(None))
        .where(User.mobile != '')
        .where(func.right(func.replace(func.replace(User.mobile, '+', ''), ' ', ''), 10) == mobile_last_10)
    )
    return rs_match.scalars().first()


async def _hash_password_async(password: str) -> str:
    """Hash password asynchronously to avoid blocking event loop."""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(hash_password, password),
            timeout=5.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password hashing timed out. Please try again."
        )
    except MemoryError:
        # Force garbage collection on memory error
        for _ in range(3):
            gc.collect()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable due to memory pressure. Please try again in a moment."
        )


@router.get("/")
async def list_users(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    session: AsyncSession = Depends(get_session)
):
    """List users with pagination to prevent memory issues."""
    # Get total count
    count_stmt = select(func.count(User.id))
    count_result = await session.execute(count_stmt)
    total = count_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    stmt = select(User).order_by(User.id).offset(offset).limit(page_size)
    rs = await session.execute(stmt)
    users = rs.scalars().all()
    
    return {
        "users": [UserOut.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/seed-dummy")
async def seed_dummy(session: AsyncSession = Depends(get_session)):
    """Insert a dummy user with email-like username and password if not exists."""
    email = "dummy@example.com"
    password = "secret123"
    
    rs = await session.execute(select(User).where(User.username == email))
    user = rs.scalars().first()
    
    if not user:
        password_hash = await _hash_password_async(password)
        user = User(username=email, password_hash=password_hash, role="editor")
        session.add(user)
        await session.commit()
    
    return {"id": user.id, "username": user.username}


@router.post("/otp/send")
async def send_otp_endpoint(payload: SendOTPRequest):
    """Send OTP to mobile number for verification.
    
    Uses fully async OTP service to prevent blocking the event loop.
    Requires exactly 10 digit mobile number.
    """
    # Validate mobile number format
    if not payload.mobile or not payload.mobile.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required"
        )
    
    # Validate 10-digit requirement
    if not payload.validate_mobile_digits():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number must be exactly 10 digits"
        )
    
    try:
        # Call async send_otp function with timeout
        result = await asyncio.wait_for(
            send_otp(payload.mobile),
            timeout=12.0  # 12 second timeout (includes retries)
        )
    except asyncio.TimeoutError:
        logger.error(f"[OTP] Timeout sending OTP to {payload.mobile}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="OTP sending timed out. Please try again."
        )
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[OTP] Error sending OTP to {payload.mobile}: {error_msg}")
        logger.error(f"[OTP] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP: {error_msg}. Please try again."
        )
    
    # Validate result
    if not result or not isinstance(result, dict):
        logger.error(f"[OTP] Invalid result from send_otp: {result}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid response from OTP service. Please try again."
        )
    
    if result.get("success"):
        response = {
            "success": True,
            "message": result.get("message", "OTP sent successfully"),
            "mobile": result.get("mobile")
        }
        # Include gateway response for debugging (optional)
        if "gateway_response" in result:
            response["gateway_response"] = result["gateway_response"]
        return response
    else:
        error_message = result.get("message", "Failed to send OTP")
        logger.warning(f"[OTP] OTP send failed for {payload.mobile}: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )


@router.post("/otp/verify")
async def verify_otp_endpoint(payload: VerifyOTPRequest):
    """Verify OTP for mobile number."""
    # Validate input
    if not payload.mobile or not payload.mobile.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required"
        )
    
    if not payload.otp or not payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is required"
        )
    
    try:
        # Verify OTP (synchronous function, but fast)
        result = verify_otp(payload.mobile, payload.otp)
        
        if result and isinstance(result, dict) and result.get("success"):
            return {
                "success": True,
                "message": result.get("message", "OTP verified successfully"),
                "mobile": result.get("mobile")
            }
        else:
            error_message = (
                result.get("message", "Invalid OTP")
                if result and isinstance(result, dict)
                else "OTP verification failed"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[OTP] Unexpected error verifying OTP for {payload.mobile}: {error_msg}")
        logger.error(f"[OTP] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while verifying OTP. Please try again."
        )


@router.post("/reset-password")
async def reset_password_endpoint(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session)
):
    """Reset password after OTP verification."""
    # Input validation
    if not payload.mobile or not payload.mobile.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required"
        )
    
    if not payload.otp or not payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is required"
        )
    
    if not payload.new_password or not payload.new_password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password is required"
        )
    
    # Validate password length
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    # Verify OTP
    result = verify_otp(payload.mobile, payload.otp)
    if not result or not isinstance(result, dict) or not result.get("success"):
        error_message = (
            result.get("message", "Invalid or expired OTP")
            if result and isinstance(result, dict)
            else "OTP verification failed"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    # Normalize mobile number
    normalized_mobile = _normalize_mobile(payload.mobile)
    if not normalized_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number format"
        )
    
    try:
        # Find user by mobile number (using same logic as _check_mobile_duplicate)
        # Extract last 10 digits for comparison
        mobile_last_10 = _extract_mobile_digits(normalized_mobile)
        if len(mobile_last_10) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mobile number format"
            )
        
        # Check exact match first (most common, uses index)
        rs = await session.execute(select(User).where(User.mobile == normalized_mobile))
        user = rs.scalars().first()
        
        # If not found, check for matches in different formats using SQL
        # This handles cases where mobile is stored in different formats (with/without +, country code, etc.)
        if not user:
            rs_match = await session.execute(
                select(User)
                .where(User.mobile.isnot(None))
                .where(User.mobile != '')
                .where(func.right(func.replace(func.replace(User.mobile, '+', ''), ' ', ''), 10) == mobile_last_10)
            )
            user = rs_match.scalars().first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"success": False, "message": "No account found with this mobile number", "code": "NOT_FOUND"}
            )
        
        # Hash password asynchronously
        new_password_hash = await _hash_password_async(payload.new_password)
        
        # Update password
        await session.execute(
            update(User)
            .where(User.id == user.id)
            .values(password_hash=new_password_hash)
        )
        await session.commit()
        
        # Clear OTP after successful password reset
        try:
            clear_otp(normalized_mobile)
        except Exception as clear_error:
            logger.warning(f"[USERS] Error clearing OTP after password reset: {clear_error}")
        
        return {"success": True, "message": "Password reset successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        error_msg = str(e)
        logger.error(f"[USERS] Error resetting password: {error_msg}")
        logger.error(f"[USERS] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password. Please try again."
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session)
):
    """Create a new user account.
    
    Validates username (email) and mobile uniqueness.
    OTP verification is optional (controlled by mobile_verified flag).
    """
    # Input validation
    if not payload.username or not payload.username.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required"
        )
    
    if not payload.password or not payload.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required"
        )
    
    # Email validation
    username_clean = payload.username.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", username_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email address"
        )
    
    # Password validation
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    # Normalize and validate mobile number (if provided)
    normalized_mobile = None
    if payload.mobile and payload.mobile.strip():
        mobile_clean = payload.mobile.strip()
        
        # Validate 10-digit requirement
        mobile_digits = ''.join(ch for ch in mobile_clean if ch.isdigit())
        if len(mobile_digits) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number must be exactly 10 digits"
            )
        
        # Check OTP verification if mobile_verified is False
        if not payload.mobile_verified:
            try:
                if not is_mobile_verified(mobile_clean):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Mobile number verification failed. Please verify your mobile number with OTP first."
                    )
            except HTTPException:
                raise
            except Exception as otp_check_error:
                # Log but don't fail registration if OTP service has issues
                logger.warning(f"[USERS] OTP verification check error (non-blocking): {otp_check_error}")
                # Allow registration to proceed without OTP verification if service is unavailable
        
        # Normalize mobile number
        normalized_mobile = _normalize_mobile(mobile_clean)
        if not normalized_mobile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mobile number format"
            )
    
    # Check duplicate username (email) - CRITICAL: This must be separate from mobile check
    rs_username = await session.execute(select(User).where(User.username == username_clean))
    existing_username = rs_username.scalars().first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": {"username": "A user with that email already exists"}}
        )
    
    # Check duplicate mobile (if provided) - CRITICAL: This is OUTSIDE the username check block
    if normalized_mobile:
        existing_mobile = await _check_mobile_duplicate(session, normalized_mobile)
        if existing_mobile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": {"mobile": "This mobile number is already in use"}}
            )
    
    # Sanitize role
    role = (payload.role or "customer").lower()
    if role not in ("customer", "vendor", "broker"):
        role = "customer"
    
    # Hash password asynchronously
    try:
        password_hash = await _hash_password_async(payload.password)
    except HTTPException:
        raise
    
    # Create user
    user = User(
        username=username_clean,
        password_hash=password_hash,
        role=role,
        first_name=payload.first_name.strip() if payload.first_name else None,
        last_name=payload.last_name.strip() if payload.last_name else None,
        mobile=normalized_mobile,
    )
    session.add(user)
    
    try:
        await session.commit()
        await session.refresh(user)
    except Exception as commit_error:
        await session.rollback()
        error_msg = str(commit_error).lower()
        logger.error(f"[USERS] Error committing user: {commit_error}")
        logger.error(f"[USERS] Traceback: {traceback.format_exc()}")
        
        # Check for duplicate key errors
        if "duplicate" in error_msg or "unique" in error_msg:
            if "username" in error_msg or "email" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"errors": {"username": "A user with that email already exists"}}
                )
            elif "mobile" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"errors": {"mobile": "This mobile number is already in use"}}
                )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create account. Please try again."
        )
    
    # Create profile if needed (vendor/broker)
    if role == "vendor":
        try:
            vp = VendorProfile(user_id=user.id)
            session.add(vp)
            await session.commit()
        except Exception as vendor_error:
            await session.rollback()
            logger.warning(f"[USERS] Error creating vendor profile for user {user.id}: {vendor_error}")
            # Don't fail registration - user can add profile later
    
    if role == "broker":
        try:
            from ..models import BrokerProfile
            bp = BrokerProfile(user_id=user.id, is_approved=False)
            session.add(bp)
            await session.commit()
        except Exception as broker_error:
            await session.rollback()
            logger.warning(f"[USERS] Error creating broker profile for user {user.id}: {broker_error}")
            # Don't fail registration - user can add profile later
    
    # Clear OTP after successful registration
    if normalized_mobile:
        try:
            clear_otp(normalized_mobile)
        except Exception:
            pass  # Non-critical
    
    # Send welcome notification (fire-and-forget)
    try:
        await NotificationService.send_registration_welcome(user, settings.WEB_APP_URL)
    except Exception as e:
        logger.warning(f"[USERS] Registration notification error for user_id={user.id}: {e}")
        # Don't fail registration if notification fails
    
    # Return response based on role
    if role == "broker":
        return {
            "success": True,
            "id": user.id,
            "username": user.username,
            "message": "Your broker account registration is pending admin approval. You will be notified once approved.",
            "requires_approval": True
        }
    
    # Auto-login for other roles
    token = create_access_token(user.username)
    return {
        "success": True,
        "id": user.id,
        "username": user.username,
        "access_token": token,
        "token_type": "bearer"
    }
