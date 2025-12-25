from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .core import settings
from .db import get_session
from .models import User

# Use pbkdf2_sha256 as the primary hashing scheme (no 72-byte limit). Keep bcrypt
# as a fallback so existing bcrypt hashes still verify.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
security = HTTPBearer()
# Public security scheme (doesn't auto-error if no token provided)
public_security = HTTPBearer(auto_error=False)


def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    """Legacy helper to create a token with a string subject.

    Kept for backward-compatibility. Prefer `create_access_token_for_user` so tokens
    include a stable user id claim and don't break when usernames change.
    """
    now = datetime.now(tz=timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode: dict[str, Any] = {"sub": sub, "iat": now, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def create_access_token_for_user(user: User, expires_delta: Optional[timedelta] = None) -> str:
    """Create an access token embedding stable identifiers.

    Claims:
    - uid: numeric user id (preferred stable key)
    - username: current username (for display/back-compat)
    - sub: also set to user id as string for broader JWT tooling compatibility
    """
    now = datetime.now(tz=timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    claims: dict[str, Any] = {
        "sub": str(user.id),
        "uid": user.id,
        "username": user.username,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(claims, settings.SECRET_KEY, algorithm="HS256")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    # bcrypt has a 72-byte input limit. Truncate the UTF-8 bytes to 72 bytes
    # to avoid ValueError on very long passwords (seeded or from env).
    try:
        if isinstance(plain, str):
            b = plain.encode('utf-8')
            if len(b) > 72:
                # truncate to 72 bytes and decode back to str (ignore partial chars)
                plain = b[:72].decode('utf-8', errors='ignore')
    except Exception:
        # In the unlikely event encoding fails, fall back to the original value
        pass
    return pwd_context.hash(plain)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    token = creds.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Prefer stable user id if available
    user: User | None = None
    uid = payload.get("uid")
    if uid is not None:
        rs = await session.execute(select(User).where(User.id == uid))
        user = rs.scalars().first()
    else:
        # Back-compat: some older tokens used username in `sub`
        sub = payload.get("sub")
        username = payload.get("username") or sub
        # If sub looks like an int, try by id as well
        if isinstance(sub, str) and sub.isdigit():
            rs = await session.execute(select(User).where(User.id == int(sub)))
            user = rs.scalars().first()
        if user is None and username:
            rs = await session.execute(select(User).where(User.username == str(username)))
            user = rs.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Get the current user and verify they have admin role."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# Role-based dependency factory
def require_role(*roles: str):
    """
    Usage:
      _user = Depends(require_role("admin"))

    Accepts one or more allowed roles. If the current user's role is not in the
    allowed list, raises 403. Roles are compared case-sensitively to the stored
    value in User.role (e.g., 'admin', 'approver', 'editor', 'vendor', etc.).
    """
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return _checker
