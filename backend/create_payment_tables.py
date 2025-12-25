#!/usr/bin/env python3
"""
Script to create payment-related tables in the database
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.db import get_session
from app.models import Base, Payment, Booking, BookingAddon
from sqlalchemy import create_engine
from app.core import settings

async def create_payment_tables():
    """Create payment-related tables"""
    try:
        # Create engine
        engine = create_engine(settings.DATABASE_URL.replace('+asyncmy', '+pymysql'))
        
        # Create tables
        Base.metadata.create_all(engine, tables=[
            Payment.__table__,
            Booking.__table__,
            BookingAddon.__table__,
        ])
        
        print("✅ Payment tables created successfully!")
        
        # Test the tables
        async for session in get_session():
            # Check if tables exist
            result = await session.execute("SHOW TABLES LIKE 'payments'")
            if result.fetchone():
                print("✅ Payments table exists")
            else:
                print("❌ Payments table not found")
                
            result = await session.execute("SHOW TABLES LIKE 'bookings'")
            if result.fetchone():
                print("✅ Bookings table exists")
            else:
                print("❌ Bookings table not found")
                
            result = await session.execute("SHOW TABLES LIKE 'booking_addons'")
            if result.fetchone():
                print("✅ Booking addons table exists")
            else:
                print("❌ Booking addons table not found")
            
            break
        
    except Exception as e:
        print(f"❌ Error creating payment tables: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(create_payment_tables())
