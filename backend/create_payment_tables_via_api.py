#!/usr/bin/env python3
"""
Script to create payment tables using the existing database connection
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.db import get_session
from sqlalchemy import text

async def create_payment_tables():
    """Create payment-related tables using existing database connection"""
    try:
        async for session in get_session():
            # Create payments table
            payments_table = """
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                payment_id VARCHAR(100) UNIQUE NOT NULL,
                order_id VARCHAR(100) UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'INR',
                payment_method VARCHAR(50) NOT NULL,
                payment_status VARCHAR(20) DEFAULT 'pending',
                transaction_id VARCHAR(100) NULL,
                gateway_response JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            
            # Create bookings table
            bookings_table = """
            CREATE TABLE IF NOT EXISTS bookings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                space_id INT NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                event_date DATETIME NOT NULL,
                start_time VARCHAR(10) NOT NULL,
                end_time VARCHAR(10) NOT NULL,
                duration_hours INT NOT NULL,
                base_amount DECIMAL(10,2) NOT NULL,
                addons_amount DECIMAL(10,2) DEFAULT 0.00,
                stage_amount DECIMAL(10,2) DEFAULT 0.00,
                banner_amount DECIMAL(10,2) DEFAULT 0.00,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                special_requests TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            
            # Create booking_addons table
            booking_addons_table = """
            CREATE TABLE IF NOT EXISTS booking_addons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                addon_id VARCHAR(100) NOT NULL,
                addon_name VARCHAR(200) NOT NULL,
                addon_type VARCHAR(20) NOT NULL,
                quantity INT DEFAULT 1,
                unit_price DECIMAL(10,2) NOT NULL,
                total_price DECIMAL(10,2) NOT NULL,
                sub_items JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            
            # Execute table creation
            print("Creating payments table...")
            await session.execute(text(payments_table))
            
            print("Creating bookings table...")
            await session.execute(text(bookings_table))
            
            print("Creating booking_addons table...")
            await session.execute(text(booking_addons_table))
            
            # Commit changes
            await session.commit()
            
            print("✅ All payment tables created successfully!")
            
            # Verify tables exist
            result = await session.execute(text("SHOW TABLES LIKE 'payments'"))
            if result.fetchone():
                print("✅ Payments table exists")
            else:
                print("❌ Payments table not found")
                
            result = await session.execute(text("SHOW TABLES LIKE 'bookings'"))
            if result.fetchone():
                print("✅ Bookings table exists")
            else:
                print("❌ Bookings table not found")
                
            result = await session.execute(text("SHOW TABLES LIKE 'booking_addons'"))
            if result.fetchone():
                print("✅ Booking addons table exists")
            else:
                print("❌ Booking addons table not found")
            
            break
        
    except Exception as e:
        print(f"❌ Error creating payment tables: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(create_payment_tables())
