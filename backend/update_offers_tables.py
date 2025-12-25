"""
Update Offers & Coupons database tables - Recreate tables with correct structure
Run this script to ensure all tables have the correct columns
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal, engine
from app.models import Offer, Coupon, OfferUsage, CouponUsage


async def update_offers_tables():
    """Recreate Offers & Coupons tables with correct structure"""
    async with AsyncSessionLocal() as session:
        try:
            print("Updating Offers & Coupons tables...")
            
            from app.db import Base
            
            # Drop existing tables if they exist (this will lose data, but ensures correct structure)
            print("\nWARNING: This will drop and recreate the following tables:")
            print("  - offers")
            print("  - coupons")
            print("  - offer_usage")
            print("  - coupon_usage")
            print("\nAll existing data in these tables will be lost!")
            
            async with engine.begin() as conn:
                # Drop tables in reverse order of dependencies
                await conn.execute(text("DROP TABLE IF EXISTS coupon_usage"))
                await conn.execute(text("DROP TABLE IF EXISTS offer_usage"))
                await conn.execute(text("DROP TABLE IF EXISTS coupons"))
                await conn.execute(text("DROP TABLE IF EXISTS offers"))
                
                print("Dropped existing tables")
                
                # Create tables with correct structure
                await conn.run_sync(
                    Base.metadata.create_all,
                    tables=[
                        Offer.__table__,
                        Coupon.__table__,
                        OfferUsage.__table__,
                        CouponUsage.__table__
                    ]
                )
            
            print("\nSUCCESS: Offers & Coupons tables recreated with correct structure!")
            print("\nCreated tables:")
            print("  - offers")
            print("  - coupons")
            print("  - offer_usage")
            print("  - coupon_usage")
            
            return True
            
        except Exception as e:
            print(f"ERROR: Error updating tables: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await session.close()


if __name__ == "__main__":
    success = asyncio.run(update_offers_tables())
    sys.exit(0 if success else 1)

