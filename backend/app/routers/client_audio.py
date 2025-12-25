"""
Client Audio Notes API

Endpoints for clients to upload voice notes for bookings and for admins to review them.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..auth import get_current_user
from ..db import get_session
from ..models import Booking, User
from ..models_client_enhanced import ClientAudioNote
from ..services.audio_service import (
    build_audio_public_url,
    save_client_audio_note,
)

router = APIRouter(prefix="/client/audio-notes", tags=["client-audio"])
admin_router = APIRouter(prefix="/admin/audio-notes", tags=["admin-audio"])


def customer_required(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("customer", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customers only")
    return user


def admin_required(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_audio_note(
    booking_id: int = Form(..., description="Booking ID the audio note belongs to"),
    duration_seconds: Optional[int] = Form(
        None, description="Recording duration in seconds as measured on client"
    ),
    audio_file: UploadFile = File(..., description="Recorded audio file"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    """
    Upload an audio note for a specific booking.
    """
    note = await save_client_audio_note(
        session=session,
        file=audio_file,
        booking_id=booking_id,
        user_id=current_user.id,
        duration_seconds=duration_seconds,
        is_admin=current_user.role == "admin",
    )

    return {
        "id": note.id,
        "booking_id": note.booking_id,
        "user_id": note.user_id,
        "audio_url": build_audio_public_url(note),
        "duration_seconds": note.audio_duration_seconds,
        "file_size_bytes": note.file_size_bytes,
        "mime_type": note.mime_type,
        "status": note.status,
        "created_at": note.created_at.isoformat(),
    }


@router.get("")
async def list_audio_notes(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(customer_required),
):
    """
    List audio notes for a booking belonging to the current user.
    """
    stmt = (
        select(ClientAudioNote)
        .join(Booking, ClientAudioNote.booking_id == Booking.id)
        .where(ClientAudioNote.booking_id == booking_id)
    )
    result = await session.execute(stmt)
    notes = result.scalars().all()

    # Filter by ownership unless admin
    if current_user.role != "admin":
        notes = [n for n in notes if n.user_id == current_user.id]

    return [
        {
            "id": note.id,
            "booking_id": note.booking_id,
            "audio_url": build_audio_public_url(note),
            "duration_seconds": note.audio_duration_seconds,
            "file_size_bytes": note.file_size_bytes,
            "mime_type": note.mime_type,
            "status": note.status,
            "created_at": note.created_at.isoformat(),
            "is_played_by_admin": note.is_played_by_admin,
        }
        for note in notes
    ]


@admin_router.get("/bookings/{booking_id}")
async def admin_list_booking_audio_notes(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """
    Admin endpoint to list all audio notes for a booking.
    """
    stmt = select(ClientAudioNote).where(ClientAudioNote.booking_id == booking_id)
    result = await session.execute(stmt)
    notes = result.scalars().all()

    return [
        {
            "id": note.id,
            "booking_id": note.booking_id,
            "user_id": note.user_id,
            "audio_url": build_audio_public_url(note),
            "duration_seconds": note.audio_duration_seconds,
            "file_size_bytes": note.file_size_bytes,
            "mime_type": note.mime_type,
            "status": note.status,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "played_at": note.played_at.isoformat() if note.played_at else None,
            "is_played_by_admin": note.is_played_by_admin,
            "admin_notes": note.admin_notes,
            "transcription": note.transcription,
        }
        for note in notes
    ]


@admin_router.post("/{note_id}/mark-played")
async def mark_audio_note_played(
    note_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """
    Mark an audio note as played by the admin.
    """
    note = await session.get(ClientAudioNote, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio note not found")

    note.is_played_by_admin = True
    note.played_at = datetime.utcnow()
    await session.commit()
    await session.refresh(note)

    return {
        "id": note.id,
        "is_played_by_admin": note.is_played_by_admin,
        "played_at": note.played_at.isoformat() if note.played_at else None,
    }


@admin_router.post("/{note_id}/notes")
async def update_audio_note_admin_notes(
    note_id: int,
    admin_note: str = Form(..., min_length=1, description="Internal note for this audio entry"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """
    Attach or update an internal admin note for an audio recording.
    """
    note = await session.get(ClientAudioNote, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio note not found")

    note.admin_notes = admin_note.strip()
    await session.commit()
    await session.refresh(note)

    return {
        "id": note.id,
        "admin_notes": note.admin_notes,
    }

