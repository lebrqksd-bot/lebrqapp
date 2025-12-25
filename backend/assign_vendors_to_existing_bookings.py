"""
Script to assign vendors to existing booking items for testing cancellation.
This is useful if you already have bookings and want to add vendor assignments.
"""
import asyncio
import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import BookingItem, VendorProfile, Booking


async def assign_vendors_to_existing_bookings(booking_id: int = None, assign_to_all: bool = False):
    """Assign vendors to existing booking items.
    
    Args:
        booking_id: Specific booking ID to assign vendors to. If None, assigns to all unassigned items.
        assign_to_all: If True, assigns vendors to all unassigned booking items. If False, only to items from booking_id.
    """
    async with AsyncSessionLocal() as session:
        try:
            # 1. Get all available vendors
            rs = await session.execute(select(VendorProfile))
            vendors = rs.scalars().all()
            
            if not vendors:
                print("❌ No vendors found. Please create some vendors first.")
                return
            
            print(f"✓ Found {len(vendors)} vendors available")
            
            # 2. Get booking items to assign vendors to
            if booking_id:
                rs = await session.execute(
                    select(BookingItem)
                    .where(BookingItem.booking_id == booking_id)
                    .where(BookingItem.vendor_id.is_(None))
                )
                booking_items = rs.scalars().all()
                print(f"✓ Found {len(booking_items)} unassigned items in booking {booking_id}")
            elif assign_to_all:
                rs = await session.execute(
                    select(BookingItem)
                    .where(BookingItem.vendor_id.is_(None))
                    .join(Booking, Booking.id == BookingItem.booking_id)
                    .where(Booking.status == 'approved')  # Only assign to approved bookings
                )
                booking_items = rs.scalars().all()
                print(f"✓ Found {len(booking_items)} unassigned items in all approved bookings")
            else:
                print("❌ Please specify either booking_id or set assign_to_all=True")
                return
            
            if not booking_items:
                print("❌ No unassigned booking items found.")
                return
            
            # 3. Assign vendors to items
            assigned_count = 0
            for bi in booking_items:
                # Randomly assign vendor (80% chance)
                if random.random() < 0.8:
                    vendor = random.choice(vendors)
                    bi.vendor_id = vendor.id
                    bi.booking_status = 'pending'  # Set to pending so vendor sees it
                    assigned_count += 1
                    print(f"  ✓ Assigned vendor '{vendor.company_name or vendor.id}' to booking item {bi.id}")
            
            await session.commit()
            
            print(f"\n{'='*60}")
            print(f"✅ Successfully assigned vendors to {assigned_count} booking item(s)!")
            print(f"{'='*60}\n")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error assigning vendors: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    import sys
    # Usage examples:
    # python assign_vendors_to_existing_bookings.py --booking-id 123
    # python assign_vendors_to_existing_bookings.py --all
    
    booking_id = None
    assign_to_all = False
    
    if '--all' in sys.argv:
        assign_to_all = True
    elif '--booking-id' in sys.argv:
        idx = sys.argv.index('--booking-id')
        if idx + 1 < len(sys.argv):
            booking_id = int(sys.argv[idx + 1])
        else:
            print("❌ --booking-id requires a booking ID")
            sys.exit(1)
    else:
        print("Usage:")
        print("  python assign_vendors_to_existing_bookings.py --booking-id <id>")
        print("  python assign_vendors_to_existing_bookings.py --all")
        sys.exit(1)
    
    asyncio.run(assign_vendors_to_existing_bookings(booking_id, assign_to_all))

