"""
Add vendor_id column to vehicles table
"""
from sqlalchemy import text
from app.db import get_db

def add_vendor_column():
    db = next(get_db())
    try:
        # Check if column exists
        result = db.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'vehicles' 
            AND COLUMN_NAME = 'vendor_id'
        """)).scalar()
        
        if result == 0:
            # Add vendor_id column
            db.execute(text("""
                ALTER TABLE vehicles 
                ADD COLUMN vendor_id INT NULL,
                ADD CONSTRAINT fk_vehicles_vendor 
                FOREIGN KEY (vendor_id) REFERENCES vendor_profiles(id) 
                ON DELETE SET NULL
            """))
            db.commit()
            print("✓ Added vendor_id column to vehicles table")
        else:
            print("✓ vendor_id column already exists")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_vendor_column()

