#!/usr/bin/env python3
"""
Migration script to make booking_item_id nullable in booking_item_status_history table
This allows tracking catalog item status changes (where booking_item_id is not applicable)
"""
import asyncio
from sqlalchemy import text
from app.db import get_async_engine

async def make_booking_item_id_nullable():
    """Make booking_item_id nullable to support catalog item status tracking"""
    engine = get_async_engine()
    async with engine.begin() as conn:
        # Check if column is already nullable
        result = await conn.execute(text("""
            SELECT IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'booking_item_status_history' 
            AND COLUMN_NAME = 'booking_item_id'
        """))
        row = result.fetchone()
        
        if row and row[0] == 'YES':
            print("✓ booking_item_id is already nullable")
            return
        
        print("Making booking_item_id nullable...")
        
        # Find the actual foreign key constraint name
        fk_result = await conn.execute(text("""
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'booking_item_status_history' 
            AND COLUMN_NAME = 'booking_item_id'
            AND REFERENCED_TABLE_NAME IS NOT NULL
        """))
        fk_row = fk_result.fetchone()
        
        if fk_row:
            fk_name = fk_row[0]
            # Drop foreign key constraint first
            await conn.execute(text(f"""
                ALTER TABLE booking_item_status_history 
                DROP FOREIGN KEY {fk_name}
            """))
        
        # Make column nullable
        await conn.execute(text("""
            ALTER TABLE booking_item_status_history 
            MODIFY COLUMN booking_item_id INT NULL
        """))
        
        # Re-add foreign key constraint (now allowing NULL)
        if fk_row:
            await conn.execute(text("""
                ALTER TABLE booking_item_status_history 
                ADD CONSTRAINT booking_item_status_history_ibfk_1 
                FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE
            """))
        
        print("✓ booking_item_id is now nullable")

if __name__ == "__main__":
    asyncio.run(make_booking_item_id_nullable())

