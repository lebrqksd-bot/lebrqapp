"""
Migration script to add rack and rack_products tables
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import engine

async def add_rack_tables():
    """Add racks and rack_products tables if they don't exist"""
    try:
        async with engine.begin() as conn:
            # Check if racks table exists
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'racks'"
            ), {'db_name': engine.url.database})
            racks_exists = result.scalar() > 0
            
            if not racks_exists:
                print("Creating 'racks' table...")
                # Create racks table
                await conn.execute(text("""
                    CREATE TABLE racks (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        code VARCHAR(100) NOT NULL UNIQUE COMMENT 'QR code identifier',
                        description TEXT,
                        location VARCHAR(255),
                        active BOOLEAN DEFAULT TRUE,
                        metadata JSON,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_code (code),
                        INDEX idx_active (active)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
                print("✅ 'racks' table created successfully!")
            else:
                print("✅ 'racks' table already exists")
            
            # Check if rack_products table exists
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'rack_products'"
            ), {'db_name': engine.url.database})
            rack_products_exists = result.scalar() > 0
            
            if not rack_products_exists:
                print("Creating 'rack_products' table...")
                # Create rack_products table
                await conn.execute(text("""
                    CREATE TABLE rack_products (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        rack_id INT NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        image_url VARCHAR(500),
                        price FLOAT NOT NULL DEFAULT 0.0,
                        stock_quantity INT DEFAULT 0 COMMENT 'Available quantity in stock',
                        delivery_time VARCHAR(100) COMMENT 'e.g., 2-3 days, In stock',
                        category VARCHAR(100),
                        status VARCHAR(32) DEFAULT 'active' COMMENT 'active or inactive',
                        metadata JSON,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (rack_id) REFERENCES racks(id) ON DELETE CASCADE,
                        INDEX idx_rack_id (rack_id),
                        INDEX idx_status (status),
                        INDEX idx_category (category)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
                print("✅ 'rack_products' table created successfully!")
            else:
                print("✅ 'rack_products' table already exists")
        
        print("\n✅ Migration completed successfully!")
        return True
    except Exception as e:
        print(f"\n❌ Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(add_rack_tables())
    sys.exit(0 if success else 1)

