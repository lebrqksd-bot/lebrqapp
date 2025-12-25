"""
Migration script to create offer_notifications table
Run this with: python -m backend.run_migration_offer_notifications
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SyncSessionLocal
from app.core import settings
from sqlalchemy import text

def run_migration():
    """Run the migration to create offer_notifications table"""
    print(f"[MIGRATION] Connecting to database: {settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DB}")
    
    db = SyncSessionLocal()
    try:
        # Read the SQL file
        migration_file = os.path.join(os.path.dirname(__file__), 'create_offer_notifications_table.sql')
        with open(migration_file, 'r') as f:
            sql_content = f.read()
        
        # Execute the migration
        print("[MIGRATION] Executing migration SQL...")
        db.execute(text(sql_content))
        db.commit()
        
        print("[MIGRATION] ✅ Migration completed successfully!")
        print("[MIGRATION] Table 'offer_notifications' has been created.")
        
    except Exception as e:
        db.rollback()
        print(f"[MIGRATION] ❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()
    
    return True

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

