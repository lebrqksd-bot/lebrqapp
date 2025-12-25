#!/usr/bin/env python3
"""
Fix content_pages to ensure all pages are published
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent))

from app.core import settings

def fix_content_pages_published():
    """Update all content pages to be published"""
    
    # Get database URL and convert to sync version
    db_url = settings.DATABASE_URL
    print(f"Using DATABASE_URL: {db_url}")
    
    is_mysql = "+asyncmy" in db_url or "+pymysql" in db_url or db_url.startswith("mysql")
    
    # Convert async URL to sync URL
    if "+asyncmy" in db_url:
        sync_url = db_url.replace("+asyncmy", "+pymysql")
    elif "+aiosqlite" in db_url:
        sync_url = db_url.replace("+aiosqlite", "")
    else:
        sync_url = db_url
    
    print(f"Connecting with sync URL: {sync_url}")
    
    try:
        # Create sync engine
        engine = create_engine(sync_url, echo=True)
        
        with engine.begin() as conn:
            print("Updating all content pages to be published...")
            # Update all pages to be published (MySQL uses 1 for true, 0 for false)
            update_sql = "UPDATE content_pages SET is_published = 1 WHERE is_published = 0 OR is_published IS NULL"
            result = conn.execute(text(update_sql))
            print(f"✅ Updated {result.rowcount} pages to be published")
            
            # Verify all pages are published
            check_sql = "SELECT page_name, is_published FROM content_pages"
            result = conn.execute(text(check_sql))
            pages = result.fetchall()
            print("\nCurrent page status:")
            for page in pages:
                print(f"  - {page.page_name}: is_published = {page.is_published}")
        
    except Exception as e:
        print(f"❌ Error updating content pages: {e}")
        raise

if __name__ == "__main__":
    fix_content_pages_published()

