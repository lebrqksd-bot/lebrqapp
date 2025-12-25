#!/usr/bin/env python3
"""
Manual script to add login/logout time columns to MySQL database
"""
import pymysql
from app.core import settings

def add_columns():
    """Add login/logout time columns to users table"""
    try:
        # Database connection parameters
        host = settings.MYSQL_HOST
        port = settings.MYSQL_PORT
        user = settings.MYSQL_USER
        password = settings.MYSQL_PASSWORD
        database = settings.MYSQL_DB
        
        print(f"Connecting to MySQL database: {database} on {host}:{port}")
        
        # Connect to MySQL
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # Check if columns already exist
            cursor.execute("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME IN ('last_login_time', 'last_logout_time')
            """, (database,))
            
            existing_columns = [row[0] for row in cursor.fetchall()]
            
            if 'last_login_time' not in existing_columns:
                print("Adding last_login_time column...")
                cursor.execute("ALTER TABLE users ADD COLUMN last_login_time DATETIME NULL")
                print("[SUCCESS] last_login_time column added")
            else:
                print("[INFO] last_login_time column already exists")
                
            if 'last_logout_time' not in existing_columns:
                print("Adding last_logout_time column...")
                cursor.execute("ALTER TABLE users ADD COLUMN last_logout_time DATETIME NULL")
                print("[SUCCESS] last_logout_time column added")
            else:
                print("[INFO] last_logout_time column already exists")
            
            # Commit the changes
            connection.commit()
            print("[SUCCESS] Database migration completed successfully!")
            
    except Exception as e:
        print(f"[ERROR] {e}")
        return False
    finally:
        if 'connection' in locals():
            connection.close()
    
    return True

if __name__ == "__main__":
    success = add_columns()
    if success:
        print("\n[SUCCESS] You can now add the login/logout time fields back to your models!")
    else:
        print("\n[ERROR] Migration failed. Please check your database connection.")
