"""
Add ticket_quantity column to program_participants table
"""
from sqlalchemy import create_engine, text
from app.core import settings

def add_ticket_quantity():
    """Add ticket_quantity column to program_participants table"""
    
    # Construct sync database URL from centralized settings
    sync_url = settings.DATABASE_URL.replace("+asyncmy", "+pymysql")
    print(f"Connecting to database: {settings.MYSQL_DB}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}")
    engine = create_engine(sync_url, echo=True)
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'program_participants'
            AND COLUMN_NAME = 'ticket_quantity'
        """))
        
        exists = result.fetchone()[0] > 0
        
        if not exists:
            print("Adding ticket_quantity column...")
            try:
                conn.execute(text("""
                    ALTER TABLE program_participants
                    ADD COLUMN ticket_quantity INT DEFAULT 1 COMMENT 'Number of tickets purchased'
                """))
                conn.commit()
                print("✓ Added ticket_quantity column")
            except Exception as e:
                print(f"Error adding ticket_quantity column: {e}")
                conn.rollback()
        else:
            print("✓ ticket_quantity column already exists")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    add_ticket_quantity()
