import asyncio
from sqlalchemy import text
from app.db import engine

async def add_accepted_at_field():
    """Add accepted_at field to booking_items table"""
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'booking_items' AND COLUMN_NAME = 'accepted_at'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("ALTER TABLE booking_items ADD COLUMN accepted_at DATETIME NULL"))
            print("✓ Added accepted_at column to booking_items table")
        else:
            print("✓ accepted_at column already exists in booking_items table")
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_accepted_at_field())

