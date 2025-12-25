"""
Test script to check if offers are being returned correctly
Run this to debug offer visibility issues
"""
import asyncio
import sys
from app.db import AsyncSessionLocal
from app.routers.offers import get_applicable_offers
from app.models import User

async def test_offer_check():
    """Test the offer check function"""
    async with AsyncSessionLocal() as session:
        try:
            print("Testing offer check...")
            print("=" * 50)
            
            # Test 1: Check without user and with 0 purchase amount
            print("\n1. Testing without user, purchase_amount=0:")
            result1 = await get_applicable_offers(
                session=session,
                user=None,
                coupon_code=None,
                purchase_amount=0.0
            )
            print(f"   has_offer: {result1.get('has_offer')}")
            if result1.get('best_offer'):
                print(f"   best_offer: {result1['best_offer']['title']} ({result1['best_offer']['type']})")
            print(f"   all_applicable: {len(result1.get('all_applicable', []))} offers")
            
            # Test 2: Check with purchase amount 1000
            print("\n2. Testing without user, purchase_amount=1000:")
            result2 = await get_applicable_offers(
                session=session,
                user=None,
                coupon_code=None,
                purchase_amount=1000.0
            )
            print(f"   has_offer: {result2.get('has_offer')}")
            if result2.get('best_offer'):
                print(f"   best_offer: {result2['best_offer']['title']} ({result2['best_offer']['type']})")
            print(f"   all_applicable: {len(result2.get('all_applicable', []))} offers")
            
            # Test 3: List all applicable offers
            print("\n3. All applicable offers:")
            for offer in result1.get('all_applicable', []):
                print(f"   - {offer['title']} ({offer['type']}) - Priority: {offer['priority']}")
                if offer.get('min_purchase_amount'):
                    print(f"     Min purchase: ₹{offer['min_purchase_amount']}")
                if offer.get('start_date'):
                    print(f"     Dates: {offer.get('start_date')} to {offer.get('end_date')}")
            
            print("\n" + "=" * 50)
            print("Test completed!")
            
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_offer_check())

