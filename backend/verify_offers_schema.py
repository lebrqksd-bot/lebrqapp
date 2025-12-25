"""
Verify that all offers and coupons related tables have the correct schema
This script checks all columns and reports any missing ones
"""
import asyncio
import sys
from sqlalchemy import text
from app.db import AsyncSessionLocal, engine
from app.models import Offer, Coupon, OfferUsage, CouponUsage, User


async def verify_schema():
    """Verify all required columns exist"""
    async with AsyncSessionLocal() as session:
        try:
            print("Verifying database schema for Offers & Coupons...")
            
            db_name = engine.url.database
            all_good = True
            
            # Check users table
            print("\n1. Checking users table...")
            user_columns = {col.name for col in User.__table__.columns}
            try:
                result = await session.execute(
                    text("""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'users'
                    """),
                    {"db_name": db_name}
                )
                existing_user_columns = {row[0] for row in result.fetchall()}
                missing_user = user_columns - existing_user_columns
                if missing_user:
                    print(f"   MISSING columns in users: {missing_user}")
                    all_good = False
                else:
                    print("   OK: All user columns exist")
            except Exception as e:
                print(f"   ERROR checking users: {e}")
                all_good = False
            
            # Check offers table
            print("\n2. Checking offers table...")
            offer_columns = {col.name for col in Offer.__table__.columns}
            try:
                result = await session.execute(
                    text("""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'offers'
                    """),
                    {"db_name": db_name}
                )
                existing_offer_columns = {row[0] for row in result.fetchall()}
                missing_offers = offer_columns - existing_offer_columns
                if missing_offers:
                    print(f"   MISSING columns in offers: {missing_offers}")
                    all_good = False
                else:
                    print("   OK: All offer columns exist")
            except Exception as e:
                print(f"   ERROR checking offers: {e}")
                all_good = False
            
            # Check coupons table
            print("\n3. Checking coupons table...")
            coupon_columns = {col.name for col in Coupon.__table__.columns}
            try:
                result = await session.execute(
                    text("""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'coupons'
                    """),
                    {"db_name": db_name}
                )
                existing_coupon_columns = {row[0] for row in result.fetchall()}
                missing_coupons = coupon_columns - existing_coupon_columns
                if missing_coupons:
                    print(f"   MISSING columns in coupons: {missing_coupons}")
                    all_good = False
                else:
                    print("   OK: All coupon columns exist")
            except Exception as e:
                print(f"   ERROR checking coupons: {e}")
                all_good = False
            
            # Check offer_usage table
            print("\n4. Checking offer_usage table...")
            offer_usage_columns = {col.name for col in OfferUsage.__table__.columns}
            try:
                result = await session.execute(
                    text("""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'offer_usage'
                    """),
                    {"db_name": db_name}
                )
                existing_usage_columns = {row[0] for row in result.fetchall()}
                missing_usage = offer_usage_columns - existing_usage_columns
                if missing_usage:
                    print(f"   MISSING columns in offer_usage: {missing_usage}")
                    all_good = False
                else:
                    print("   OK: All offer_usage columns exist")
            except Exception as e:
                print(f"   ERROR checking offer_usage: {e}")
                all_good = False
            
            # Check coupon_usage table
            print("\n5. Checking coupon_usage table...")
            coupon_usage_columns = {col.name for col in CouponUsage.__table__.columns}
            try:
                result = await session.execute(
                    text("""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = :db_name 
                        AND TABLE_NAME = 'coupon_usage'
                    """),
                    {"db_name": db_name}
                )
                existing_coupon_usage_columns = {row[0] for row in result.fetchall()}
                missing_coupon_usage = coupon_usage_columns - existing_coupon_usage_columns
                if missing_coupon_usage:
                    print(f"   MISSING columns in coupon_usage: {missing_coupon_usage}")
                    all_good = False
                else:
                    print("   OK: All coupon_usage columns exist")
            except Exception as e:
                print(f"   ERROR checking coupon_usage: {e}")
                all_good = False
            
            if all_good:
                print("\n" + "="*50)
                print("SUCCESS: All schema checks passed!")
                print("="*50)
            else:
                print("\n" + "="*50)
                print("WARNING: Some columns are missing!")
                print("Run update_offers_tables.py to fix the schema")
                print("="*50)
            
            return all_good
            
        except Exception as e:
            print(f"ERROR: Error verifying schema: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await session.close()


if __name__ == "__main__":
    success = asyncio.run(verify_schema())
    sys.exit(0 if success else 1)

