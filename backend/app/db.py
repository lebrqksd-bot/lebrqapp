"""
Database Module - Backward Compatibility Layer

This module re-exports from app.db.session for backward compatibility.
New code should import directly from app.db.session or use the app.db package.

Example:
    from app.db import engine, Base, get_session, init_db
    from app.db.session import AsyncSessionLocal
"""

# Import everything from the new db.session module for backward compatibility
from app.db.session import (
    Base,
    engine,
    AsyncSessionLocal,
    init_db,
    close_db,
    get_session,
    sync_engine,
    SyncSessionLocal,
    get_db,
)

__all__ = [
    "Base",
    "engine",
    "AsyncSessionLocal",
    "init_db",
    "close_db",
    "get_session",
    "sync_engine",
    "SyncSessionLocal",
    "get_db",
]
