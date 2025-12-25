from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..db import get_session
from ..models import Space, Booking


router = APIRouter(prefix="/chatbot", tags=["chatbot"])


class ChatRequest(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str
    intent: Optional[str] = None


@router.post("/message", response_model=ChatResponse)
async def chatbot_message(req: ChatRequest, session: AsyncSession = Depends(get_session)) -> ChatResponse:
    q = (req.text or "").strip()
    ql = q.lower()

    # Simple intents
    if any(k in ql for k in ["hi", "hello", "hey", "help"]):
        return ChatResponse(
            reply=(
                "Hi! I can help with:\n"
                "- Availability and timing\n"
                "- Rates per hour\n"
                "- Booking Grant Hall or Meeting Room\n"
                "Ask me things like 'rate for grant hall' or 'available slots on 27 Oct'."
            ),
            intent="greeting",
        )

    # Rates for spaces
    if "rate" in ql or "price" in ql or "cost" in ql:
        rs = await session.execute(select(Space).order_by(Space.id))
        spaces = rs.scalars().all()
        if not spaces:
            return ChatResponse(reply="Our rate cards will be updated shortly.", intent="rates")
        lines = [f"{s.name}: INR {int(s.price_per_hour)}/hour" for s in spaces]
        return ChatResponse(reply="Rates per hour:\n" + "\n".join(lines), intent="rates")

    # Availability keyword only (date-specific logic should be asked via UI time-slot picker)
    if "availability" in ql or "available" in ql or "slot" in ql:
        return ChatResponse(
            reply=(
                "To check availability, pick your date/time in the page selector. "
                "I'll use the same API to validate your chosen slot instantly."
            ),
            intent="availability",
        )

    # Today's events (simple count)
    if "today" in ql and ("event" in ql or "booking" in ql):
        from datetime import date
        today = date.today()
        rs = await session.execute(
            select(func.count(Booking.id)).where(func.date(Booking.start_datetime) == today)
        )
        cnt = rs.scalar() or 0
        return ChatResponse(reply=f"We have {cnt} event(s) scheduled today.", intent="todays_events")

    # Grant Hall or Meeting Room info
    if "grant" in ql or "hall" in ql or "meeting room" in ql or "room" in ql:
        rs = await session.execute(select(Space).order_by(Space.id))
        spaces = rs.scalars().all()
        info = []
        for s in spaces:
            if ("grant" in ql or "hall" in ql) and "grant" in (s.name or "").lower():
                info.append(f"Grant Hall: Capacity ~{s.capacity} | INR {int(s.price_per_hour)}/hr")
            if ("meeting" in ql or "room" in ql) and "meeting" in (s.name or "").lower():
                info.append(f"Meeting Room: Capacity ~{s.capacity} | INR {int(s.price_per_hour)}/hr")
        if info:
            return ChatResponse(reply="\n".join(info), intent="space_info")

    # Default fallback
    ctx_hint = ""
    if req.context and req.context.get("page"):
        ctx_hint = f" (seen on {req.context.get('page')})"
    return ChatResponse(
        reply=(
            "I'm not sure about that. You can ask about rates, availability, or spaces."
            + ctx_hint
        ),
        intent="fallback",
    )


