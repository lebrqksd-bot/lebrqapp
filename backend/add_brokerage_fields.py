"""
Script to add brokerage_percentage to broker_profiles and broker_id, brokerage_amount to bookings.
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from app.core import settings
from sqlalchemy import create_engine, text

async def add_brokerage_fields():
    """Add brokerage fields to database tables."""
    db_url = settings.DATABASE_URL
    print(f"Using DATABASE_URL: {db_url}")

    # Convert async URL to sync URL for SQLAlchemy
    if "+asyncmy" in db_url:
        sync_url = db_url.replace("+asyncmy", "+pymysql")
    elif "+aiosqlite" in db_url:
        sync_url = db_url.replace("+aiosqlite", "")
    else:
        sync_url = db_url

    print(f"Connecting with sync URL: {sync_url}")

    try:
        engine = create_engine(sync_url, echo=True)
        with engine.begin() as conn:
            # Add brokerage_percentage to broker_profiles
            print("\n1. Adding brokerage_percentage to broker_profiles...")
            try:
                conn.execute(text("""
                    ALTER TABLE broker_profiles 
                    ADD COLUMN brokerage_percentage FLOAT DEFAULT 0.0 
                    COMMENT 'Brokerage percentage for this broker'
                """))
                print("✅ Added brokerage_percentage column to broker_profiles")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("✅ brokerage_percentage column already exists in broker_profiles")
                else:
                    raise

            # Add broker_id to bookings
            print("\n2. Adding broker_id to bookings...")
            try:
                conn.execute(text("""
                    ALTER TABLE bookings 
                    ADD COLUMN broker_id INT NULL,
                    ADD FOREIGN KEY (broker_id) REFERENCES broker_profiles(id) ON DELETE SET NULL,
                    ADD INDEX idx_broker_id (broker_id)
                """))
                print("✅ Added broker_id column to bookings")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("✅ broker_id column already exists in bookings")
                else:
                    raise

            # Add brokerage_amount to bookings
            print("\n3. Adding brokerage_amount to bookings...")
            try:
                conn.execute(text("""
                    ALTER TABLE bookings 
                    ADD COLUMN brokerage_amount FLOAT DEFAULT 0.0 
                    COMMENT 'Brokerage amount for broker'
                """))
                print("✅ Added brokerage_amount column to bookings")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("✅ brokerage_amount column already exists in bookings")
                else:
                    raise

            print("\n✅ All brokerage fields added successfully!")

    except Exception as e:
        print(f"❌ Error adding brokerage fields: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(add_brokerage_fields())

