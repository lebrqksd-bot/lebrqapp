"""
Script to update the test customer user's password to meet 8-character requirement.
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import User
from app.auth import hash_password


async def update_test_user_password():
    """Update test_customer user password to test1234."""
    async with AsyncSessionLocal() as session:
        try:
            # Find the test user
            rs = await session.execute(select(User).where(User.username == 'test_customer'))
            test_user = rs.scalars().first()
            
            if not test_user:
                print("❌ Test user 'test_customer' not found.")
                print("   Run create_test_booking_with_vendors.py first to create the user.")
                return
            
            # Update password
            new_password = 'test1234'
            test_user.password_hash = hash_password(new_password)
            await session.commit()
            
            print(f"✅ Successfully updated password for test_customer")
            print(f"   Username: test_customer")
            print(f"   Password: {new_password}")
            print(f"\n   You can now login with these credentials.")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error updating password: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    print("Updating test_customer password...\n")
    asyncio.run(update_test_user_password())

