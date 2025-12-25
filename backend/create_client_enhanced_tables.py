"""
Create Enhanced Client Communication Tables

This script creates the following tables:
1. client_audio_notes       - Store voice notes recorded by clients for bookings
2. client_notifications     - Store all client notifications with read/unread tracking
3. client_messages          - Store threaded messaging between admin and clients
4. client_activity_log      - Track client actions for auditing and analytics
"""

import asyncio
from sqlalchemy import text

from app.db import get_async_engine


async def create_client_tables() -> None:
    """Create all enhanced client communication tables if they don't exist."""
    engine = get_async_engine()

    async with engine.begin() as conn:
        # 1. Client Audio Notes
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS client_audio_notes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    booking_id INT NOT NULL,
                    user_id INT NOT NULL,
                    audio_file_path VARCHAR(500) NOT NULL,
                    audio_duration_seconds INT NULL,
                    file_size_bytes INT NULL,
                    mime_type VARCHAR(50) DEFAULT 'audio/webm',
                    transcription TEXT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    is_played_by_admin BOOLEAN DEFAULT FALSE,
                    admin_notes TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    played_at DATETIME NULL,
                    INDEX idx_booking (booking_id),
                    INDEX idx_user (user_id),
                    INDEX idx_status (status),
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )

        # 2. Client Notifications
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS client_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    booking_id INT NULL,
                    link VARCHAR(500) NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    priority VARCHAR(20) DEFAULT 'normal',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME NULL,
                    INDEX idx_user_read (user_id, is_read),
                    INDEX idx_created (created_at),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )

        # 3. Client Messages (Admin ↔ Client)
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS client_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    thread_id VARCHAR(100) NOT NULL,
                    sender_id INT NOT NULL,
                    recipient_id INT NOT NULL,
                    subject VARCHAR(255) NULL,
                    message TEXT NOT NULL,
                    booking_id INT NULL,
                    parent_message_id INT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    is_deleted_by_sender BOOLEAN DEFAULT FALSE,
                    is_deleted_by_recipient BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME NULL,
                    INDEX idx_thread (thread_id),
                    INDEX idx_sender_recipient (sender_id, recipient_id),
                    INDEX idx_created (created_at),
                    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_message_id) REFERENCES client_messages(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )

        # 4. Client Activity Log
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS client_activity_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    entity_type VARCHAR(50) NULL,
                    entity_id INT NULL,
                    details TEXT NULL,
                    ip_address VARCHAR(45) NULL,
                    user_agent TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_action (user_id, action),
                    INDEX idx_entity (entity_type, entity_id),
                    INDEX idx_created (created_at),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )

        print("✅ All client enhanced tables created successfully!")
        print("   - client_audio_notes")
        print("   - client_notifications")
        print("   - client_messages")
        print("   - client_activity_log")


if __name__ == "__main__":
    asyncio.run(create_client_tables())

