"""
Migration script to add metadata columns to racks and rack_products tables
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import engine

async def add_metadata_columns():
    """Add metadata JSON columns to racks and rack_products tables if they don't exist"""
    try:
        async with engine.begin() as conn:
            # Check if metadata column exists in racks table
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = :db_name 
                AND TABLE_NAME = 'racks' 
                AND COLUMN_NAME = 'metadata'
            """), {'db_name': engine.url.database})
            racks_has_metadata = result.scalar() > 0
            
            if not racks_has_metadata:
                print("Adding 'metadata' column to 'racks' table...")
                await conn.execute(text("""
                    ALTER TABLE racks 
                    ADD COLUMN metadata JSON NULL
                """))
                print("✅ 'metadata' column added to 'racks' table!")
            else:
                print("✅ 'racks.metadata' column already exists")
            
            # Check if metadata column exists in rack_products table
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = :db_name 
                AND TABLE_NAME = 'rack_products' 
                AND COLUMN_NAME = 'metadata'
            """), {'db_name': engine.url.database})
            rack_products_has_metadata = result.scalar() > 0
            
            if not rack_products_has_metadata:
                print("Adding 'metadata' column to 'rack_products' table...")
                await conn.execute(text("""
                    ALTER TABLE rack_products 
                    ADD COLUMN metadata JSON NULL
                """))
                print("✅ 'metadata' column added to 'rack_products' table!")
            else:
                print("✅ 'rack_products.metadata' column already exists")
        
        print("\n✅ Migration completed successfully!")
        return True
    except Exception as e:
        print(f"\n❌ Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(add_metadata_columns())
    sys.exit(0 if success else 1)

