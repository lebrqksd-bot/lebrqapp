"""
Utility functions for the application
"""
from datetime import datetime, timezone
from typing import Optional


def get_current_utc_time() -> datetime:
    """Get current UTC time with timezone info"""
    return datetime.now(timezone.utc)


def format_datetime_for_display(dt: Optional[datetime], timezone_name: str = "UTC") -> Optional[str]:
    """
    Format datetime for display in a specific timezone
    
    Args:
        dt: The datetime object to format
        timezone_name: The timezone to display in (e.g., "UTC", "Asia/Kolkata", "America/New_York")
    
    Returns:
        Formatted datetime string or None if dt is None
    """
    if dt is None:
        return None
    
    # If the datetime is naive (no timezone info), assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Convert to the specified timezone
    try:
        import pytz
        target_tz = pytz.timezone(timezone_name)
        local_dt = dt.astimezone(target_tz)
        return local_dt.strftime("%Y-%m-%d %H:%M:%S %Z")
    except ImportError:
        # Fallback if pytz is not available
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def get_user_timezone() -> str:
    """
    Get user's timezone (you can implement logic to detect user's timezone)
    For now, returning a default timezone
    """
    # You can implement logic here to detect user's timezone
    # For example, from user preferences, browser settings, etc.
    return "UTC"  # Default to UTC
