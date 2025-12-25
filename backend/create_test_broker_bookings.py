"""
Script to create test bookings for a broker user.
This is useful for testing the brokerage functionality.
"""
import asyncio
import random
import secrets
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import Booking, BookingItem, User, Venue, Space, Item, BrokerProfile
from app.auth import hash_password


async def create_test_broker_bookings(num_bookings: int = 5):
    """Create test bookings for a broker user to test brokerage functionality."""
    async with AsyncSessionLocal() as session:
        try:
            # 1. Get or create a broker user
            rs = await session.execute(select(User).where(User.username == 'test_broker'))
            broker_user = rs.scalars().first()
            
            if not broker_user:
                broker_user = User(
                    username='test_broker',
                    password_hash=hash_password('test1234'),
                    role='broker',
                    mobile='9999999998',
                    first_name='Test',
                    last_name='Broker'
                )
                session.add(broker_user)
                await session.flush()
                print("✓ Created broker user: test_broker / test1234")
            else:
                # Update password to ensure it's correct
                broker_user.password_hash = hash_password('test1234')
                # Ensure role is broker
                if broker_user.role != 'broker':
                    broker_user.role = 'broker'
                await session.flush()
                print("✓ Updated existing broker user: test_broker / test1234")
            
            # 2. Get or create broker profile
            rs = await session.execute(
                select(BrokerProfile).where(BrokerProfile.user_id == broker_user.id)
            )
            broker_profile = rs.scalars().first()
            
            if not broker_profile:
                broker_profile = BrokerProfile(
                    user_id=broker_user.id,
                    company_name='Test Broker Company',
                    contact_email='test_broker@example.com',
                    contact_phone='9999999998',
                    brokerage_percentage=5.0,  # 5% brokerage
                    is_approved=True,  # Approve the broker so they can login
                )
                session.add(broker_profile)
                await session.flush()
                print("✓ Created broker profile with 5% brokerage")
            else:
                # Ensure broker is approved and has brokerage percentage
                if not broker_profile.is_approved:
                    broker_profile.is_approved = True
                if broker_profile.brokerage_percentage == 0:
                    broker_profile.brokerage_percentage = 5.0
                await session.flush()
                print(f"✓ Using existing broker profile (ID: {broker_profile.id}, {broker_profile.brokerage_percentage}% brokerage)")
            
            # 3. Get first available venue and space
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
            
            # 4. Get all available items
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
            
            # Create multiple test bookings
            for booking_num in range(1, num_bookings + 1):
                print(f"\n--- Creating Broker Test Booking #{booking_num} ---")
                
                # 5. Create booking reference
                booking_ref = f"BROKER-TEST-{booking_num:03d}-{secrets.token_hex(3).upper()}"
                
                # 6. Set event date (various dates in the future)
                event_date = datetime.utcnow() + timedelta(days=booking_num)
                start_hour = 10 + booking_num  # 11, 12, 13, 14, etc.
                end_hour = start_hour + random.randint(2, 5)  # 2-5 hour duration
                start_datetime = event_date.replace(hour=start_hour, minute=0, second=0, microsecond=0)
                end_datetime = event_date.replace(hour=end_hour, minute=0, second=0, microsecond=0)
                
                # 7. Calculate base amount (space rental)
                duration_hours = (end_datetime - start_datetime).total_seconds() / 3600.0
                space_amount = float(duration_hours * float(space.price_per_hour))
                
                # 8. Select random items for this booking (1-4 items per booking)
                num_items = random.randint(1, min(4, len(all_items)))
                selected_items = random.sample(all_items, num_items)
                
                # 9. Calculate items total
                items_total = 0.0
                booking_items = []
                for item in selected_items:
                    quantity = random.randint(1, 5)
                    unit_price = float(item.price)
                    total_price = unit_price * quantity
                    items_total += total_price
                    booking_items.append({
                        'item': item,
                        'quantity': quantity,
                        'unit_price': unit_price,
                        'total_price': total_price
                    })
                
                # 10. Calculate total amount
                total_amount = space_amount + items_total
                
                # 11. Calculate brokerage amount
                brokerage_percentage = float(broker_profile.brokerage_percentage)
                brokerage_amount = total_amount * (brokerage_percentage / 100.0)
                
                # 12. Create booking
                b = Booking(
                    booking_reference=booking_ref,
                    user_id=broker_user.id,
                    broker_id=broker_profile.id,
                    venue_id=venue.id,
                    space_id=space.id,
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                    attendees=random.randint(10, 100),
                    status=random.choice(['pending', 'approved', 'confirmed']),
                    total_amount=total_amount,
                    brokerage_amount=brokerage_amount,
                    booking_type='one_day',
                    event_type='Event',
                    customer_note=f'Test broker booking #{booking_num}',
                )
                session.add(b)
                await session.flush()
                
                # 13. Create booking items
                for item_data in booking_items:
                    bi = BookingItem(
                        booking_id=b.id,
                        item_id=item_data['item'].id,
                        vendor_id=item_data['item'].vendor_id,
                        quantity=item_data['quantity'],
                        unit_price=item_data['unit_price'],
                        total_price=item_data['total_price'],
                        event_date=start_datetime.date(),
                        booking_status=b.status,
                        is_supplied=False,
                    )
                    session.add(bi)
                
                await session.flush()
                
                created_bookings.append({
                    'booking_id': b.id,
                    'reference': booking_ref,
                    'total_amount': total_amount,
                    'brokerage_amount': brokerage_amount,
                    'brokerage_percentage': brokerage_percentage,
                    'date': start_datetime.strftime('%Y-%m-%d'),
                })
                
                print(f"  ✓ Created booking {booking_ref}")
                print(f"    Total: ₹{total_amount:.2f}")
                print(f"    Brokerage ({brokerage_percentage}%): ₹{brokerage_amount:.2f}")
                print(f"    Date: {start_datetime.strftime('%Y-%m-%d %H:%M')}")
            
            await session.commit()
            
            print(f"\n✅ Successfully created {len(created_bookings)} broker bookings!")
            print("\nSummary:")
            total_brokerage = sum(b['brokerage_amount'] for b in created_bookings)
            total_amount = sum(b['total_amount'] for b in created_bookings)
            print(f"  Total Bookings: {len(created_bookings)}")
            print(f"  Total Booking Amount: ₹{total_amount:.2f}")
            print(f"  Total Brokerage: ₹{total_brokerage:.2f}")
            print(f"\nBroker Login Credentials:")
            print(f"  Username: test_broker")
            print(f"  Password: test1234")
            print(f"\nYou can now:")
            print(f"  1. Login as test_broker to view bookings")
            print(f"  2. Check the brokerage tab to see earnings")
            print(f"  3. View brokerage in admin settlement page")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating broker bookings: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(create_test_broker_bookings(num_bookings=5))


