"""
Add preparation_time_minutes column to items table
This allows vendors and admins to specify how much advance notice they need for each item
"""
from sqlalchemy import text
from app.db import sync_engine

def add_preparation_time_column():
    """Add preparation_time_minutes to items table"""
    with sync_engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'items'
              AND COLUMN_NAME = 'preparation_time_minutes'
        """))
        exists = result.fetchone()[0] > 0
        
        if exists:
            print("✓ preparation_time_minutes column already exists")
        else:
            print("Adding preparation_time_minutes column...")
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN preparation_time_minutes INT DEFAULT 0 COMMENT 'Minimum preparation time in minutes'
                AFTER available
            """))
            conn.commit()
            print("✓ preparation_time_minutes column added successfully")
        
        print("\n✅ Database migration completed!")

if __name__ == "__main__":
    add_preparation_time_column()

