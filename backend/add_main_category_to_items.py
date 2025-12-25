"""
Migration script to add main_category column to items table
Run this script to add the main_category field to existing items table
"""
import asyncio
from sqlalchemy import text
from app.db import get_session

async def add_main_category_column():
    """Add main_category column to items table"""
    async for session in get_session():
        try:
            # Check if column already exists
            result = await session.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'items' 
                AND COLUMN_NAME = 'main_category'
            """))
            exists = result.scalar() > 0
            
            if exists:
                print("Column 'main_category' already exists in 'items' table")
                return
            
            # Add the column
            await session.execute(text("""
                ALTER TABLE items 
                ADD COLUMN main_category VARCHAR(64) NULL 
                COMMENT 'Main event category: social-life|cultural-religious|corporate-business|educational-academic|health-wellness-sports|cake-others'
                AFTER vendor_id
            """))
            await session.commit()
            print("✅ Successfully added 'main_category' column to 'items' table")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding main_category column: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(add_main_category_column())

