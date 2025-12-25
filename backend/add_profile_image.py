"""Add profile_image column to users table"""
import pymysql
from app.core import settings

def add_profile_image_column():
    """Add profile_image column to users table"""
    try:
        connection = pymysql.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DB,
            port=settings.MYSQL_PORT
        )
        
        cursor = connection.cursor()
        
        # Check if column already exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'profile_image'
        """, (settings.MYSQL_DB,))
        
        exists = cursor.fetchone()[0]
        
        if exists:
            print("✓ profile_image column already exists")
        else:
            # Add profile_image column
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN profile_image VARCHAR(500) NULL AFTER mobile
            """)
            connection.commit()
            print("✓ Added profile_image column to users table")
        
        cursor.close()
        connection.close()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    add_profile_image_column()
