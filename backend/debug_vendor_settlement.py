"""
Debug script to check why items are not showing in vendor settlement
Run: python debug_vendor_settlement.py <vendor_id>
"""
import asyncio
import sys
from sqlalchemy import select, and_
from app.db import AsyncSessionLocal
from app.models import BookingItem, VendorProfile, Item, Booking
from datetime import datetime, timedelta

async def debug_vendor_settlement(vendor_id: int):
    async with AsyncSessionLocal() as session:
        # Get vendor info
        rs = await session.execute(select(VendorProfile).where(VendorProfile.id == vendor_id))
        vendor = rs.scalars().first()
        if not vendor:
            print(f"Vendor {vendor_id} not found")
            return
        
        print(f"\n=== Debugging Vendor Settlement for: {vendor.company_name or vendor.id} ===\n")
        
        # Check all booking items for this vendor
        stmt = select(BookingItem, Booking, Item).join(
            Booking, Booking.id == BookingItem.booking_id
        ).join(
            Item, Item.id == BookingItem.item_id
        ).where(
            BookingItem.vendor_id == vendor_id
        )
        
        rs = await session.execute(stmt)
        all_items = rs.all()
        
        print(f"Total booking items for vendor: {len(all_items)}\n")
        
        # Check supplied items
        supplied_items = [item for item in all_items if item[0].is_supplied]
        print(f"Items marked as supplied: {len(supplied_items)}")
        for bi, b, it in supplied_items:
            print(f"  - Item ID {bi.id}: {it.name}")
            print(f"    supplied_at: {bi.supplied_at}")
            print(f"    supply_verified: {bi.supply_verified}")
            print(f"    verified_at: {bi.verified_at}")
            print(f"    total_price: {bi.total_price}")
            print()
        
        # Check verified items
        verified_items = [item for item in supplied_items if item[0].supply_verified]
        print(f"Items verified by admin: {len(verified_items)}")
        for bi, b, it in verified_items:
            print(f"  - Item ID {bi.id}: {it.name}")
            print(f"    supplied_at: {bi.supplied_at}")
            print(f"    verified_at: {bi.verified_at}")
            print(f"    total_price: {bi.total_price}")
            print()
        
        # Check items within last 30 days
        now = datetime.utcnow()
        start_date = now - timedelta(days=30)
        
        monthly_items = [
            item for item in verified_items 
            if item[0].supplied_at and item[0].supplied_at >= start_date
        ]
        print(f"Verified items supplied in last 30 days: {len(monthly_items)}")
        for bi, b, it in monthly_items:
            print(f"  - Item ID {bi.id}: {it.name}")
            print(f"    supplied_at: {bi.supplied_at}")
            print(f"    verified_at: {bi.verified_at}")
            print(f"    total_price: {bi.total_price}")
            print()
        
        # Summary
        print("\n=== Summary ===")
        print(f"Total items: {len(all_items)}")
        print(f"Supplied: {len(supplied_items)}")
        print(f"Verified: {len(verified_items)}")
        print(f"Verified + Last 30 days: {len(monthly_items)}")
        
        total_amount = sum(float(item[0].total_price) for item in monthly_items)
        print(f"Total amount (last 30 days): ₹{total_amount:.2f}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_vendor_settlement.py <vendor_id>")
        sys.exit(1)
    
    vendor_id = int(sys.argv[1])
    asyncio.run(debug_vendor_settlement(vendor_id))

