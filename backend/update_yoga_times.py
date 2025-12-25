"""
Update yoga program times to 11:00 AM - 12:00 PM
"""
from sqlalchemy import create_engine, text
from app.core import settings

def update_yoga_times():
    """Update yoga program times to 11:00 AM - 12:00 PM"""
    
    # Construct sync database URL from centralized settings
    sync_url = settings.DATABASE_URL.replace("+asyncmy", "+pymysql")
    print(f"Connecting to database: {settings.MYSQL_DB}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}")
    engine = create_engine(sync_url, echo=True)
    
    with engine.connect() as conn:
        # Update yoga programs to use 11:00 AM - 12:00 PM
        try:
            result = conn.execute(text("""
                UPDATE programs
                SET start_time = '11:00:00', end_time = '12:00:00'
                WHERE LOWER(title) LIKE '%yoga%'
            """))
            conn.commit()
            print(f"\n✅ Updated {result.rowcount} yoga program(s) to 11:00 AM - 12:00 PM")
        except Exception as e:
            print(f"❌ Error updating yoga times: {e}")
            conn.rollback()

if __name__ == "__main__":
    update_yoga_times()
