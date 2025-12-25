"""
Add date_of_birth column to users table if it doesn't exist
This is required for birthday offers functionality
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal, engine


async def add_date_of_birth_column():
    """Add date_of_birth column to users table"""
    async with AsyncSessionLocal() as session:
        try:
            print("Checking users table for date_of_birth column...")
            
            # Get database name from engine URL
            db_name = engine.url.database
            
            # Check if column exists
            try:
                result = await session.execute(
                    text("""
                        SELECT COUNT(*) 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'users' 
                        AND COLUMN_NAME = 'date_of_birth'
                    """),
                    {"db_name": db_name}
                )
                column_exists = result.scalar() > 0
            except:
                # Fallback: try SHOW COLUMNS
                try:
                    result = await session.execute(text("SHOW COLUMNS FROM users LIKE 'date_of_birth'"))
                    column_exists = result.fetchone() is not None
                except:
                    # If both fail, assume column doesn't exist
                    column_exists = False
            
            if column_exists:
                print("SUCCESS: date_of_birth column already exists in users table")
                return True
            
            print("Adding date_of_birth column to users table...")
            
            # Add the column
            async with engine.begin() as conn:
                await conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN date_of_birth DATE NULL 
                    COMMENT 'User date of birth for birthday offers'
                """))
            
            print("SUCCESS: date_of_birth column added to users table")
            return True
            
        except Exception as e:
            print(f"ERROR: Error adding column: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await session.close()


if __name__ == "__main__":
    success = asyncio.run(add_date_of_birth_column())
    sys.exit(0 if success else 1)

