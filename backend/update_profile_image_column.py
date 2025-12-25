"""Update profile_image column to LONGTEXT for storing base64 images"""
import pymysql
from app.core import settings

def update_profile_image_column():
    """Update profile_image column to LONGTEXT"""
    try:
        connection = pymysql.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DB,
            port=settings.MYSQL_PORT
        )
        
        cursor = connection.cursor()
        
        # Update profile_image column to LONGTEXT
        print("Updating profile_image column to LONGTEXT...")
        cursor.execute("""
            ALTER TABLE users 
            MODIFY COLUMN profile_image LONGTEXT NULL
        """)
        connection.commit()
        print("✓ Updated profile_image column to LONGTEXT")
        
        cursor.close()
        connection.close()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    update_profile_image_column()
