#!/usr/bin/env python3
"""
Add new columns to booking_items to support admin operations:
 - event_date DATE NULL
 - booking_status VARCHAR(32) NULL
 - is_supplyed BOOLEAN NOT NULL DEFAULT 0
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings


async def add_booking_items_columns():
    url = settings.DATABASE_URL
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=True)

    async with engine.begin() as conn:
        stmts = [
            "ALTER TABLE booking_items ADD COLUMN event_date DATE NULL",
            "ALTER TABLE booking_items ADD COLUMN booking_status VARCHAR(32) NULL",
            "ALTER TABLE booking_items ADD COLUMN is_supplyed BOOLEAN NOT NULL DEFAULT 0",
        ]
        for sql in stmts:
            try:
                await conn.execute(text(sql))
                print(f"✓ {sql}")
            except Exception as e:
                print(f"⚠ Skipped/failed: {sql} -> {e}")


if __name__ == "__main__":
    asyncio.run(add_booking_items_columns())
