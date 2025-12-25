"""
Add pricing columns to items table for vendor pricing and admin markup system
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.db import sync_engine

def add_pricing_columns():
    """Add vendor_price, admin_markup_percent, and updated_at columns to items table"""
    print("=" * 60)
    print("Adding Pricing Columns to Items Table")
    print("=" * 60)
    
    with sync_engine.connect() as conn:
        try:
            # Check if columns already exist
            print("\n1. Checking existing columns...")
            result = conn.execute(text("DESCRIBE items"))
            existing_columns = [row[0] for row in result]
            print(f"   Existing columns: {', '.join(existing_columns)}")
            
            # Add vendor_price column
            if 'vendor_price' not in existing_columns:
                print("\n2. Adding vendor_price column...")
                conn.execute(text("""
                    ALTER TABLE items 
                    ADD COLUMN vendor_price FLOAT DEFAULT 0.0 
                    COMMENT 'Base price from vendor (cost)'
                """))
                print("   ✅ vendor_price column added")
                
                # Copy existing price to vendor_price for existing items
                print("   📦 Copying existing prices to vendor_price...")
                conn.execute(text("""
                    UPDATE items 
                    SET vendor_price = price 
                    WHERE vendor_price = 0.0 OR vendor_price IS NULL
                """))
                print("   ✅ Existing prices copied to vendor_price")
            else:
                print("\n2. vendor_price column already exists, skipping...")
            
            # Add admin_markup_percent column
            if 'admin_markup_percent' not in existing_columns:
                print("\n3. Adding admin_markup_percent column...")
                conn.execute(text("""
                    ALTER TABLE items 
                    ADD COLUMN admin_markup_percent FLOAT DEFAULT 0.0 
                    COMMENT 'Admin markup percentage'
                """))
                print("   ✅ admin_markup_percent column added")
            else:
                print("\n3. admin_markup_percent column already exists, skipping...")
            
            # Add updated_at column
            if 'updated_at' not in existing_columns:
                print("\n4. Adding updated_at column...")
                conn.execute(text("""
                    ALTER TABLE items 
                    ADD COLUMN updated_at DATETIME NULL 
                    ON UPDATE CURRENT_TIMESTAMP
                """))
                print("   ✅ updated_at column added")
            else:
                print("\n4. updated_at column already exists, skipping...")
            
            # Add index on vendor_id for faster queries
            print("\n5. Adding index on vendor_id...")
            try:
                conn.execute(text("""
                    CREATE INDEX idx_items_vendor_id ON items(vendor_id)
                """))
                print("   ✅ Index on vendor_id added")
            except:
                print("   ⚠️  Index already exists or error, skipping...")
            
            conn.commit()
            
            print("\n" + "=" * 60)
            print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print("\nNew columns added to 'items' table:")
            print("  • vendor_price       - Base price from vendor (cost)")
            print("  • admin_markup_percent - Admin profit margin (%)")
            print("  • updated_at         - Track price changes")
            print("\nFormula: Final Price = vendor_price × (1 + admin_markup_percent/100)")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    try:
        add_pricing_columns()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)

