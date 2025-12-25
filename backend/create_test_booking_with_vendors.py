"""
Script to create test bookings with items that have vendors assigned.
This is useful for testing the automatic cancellation feature when a client cancels a booking.
"""
import asyncio
import random
import secrets
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import Booking, BookingItem, User, Venue, Space, Item, VendorProfile
from app.auth import hash_password


async def create_test_booking_with_vendors(num_bookings: int = 3, assign_vendors: bool = True):
    """Create test bookings with items, optionally assigning vendors to test cancellation."""
    async with AsyncSessionLocal() as session:
        try:
            # 1. Get or create a test user
            rs = await session.execute(select(User).where(User.username == 'test_customer'))
            test_user = rs.scalars().first()
            
            if not test_user:
                test_user = User(
                    username='test_customer',
                    password_hash=hash_password('test1234'),
                    role='customer',
                    mobile='9999999999',
                    first_name='Test',
                    last_name='Customer'
                )
                session.add(test_user)
                await session.flush()
                print("✓ Created test user: test_customer / test1234")
            else:
                # Update password to ensure it's correct
                test_user.password_hash = hash_password('test1234')
                await session.flush()
                print("✓ Updated existing test user password: test_customer / test1234")
            
            # 2. Get first available venue and space
            rs = await session.execute(select(Venue).limit(1))
            venue = rs.scalars().first()
            if not venue:
                print("❌ No venues found. Please create a venue first.")
                return
            
            rs = await session.execute(select(Space).where(Space.venue_id == venue.id).limit(1))
            space = rs.scalars().first()
            if not space:
                print("❌ No spaces found for venue. Please create a space first.")
                return
            
            print(f"✓ Using venue: {venue.name}, space: {space.name}")
            
            # 3. Get all available items
            rs = await session.execute(
                select(Item)
                .where(Item.available == True)
            )
            all_items = rs.scalars().all()
            
            if not all_items:
                print("❌ No items found. Please create some items first.")
                return
            
            print(f"✓ Found {len(all_items)} available items")
            
            # 4. Get all available vendors (if assigning vendors)
            vendors = []
            if assign_vendors:
                rs = await session.execute(select(VendorProfile))
                vendors = rs.scalars().all()
                if not vendors:
                    print("⚠️  No vendors found. Creating bookings without vendor assignments.")
                    assign_vendors = False
                else:
                    print(f"✓ Found {len(vendors)} vendors available for assignment")
            
            created_bookings = []
            
            # Create multiple test bookings
            for booking_num in range(1, num_bookings + 1):
                print(f"\n--- Creating Test Booking #{booking_num} ---")
                
                # 5. Create booking reference
                booking_ref = f"CANCEL-TEST-{booking_num:03d}-{secrets.token_hex(3).upper()}"
                
                # 6. Set event date (at least 2 days in future to allow cancellation testing)
                # This ensures bookings can be cancelled (24h rule)
                # Make each booking on a different day with different times
                event_date = datetime.utcnow() + timedelta(days=2 + booking_num)
                start_hour = 9 + booking_num  # 10, 11, 12, 13, etc.
                end_hour = start_hour + 4  # 4-hour duration
                start_datetime = event_date.replace(hour=start_hour, minute=0, second=0, microsecond=0)
                end_datetime = event_date.replace(hour=end_hour, minute=0, second=0, microsecond=0)
                
                # 7. Select random items for this booking (2-5 items per booking)
                num_items = random.randint(2, min(5, len(all_items)))
                selected_items = random.sample(all_items, num_items)
                
                # 8. Create booking with unique event type and NO series_reference to prevent grouping
                booking = Booking(
                    booking_reference=booking_ref,
                    user_id=test_user.id,
                    venue_id=venue.id,
                    space_id=space.id,
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                    attendees=30 + (booking_num * 10),  # Varying attendees
                    status='approved',  # Approved so it shows up
                    total_amount=0.0,  # Will be calculated
                    booking_type='one_day',
                    event_type=f'Test Event {booking_num} - {event_date.strftime("%b %d")}',
                    series_reference=None,  # Explicitly set to None to prevent grouping
                    is_admin_booking=True
                )
                session.add(booking)
                await session.flush()
                print(f"✓ Created booking: {booking_ref} (ID: {booking.id})")
                
                # 9. Create booking items and assign vendors if requested
                total_amount = 0.0
                items_with_vendors = 0
                
                for idx, item in enumerate(selected_items):
                    quantity = random.randint(1, 5)  # Random quantity between 1-5
                    unit_price = item.price or (100.0 + (idx * 50))  # Varying prices
                    total_price = unit_price * quantity
                    total_amount += total_price
                    
                    # Assign vendor if requested and vendors are available
                    assigned_vendor_id = None
                    assigned_vendor = None
                    if assign_vendors and vendors:
                        # Randomly assign vendor to some items (70% chance)
                        if random.random() < 0.7:
                            assigned_vendor = random.choice(vendors)
                            assigned_vendor_id = assigned_vendor.id
                            items_with_vendors += 1
                    
                    booking_item = BookingItem(
                        booking_id=booking.id,
                        item_id=item.id,
                        vendor_id=assigned_vendor_id,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=total_price,
                        event_date=event_date.date(),
                        booking_status='pending' if assigned_vendor_id else 'approved'
                    )
                    session.add(booking_item)
                    
                    vendor_info = f" (Vendor: {assigned_vendor.company_name if assigned_vendor else 'None'})" if assigned_vendor_id else ""
                    print(f"  ✓ Added item: {item.name} (Qty: {quantity}, Unit: ₹{unit_price}, Total: ₹{total_price}){vendor_info}")
                
                # 10. Update booking total
                booking.total_amount = total_amount
                created_bookings.append({
                    'ref': booking_ref,
                    'id': booking.id,
                    'amount': total_amount,
                    'date': event_date.date(),
                    'items': len(selected_items),
                    'items_with_vendors': items_with_vendors
                })
            
            await session.commit()
            
            print(f"\n{'='*60}")
            print(f"✅ Successfully created {num_bookings} test booking(s)!")
            print(f"{'='*60}")
            for i, booking_info in enumerate(created_bookings, 1):
                print(f"\nBooking #{i}:")
                print(f"   Booking Reference: {booking_info['ref']}")
                print(f"   Booking ID: {booking_info['id']}")
                print(f"   Total Amount: ₹{booking_info['amount']:.2f}")
                print(f"   Event Date: {booking_info['date']}")
                print(f"   Items: {booking_info['items']} items")
                if assign_vendors:
                    print(f"   Items with Vendors: {booking_info['items_with_vendors']} items")
            
            print(f"\n{'='*60}")
            print(f"📋 Testing Instructions:")
            print(f"   1. Login as test_customer (password: test1234)")
            print(f"   2. Go to Bookings tab")
            print(f"   3. Find bookings with reference starting with 'CANCEL-TEST-'")
            print(f"   4. Click 'Cancel' button on any booking")
            print(f"   5. Check Admin > Vendor Items page to see automatic cancellation")
            print(f"   6. Verify cancellation notes include the cancellation date")
            print(f"{'='*60}\n")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test bookings: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    import sys
    # Allow specifying number of bookings to create (default: 3)
    # Usage: python create_test_booking_with_vendors.py [num_bookings] [assign_vendors]
    # Example: python create_test_booking_with_vendors.py 5 true
    num_bookings = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    assign_vendors = sys.argv[2].lower() == 'true' if len(sys.argv) > 2 else True
    
    print(f"Creating {num_bookings} test booking(s) with {'vendor assignments' if assign_vendors else 'no vendor assignments'}...\n")
    asyncio.run(create_test_booking_with_vendors(num_bookings, assign_vendors))

