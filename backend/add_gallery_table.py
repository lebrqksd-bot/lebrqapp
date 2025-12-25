"""
Script to create the gallery_images table in the database.

Reads database configuration from the single source of truth:
app.core.settings (which loads from backend/.env).
"""
import pymysql
from app.core import settings

MYSQL_USER = settings.MYSQL_USER
MYSQL_PASSWORD = settings.MYSQL_PASSWORD
MYSQL_HOST = settings.MYSQL_HOST
MYSQL_PORT = settings.MYSQL_PORT
MYSQL_DB = settings.MYSQL_DB

def create_gallery_table():
    """Create the gallery_images table"""
    connection = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB
    )
    
    try:
        with connection.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = %s AND table_name = 'gallery_images'
            """, (MYSQL_DB,))
            
            exists = cursor.fetchone()[0]
            
            if exists:
                print("Table 'gallery_images' already exists")
                return
            
            # Create gallery_images table
            cursor.execute("""
                CREATE TABLE gallery_images (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    filepath VARCHAR(500) NOT NULL,
                    title VARCHAR(255) NULL,
                    description TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            connection.commit()
            print("[OK] Table 'gallery_images' created successfully")
            
    finally:
        connection.close()

if __name__ == "__main__":
    print("Creating gallery_images table...")
    create_gallery_table()
    print("Done!")

