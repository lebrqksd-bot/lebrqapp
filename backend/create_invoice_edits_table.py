"""
Script to create the invoice_edits table
Run this script to create the table if it doesn't exist
"""
import asyncio
from sqlalchemy import text
from app.db import AsyncSessionLocal


async def create_invoice_edits_table():
    """Create the invoice_edits table if it doesn't exist"""
    async with AsyncSessionLocal() as session:
        try:
            # Check if table exists
            result = await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_edits'")
            )
            if result.first():
                print("Table 'invoice_edits' already exists.")
                return
            
            # Create table
            await session.execute(text("""
                CREATE TABLE invoice_edits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id INTEGER NOT NULL UNIQUE,
                    invoice_number VARCHAR(100),
                    invoice_date VARCHAR(50),
                    customer_name VARCHAR(255),
                    gst_rate FLOAT,
                    brokerage_amount FLOAT,
                    notes TEXT,
                    items JSON,
                    edited_by_user_id INTEGER,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (booking_id) REFERENCES bookings(id),
                    FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
                )
            """))
            
            # Create index
            await session.execute(text("CREATE INDEX idx_invoice_edits_booking_id ON invoice_edits(booking_id)"))
            
            await session.commit()
            print("Successfully created 'invoice_edits' table.")
        except Exception as e:
            await session.rollback()
            print(f"Error creating table: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(create_invoice_edits_table())

