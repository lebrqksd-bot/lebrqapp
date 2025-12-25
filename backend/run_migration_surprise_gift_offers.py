"""Run migration to add surprise gift fields to offers table"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core import settings
import mysql.connector
from pathlib import Path

def run_migration():
    """Execute the SQL migration"""
    sql_file = Path(__file__).parent / "add_surprise_gift_to_offers.sql"
    
    if not sql_file.exists():
        print(f"❌ SQL file not found: {sql_file}")
        return False
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        # Parse DATABASE_URL: mysql+asyncmy://user:pass@host:port/dbname
        db_url = settings.DATABASE_URL
        if db_url.startswith('mysql+asyncmy://'):
            db_url = db_url.replace('mysql+asyncmy://', 'mysql://')
        
        # Extract connection details
        import re
        match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', db_url)
        if not match:
            print(f"❌ Could not parse DATABASE_URL: {db_url}")
            return False
        
        user, password, host, port, database = match.groups()
        
        print(f"📦 Connecting to database: {host}:{port}/{database}")
        conn = mysql.connector.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=database
        )
        cursor = conn.cursor()
        
        # Execute SQL statements
        for statement in sql_content.split(';'):
            statement = statement.strip()
            if statement:
                print(f"🔧 Executing: {statement[:100]}...")
                cursor.execute(statement)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

