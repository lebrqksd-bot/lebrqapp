from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core import settings
from ..db import get_session
from ..models import User
from ..auth import (
    create_access_token_for_user,
    create_access_token,  # legacy
    verify_password,
    get_current_user,
    hash_password,
)
try:
    import phonenumbers
except Exception:  # phonenumbers may not be installed in some environments
    phonenumbers = None
from ..utils import get_current_utc_time

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    profile_image: Optional[str] = None
    # last_login_time: datetime | None = None
    # last_logout_time: datetime | None = None

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    username: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateProfileImageRequest(BaseModel):
    profile_image: str  # Base64 encoded image or URL


@router.post("/login")
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)):
    """Login endpoint with comprehensive error handling"""
    import traceback
    from ..models import VendorProfile, BrokerProfile
    from datetime import datetime
    
    try:
        # Input validation
        if not payload.username or not payload.username.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is required"
            )
        
        if not payload.password or not payload.password.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required"
            )
        
        # Query user from database
        try:
            rs = await session.execute(select(User).where(User.username == payload.username))
            user = rs.scalars().first()
        except Exception as db_error:
            logger.error(f"[AUTH] Database error during login for username {payload.username}: {str(db_error)}")
            logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error during login. Please try again."
            )
        
        # Verify user exists and password is correct
        if not user:
            # Don't reveal if user exists or not (security best practice)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
        # Verify password
        try:
            password_valid = verify_password(payload.password, user.password_hash)
        except Exception as pwd_error:
            logger.error(f"[AUTH] Password verification error for user {user.id}: {str(pwd_error)}")
            logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error verifying credentials. Please try again."
            )
        
        if not password_valid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
        # Check if user is suspended (for customers, check User.suspended_until directly)
        try:
            if user.role == "customer":
                if user.suspended_until:
                    now = datetime.utcnow()
                    if user.suspended_until > now:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been suspended by admin. Contact lebrq@gmail.com for more information."
                        )
            elif user.role == "vendor":
                rs_vp = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
                vp = rs_vp.scalars().first()
                if vp and vp.suspended_until:
                    now = datetime.utcnow()
                    if vp.suspended_until > now:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been suspended by admin. Contact lebrq@gmail.com for more information."
                        )
            elif user.role == "broker":
                rs_bp = await session.execute(select(BrokerProfile).where(BrokerProfile.user_id == user.id))
                bp = rs_bp.scalars().first()
                if bp:
                    # Check if broker is approved
                    if not bp.is_approved:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your broker account is pending admin approval. You will be notified once approved."
                        )
                    # Check if broker is suspended
                    if bp.suspended_until:
                        now = datetime.utcnow()
                        if bp.suspended_until > now:
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Your account has been suspended by admin. Contact lebrq@gmail.com for more information."
                            )
        except HTTPException:
            raise  # Re-raise HTTP exceptions (suspension messages)
        except Exception as profile_error:
            logger.error(f"[AUTH] Error checking user profile for user {user.id}: {str(profile_error)}")
            logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
            # Don't fail login if profile check fails - log and continue
            # This prevents profile query errors from blocking valid logins

        # Issue modern token with stable uid claim (fallback legacy helper retained)
        try:
            token = create_access_token_for_user(
                user,
                expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            )
        except Exception as token_error:
            logger.error(f"[AUTH] Error creating access token for user {user.id}: {str(token_error)}")
            logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error generating authentication token. Please try again."
            )
        
        return {"access_token": token, "token_type": "bearer"}
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions (they're already properly formatted)
    except Exception as e:
        # Catch any unexpected errors
        error_msg = str(e)
        logger.error(f"[AUTH] Unexpected error in login endpoint: {error_msg}")
        logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login. Please try again."
        )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Update last logout time (commented out - column doesn't exist in DB)
    # await session.execute(
    #     update(User)
    #     .where(User.id == user.id)
    #     .values(last_logout_time=get_current_utc_time())
    # )
    # await session.commit()
    
    return {"message": "Successfully logged out"}


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update user profile information"""
    update_data = {}
    
    if payload.first_name is not None:
        update_data["first_name"] = payload.first_name
    if payload.last_name is not None:
        update_data["last_name"] = payload.last_name
    if payload.mobile is not None:
        # Normalize mobile number to ensure consistency
        normalized_mobile = None
        if phonenumbers is not None:
            try:
                # try parsing as E.164 or with a default region
                m = phonenumbers.parse(payload.mobile, None)
                if phonenumbers.is_valid_number(m):
                    normalized_mobile = phonenumbers.format_number(m, phonenumbers.PhoneNumberFormat.E164)
            except phonenumbers.NumberParseException:
                try:
                    # try parse with a default region (use US as a fallback)
                    m = phonenumbers.parse(payload.mobile, 'US')
                    if phonenumbers.is_valid_number(m):
                        normalized_mobile = phonenumbers.format_number(m, phonenumbers.PhoneNumberFormat.E164)
                except phonenumbers.NumberParseException:
                    pass
        if normalized_mobile:
            update_data["mobile"] = normalized_mobile
        else:
            # Fallback: simple validation and use as-is
            import re
            if re.match(r'^\+?[0-9]{7,15}$', payload.mobile):
                update_data["mobile"] = payload.mobile
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid mobile number format"
                )
    if payload.username is not None:
        # Check if username is already taken by another user
        rs = await session.execute(
            select(User).where(User.username == payload.username, User.id != user.id)
        )
        existing_user = rs.scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        update_data["username"] = payload.username
    
    if update_data:
        await session.execute(
            update(User)
            .where(User.id == user.id)
            .values(**update_data)
        )
        await session.commit()
        
        # Fetch updated user
        rs = await session.execute(select(User).where(User.id == user.id))
        updated_user = rs.scalars().first()
        return updated_user
    
    return user


@router.put("/profile/image")
async def update_profile_image(
    payload: UpdateProfileImageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update user profile image"""
    await session.execute(
        update(User)
        .where(User.id == user.id)
        .values(profile_image=payload.profile_image)
    )
    await session.commit()
    
    return {"message": "Profile image updated successfully", "profile_image": payload.profile_image}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Change user password with proper error handling and SSL memory protection"""
    import asyncio
    import gc
    import traceback
    
    try:
        # Input validation
        if not payload.current_password or len(payload.current_password.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required"
            )
        
        if not payload.new_password or len(payload.new_password.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password is required"
            )
        
        # Verify current password
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Validate new password
        if len(payload.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters long"
            )
        
        # Check if new password is same as current password
        if verify_password(payload.new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Hash new password (with timeout protection)
        try:
            new_password_hash = await asyncio.wait_for(
                asyncio.to_thread(hash_password, payload.new_password),
                timeout=5.0  # 5 second timeout for password hashing
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password change operation timed out. Please try again."
            )
        except MemoryError:
            # Force garbage collection on memory error
            for _ in range(3):
                gc.collect()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service temporarily unavailable due to memory pressure. Please try again in a moment."
            )
        
        # Update password with timeout protection
        try:
            await asyncio.wait_for(
                session.execute(
                    update(User)
                    .where(User.id == user.id)
                    .values(password_hash=new_password_hash)
                ),
                timeout=10.0  # 10 second timeout for database update
            )
            
            # Commit with timeout protection
            await asyncio.wait_for(
                session.commit(),
                timeout=10.0  # 10 second timeout for commit
            )
        except asyncio.TimeoutError:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password change operation timed out. Please try again."
            )
        except MemoryError:
            await session.rollback()
            # Force aggressive garbage collection for SSL memory errors
            for _ in range(7):
                gc.collect()
            gc.collect(2)  # Force generation 2 collection
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service temporarily unavailable due to memory pressure. Please try again in a moment."
            )
        except Exception as db_error:
            await session.rollback()
            # Log the error for debugging
            error_msg = str(db_error)
            logger.error(f"[AUTH] Error changing password for user {user.id}: {error_msg}")
            logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to change password. Please try again."
            )
        
        # Force garbage collection after successful password change to free memory
        gc.collect()
        
        return {"success": True, "message": "Password changed successfully"}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Safety net: rollback any pending transaction
        try:
            await session.rollback()
        except Exception:
            pass
        
        # Log unexpected errors
        error_msg = str(e)
        logger.error(f"[AUTH] Unexpected error in change-password: {error_msg}")
        logger.error(f"[AUTH] Traceback: {traceback.format_exc()}")
        
        # Force garbage collection on unexpected errors
        try:
            for _ in range(3):
                gc.collect()
        except Exception:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again."
        )


def require_role(*roles: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return _checker
