#!/usr/bin/env python3
"""
Add pricing_overrides column to spaces table
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings

async def add_pricing_overrides_column():
    """Add pricing_overrides column to spaces table"""
    url = settings.DATABASE_URL
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=True)
    
    async with engine.begin() as conn:
        try:
            # Add pricing_overrides column to spaces table
            await conn.execute(text(
                "ALTER TABLE spaces ADD COLUMN pricing_overrides JSON"
            ))
            print("[OK] Added pricing_overrides column to spaces table")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("[OK] pricing_overrides column already exists")
            else:
                print(f"[ERROR] Error adding column: {e}")
                raise
        
        # Verify the column was added
        result = await conn.execute(text(
            "SHOW COLUMNS FROM spaces LIKE 'pricing_overrides'"
        ))
        row = result.fetchone()
        if row:
            print(f"[OK] Verified: pricing_overrides column exists (Type: {row[1]})")
        else:
            print("[ERROR] Column verification failed")

if __name__ == "__main__":
    asyncio.run(add_pricing_overrides_column())

