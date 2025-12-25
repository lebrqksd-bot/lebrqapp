import os
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.auth import get_current_user
from app.db import get_session
from app.core import settings

router = APIRouter(prefix="/admin", tags=["admin-debug"]) 


def _uploads_dir() -> str:
    # Resolve backend/app/uploads regardless of current file location
    base_dir = os.path.dirname(os.path.dirname(__file__))  # backend/app
    return os.path.join(base_dir, "uploads")


def _safe_join_uploads(name: str) -> str:
    # Prevent path traversal by stripping directory components
    safe_name = os.path.basename(name)
    return os.path.join(_uploads_dir(), safe_name)


@router.get("/static/exists")
async def static_exists(
    name: str = Query(..., description="Filename under uploads, e.g. 82d223433ac77f4c.jpg"),
    current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    # Restrict to admin
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    path = _safe_join_uploads(name)
    exists = os.path.exists(path)
    return {
        "name": os.path.basename(name),
        "exists": exists,
        "path": path if exists else None,
        "uploads_dir": _uploads_dir(),
    }


@router.get("/static/list")
async def static_list(
    limit: int = Query(100, ge=1, le=1000),
    current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ud = _uploads_dir()
    if not os.path.isdir(ud):
        return {"uploads_dir": ud, "files": [], "exists": False}
    files = []
    for name in os.listdir(ud):
        if len(files) >= limit:
            break
        if os.path.isfile(os.path.join(ud, name)):
            files.append(name)
    return {"uploads_dir": ud, "exists": True, "count": len(files), "files": files}


@router.get("/diagnostics/db")
async def diagnostics_db(
    current_user: Any = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    # Simple DB ping
    try:
        rs = await session.execute(text("SELECT 1"))
        val = rs.scalar()
        return {"ok": True, "result": val}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/diagnostics/tables")
async def diagnostics_tables(
    current_user: Any = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    like: Optional[str] = Query(None, description="Optional filter for table names (substring)"),
) -> Dict[str, Any]:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    url = settings.DATABASE_URL
    out: Dict[str, Any] = {"driver": url.split(":", 1)[0], "tables": []}
    try:
        if url.startswith("mysql+"):
            rs = await session.execute(text("SHOW TABLES"))
            names = [row[0] for row in rs.fetchall()]
        else:
            # sqlite
            rs = await session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            names = [row[0] for row in rs.fetchall()]
        if like:
            names = [n for n in names if like in n]
        out["tables"] = names
        # quick presence check for critical tables
        critical = [
            "users","venues","spaces","items","bookings","booking_items","payments","booking_events"
        ]
        missing = [t for t in critical if t not in names]
        out["missing_critical"] = missing
        out["ok"] = True
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)
    return out
