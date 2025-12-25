"""
Migration script to add hour-based pricing columns to items table
Run this script to apply the migration: python run_migration_items_hour_pricing.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings
import os

async def run_migration():
    """Execute the SQL migration to add hour-based pricing columns to items table"""
    # Construct database URL
    database_url = settings.DATABASE_URL
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else '***'}")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    
    try:
        # Read SQL file
        sql_file_path = os.path.join(os.path.dirname(__file__), 'add_items_hour_pricing_columns.sql')
        
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print("Executing migration: add_items_hour_pricing_columns.sql")
        
        # Execute SQL (split by semicolon to handle multiple statements)
        async with engine.begin() as conn:
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
            for statement in statements:
                if statement:
                    try:
                        await conn.execute(text(statement))
                    except Exception as e:
                        # If column already exists, that's okay
                        if 'Duplicate column name' in str(e) or 'already exists' in str(e).lower():
                            print(f"⚠️  Column already exists, skipping: {statement[:50]}...")
                        else:
                            raise
        
        print("✅ Migration completed successfully! Hour-based pricing columns added to items table.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

