import asyncio
from sqlalchemy import text
from app.db import engine

async def add_rejection_history_table():
    """Create booking_item_rejections table to track all vendor rejections for an item"""
    async with engine.begin() as conn:
        # Check if table exists
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'booking_item_rejections'"
        ), {'db_name': engine.url.database})
        if result.scalar() == 0:
            await conn.execute(text("""
                CREATE TABLE booking_item_rejections (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    booking_item_id INT NOT NULL,
                    vendor_id INT NOT NULL,
                    rejection_note TEXT,
                    rejected_at DATETIME NOT NULL,
                    FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE,
                    FOREIGN KEY (vendor_id) REFERENCES vendor_profiles(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_item_vendor_rejection (booking_item_id, vendor_id),
                    INDEX idx_booking_item_id (booking_item_id),
                    INDEX idx_vendor_id (vendor_id)
                )
            """))
            print("✓ Created booking_item_rejections table")
        else:
            print("✓ booking_item_rejections table already exists")
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_rejection_history_table())

