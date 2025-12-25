"""
Script to check and fix vendor_id in booking items.
Run this to verify and update vendor_id associations.
"""
import asyncio
from sqlalchemy import select, update, and_
from app.db import AsyncSessionLocal, engine, Base
from app.models import Item, BookingItem, VendorProfile

async def check_and_fix_vendor_ids():
    async with AsyncSessionLocal() as session:
        # Step 1: Check Items table
        print("=" * 60)
        print("CHECKING ITEMS TABLE")
        print("=" * 60)
        
        # Items without vendor_id
        rs = await session.execute(select(Item).where(Item.vendor_id.is_(None)))
        items_without_vendor = rs.scalars().all()
        print(f"Items without vendor_id: {len(items_without_vendor)}")
        for item in items_without_vendor[:5]:  # Show first 5
            print(f"  - ID: {item.id}, Name: {item.name}, Category: {item.category}")
        
        # Items with vendor_id
        rs = await session.execute(select(Item).where(Item.vendor_id.isnot(None)))
        items_with_vendor = rs.scalars().all()
        print(f"\nItems with vendor_id: {len(items_with_vendor)}")
        for item in items_with_vendor[:5]:  # Show first 5
            print(f"  - ID: {item.id}, Name: {item.name}, Vendor ID: {item.vendor_id}")
        
        # Step 2: Check BookingItems table
        print("\n" + "=" * 60)
        print("CHECKING BOOKING_ITEMS TABLE")
        print("=" * 60)
        
        # BookingItems without vendor_id
        rs = await session.execute(select(BookingItem).where(BookingItem.vendor_id.is_(None)))
        booking_items_without_vendor = rs.scalars().all()
        print(f"BookingItems without vendor_id: {len(booking_items_without_vendor)}")
        
        # BookingItems with vendor_id
        rs = await session.execute(select(BookingItem).where(BookingItem.vendor_id.isnot(None)))
        booking_items_with_vendor = rs.scalars().all()
        print(f"BookingItems with vendor_id: {len(booking_items_with_vendor)}")
        
        # Step 3: Sample a booking item and show item details
        if booking_items_without_vendor:
            bi = booking_items_without_vendor[0]
            print(f"\nSample BookingItem without vendor_id:")
            print(f"  - BookingItem ID: {bi.id}")
            print(f"  - Item ID: {bi.item_id}")
            print(f"  - Vendor ID: {bi.vendor_id}")
            
            # Get the item
            rs = await session.execute(select(Item).where(Item.id == bi.item_id))
            item = rs.scalars().first()
            if item:
                print(f"  - Item Name: {item.name}")
                print(f"  - Item Vendor ID: {item.vendor_id}")
        
        # Step 4: Check VendorProfile
        print("\n" + "=" * 60)
        print("CHECKING VENDOR PROFILES")
        print("=" * 60)
        
        rs = await session.execute(select(VendorProfile))
        vendors = rs.scalars().all()
        print(f"Total vendor profiles: {len(vendors)}")
        for vp in vendors[:5]:  # Show first 5
            print(f"  - ID: {vp.id}, User ID: {vp.user_id}, Company: {vp.company_name}")
        
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Total Items: {len(items_with_vendor) + len(items_without_vendor)}")
        print(f"  - With vendor_id: {len(items_with_vendor)}")
        print(f"  - Without vendor_id: {len(items_without_vendor)}")
        print(f"\nTotal BookingItems: {len(booking_items_with_vendor) + len(booking_items_without_vendor)}")
        print(f"  - With vendor_id: {len(booking_items_with_vendor)}")
        print(f"  - Without vendor_id: {len(booking_items_without_vendor)}")
        print(f"\nTotal VendorProfiles: {len(vendors)}")

if __name__ == "__main__":
    asyncio.run(check_and_fix_vendor_ids())
