from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db import get_session
from app.models import Booking
from app.schemas.bookings import BookingOut

router = APIRouter()

@router.get('/all-bookings', response_model=List[BookingOut])
async def list_all_bookings(
    session: AsyncSession = Depends(get_session),
):
    """
    Public endpoint to list all bookings from all users.
    Be cautious about the data exposed here.
    For now, it mirrors the user-specific booking list.
    """
    stmt = (
        select(Booking)
        .order_by(Booking.start_datetime.desc())
    )
    rs = await session.execute(stmt)
    rows = rs.scalars().all()
    return rows
    return rows
