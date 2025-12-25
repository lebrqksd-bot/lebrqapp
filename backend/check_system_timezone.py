#!/usr/bin/env python3
"""
Check system timezone and datetime handling
"""
import os
import time
from datetime import datetime, timezone
import platform

def check_system_timezone():
    """Check system timezone and datetime handling"""
    print("=== System Timezone Information ===")
    print(f"Platform: {platform.system()} {platform.release()}")
    print(f"Python version: {platform.python_version()}")
    
    # Current time in different formats
    now_naive = datetime.now()
    now_utc = datetime.now(timezone.utc)
    now_local = datetime.now().astimezone()
    
    print(f"\nCurrent Time:")
    print(f"  Naive (no timezone): {now_naive}")
    print(f"  UTC: {now_utc}")
    print(f"  Local: {now_local}")
    print(f"  Local timezone: {now_local.tzinfo}")
    
    # System timezone
    if hasattr(time, 'tzname'):
        print(f"  System timezone: {time.tzname}")
    
    # Environment variables
    tz_env = os.environ.get('TZ')
    if tz_env:
        print(f"  TZ environment variable: {tz_env}")
    else:
        print(f"  TZ environment variable: Not set")
    
    # Test timezone conversion
    print(f"\nTimezone Conversion Test:")
    print(f"  UTC timestamp: {now_utc.timestamp()}")
    print(f"  UTC ISO: {now_utc.isoformat()}")
    
    # Check if pytz is available
    try:
        import pytz
        print(f"\npytz is available: {pytz.__version__}")
        
        # Test common timezones
        common_tz = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London']
        for tz_name in common_tz:
            try:
                tz = pytz.timezone(tz_name)
                local_time = now_utc.astimezone(tz)
                print(f"  {tz_name}: {local_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            except Exception as e:
                print(f"  {tz_name}: Error - {e}")
    except ImportError:
        print(f"\npytz is NOT available - install with: pip install pytz")
    
    print(f"\n=== Recommendations ===")
    print(f"1. All times are stored in UTC in the database")
    print(f"2. Convert to user's local timezone for display")
    print(f"3. Use timezone-aware datetime objects")
    print(f"4. Consider installing pytz for better timezone support")

if __name__ == "__main__":
    check_system_timezone()
