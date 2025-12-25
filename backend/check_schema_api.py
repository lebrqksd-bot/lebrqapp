#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_session
from sqlalchemy import text

async def check_schema():
    async for session in get_session():
        try:
            # Check if event_type column exists
            result = await session.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'lebrq' 
                AND TABLE_NAME = 'bookings' 
                AND COLUMN_NAME = 'event_type'
            """))
            
            row = result.fetchone()
            
            if row:
                print('✅ event_type column exists in bookings table')
            else:
                print('❌ event_type column does NOT exist in bookings table')
                print('Adding event_type column...')
                
                # Add the event_type column
                await session.execute(text("""
                    ALTER TABLE bookings 
                    ADD COLUMN event_type VARCHAR(50) NULL 
                    AFTER booking_type
                """))
                
                await session.commit()
                print('✅ Successfully added event_type column to bookings table')
            
            break
        except Exception as e:
            print(f'Error: {e}')
            break

if __name__ == "__main__":
    asyncio.run(check_schema())
