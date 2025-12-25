#!/usr/bin/env python3
"""Add stage_banner_url column to bookings table."""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core import settings

async def add_stage_banner_column():
    """Add stage_banner_url column if it doesn't exist."""
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Check if column exists
            result = await conn.execute(
                text("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bookings' AND COLUMN_NAME='stage_banner_url'")
            )
            row = result.fetchone()
            
            if row:
                print("✅ Column 'stage_banner_url' already exists")
            else:
                print("Adding 'stage_banner_url' column to bookings table...")
                await conn.execute(
                    text("ALTER TABLE bookings ADD COLUMN stage_banner_url TEXT NULL")
                )
                print("✅ Column 'stage_banner_url' added successfully")
    
    finally:
        await engine.dispose()

if __name__ == '__main__':
    asyncio.run(add_stage_banner_column())
