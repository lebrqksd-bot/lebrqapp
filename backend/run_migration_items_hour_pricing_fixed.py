"""
Migration script to add hour-based pricing columns to items table
Run this script to apply the migration: python run_migration_items_hour_pricing_fixed.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings

async def run_migration():
    """Execute the SQL migration to add hour-based pricing columns to items table"""
    # Construct database URL
    database_url = settings.DATABASE_URL
    
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else '***'}")
    
    # Create async engine
    engine = create_async_engine(database_url, echo=True)  # Enable echo to see SQL
    
    try:
        async with engine.begin() as conn:
            # Check if columns exist first
            check_sql = text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'items' 
                AND COLUMN_NAME IN ('base_hours_included', 'rate_per_extra_hour', 'is_eligible_for_space_offer')
            """)
            result = await conn.execute(check_sql)
            existing_cols = [row[0] for row in result]
            print(f"Existing columns: {existing_cols}")
            
            # Add base_hours_included if not exists
            if 'base_hours_included' not in existing_cols:
                print("Adding base_hours_included column...")
                await conn.execute(text("""
                    ALTER TABLE `items` 
                    ADD COLUMN `base_hours_included` INT DEFAULT 0 
                    COMMENT 'Base hours included in price (e.g., 3 hours)' 
                    AFTER `preparation_time_minutes`
                """))
                print("✅ Added base_hours_included")
            else:
                print("⚠️  base_hours_included already exists")
            
            # Add rate_per_extra_hour if not exists
            if 'rate_per_extra_hour' not in existing_cols:
                print("Adding rate_per_extra_hour column...")
                await conn.execute(text("""
                    ALTER TABLE `items` 
                    ADD COLUMN `rate_per_extra_hour` DECIMAL(10,2) DEFAULT 0.00 
                    COMMENT 'Rate per extra hour beyond base hours (e.g., ₹1000/hour)' 
                    AFTER `base_hours_included`
                """))
                print("✅ Added rate_per_extra_hour")
            else:
                print("⚠️  rate_per_extra_hour already exists")
            
            # Add is_eligible_for_space_offer if not exists
            if 'is_eligible_for_space_offer' not in existing_cols:
                print("Adding is_eligible_for_space_offer column...")
                await conn.execute(text("""
                    ALTER TABLE `items` 
                    ADD COLUMN `is_eligible_for_space_offer` BOOLEAN DEFAULT TRUE 
                    COMMENT 'Whether this item is eligible for space offers (halls, meeting rooms, programs)' 
                    AFTER `rate_per_extra_hour`
                """))
                print("✅ Added is_eligible_for_space_offer")
            else:
                print("⚠️  is_eligible_for_space_offer already exists")
        
        print("\n✅ Migration completed successfully! All columns added to items table.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

