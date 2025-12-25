"""
Script to add office location for QR attendance
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.db import get_session
from app.models import Office, User
from sqlalchemy import select
from datetime import datetime
import secrets

async def generate_qr_id() -> str:
    """Generate unique QR identifier"""
    return f"OFFICE_{secrets.token_urlsafe(16)}"

async def add_office():
    """Add City Complex office location"""
    async for session in get_session():
        try:
            # Check if office already exists (using LIKE for case-insensitive)
            from sqlalchemy import func
            result = await session.execute(
                select(Office).where(func.lower(Office.name).like("%city complex%"))
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"Office already exists: {existing.name} (ID: {existing.id}, QR ID: {existing.qr_id})")
                return existing
            
            # Get first admin user for created_by
            user_result = await session.execute(
                select(User).where(User.role == "admin").limit(1)
            )
            admin_user = user_result.scalar_one_or_none()
            
            if not admin_user:
                print("ERROR: No admin user found. Please create an admin user first.")
                return None
            
            # Create office
            qr_id = await generate_qr_id()
            
            # Ensure unique QR ID
            while True:
                check_result = await session.execute(select(Office).where(Office.qr_id == qr_id))
                if not check_result.scalar_one_or_none():
                    break
                qr_id = await generate_qr_id()
            
            office = Office(
                name="City Complex, Kasaragod",
                qr_id=qr_id,
                latitude=12.5074693,  # From Google Maps link
                longitude=74.9884455,  # From Google Maps link
                allowed_radius=100.0,  # 100 meters
                is_active=True,
                created_by_user_id=admin_user.id,
            )
            
            session.add(office)
            await session.commit()
            await session.refresh(office)
            
            print(f"✅ Office added successfully!")
            print(f"   Name: {office.name}")
            print(f"   Location: {office.latitude}, {office.longitude}")
            print(f"   QR ID: {office.qr_id}")
            print(f"   Allowed Radius: {office.allowed_radius}m")
            print(f"\n📱 Use this QR ID to generate QR code in admin panel")
            
            return office
            
        except Exception as e:
            await session.rollback()
            print(f"ERROR: {e}")
            raise
        finally:
            break

if __name__ == "__main__":
    asyncio.run(add_office())

