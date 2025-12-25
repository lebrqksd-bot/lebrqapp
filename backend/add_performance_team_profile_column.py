"""
Migration script to add performance_team_profile JSON column to items table
Run this script to add the comprehensive performance team profile field
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db import engine

async def add_performance_team_profile_column():
    """Add performance_team_profile JSON column to items table"""
    async with engine.begin() as conn:
        # Check if column already exists
        check_query = text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'items'
            AND COLUMN_NAME = 'performance_team_profile'
        """)
        
        result = await conn.execute(check_query)
        row = result.fetchone()
        column_exists = row[0] > 0 if row else False
        
        if column_exists:
            print("Column 'performance_team_profile' already exists in 'items' table")
            return
        
        # Add the column
        alter_query = text("""
            ALTER TABLE items
            ADD COLUMN performance_team_profile JSON NULL
            COMMENT 'Complete performance team profile: history, experience, team members, achievements, contact info, etc.'
            AFTER profile_info
        """)
        
        await conn.execute(alter_query)
        print("Successfully added 'performance_team_profile' column to 'items' table")

if __name__ == "__main__":
    print("Adding performance_team_profile column to items table...")
    asyncio.run(add_performance_team_profile_column())
    print("Migration completed!")

