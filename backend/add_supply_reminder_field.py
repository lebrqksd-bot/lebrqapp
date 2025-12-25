import asyncio
from sqlalchemy import text
from app.db import engine

async def add_supply_reminder_field():
    """Add supply_reminder_sent_at field to booking_items table"""
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'booking_items' AND COLUMN_NAME = 'supply_reminder_sent_at'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("ALTER TABLE booking_items ADD COLUMN supply_reminder_sent_at DATETIME NULL"))
            print("✓ Added supply_reminder_sent_at column to booking_items table")
        else:
            print("✓ supply_reminder_sent_at column already exists in booking_items table")
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_supply_reminder_field())

