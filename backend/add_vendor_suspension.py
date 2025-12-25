"""
Add suspended_until column to vendor_profiles table
Run from backend folder: python add_vendor_suspension.py
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_suspension_column():
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'vendor_profiles' 
            AND COLUMN_NAME = 'suspended_until'
        """))
        column_exists = result.fetchone() is not None
        
        if not column_exists:
            # Add suspended_until column to vendor_profiles table
            await conn.execute(text("""
                ALTER TABLE vendor_profiles 
                ADD COLUMN suspended_until DATETIME NULL
            """))
            print("✓ Added suspended_until column to vendor_profiles table")
        else:
            print("✓ Column suspended_until already exists, skipping...")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_suspension_column())

