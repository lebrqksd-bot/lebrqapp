#!/usr/bin/env python3
"""
Debug the venues API issue
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from app.core import settings
from app.models import Space, Venue
from app.schemas.venues import SpaceOut

async def debug_venues():
    """Debug venues API"""
    url = settings.DATABASE_URL
    engine = create_async_engine(url, echo=False)
    
    async with AsyncSession(engine) as session:
        # Test the exact query from venues router
        venue_id = 3
        result = await session.execute(
            select(Space).where(Space.venue_id == venue_id, Space.active == True)
        )
        spaces = result.scalars().all()
        
        print(f"Found {len(spaces)} spaces for venue {venue_id}")
        
        for space in spaces:
            print(f"Space: {space.name}")
            try:
                # Try to create SpaceOut object
                space_out = SpaceOut.model_validate(space)
                print(f"✓ SpaceOut created successfully")
                print(f"  Features: {space_out.features}")
                print(f"  Event Types: {space_out.event_types}")
            except Exception as e:
                print(f"✗ Error creating SpaceOut: {e}")
                print(f"  Space features type: {type(space.features)}")
                print(f"  Space event_types type: {type(space.event_types)}")

if __name__ == "__main__":
    asyncio.run(debug_venues())
