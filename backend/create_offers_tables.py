"""
Create Offers & Coupons database tables
Run this script to create all offer and coupon-related tables in the database
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal, engine
from app.models import Offer, Coupon, OfferUsage, CouponUsage


async def create_offers_tables():
    """Create Offers & Coupons tables"""
    async with AsyncSessionLocal() as session:
        try:
            print("Creating Offers & Coupons tables...")
            
            # Get database name from engine URL
            db_name = engine.url.database or engine.url.database
            
            # Check if tables already exist (using MySQL syntax)
            try:
                result = await session.execute(
                    text("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'offers'"),
                    {"db_name": db_name}
                )
                if result.scalar() > 0:
                    print("WARNING: Offers & Coupons tables already exist. Skipping creation.")
                    print("   If you want to recreate them, drop the tables first:")
                    print("   DROP TABLE IF EXISTS coupon_usages, offer_usages, coupons, offers;")
                    return True
            except Exception as check_error:
                # If INFORMATION_SCHEMA doesn't work, try SHOW TABLES (MySQL)
                try:
                    result = await session.execute(text("SHOW TABLES LIKE 'offers'"))
                    if result.fetchone():
                        print("WARNING: Offers & Coupons tables already exist. Skipping creation.")
                        return True
                except:
                    # If both fail, continue with creation (table might not exist)
                    pass
            
            # Create tables using SQLAlchemy
            from app.db import Base
            async with engine.begin() as conn:
                # Create only the offers-related tables
                await conn.run_sync(
                    Base.metadata.create_all,
                    tables=[
                        Offer.__table__,
                        Coupon.__table__,
                        OfferUsage.__table__,
                        CouponUsage.__table__
                    ]
                )
            
            print("SUCCESS: Offers & Coupons tables created successfully!")
            print("\nCreated tables:")
            print("  - offers")
            print("  - coupons")
            print("  - offer_usages")
            print("  - coupon_usages")
            print("\nYou can now use the Offers & Coupons module!")
            
            return True
            
        except Exception as e:
            print(f"ERROR: Error creating tables: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await session.close()


if __name__ == "__main__":
    success = asyncio.run(create_offers_tables())
    sys.exit(0 if success else 1)

