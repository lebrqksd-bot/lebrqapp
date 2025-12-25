#!/usr/bin/env python3
"""
Quickly seed a demo venue and spaces into the current database.

Designed for local SQLite use but works with whatever DB_URL the app is configured to.

Usage (from repo root or backend/):
  # From repo root
  set PYTHONPATH=backend & .venv\Scripts\python.exe backend/seed_sqlite_demo.py

  # Or from backend/
  ..\.venv\Scripts\python.exe seed_sqlite_demo.py
"""
import asyncio
from sqlalchemy import select

from app.db import get_session, init_db
from app.models import Venue, Space


async def main() -> None:
    # Ensure tables exist
    await init_db()

    async for session in get_session():
        # Do we already have any spaces?
        rs = await session.execute(select(Space).limit(1))
        if rs.scalars().first():
            print("Database already has spaces; skipping demo seed.")
            break

        # Create a venue
        venue = Venue(
            name="Lebrq Event Center",
            address="123 Event Street, Downtown",
            city="Your City",
            timezone="Asia/Kolkata",
            metadata_json={
                "description": "Premium event venue with multiple spaces",
                "amenities": ["Parking", "Security", "Catering", "WiFi"],
            },
        )
        session.add(venue)
        await session.flush()

        # Create a few spaces
        spaces = [
            Space(
                venue_id=venue.id,
                name="Grant Hall",
                capacity=500,
                price_per_hour=1000.0,
                features={"amenities": [{"id": "sound", "label": "Sound System"}]},
                active=True,
            ),
            Space(
                venue_id=venue.id,
                name="Meeting Room",
                capacity=12,
                price_per_hour=1000.0,
                features={"amenities": [{"id": "tv", "label": "TV/Display"}]},
                active=True,
            ),
        ]
        session.add_all(spaces)
        await session.commit()
        print(f"Seeded venue id={venue.id} with {len(spaces)} spaces.")
        break


if __name__ == "__main__":
    asyncio.run(main())
