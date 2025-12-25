from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_session
from ..models import Event

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/")
async def list_events(session: AsyncSession = Depends(get_session)):
    rs = await session.execute(select(Event).order_by(Event.id.desc()).limit(50))
    items = [
        {"id": e.id, "title": e.title, "dateText": e.date_text}
        for e in rs.scalars().all()
    ]
    return {"items": items}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_event(payload: dict, session: AsyncSession = Depends(get_session)):
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    e = Event(title=title, date_text=payload.get("dateText"))
    session.add(e)
    await session.commit()
    await session.refresh(e)
    return {"id": e.id, "title": e.title, "dateText": e.date_text}
