"""
Script to add bank account fields to broker_profiles table.
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from app.core import settings
from sqlalchemy import create_engine, text

async def add_broker_bank_fields():
    """Add bank account fields to broker_profiles table."""
    db_url = settings.DATABASE_URL
    print(f"Using DATABASE_URL: {db_url}")

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
            fields = [
                ("bank_account_name", "VARCHAR(255) NULL"),
                ("bank_account_number", "VARCHAR(64) NULL"),
                ("bank_ifsc_code", "VARCHAR(16) NULL"),
                ("bank_name", "VARCHAR(255) NULL"),
            ]
            
            for field_name, field_type in fields:
                print(f"\nAdding {field_name} to broker_profiles...")
                try:
                    conn.execute(text(f"""
                        ALTER TABLE broker_profiles 
                        ADD COLUMN {field_name} {field_type}
                    """))
                    print(f"✅ Added {field_name} column")
                except Exception as e:
                    if "Duplicate column name" in str(e):
                        print(f"✅ {field_name} column already exists")
                    else:
                        raise

            print("\n✅ All bank account fields added successfully!")

    except Exception as e:
        print(f"❌ Error adding bank fields: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(add_broker_bank_fields())

