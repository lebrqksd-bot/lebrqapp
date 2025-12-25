import asyncio
from sqlalchemy import text
from app.db import engine

async def add_admin_viewed_fields():
    """Add admin_viewed_at fields to bookings and users tables"""
    async with engine.begin() as conn:
        # Check and add to bookings table
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'admin_viewed_at'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("ALTER TABLE bookings ADD COLUMN admin_viewed_at DATETIME NULL"))
            print("✓ Added admin_viewed_at column to bookings table")
        else:
            print("✓ admin_viewed_at column already exists in bookings table")
        
        # Check and add to users table
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'admin_viewed_at'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("ALTER TABLE users ADD COLUMN admin_viewed_at DATETIME NULL"))
            print("✓ Added admin_viewed_at column to users table")
        else:
            print("✓ admin_viewed_at column already exists in users table")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_admin_viewed_fields())

