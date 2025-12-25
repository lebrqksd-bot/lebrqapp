"""
Audio Service

Utility helpers for handling client audio note uploads and storage.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Booking
from ..models_client_enhanced import ClientAudioNote

MAX_AUDIO_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
SUPPORTED_MIME_TYPES = {
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
}

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "audio"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


async def _ensure_booking_access(
    session: AsyncSession,
    booking_id: int,
    user_id: int,
    is_admin: bool,
) -> Booking:
    """Ensure the booking exists and belongs to the current user (unless admin)."""
    stmt = select(Booking).where(Booking.id == booking_id)
    result = await session.execute(stmt)
    booking = result.scalars().first()

    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if not is_admin and booking.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this booking")

    return booking


def _resolve_extension(filename: Optional[str], content_type: Optional[str]) -> str:
    """Determine file extension based on MIME type or filename."""
    if content_type and content_type.lower() in SUPPORTED_MIME_TYPES:
        return SUPPORTED_MIME_TYPES[content_type.lower()]

    if filename and "." in filename:
        _, ext = os.path.splitext(filename)
        if ext:
            return ext.lower()

    # Default to .webm if unknown
    return ".webm"


async def save_client_audio_note(
    *,
    session: AsyncSession,
    file: UploadFile,
    booking_id: int,
    user_id: int,
    duration_seconds: Optional[int],
    is_admin: bool = False,
) -> ClientAudioNote:
    """
    Persist an audio upload to disk and create a database record.

    Raises:
        HTTPException: On validation failures or storage errors.
    """
    # Validate booking access
    await _ensure_booking_access(session, booking_id, user_id, is_admin)

    # Validate MIME type
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only audio files are allowed.",
        )

    # Build storage path
    now = datetime.utcnow()
    relative_dir = Path(str(now.year)) / f"{now.month:02d}"
    target_dir = UPLOAD_ROOT / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    extension = _resolve_extension(file.filename, content_type)
    filename = f"{uuid4().hex}{extension}"
    disk_path = target_dir / filename

    # Stream file to disk in chunks to avoid loading entire file into memory
    # This prevents MemoryError for large audio files
    total_size = 0
    try:
        with open(disk_path, "wb") as dest:
            while True:
                # Read in 512KB chunks for audio files
                chunk = await file.read(512 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_AUDIO_FILE_SIZE_BYTES:
                    if disk_path.exists():
                        disk_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Audio file is too large. Maximum size is 10 MB.",
                    )
                dest.write(chunk)
        
        # Check if file is empty
        if total_size == 0:
            if disk_path.exists():
                disk_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio file uploaded.",
            )
    except MemoryError:
        if disk_path.exists():
            disk_path.unlink()
        import gc
        gc.collect()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable: Memory pressure. Please try again later.",
        )
    except Exception as exc:
        if disk_path.exists():
            disk_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store audio file: {exc}",
        ) from exc
    
    file_size = total_size

    # Create DB record
    note = ClientAudioNote(
        booking_id=booking_id,
        user_id=user_id,
        audio_file_path=str(Path("audio") / relative_dir / filename).replace("\\", "/"),
        audio_duration_seconds=duration_seconds,
        file_size_bytes=file_size,
        mime_type=content_type or "audio/webm",
        status="pending",
        is_played_by_admin=False,
    )

    session.add(note)
    await session.commit()
    await session.refresh(note)

    return note


def build_audio_public_url(note: ClientAudioNote) -> str:
    """Return the public URL for the stored audio note."""
    return f"/static/{note.audio_file_path}"

