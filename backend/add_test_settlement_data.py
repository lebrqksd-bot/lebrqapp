"""
Script to add test settlement data for vendor with username 'mouni'.
This creates sample booking items that are supplied, verified, and settled.

Run from backend folder: python add_test_settlement_data.py
"""
import asyncio
import sys
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import User, VendorProfile, BookingItem, Booking, Item, Space, Venue

async def add_test_data():
    async with AsyncSessionLocal() as session:
        try:
            # Find user with username 'mouni'
            rs = await session.execute(select(User).where(User.username == 'mouni'))
            user = rs.scalars().first()
            
            if not user:
                print("❌ User 'mouni' not found. Please create the user first.")
                return
            
            # Find or create vendor profile for this user
            rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
            vendor_profile = rs.scalars().first()
            
            if not vendor_profile:
                print("❌ Vendor profile not found for user 'mouni'. Please create a vendor profile first.")
                return
            
            print(f"✅ Found vendor profile: {vendor_profile.company_name} (ID: {vendor_profile.id})")
            
            # Find or create a test item
            rs = await session.execute(select(Item).limit(1))
            test_item = rs.scalars().first()
            
            if not test_item:
                print("❌ No items found in database. Please create at least one item first.")
                return
            
            # Find or create a test venue and space
            rs = await session.execute(select(Venue).limit(1))
            test_venue = rs.scalars().first()
            
            if not test_venue:
                test_venue = Venue(name="Test Venue", city="Test City")
                session.add(test_venue)
                await session.flush()
                print(f"✅ Created test venue: {test_venue.id}")
            
            rs = await session.execute(select(Space).where(Space.venue_id == test_venue.id).limit(1))
            test_space = rs.scalars().first()
            
            if not test_space:
                test_space = Space(
                    venue_id=test_venue.id,
                    name="Test Space",
                    capacity=100,
                    price_per_hour=1000.0,
                    active=True
                )
                session.add(test_space)
                await session.flush()
                print(f"✅ Created test space: {test_space.id}")
            
            # Create a test booking
            test_booking = Booking(
                user_id=user.id,
                space_id=test_space.id,
                start_datetime=datetime.utcnow() - timedelta(days=5),
                end_datetime=datetime.utcnow() - timedelta(days=5) + timedelta(hours=3),
                total_amount=5000.0,
                status='approved',
                booking_reference=f"TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            )
            session.add(test_booking)
            await session.flush()
            print(f"✅ Created test booking: {test_booking.id} ({test_booking.booking_reference})")
            
            # Create 3 test booking items that are supplied, verified, and settled
            test_items_data = [
                {"name": "Test Cake Item 1", "quantity": 2, "unit_price": 500.0, "vendor_price": 300.0},
                {"name": "Test Decoration Item", "quantity": 1, "unit_price": 1500.0, "vendor_price": 1000.0},
                {"name": "Test Food Item", "quantity": 5, "unit_price": 200.0, "vendor_price": 150.0},
            ]
            
            for item_data in test_items_data:
                # Update test_item with new data or create new item
                test_item.name = item_data["name"]
                test_item.vendor_price = item_data["vendor_price"]
                test_item.price = item_data["unit_price"]
                test_item.vendor_id = vendor_profile.id
                await session.flush()
                
                # Create booking item
                booking_item = BookingItem(
                    booking_id=test_booking.id,
                    item_id=test_item.id,
                    vendor_id=vendor_profile.id,
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    total_price=item_data["unit_price"] * item_data["quantity"],
                    event_date=(datetime.utcnow() - timedelta(days=5)).date(),
                    booking_status='approved',
                    is_supplied=True,
                    supplied_at=datetime.utcnow() - timedelta(days=3),
                    supply_verified=True,
                    verified_at=datetime.utcnow() - timedelta(days=2),
                    payment_settled=True,
                    payment_settled_at=datetime.utcnow() - timedelta(days=1),
                    payment_settled_by_user_id=user.id
                )
                session.add(booking_item)
                print(f"✅ Created settled booking item: {item_data['name']} (Qty: {item_data['quantity']}, Amount: ₹{item_data['vendor_price'] * item_data['quantity']})")
            
            await session.commit()
            print("\n✅ Test settlement data added successfully!")
            print(f"   Vendor: {vendor_profile.company_name}")
            print(f"   Booking: {test_booking.booking_reference}")
            print(f"   Total settled items: {len(test_items_data)}")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(add_test_data())

