"""
Migration script to add hours_used column to booking_items table
Run this script to apply the migration: python run_migration_hours_used.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings
import os

async def run_migration():
    """Execute the SQL migration to add hours_used column to booking_items"""
    # Construct database URL
    database_url = settings.DATABASE_URL
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else '***'}")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    
    try:
        # Read SQL file
        sql_file_path = os.path.join(os.path.dirname(__file__), '..', 'MYSQL_ADD_HOURS_USED_COLUMN.sql')
        if not os.path.exists(sql_file_path):
            # Try alternative path
            sql_file_path = os.path.join(os.path.dirname(__file__), 'MYSQL_ADD_HOURS_USED_COLUMN.sql')
        
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print("Executing migration: MYSQL_ADD_HOURS_USED_COLUMN.sql")
        
        # Execute SQL
        async with engine.begin() as conn:
            await conn.execute(text(sql_content))
        
        print("✅ Migration completed successfully! hours_used column added to booking_items table.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

