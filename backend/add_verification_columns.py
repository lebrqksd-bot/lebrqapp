#!/usr/bin/env python3
"""
Migration script to add is_verified and verified_at columns to program_participants table.
"""
import sys
import asyncio
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine
import os

async def add_verification_columns():
    """Add is_verified and verified_at columns if they don't exist."""
    # Get database URL
    db_url = os.getenv('DB_URL', 'sqlite+aiosqlite:///./lebrq.db')
    engine = create_async_engine(db_url, echo=False)
    
    try:
        async with engine.begin() as conn:
            # For SQLite, we use ALTER TABLE directly
            try:
                await conn.execute(text("ALTER TABLE program_participants ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
                print("✓ is_verified column added")
            except Exception as e:
                if 'duplicate column' in str(e).lower():
                    print("✓ is_verified column already exists")
                else:
                    raise
            
            try:
                await conn.execute(text("ALTER TABLE program_participants ADD COLUMN verified_at DATETIME"))
                print("✓ verified_at column added")
            except Exception as e:
                if 'duplicate column' in str(e).lower():
                    print("✓ verified_at column already exists")
                else:
                    raise
    finally:
        await engine.dispose()

if __name__ == '__main__':
    try:
        asyncio.run(add_verification_columns())
        print("\n✅ Migration completed successfully!")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
