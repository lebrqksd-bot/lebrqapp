"""
Script to create dummy orders for testing vendor assignment functionality.
This creates multiple bookings with items that can be assigned to vendors.
"""
import asyncio
import random
import secrets
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import Booking, BookingItem, User, Venue, Space, Item
from app.auth import hash_password


async def create_test_order(num_orders: int = 3):
    """Create multiple test bookings with items for vendor assignment testing."""
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
            
            created_bookings = []
            
            # Create multiple test orders
            for order_num in range(1, num_orders + 1):
                print(f"\n--- Creating Test Order #{order_num} ---")
                
                # 4. Create booking reference
                booking_ref = f"TEST-{order_num:03d}-{secrets.token_hex(3).upper()}"
                
                # 5. Set event date (spread across different days with unique times)
                # Make each booking on a different day with different times
                event_date = datetime.utcnow() + timedelta(days=order_num)
                start_hour = 9 + order_num  # 10, 11, 12, 13, etc.
                end_hour = start_hour + 4  # 4-hour duration
                start_datetime = event_date.replace(hour=start_hour, minute=0, second=0, microsecond=0)
                end_datetime = event_date.replace(hour=end_hour, minute=0, second=0, microsecond=0)
                
                # 6. Select random items for this order (2-5 items per order)
                num_items = random.randint(2, min(5, len(all_items)))
                selected_items = random.sample(all_items, num_items)
                
                # 7. Create booking with unique event type and NO series_reference to prevent grouping
                booking = Booking(
                    booking_reference=booking_ref,
                    user_id=test_user.id,
                    venue_id=venue.id,
                    space_id=space.id,
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                    attendees=30 + (order_num * 10),  # Varying attendees
                    status='approved',  # Approved so it shows up
                    total_amount=0.0,  # Will be calculated
                    booking_type='one_day',
                    event_type=f'Test Event {order_num} - {event_date.strftime("%b %d")}',
                    series_reference=None,  # Explicitly set to None to prevent grouping
                    is_admin_booking=True
                )
                session.add(booking)
                await session.flush()
                print(f"✓ Created booking: {booking_ref} (ID: {booking.id})")
                
                # 8. Create booking items (without vendor_id initially)
                total_amount = 0.0
                for idx, item in enumerate(selected_items):
                    quantity = random.randint(1, 5)  # Random quantity between 1-5
                    unit_price = item.price or (100.0 + (idx * 50))  # Varying prices
                    total_price = unit_price * quantity
                    total_amount += total_price
                    
                    booking_item = BookingItem(
                        booking_id=booking.id,
                        item_id=item.id,
                        vendor_id=None,  # No vendor assigned yet - this is what we want to test!
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=total_price,
                        event_date=event_date.date(),
                        booking_status='approved'
                    )
                    session.add(booking_item)
                    print(f"  ✓ Added item: {item.name} (Qty: {quantity}, Unit: ₹{unit_price}, Total: ₹{total_price})")
                
                # 9. Update booking total
                booking.total_amount = total_amount
                created_bookings.append({
                    'ref': booking_ref,
                    'id': booking.id,
                    'amount': total_amount,
                    'date': event_date.date(),
                    'items': len(selected_items)
                })
            
            await session.commit()
            
            print(f"\n{'='*60}")
            print(f"✅ Successfully created {num_orders} test orders!")
            print(f"{'='*60}")
            for i, booking_info in enumerate(created_bookings, 1):
                print(f"\nOrder #{i}:")
                print(f"   Booking Reference: {booking_info['ref']}")
                print(f"   Booking ID: {booking_info['id']}")
                print(f"   Total Amount: ₹{booking_info['amount']:.2f}")
                print(f"   Event Date: {booking_info['date']}")
                print(f"   Items: {booking_info['items']} items (no vendor assigned)")
            
            print(f"\n{'='*60}")
            print(f"📋 You can now test vendor assignment in:")
            print(f"   - Admin > Vendor Items page")
            print(f"   - Admin > Bookings > View Details")
            print(f"{'='*60}\n")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test orders: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    import sys
    # Allow specifying number of orders to create (default: 3)
    num_orders = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    print(f"Creating {num_orders} test order(s)...\n")
    asyncio.run(create_test_order(num_orders))

