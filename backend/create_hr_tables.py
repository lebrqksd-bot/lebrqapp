"""
Create HR & Payroll database tables
Run this script to create all HR-related tables in the database
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal, engine
from app.models import Staff, StaffDocument, Attendance, Leave, Payroll

async def create_hr_tables():
    """Create HR & Payroll tables"""
    async with AsyncSessionLocal() as session:
        try:
            print("Creating HR & Payroll tables...")
            
            # Check if tables already exist
            result = await session.execute(
                text("SHOW TABLES LIKE 'staff'")
            )
            if result.fetchone():
                print("⚠️  HR tables already exist. Skipping creation.")
                print("   If you want to recreate them, drop the tables first:")
                print("   DROP TABLE IF EXISTS payroll, leaves, attendance, staff_documents, staff;")
                return True
            
            # Create tables using SQLAlchemy
            from app.db import Base
            async with engine.begin() as conn:
                # Create all tables defined in models
                await conn.run_sync(Base.metadata.create_all)
            
            print("✅ HR & Payroll tables created successfully!")
            print("\nCreated tables:")
            print("  - staff")
            print("  - staff_documents")
            print("  - attendance")
            print("  - leaves")
            print("  - payroll")
            print("\nYou can now use the HR module!")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = asyncio.run(create_hr_tables())
    sys.exit(0 if success else 1)

