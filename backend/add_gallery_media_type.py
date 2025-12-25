"""
Add media_type column to gallery_images table
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal
from app.core import settings

async def run_migration():
    """Add media_type column to gallery_images table if it doesn't exist"""
    async with AsyncSessionLocal() as session:
        try:
            print("Starting migration: Adding media_type column to gallery_images table...")
            
            # Check if column exists
            result = await session.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = :db_name 
                AND TABLE_NAME = 'gallery_images'
                AND COLUMN_NAME = 'media_type'
            """), {"db_name": settings.MYSQL_DB})
            existing_column = result.fetchone()
            
            if existing_column:
                print("Column media_type already exists, skipping...")
            else:
                print("Adding column: media_type")
                # Add the media_type column with default value 'image' for existing rows
                await session.execute(text("""
                    ALTER TABLE gallery_images 
                    ADD COLUMN media_type VARCHAR(10) NOT NULL DEFAULT 'image' COMMENT 'image or video'
                """))
                
                # Commit the changes
                await session.commit()
                print("Migration completed successfully! Column media_type added to gallery_images table.")
            
        except Exception as e:
            await session.rollback()
            print(f"Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_migration())

