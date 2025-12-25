# app/dependencies.py
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session  # Async session generator
from app.models import User  # Your User model

async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Retrieve the current authenticated user from request headers.
    Raises 401 if no user_id in headers.
    Raises 404 if user not found in DB.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User not authenticated"
        )
    user = await session.get(User, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user


async def optional_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """
    Retrieve the user if present, otherwise return None.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    user = await session.get(User, int(user_id))
    return user


# ------------------------
# Admin check
# ------------------------
async def admin_required(current_user: User = Depends(get_current_user)):
    """
    Ensure the current user is an admin.
    """
    if not current_user.is_admin:  # replace with your admin attribute
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

# ------------------------
# Vendor check
# ------------------------
async def vendor_required(current_user: User = Depends(get_current_user)):
    """
    Ensure the current user is a vendor.
    """
    if not current_user.is_vendor:  # replace with your vendor attribute
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendor access required")
    return current_user

# ------------------------
# Broker check
# ------------------------
async def broker_required(current_user: User = Depends(get_current_user)):
    """
    Ensure the current user is a broker.
    """
    if not current_user.is_broker:  # replace with your broker attribute
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Broker access required")
    return current_user

# ------------------------
# Optional user
# ------------------------
async def optional_current_user(request: Request, session: AsyncSession = Depends(get_session)) -> Optional[User]:
    """
    Get current user if available, otherwise None.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return await session.get(User, int(user_id))
