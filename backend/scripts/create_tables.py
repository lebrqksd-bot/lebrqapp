#!/usr/bin/env python
"""
Create all database tables in Supabase.

Run this script ONCE to initialize your Supabase database with all tables.
After initial setup, use Alembic migrations for schema changes.

Usage:
    cd backend
    python scripts/create_tables.py
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text


async def create_tables():
    """Create all database tables."""
    # Import after path setup
    from app.db.session import engine, Base
    from app.settings import settings
    
    # Import all models to register them with Base
    from app import models  # This imports all models
    
    print("=" * 60)
    print("Supabase Table Creation Script")
    print("=" * 60)
    print(f"Database: {settings.computed_database_url.split('@')[0]}...@{settings.computed_database_url.split('@')[1] if '@' in settings.computed_database_url else 'local'}")
    print()
    
    try:
        async with engine.begin() as conn:
            # Test connectivity
            result = await conn.execute(text("SELECT 1"))
            print("✓ Database connection successful")
            
            # List existing tables
            if "postgresql" in settings.computed_database_url:
                tables_result = await conn.execute(text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                ))
                existing_tables = [row[0] for row in tables_result.fetchall()]
                print(f"✓ Found {len(existing_tables)} existing tables: {existing_tables[:10]}{'...' if len(existing_tables) > 10 else ''}")
            
            # Create all tables
            print("\n[Creating Tables]")
            await conn.run_sync(Base.metadata.create_all)
            print("✓ All tables created successfully!")
            
            # List tables again
            if "postgresql" in settings.computed_database_url:
                tables_result = await conn.execute(text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                ))
                new_tables = [row[0] for row in tables_result.fetchall()]
                print(f"✓ Total tables now: {len(new_tables)}")
                
                # Show new tables
                created = set(new_tables) - set(existing_tables)
                if created:
                    print(f"✓ Newly created tables: {list(created)[:20]}{'...' if len(created) > 20 else ''}")
                    
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("Table creation complete!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(create_tables())
    sys.exit(0 if success else 1)
