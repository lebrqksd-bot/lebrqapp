"""
Migration script to add is_approved field to broker_profiles table
"""
import asyncio
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

sys.path.append(str(Path(__file__).parent))
from app.core import settings

async def add_broker_approval_field():
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
            print("\nAdding is_approved to broker_profiles...")
            try:
                conn.execute(text("""
                    ALTER TABLE broker_profiles
                    ADD COLUMN is_approved BOOLEAN DEFAULT FALSE
                    COMMENT 'Broker approval status - must be approved by admin before access'
                """))
                print("✅ Added is_approved column to broker_profiles")
            except Exception as e:
                if "Duplicate column name 'is_approved'" in str(e):
                    print("☑️ is_approved column already exists in broker_profiles")
                else:
                    print(f"❌ Error adding is_approved to broker_profiles: {e}")
                    raise

            # Set existing brokers to approved (so they don't get locked out)
            try:
                conn.execute(text("""
                    UPDATE broker_profiles
                    SET is_approved = TRUE
                    WHERE is_approved IS NULL OR is_approved = FALSE
                """))
                print("✅ Set existing brokers to approved")
            except Exception as e:
                print(f"⚠️ Warning: Could not update existing brokers: {e}")

        print("\n✅ Broker approval field added successfully!")

    except Exception as e:
        print(f"❌ Error setting up broker approval field: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(add_broker_approval_field())

