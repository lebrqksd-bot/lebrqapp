"""
Add performance team fields to items table
Allows storing video_url, profile_image_url, and profile_info for performance teams
"""
from sqlalchemy import text
from app.db import sync_engine

def add_performance_team_fields():
    """Add video_url, profile_image_url, and profile_info columns to items table"""
    with sync_engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'items' 
            AND COLUMN_NAME IN ('video_url', 'profile_image_url', 'profile_info')
        """))
        existing_columns = [row[0] for row in result]
        
        # Add video_url if it doesn't exist
        if 'video_url' not in existing_columns:
            print("Adding video_url column...")
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN video_url VARCHAR(500) NULL COMMENT 'Video URL for performance team'
                AFTER image_url
            """))
            conn.commit()
            print("video_url column added successfully")
        else:
            print("video_url column already exists")
        
        # Add profile_image_url if it doesn't exist
        if 'profile_image_url' not in existing_columns:
            print("Adding profile_image_url column...")
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN profile_image_url VARCHAR(500) NULL COMMENT 'Profile photo URL for performance team'
                AFTER video_url
            """))
            conn.commit()
            print("profile_image_url column added successfully")
        else:
            print("profile_image_url column already exists")
        
        # Add profile_info if it doesn't exist
        if 'profile_info' not in existing_columns:
            print("Adding profile_info column...")
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN profile_info TEXT NULL COMMENT 'Profile information/description for performance team'
                AFTER profile_image_url
            """))
            conn.commit()
            print("profile_info column added successfully")
        else:
            print("profile_info column already exists")
        
        print("\nDatabase migration completed!")

if __name__ == "__main__":
    add_performance_team_fields()

