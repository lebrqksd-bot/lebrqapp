"""
Migration script to add admin_viewed_at columns to bookings and users tables
Run this script to apply the migration: python run_migration_admin_viewed_at.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings

async def run_migration():
    """Execute the SQL migration to add admin_viewed_at columns"""
    # Construct database URL
    database_url = settings.DATABASE_URL
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else '***'}")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=True)
    
    try:
        async with engine.begin() as conn:
            # Check if columns exist first
            check_sql = text("""
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN ('bookings', 'users')
                AND COLUMN_NAME = 'admin_viewed_at'
            """)
            result = await conn.execute(check_sql)
            existing = {(row[0], row[1]) for row in result}
            print(f"Existing columns: {existing}")
            
            # Add admin_viewed_at to bookings if not exists
            if ('bookings', 'admin_viewed_at') not in existing:
                print("Adding admin_viewed_at column to bookings table...")
                await conn.execute(text("""
                    ALTER TABLE `bookings` 
                    ADD COLUMN `admin_viewed_at` DATETIME NULL 
                    COMMENT 'When admin viewed this booking (for badge tracking)' 
                    AFTER `broker_settled_by_user_id`
                """))
                print("✅ Added admin_viewed_at to bookings")
            else:
                print("⚠️  admin_viewed_at already exists in bookings")
            
            # Add admin_viewed_at to users if not exists
            if ('users', 'admin_viewed_at') not in existing:
                print("Adding admin_viewed_at column to users table...")
                await conn.execute(text("""
                    ALTER TABLE `users` 
                    ADD COLUMN `admin_viewed_at` DATETIME NULL 
                    COMMENT 'When admin viewed this user (for badge tracking)' 
                    AFTER `suspended_until`
                """))
                print("✅ Added admin_viewed_at to users")
            else:
                print("⚠️  admin_viewed_at already exists in users")
        
        print("\n✅ Migration completed successfully! admin_viewed_at columns added.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

