#!/usr/bin/env python3
"""
Test script to verify timezone handling for login/logout times
"""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.db import get_session
from app.models import User
from app.utils import get_current_utc_time, format_datetime_for_display

async def test_timezone_handling():
    """Test timezone handling for login/logout times"""
    async for session in get_session():
        try:
            # Get a user to test with
            result = await session.execute(select(User).limit(1))
            user = result.scalars().first()
            
            if not user:
                print("No users found in database")
                return
            
            print(f"User: {user.username}")
            print(f"ID: {user.id}")
            
            # Test current UTC time
            current_utc = get_current_utc_time()
            print(f"Current UTC time: {current_utc}")
            print(f"Current UTC time (ISO): {current_utc.isoformat()}")
            
            # Display login/logout times in different formats
            if user.last_login_time:
                print(f"\nLast Login Time:")
                print(f"  Raw: {user.last_login_time}")
                print(f"  ISO: {user.last_login_time.isoformat() if hasattr(user.last_login_time, 'isoformat') else 'N/A'}")
                print(f"  UTC: {format_datetime_for_display(user.last_login_time, 'UTC')}")
                print(f"  IST: {format_datetime_for_display(user.last_login_time, 'Asia/Kolkata')}")
                print(f"  EST: {format_datetime_for_display(user.last_login_time, 'America/New_York')}")
            
            if user.last_logout_time:
                print(f"\nLast Logout Time:")
                print(f"  Raw: {user.last_logout_time}")
                print(f"  ISO: {user.last_logout_time.isoformat() if hasattr(user.last_logout_time, 'isoformat') else 'N/A'}")
                print(f"  UTC: {format_datetime_for_display(user.last_logout_time, 'UTC')}")
                print(f"  IST: {format_datetime_for_display(user.last_logout_time, 'Asia/Kolkata')}")
                print(f"  EST: {format_datetime_for_display(user.last_logout_time, 'America/New_York')}")
            
            # Test timezone conversion
            print(f"\nTimezone Test:")
            print(f"Current time in different timezones:")
            print(f"  UTC: {format_datetime_for_display(current_utc, 'UTC')}")
            print(f"  IST: {format_datetime_for_display(current_utc, 'Asia/Kolkata')}")
            print(f"  EST: {format_datetime_for_display(current_utc, 'America/New_York')}")
            print(f"  PST: {format_datetime_for_display(current_utc, 'America/Los_Angeles')}")
            
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await session.close()
        break

if __name__ == "__main__":
    asyncio.run(test_timezone_handling())
