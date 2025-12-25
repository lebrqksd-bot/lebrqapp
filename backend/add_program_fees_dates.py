"""
Migration script to add daily_fee, monthly_fee, overall_start_date, overall_end_date, 
and series_reference columns to the programs table.
"""
import asyncio
from sqlalchemy import text
from app.db import engine

async def add_program_fees_and_dates():
    async with engine.begin() as conn:
        # Check if columns already exist
        check_sql = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='programs' AND column_name IN ('daily_fee', 'monthly_fee', 'overall_start_date', 'overall_end_date', 'series_reference');
        """
        result = await conn.execute(text(check_sql))
        existing_columns = {row[0] for row in result.fetchall()}
        
        # Add daily_fee column if it doesn't exist
        if 'daily_fee' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE programs 
                ADD COLUMN daily_fee FLOAT DEFAULT 0.0;
            """))
            print("[SUCCESS] Added daily_fee column to programs table")
        else:
            print("[INFO] daily_fee column already exists")
        
        # Add monthly_fee column if it doesn't exist
        if 'monthly_fee' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE programs 
                ADD COLUMN monthly_fee FLOAT DEFAULT 0.0;
            """))
            print("[SUCCESS] Added monthly_fee column to programs table")
        else:
            print("[INFO] monthly_fee column already exists")
        
        # Add overall_start_date column if it doesn't exist
        if 'overall_start_date' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE programs 
                ADD COLUMN overall_start_date TIMESTAMP NULL;
            """))
            print("[SUCCESS] Added overall_start_date column to programs table")
        else:
            print("[INFO] overall_start_date column already exists")
        
        # Add overall_end_date column if it doesn't exist
        if 'overall_end_date' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE programs 
                ADD COLUMN overall_end_date TIMESTAMP NULL;
            """))
            print("[SUCCESS] Added overall_end_date column to programs table")
        else:
            print("[INFO] overall_end_date column already exists")
        
        # Add series_reference column if it doesn't exist
        if 'series_reference' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE programs 
                ADD COLUMN series_reference VARCHAR(64) NULL;
            """))
            print("[SUCCESS] Added series_reference column to programs table")
        else:
            print("[INFO] series_reference column already exists")
        
        print("\n[SUCCESS] Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_program_fees_and_dates())

