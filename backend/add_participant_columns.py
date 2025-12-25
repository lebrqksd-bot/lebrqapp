"""
Add subscription tracking columns to program_participants table
"""
from sqlalchemy import create_engine, text
from app.core import settings

def add_participant_columns():
    """Add subscription tracking columns to program_participants table"""
    
    # Construct sync database URL from centralized settings
    sync_url = settings.DATABASE_URL.replace("+asyncmy", "+pymysql")
    print(f"Connecting to database: {settings.MYSQL_DB}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}")
    engine = create_engine(sync_url, echo=True)
    
    with engine.connect() as conn:
        columns_to_add = [
            ("subscription_type", "VARCHAR(16) NULL COMMENT 'daily or monthly subscription'"),
            ("start_date", "DATETIME NULL COMMENT 'Subscription start date'"),
            ("end_date", "DATETIME NULL COMMENT 'Subscription end date'"),
            ("amount_paid", "FLOAT NULL COMMENT 'Amount paid for subscription'"),
            ("is_active", "BOOLEAN DEFAULT TRUE COMMENT 'Whether subscription is active'"),
        ]
        
        for col_name, col_def in columns_to_add:
            # Check if column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'program_participants'
                AND COLUMN_NAME = :col_name
            """), {"col_name": col_name})
            
            exists = result.fetchone()[0] > 0
            
            if not exists:
                print(f"Adding {col_name} column...")
                try:
                    conn.execute(text(f"""
                        ALTER TABLE program_participants
                        ADD COLUMN {col_name} {col_def}
                    """))
                    conn.commit()
                    print(f"✓ Added {col_name} column")
                except Exception as e:
                    print(f"Error adding {col_name} column: {e}")
                    conn.rollback()
            else:
                print(f"✓ {col_name} column already exists")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    add_participant_columns()
