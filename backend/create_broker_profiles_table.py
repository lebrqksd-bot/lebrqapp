"""
Script to create the broker_profiles table in the database.
This table is similar to vendor_profiles but for brokers.
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from app.core import settings
from sqlalchemy import create_engine, text

async def create_broker_profiles_table():
    """Create the broker_profiles table if it doesn't exist."""
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
            print("Creating broker_profiles table...")
            
            # Check if table already exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'broker_profiles'
            """))
            table_exists = result.scalar() > 0

            if table_exists:
                print("✅ broker_profiles table already exists")
            else:
                # Create the broker_profiles table
                conn.execute(text("""
                    CREATE TABLE broker_profiles (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL UNIQUE,
                        company_name VARCHAR(255) NULL,
                        description TEXT NULL,
                        contact_email VARCHAR(255) NULL,
                        contact_phone VARCHAR(64) NULL,
                        address TEXT NULL,
                        suspended_until DATETIME NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
                print("✅ broker_profiles table created successfully")

            # Verify table structure
            print("\nTable structure:")
            result = conn.execute(text("DESCRIBE broker_profiles"))
            for row in result:
                print(f"  - {row[0]}: {row[1]}")

    except Exception as e:
        print(f"❌ Error creating broker_profiles table: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(create_broker_profiles_table())

