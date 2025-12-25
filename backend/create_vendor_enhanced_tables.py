"""
Create Enhanced Vendor Communication Tables

This script creates the following tables:
1. vendor_notifications - Store all vendor notifications
2. vendor_messages - Store admin-vendor threaded conversations
3. vendor_activity_log - Track vendor actions for analytics
4. booking_item_status_history - Track status changes for items
"""

import asyncio
from sqlalchemy import text
from app.db import get_async_engine

async def create_vendor_tables():
    engine = get_async_engine()
    
    async with engine.begin() as conn:
        # 1. Vendor Notifications Table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS vendor_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                booking_id INT NULL,
                booking_item_id INT NULL,
                link VARCHAR(500) NULL,
                is_read BOOLEAN DEFAULT FALSE,
                is_deleted BOOLEAN DEFAULT FALSE,
                priority VARCHAR(20) DEFAULT 'normal',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME NULL,
                INDEX idx_vendor_user (vendor_user_id),
                INDEX idx_booking (booking_id),
                INDEX idx_booking_item (booking_item_id),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (vendor_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        
        # 2. Vendor Messages Table (Admin-Vendor Communication)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS vendor_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                thread_id VARCHAR(100) NOT NULL,
                sender_id INT NOT NULL,
                recipient_id INT NOT NULL,
                subject VARCHAR(255) NULL,
                message TEXT NOT NULL,
                booking_id INT NULL,
                booking_item_id INT NULL,
                parent_message_id INT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                is_deleted_by_sender BOOLEAN DEFAULT FALSE,
                is_deleted_by_recipient BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME NULL,
                INDEX idx_thread (thread_id),
                INDEX idx_sender (sender_id),
                INDEX idx_recipient (recipient_id),
                INDEX idx_booking (booking_id),
                INDEX idx_parent (parent_message_id),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_message_id) REFERENCES vendor_messages(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        
        # 3. Vendor Activity Log
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS vendor_activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NULL,
                entity_id INT NULL,
                details TEXT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_vendor_user (vendor_user_id),
                INDEX idx_action (action),
                INDEX idx_entity (entity_type, entity_id),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (vendor_user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        
        # 4. Booking Item Status History
        # Note: booking_item_id is nullable to support catalog item status tracking
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS booking_item_status_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_item_id INT NULL,
                old_status VARCHAR(50) NULL,
                new_status VARCHAR(50) NOT NULL,
                changed_by_user_id INT NOT NULL,
                changed_by_role VARCHAR(50) NOT NULL,
                reason TEXT NULL,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_booking_item (booking_item_id),
                INDEX idx_changed_by (changed_by_user_id),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE,
                FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        
        print("✅ All vendor enhanced tables created successfully!")
        print("   - vendor_notifications")
        print("   - vendor_messages")
        print("   - vendor_activity_log")
        print("   - booking_item_status_history")

if __name__ == "__main__":
    asyncio.run(create_vendor_tables())

