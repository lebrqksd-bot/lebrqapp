"""
Migration script to add Office and AttendanceOTP tables, and update Attendance table
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.db import get_async_session
from sqlalchemy import text


async def create_tables():
    """Create Office and AttendanceOTP tables, and update Attendance table"""
    async for session in get_async_session():
        try:
            # Create offices table
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS offices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    qr_id VARCHAR(100) UNIQUE NOT NULL,
                    latitude FLOAT NOT NULL,
                    longitude FLOAT NOT NULL,
                    allowed_radius FLOAT DEFAULT 100.0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    created_by_user_id INT,
                    INDEX idx_qr_id (qr_id),
                    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            
            # Create attendance_otps table
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS attendance_otps (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    staff_id INT NOT NULL,
                    otp VARCHAR(10) NOT NULL,
                    status VARCHAR(20) DEFAULT 'valid',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    used_at DATETIME NULL,
                    wrong_attempts INT DEFAULT 0,
                    blocked_until DATETIME NULL,
                    INDEX idx_staff_id (staff_id),
                    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            
            # Add GPS and device fields to attendance table
            await session.execute(text("""
                ALTER TABLE attendance
                ADD COLUMN IF NOT EXISTS check_in_latitude FLOAT NULL,
                ADD COLUMN IF NOT EXISTS check_in_longitude FLOAT NULL,
                ADD COLUMN IF NOT EXISTS check_out_latitude FLOAT NULL,
                ADD COLUMN IF NOT EXISTS check_out_longitude FLOAT NULL,
                ADD COLUMN IF NOT EXISTS check_in_device_type VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS check_in_ip_address VARCHAR(45) NULL,
                ADD COLUMN IF NOT EXISTS check_out_device_type VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS check_out_ip_address VARCHAR(45) NULL;
            """))
            
            await session.commit()
            print("✅ Tables created/updated successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")
            raise
        finally:
            await session.close()
            break


if __name__ == "__main__":
    asyncio.run(create_tables())

