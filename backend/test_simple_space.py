#!/usr/bin/env python3
"""
Simple test to debug the space API issue
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from app.core import settings
from app.models import Space

async def test_simple_space():
    """Test simple space query"""
    url = settings.DATABASE_URL
    engine = create_async_engine(url, echo=False)
    
    async with AsyncSession(engine) as session:
        # Get space 1
        stmt = select(Space).where(Space.id == 1)
        result = await session.execute(stmt)
        space = result.scalars().first()
        
        if space:
            print(f"Space found: {space.name}")
            print(f"Description: {space.description}")
            print(f"Image URL: {space.image_url}")
            print(f"Features type: {type(space.features)}")
            print(f"Features: {space.features}")
            print(f"Event Types type: {type(space.event_types)}")
            print(f"Event Types: {space.event_types}")
        else:
            print("Space not found")

if __name__ == "__main__":
    asyncio.run(test_simple_space())
