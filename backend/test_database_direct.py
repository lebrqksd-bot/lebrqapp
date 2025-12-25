#!/usr/bin/env python3
"""
Test database directly to see if the data is there
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

def get_database_url() -> str:
    return os.environ.get("DB_URL") or os.environ.get("DATABASE_URL") or "sqlite+aiosqlite:///./lebrq.db"

async def test_database_direct():
    """Test database directly"""
    url = get_database_url()
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=False)
    
    async with engine.begin() as conn:
        # Check spaces table structure
        result = await conn.execute(text("DESCRIBE spaces"))
        columns = result.fetchall()
        print("Spaces table columns:")
        for col in columns:
            print(f"  - {col[0]} ({col[1]})")
        
        # Check spaces data
        result = await conn.execute(text("SELECT id, name, description, image_url, features, event_types, stage_options, banner_sizes FROM spaces WHERE id IN (1, 2)"))
        rows = result.fetchall()
        print("\nSpaces data:")
        for row in rows:
            print(f"  - ID: {row[0]}, Name: {row[1]}")
            print(f"    Description: {row[2]}")
            print(f"    Image URL: {row[3]}")
            print(f"    Features: {row[4]}")
            print(f"    Event Types: {row[5]}")
            print(f"    Stage Options: {row[6]}")
            print(f"    Banner Sizes: {row[7]}")
            print()

if __name__ == "__main__":
    asyncio.run(test_database_direct())
