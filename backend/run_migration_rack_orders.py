"""
Migration script to create rack_orders table
Run this script to apply the migration: python run_migration_rack_orders.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings
import os

async def run_migration():
    """Execute the SQL migration to create rack_orders table"""
    # Construct database URL
    database_url = settings.DATABASE_URL
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else '***'}")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    
    try:
        # Read SQL file
        sql_file_path = os.path.join(os.path.dirname(__file__), 'create_rack_orders_table.sql')
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print("Executing migration: create_rack_orders_table.sql")
        
        # Execute SQL
        async with engine.begin() as conn:
            await conn.execute(text(sql_content))
        
        print("✅ Migration completed successfully! rack_orders table created.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

