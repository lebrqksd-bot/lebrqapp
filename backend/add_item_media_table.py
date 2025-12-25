"""
Migration script to add item_media table for storing multiple images and videos per item
"""
import asyncio
from sqlalchemy import text
from app.db import get_session

async def add_item_media_table():
    """Create item_media table for storing multiple images/videos per item"""
    async for session in get_session():
        try:
            # Create item_media table
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS item_media (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    item_id INT NOT NULL,
                    media_type ENUM('image', 'video') NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    file_url VARCHAR(500) NOT NULL,
                    is_primary BOOLEAN DEFAULT FALSE,
                    display_order INT DEFAULT 0,
                    title VARCHAR(255) NULL,
                    description TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_item_id (item_id),
                    INDEX idx_media_type (media_type),
                    INDEX idx_is_primary (is_primary),
                    INDEX idx_display_order (display_order),
                    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            await session.commit()
            print("✅ Created item_media table successfully")
            
            # Migrate existing image_url to item_media if exists
            await session.execute(text("""
                INSERT INTO item_media (item_id, media_type, file_path, file_url, is_primary, display_order)
                SELECT 
                    id as item_id,
                    'image' as media_type,
                    image_url as file_path,
                    image_url as file_url,
                    TRUE as is_primary,
                    0 as display_order
                FROM items
                WHERE image_url IS NOT NULL 
                    AND image_url != ''
                    AND NOT EXISTS (
                        SELECT 1 FROM item_media WHERE item_media.item_id = items.id
                    )
            """))
            
            await session.commit()
            print("✅ Migrated existing image_url data to item_media")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
        finally:
            await session.close()
            break

if __name__ == "__main__":
    asyncio.run(add_item_media_table())

