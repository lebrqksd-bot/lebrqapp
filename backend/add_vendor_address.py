"""
Migration script to add address column to vendor_profiles table.
Run from backend folder: python add_vendor_address.py
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_vendor_address():
    async with engine.begin() as conn:
        # Check if address column exists
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'vendor_profiles' AND COLUMN_NAME = 'address'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("ALTER TABLE vendor_profiles ADD COLUMN address TEXT NULL"))
            print("✓ Added address column to vendor_profiles table")
        else:
            print("✓ address column already exists in vendor_profiles table")

    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_vendor_address())

