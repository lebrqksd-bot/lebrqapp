"""
Add broker_settled fields to bookings table
Run from backend folder: python add_broker_settled_fields.py
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_broker_settled_fields():
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'bookings' 
            AND COLUMN_NAME = 'broker_settled'
        """))
        column_exists = result.fetchone() is not None
        
        if not column_exists:
            # Add broker_settled columns to bookings table
            await conn.execute(text("""
                ALTER TABLE bookings 
                ADD COLUMN broker_settled BOOLEAN DEFAULT FALSE NOT NULL COMMENT 'Whether broker payment has been settled',
                ADD COLUMN broker_settled_at DATETIME NULL COMMENT 'When broker payment was settled',
                ADD COLUMN broker_settled_by_user_id INT NULL COMMENT 'User who marked broker as settled'
            """))
            # Check if foreign key already exists
            fk_result = await conn.execute(text("""
                SELECT CONSTRAINT_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'bookings' 
                AND COLUMN_NAME = 'broker_settled_by_user_id'
                AND REFERENCED_TABLE_NAME = 'users'
            """))
            fk_exists = fk_result.fetchone() is not None
            
            if not fk_exists:
                # Add foreign key separately to avoid constraint issues
                try:
                    await conn.execute(text("""
                        ALTER TABLE bookings 
                        ADD FOREIGN KEY (broker_settled_by_user_id) REFERENCES users(id)
                    """))
                    print("✓ Added foreign key constraint for broker_settled_by_user_id")
                except Exception as e:
                    print(f"⚠ Warning: Could not add foreign key constraint: {e}")
                    print("  (This is not critical - the column will still work)")
            else:
                print("✓ Foreign key constraint already exists")
            print("✓ Added broker_settled fields to bookings table")
        else:
            print("✓ Column broker_settled already exists, skipping...")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_broker_settled_fields())

