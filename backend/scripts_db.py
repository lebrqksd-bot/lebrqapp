#!/usr/bin/env python3
"""
Shared database configuration utilities for maintenance scripts.
Centralized single source of truth: app.core.settings.
This avoids duplicating dotenv/env parsing logic in each script.
"""
from __future__ import annotations

from typing import Dict, Any
from app.core import settings


def _base_env() -> Dict[str, Any]:
    return {
        "host": settings.MYSQL_HOST,
        "port": settings.MYSQL_PORT,
        "user": settings.MYSQL_USER,
        "password": settings.MYSQL_PASSWORD,
        "database": settings.MYSQL_DB,
    }


def get_pymysql_config() -> Dict[str, Any]:
    """Return connection kwargs for pymysql.connect()."""
    cfg = _base_env()
    cfg.setdefault("charset", "utf8mb4")
    return cfg


def get_mysql_connector_config() -> Dict[str, Any]:
    """Return connection kwargs for mysql.connector.connect()."""
    cfg = _base_env()
    # mysql-connector-python uses 'database' key too; charset can be set at cursor/session level if needed
    return cfg


def echo_config(mask_password: bool = True) -> Dict[str, Any]:
    cfg = _base_env()
    if mask_password and cfg.get("password"):
        cfg["password"] = "***"
    return cfg
