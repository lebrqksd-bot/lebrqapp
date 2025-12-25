"""
Add booking_id column (and optional FK) to program_participants table.
- Works for MySQL and SQLite (dev)
"""
from sqlalchemy import create_engine, text
from app.core import settings


def add_booking_id_column():
    db_url = settings.DATABASE_URL
    print(f"Using DATABASE_URL: {db_url}")
    is_mysql = "+asyncmy" in db_url or "+pymysql" in db_url or db_url.startswith("mysql")
    is_sqlite = db_url.startswith("sqlite")

    # Use sync engines
    if "+asyncmy" in db_url:
        sync_url = db_url.replace("+asyncmy", "+pymysql")
    elif "+aiosqlite" in db_url:
        sync_url = db_url.replace("+aiosqlite", "")
    else:
        sync_url = db_url

    print(f"Connecting with sync URL: {sync_url}")
    engine = create_engine(sync_url, echo=True)

    with engine.begin() as conn:
        # Detect if column exists
        try:
            if is_mysql:
                exists_sql = text(
                    """
                    SELECT COUNT(*) as cnt
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'program_participants'
                      AND COLUMN_NAME = 'booking_id'
                    """
                )
                res = conn.execute(exists_sql).scalar()
                exists = bool(res and int(res) > 0)
            else:
                # SQLite: pragma table_info
                res = conn.execute(text("PRAGMA table_info(program_participants)")).fetchall()
                cols = {row[1] for row in res}
                exists = "booking_id" in cols
        except Exception as e:
            print(f"Error checking column existence: {e}")
            exists = False

        if exists:
            print("✓ booking_id already exists")
        else:
            print("Adding booking_id column...")
            if is_mysql:
                try:
                    conn.execute(text("ALTER TABLE program_participants ADD COLUMN booking_id INT NULL"))
                    # Add FK if possible; ignore error if bookings table or perms missing
                    try:
                        conn.execute(text(
                            "ALTER TABLE program_participants ADD CONSTRAINT fk_participant_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)"
                        ))
                    except Exception as fk_err:
                        print(f"(Non-fatal) FK add failed: {fk_err}")
                    print("✓ booking_id added (MySQL)")
                except Exception as e:
                    print(f"Failed to add booking_id (MySQL): {e}")
                    raise
            else:
                # SQLite
                try:
                    conn.execute(text("ALTER TABLE program_participants ADD COLUMN booking_id INTEGER"))
                    print("✓ booking_id added (SQLite)")
                except Exception as e:
                    print(f"Failed to add booking_id (SQLite): {e}")
                    raise

    print("\n✅ Migration completed.")


if __name__ == "__main__":
    add_booking_id_column()
