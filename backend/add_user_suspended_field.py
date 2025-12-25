"""
Migration script to add suspended_until field to users table for customer suspension
"""
import asyncio
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

sys.path.append(str(Path(__file__).parent))
from app.core import settings

async def add_user_suspended_field():
    db_url = settings.DATABASE_URL
    if "+asyncmy" in db_url:
        sync_url = db_url.replace("+asyncmy", "+pymysql")
    elif "+aiosqlite" in db_url:
        sync_url = db_url.replace("+aiosqlite", "")
    else:
        sync_url = db_url

    try:
        engine = create_engine(sync_url, echo=True)
        with engine.begin() as conn:
            print("\nAdding suspended_until to users table...")
            try:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN suspended_until DATETIME NULL
                    COMMENT 'User suspended until this date (for customers)'
                """))
                print("✅ Added suspended_until column to users table")
            except Exception as e:
                if "Duplicate column name 'suspended_until'" in str(e):
                    print("☑️ suspended_until column already exists in users table")
                else:
                    print(f"❌ Error adding suspended_until to users: {e}")
                    raise

        print("\n✅ User suspension field added successfully!")

    except Exception as e:
        print(f"❌ Error setting up user suspension field: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(add_user_suspended_field())

