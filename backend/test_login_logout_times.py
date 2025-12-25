#!/usr/bin/env python3
"""
Test script to verify login/logout time functionality
"""
import asyncio
from sqlalchemy import select
from app.db import get_session
from app.models import User

async def test_login_logout_times():
    """Test that login/logout times are being stored correctly"""
    async for session in get_session():
        try:
            # Get a user to test with
            result = await session.execute(select(User).limit(1))
            user = result.scalars().first()
            
            if not user:
                print("❌ No users found in database")
                return
            
            print(f"📊 User: {user.username}")
            print(f"   ID: {user.id}")
            print(f"   Last Login: {user.last_login_time}")
            print(f"   Last Logout: {user.last_logout_time}")
            print(f"   Created: {user.created_at}")
            
            # Check if columns exist
            if hasattr(user, 'last_login_time') and hasattr(user, 'last_logout_time'):
                print("✅ Login/logout time columns are present")
            else:
                print("❌ Login/logout time columns are missing")
                
        except Exception as e:
            print(f"❌ Test failed: {e}")
        finally:
            await session.close()
        break

if __name__ == "__main__":
    asyncio.run(test_login_logout_times())
