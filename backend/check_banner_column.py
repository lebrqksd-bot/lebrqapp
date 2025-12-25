#!/usr/bin/env python3
"""Check if banner_image_url column exists in bookings table and show recent bookings."""

import sys
import asyncio
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Import your app config
from app.core import settings
from app.models import Booking

async def check_banner_column():
    """Check if banner_image_url exists and display recent bookings."""
    
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with engine.begin() as conn:
            # Check if column exists using raw SQL
            result = await conn.execute(
                text("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bookings' AND COLUMN_NAME='banner_image_url'")
            )
            row = result.fetchone()
            if row:
                print("✅ Column 'banner_image_url' EXISTS in bookings table")
            else:
                print("❌ Column 'banner_image_url' NOT FOUND in bookings table")
                print("\nColumns in bookings table:")
                result = await conn.execute(
                    text("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bookings'")
                )
                for r in result:
                    print(f"  - {r[0]}")
        
        # Fetch recent bookings with banner_image_url
        async with async_session() as session:
            stmt = select(Booking).order_by(Booking.id.desc()).limit(5)
            result = await session.execute(stmt)
            bookings = result.scalars().all()
            
            if bookings:
                print(f"\n📋 Recent {len(bookings)} bookings:")
                for b in bookings:
                    banner_url = getattr(b, 'banner_image_url', 'N/A')
                    print(f"  ID: {b.id} | Ref: {b.booking_reference} | Banner URL: {banner_url}")
            else:
                print("\n❌ No bookings found in database")
    
    finally:
        await engine.dispose()

if __name__ == '__main__':
    asyncio.run(check_banner_column())
