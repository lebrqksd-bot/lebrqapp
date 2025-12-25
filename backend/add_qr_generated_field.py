"""
Migration script to add qr_generated_at field to offices table
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.db import get_session

async def add_qr_generated_field():
    """Add qr_generated_at column to offices table"""
    async for session in get_session():
        try:
            # Check if column already exists
            result = await session.execute(
                text("SHOW COLUMNS FROM offices LIKE 'qr_generated_at'")
            )
            if result.fetchone():
                print("✅ Column 'qr_generated_at' already exists")
                return
            
            # Add column
            await session.execute(
                text("ALTER TABLE offices ADD COLUMN qr_generated_at DATETIME NULL")
            )
            await session.commit()
            print("✅ Added 'qr_generated_at' column to offices table")
        except Exception as e:
            await session.rollback()
            print(f"ERROR: {e}")
            raise
        finally:
            break

if __name__ == "__main__":
    asyncio.run(add_qr_generated_field())

