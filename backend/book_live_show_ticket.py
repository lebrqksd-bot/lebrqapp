"""
Script to book a live show ticket for a specific user by email.
Usage: python book_live_show_ticket.py <email> <booking_id> [ticket_quantity] [amount_paid]
"""
import asyncio
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import AsyncSessionLocal
from app.models import User, Booking, ProgramParticipant
from datetime import datetime

async def book_ticket_for_user(email: str, booking_id: int, ticket_quantity: int = 1, amount_paid: float = 0.0):
    """Book a live show ticket for a user by email"""
    async with AsyncSessionLocal() as session:
        try:
            # Find user by email (username field)
            rs_user = await session.execute(
                select(User).where(User.username == email)
            )
            user = rs_user.scalars().first()
            
            if not user:
                print(f"❌ User with email {email} not found")
                return False
            
            # Verify booking exists and is a live show
            rs_booking = await session.execute(
                select(Booking).where(Booking.id == booking_id)
            )
            booking = rs_booking.scalars().first()
            
            if not booking:
                print(f"❌ Booking with ID {booking_id} not found")
                return False
            
            booking_type = getattr(booking, 'booking_type', None)
            if booking_type != 'live-':
                print(f"⚠️  Warning: Booking {booking_id} is not a live show (booking_type: {booking_type})")
            
            # Check if participant already exists for this booking and user
            rs_existing = await session.execute(
                select(ProgramParticipant).where(
                    ProgramParticipant.booking_id == booking_id,
                    ProgramParticipant.user_id == user.id,
                    ProgramParticipant.program_type == 'live'
                )
            )
            existing = rs_existing.scalars().first()
            
            if existing:
                print(f"⚠️  Participant already exists for user {email} and booking {booking_id}")
                print(f"   Participant ID: {existing.id}, Verified: {existing.is_verified}")
                return True
            
            # Create participant entry
            participant = ProgramParticipant(
                user_id=user.id,
                name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or email,
                mobile=user.mobile or '',
                program_type='live',
                subscription_type=None,
                ticket_quantity=ticket_quantity,
                booking_id=booking_id,
                start_date=booking.start_datetime,
                end_date=booking.end_datetime,
                amount_paid=amount_paid,
                is_active=True,
                is_verified=False,  # Will be marked as arrived when scanned
                joined_at=datetime.utcnow(),
            )
            
            session.add(participant)
            await session.commit()
            await session.refresh(participant)
            
            print(f"✅ Successfully booked live show ticket for {email}")
            print(f"   Participant ID: {participant.id}")
            print(f"   Booking ID: {booking_id}")
            print(f"   Event: {getattr(booking, 'event_type', 'Live Show')}")
            print(f"   Date: {booking.start_datetime}")
            print(f"   Tickets: {ticket_quantity}")
            print(f"   Amount: ₹{amount_paid}")
            print(f"\n📱 QR Code URL: http://app.lebrq.com/verify/participant?id={participant.id}&type=live&code=VERIFY")
            
            return True
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            return False

async def main():
    if len(sys.argv) < 3:
        print("Usage: python book_live_show_ticket.py <email> <booking_id> [ticket_quantity] [amount_paid]")
        print("\nExample:")
        print("  python book_live_show_ticket.py vaishakbalakrishnan950@gmail.com 123 1 199.0")
        sys.exit(1)
    
    email = sys.argv[1]
    booking_id = int(sys.argv[2])
    ticket_quantity = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    amount_paid = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    
    success = await book_ticket_for_user(email, booking_id, ticket_quantity, amount_paid)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())

