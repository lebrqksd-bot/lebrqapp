"""
Migration script to add deleted_at columns for soft delete functionality
Run this script to add the deleted_at columns to the database tables.
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import engine
from app.core import settings

async def run_migration():
    """Run the migration to add deleted_at columns."""
    print("=" * 60)
    print("Running migration: Adding deleted_at columns")
    print("=" * 60)
    
    migration_sql = [
        # Add deleted_at column to whatsapp_keyword_responses table
        """
        ALTER TABLE whatsapp_keyword_responses 
        ADD COLUMN deleted_at DATETIME NULL COMMENT 'Soft delete timestamp';
        """,
        
        # Add deleted_at column to whatsapp_quick_replies table
        """
        ALTER TABLE whatsapp_quick_replies 
        ADD COLUMN deleted_at DATETIME NULL COMMENT 'Soft delete timestamp';
        """,
        
        # Create indexes for better query performance
        """
        CREATE INDEX idx_whatsapp_keyword_responses_deleted_at 
        ON whatsapp_keyword_responses(deleted_at);
        """,
        
        """
        CREATE INDEX idx_whatsapp_quick_replies_deleted_at 
        ON whatsapp_quick_replies(deleted_at);
        """
    ]
    
    try:
        async with engine.begin() as conn:
            print(f"\nConnecting to database: {settings.MYSQL_DB}@{settings.MYSQL_HOST}")
            
            for i, sql in enumerate(migration_sql, 1):
                try:
                    print(f"\n[{i}/{len(migration_sql)}] Executing migration step...")
                    await conn.execute(text(sql))
                    print(f"✓ Step {i} completed successfully")
                except Exception as e:
                    # Check if column/index already exists
                    error_msg = str(e).lower()
                    if "duplicate column name" in error_msg or "already exists" in error_msg:
                        print(f"⚠ Step {i} skipped (column/index already exists)")
                    else:
                        print(f"✗ Step {i} failed: {e}")
                        raise
            
            print("\n" + "=" * 60)
            print("Migration completed successfully!")
            print("=" * 60)
            print("\nThe deleted_at columns have been added to:")
            print("  - whatsapp_keyword_responses")
            print("  - whatsapp_quick_replies")
            print("\nIndexes have been created for better query performance.")
            
    except Exception as e:
        print("\n" + "=" * 60)
        print("Migration failed!")
        print("=" * 60)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
