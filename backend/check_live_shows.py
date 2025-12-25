"""Quick script to list live show bookings"""
import asyncio
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import Booking

async def list_live_shows():
    async with AsyncSessionLocal() as session:
        rs = await session.execute(
            select(Booking)
            .where(Booking.booking_type == 'live-')
            .order_by(Booking.start_datetime.desc())
            .limit(10)
        )
        bookings = rs.scalars().all()
        
        if not bookings:
            print("No live show bookings found.")
            return
        
        print("\n📅 Available Live Show Bookings:\n")
        for b in bookings:
            event_type = getattr(b, 'event_type', 'Live Show') or 'Live Show'
            print(f"  ID: {b.id}")
            print(f"  Event: {event_type}")
            print(f"  Date: {b.start_datetime}")
            print(f"  Status: {b.status}")
            print(f"  Reference: {b.booking_reference}")
            print("  " + "-" * 50)

if __name__ == "__main__":
    asyncio.run(list_live_shows())

