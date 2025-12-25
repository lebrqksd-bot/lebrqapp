"""
Add payment_settled field to booking_items table
Run from backend folder: python add_payment_settled_field.py
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_payment_settled_field():
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'booking_items' 
            AND COLUMN_NAME = 'payment_settled'
        """))
        column_exists = result.fetchone() is not None
        
        if not column_exists:
            # Add payment_settled column to booking_items table
            await conn.execute(text("""
                ALTER TABLE booking_items 
                ADD COLUMN payment_settled BOOLEAN DEFAULT FALSE NOT NULL,
                ADD COLUMN payment_settled_at DATETIME NULL,
                ADD COLUMN payment_settled_by_user_id BIGINT NULL
            """))
            print("✓ Added payment_settled fields to booking_items table")
        else:
            print("✓ Column payment_settled already exists, skipping...")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_payment_settled_field())

