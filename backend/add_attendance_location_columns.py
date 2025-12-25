"""
Migration script to add location tracking columns to attendance table
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.db import engine
from sqlalchemy import text


async def add_location_columns():
    """Add location tracking columns to attendance table"""
    async with engine.begin() as conn:
        try:
            # Check if columns already exist
            check_query = text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'attendance' 
                AND COLUMN_NAME IN (
                    'check_in_latitude', 
                    'check_in_longitude', 
                    'check_out_latitude', 
                    'check_out_longitude',
                    'check_in_device_type',
                    'check_in_ip_address',
                    'check_out_device_type',
                    'check_out_ip_address'
                )
            """)
            result = await conn.execute(check_query)
            existing_columns = [row[0] for row in result.fetchall()]
            
            print(f"Existing location columns: {existing_columns}")
            
            # Add missing columns
            columns_to_add = [
                ("check_in_latitude", "FLOAT NULL"),
                ("check_in_longitude", "FLOAT NULL"),
                ("check_out_latitude", "FLOAT NULL"),
                ("check_out_longitude", "FLOAT NULL"),
                ("check_in_device_type", "VARCHAR(50) NULL"),
                ("check_in_ip_address", "VARCHAR(45) NULL"),
                ("check_out_device_type", "VARCHAR(50) NULL"),
                ("check_out_ip_address", "VARCHAR(45) NULL"),
            ]
            
            for col_name, col_type in columns_to_add:
                if col_name not in existing_columns:
                    alter_query = text(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}")
                    await conn.execute(alter_query)
                    print(f"✅ Added column: {col_name}")
                else:
                    print(f"⏭️  Column already exists: {col_name}")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(add_location_columns())

