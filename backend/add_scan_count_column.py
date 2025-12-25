"""
Migration script to add scan_count column to program_participants table.
Run this script once to add the missing column to the database.
"""
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core import settings
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

def add_scan_count_column():
    """Add scan_count column to program_participants table if it doesn't exist."""
    # Use sync engine for migrations
    if settings.DATABASE_URL.startswith("mysql+asyncmy://"):
        database_url = settings.DATABASE_URL.replace("mysql+asyncmy://", "mysql+pymysql://")
    else:
        database_url = settings.DATABASE_URL
    
    engine = create_engine(database_url)
    
    try:
        with engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'program_participants'
                AND COLUMN_NAME = 'scan_count'
            """))
            
            row = result.fetchone()
            column_exists = row[0] > 0 if row else False
            
            if not column_exists:
                print("Adding scan_count column to program_participants table...")
                conn.execute(text("""
                    ALTER TABLE program_participants
                    ADD COLUMN scan_count INT DEFAULT 0 NOT NULL
                """))
                conn.commit()
                print("[SUCCESS] Successfully added scan_count column")
            else:
                print("[INFO] scan_count column already exists")
                
    except OperationalError as e:
        print(f"Error adding column: {e}")
        sys.exit(1)
    finally:
        engine.dispose()

if __name__ == "__main__":
    print("Running migration: Adding scan_count column to program_participants...")
    add_scan_count_column()
    print("Migration complete!")

