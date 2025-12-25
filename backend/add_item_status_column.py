"""
Add item_status column to items table
Allows vendors/admins to mark items as:
- available (default)
- under_maintenance
- out_of_stock
"""
from sqlalchemy import text
from app.db import sync_engine

def add_item_status_column():
    """Add item_status to items table"""
    with sync_engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'items'
              AND COLUMN_NAME = 'item_status'
        """))
        exists = result.fetchone()[0] > 0
        
        if exists:
            print("✓ item_status column already exists")
        else:
            print("Adding item_status column...")
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN item_status VARCHAR(32) DEFAULT 'available' 
                COMMENT 'Item availability status: available, under_maintenance, out_of_stock'
                AFTER available
            """))
            conn.commit()
            print("✓ item_status column added successfully")
        
        print("\n✅ Database migration completed!")

if __name__ == "__main__":
    add_item_status_column()

