"""
Migration script to add category fields, QR code, and multiple images/videos support to racks
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_rack_enhancements():
    """Add category_name, category_image_url, qr_code_url to racks and images_json, videos_json to rack_products"""
    async with engine.begin() as conn:
        db_name = engine.url.database

        # Add category_name to racks
        try:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'racks' AND COLUMN_NAME = 'category_name'"
            ), {'db_name': db_name})
            if result.scalar() == 0:
                print("Adding 'category_name' column to 'racks' table...")
                await conn.execute(text("ALTER TABLE racks ADD COLUMN category_name VARCHAR(255) NULL"))
                print("✅ 'category_name' column added to 'racks' table!")
            else:
                print("✅ 'racks.category_name' column already exists")
        except Exception as e:
            print(f"⚠️  Error checking/adding category_name: {e}")

        # Add category_image_url to racks
        try:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'racks' AND COLUMN_NAME = 'category_image_url'"
            ), {'db_name': db_name})
            if result.scalar() == 0:
                print("Adding 'category_image_url' column to 'racks' table...")
                await conn.execute(text("ALTER TABLE racks ADD COLUMN category_image_url VARCHAR(500) NULL"))
                print("✅ 'category_image_url' column added to 'racks' table!")
            else:
                print("✅ 'racks.category_image_url' column already exists")
        except Exception as e:
            print(f"⚠️  Error checking/adding category_image_url: {e}")

        # Add qr_code_url to racks
        try:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'racks' AND COLUMN_NAME = 'qr_code_url'"
            ), {'db_name': db_name})
            if result.scalar() == 0:
                print("Adding 'qr_code_url' column to 'racks' table...")
                await conn.execute(text("ALTER TABLE racks ADD COLUMN qr_code_url VARCHAR(500) NULL"))
                print("✅ 'qr_code_url' column added to 'racks' table!")
            else:
                print("✅ 'racks.qr_code_url' column already exists")
        except Exception as e:
            print(f"⚠️  Error checking/adding qr_code_url: {e}")

        # Add images_json to rack_products
        try:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'rack_products' AND COLUMN_NAME = 'images_json'"
            ), {'db_name': db_name})
            if result.scalar() == 0:
                print("Adding 'images_json' column to 'rack_products' table...")
                await conn.execute(text("ALTER TABLE rack_products ADD COLUMN images_json JSON NULL"))
                print("✅ 'images_json' column added to 'rack_products' table!")
            else:
                print("✅ 'rack_products.images_json' column already exists")
        except Exception as e:
            print(f"⚠️  Error checking/adding images_json: {e}")

        # Add videos_json to rack_products
        try:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'rack_products' AND COLUMN_NAME = 'videos_json'"
            ), {'db_name': db_name})
            if result.scalar() == 0:
                print("Adding 'videos_json' column to 'rack_products' table...")
                await conn.execute(text("ALTER TABLE rack_products ADD COLUMN videos_json JSON NULL"))
                print("✅ 'videos_json' column added to 'rack_products' table!")
            else:
                print("✅ 'rack_products.videos_json' column already exists")
        except Exception as e:
            print(f"⚠️  Error checking/adding videos_json: {e}")

    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_rack_enhancements())

