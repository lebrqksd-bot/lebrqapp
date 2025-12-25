"""
Add start_time and end_time columns to programs table
"""
from sqlalchemy import create_engine, text
from app.core import settings

def add_program_time_columns():
    """Add start_time and end_time columns to programs table if they don't exist"""
    engine = create_engine(
        settings.DATABASE_URL.replace("mysql+asyncmy://", "mysql+pymysql://"),
        echo=True
    )
    
    with engine.connect() as conn:
        # Check if start_time column exists
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'programs'
            AND COLUMN_NAME = 'start_time'
        """))
        
        start_time_exists = result.fetchone()[0] > 0
        
        # Check if end_time column exists
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'programs'
            AND COLUMN_NAME = 'end_time'
        """))
        
        end_time_exists = result.fetchone()[0] > 0
        
        # Add start_time column if it doesn't exist
        if not start_time_exists:
            print("Adding start_time column to programs table...")
            try:
                conn.execute(text("""
                    ALTER TABLE programs
                    ADD COLUMN start_time VARCHAR(8) NULL COMMENT 'Program start time in HH:MM:SS format'
                """))
                conn.commit()
                print("✓ Added start_time column")
            except Exception as e:
                print(f"Error adding start_time column: {e}")
                conn.rollback()
        else:
            print("✓ start_time column already exists")
        
        # Add end_time column if it doesn't exist
        if not end_time_exists:
            print("Adding end_time column to programs table...")
            try:
                conn.execute(text("""
                    ALTER TABLE programs
                    ADD COLUMN end_time VARCHAR(8) NULL COMMENT 'Program end time in HH:MM:SS format'
                """))
                conn.commit()
                print("✓ Added end_time column")
            except Exception as e:
                print(f"Error adding end_time column: {e}")
                conn.rollback()
        else:
            print("✓ end_time column already exists")
        
        # Set default times for existing yoga programs
        if start_time_exists or not start_time_exists:  # Always try to update
            try:
                result = conn.execute(text("""
                    UPDATE programs
                    SET start_time = '11:00:00', end_time = '12:00:00'
                    WHERE LOWER(title) LIKE '%yoga%'
                    AND (start_time IS NULL OR start_time = '')
                """))
                conn.commit()
                print(f"✓ Set default times for {result.rowcount} yoga program(s) (11:00 AM - 12:00 PM)")
            except Exception as e:
                print(f"Note: Could not update yoga times: {e}")
        
        # Set default times for existing zumba programs
        try:
            result = conn.execute(text("""
                UPDATE programs
                SET start_time = '18:00:00', end_time = '19:00:00'
                WHERE LOWER(title) LIKE '%zumba%'
                AND (start_time IS NULL OR start_time = '')
            """))
            conn.commit()
            print(f"✓ Set default times for {result.rowcount} zumba program(s)")
        except Exception as e:
            print(f"Note: Could not update zumba times: {e}")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    add_program_time_columns()
