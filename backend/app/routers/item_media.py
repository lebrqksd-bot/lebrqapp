"""
Item Media API - Handle multiple images and videos for items
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.db import get_session
from app.models import ItemMedia, Item
from app.auth import get_current_user
from app.models import User
from typing import Optional

router = APIRouter(prefix="/items", tags=["item-media"])

# Upload directory - must match where static files are served from
# Static files are served from backend/app/uploads (see core.py line 246: os.path.dirname(__file__) = backend/app/)
# So we save to backend/app/uploads/item-media
# __file__ is backend/app/routers/item_media.py, so .parent.parent = backend/app/
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "item-media"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file types
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user


def vendor_required(user: User = Depends(get_current_user)):
    if user.role != 'vendor':
        raise HTTPException(status_code=403, detail='Vendor only')
    return user


async def verify_item_access(item_id: int, user: User, session: AsyncSession) -> Item:
    """Verify user has access to item (admin or item owner)"""
    rs = await session.execute(select(Item).where(Item.id == item_id))
    item = rs.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    
    # Admin can access any item
    if user.role == 'admin':
        return item
    
    # Vendor can only access their own items
    if user.role == 'vendor':
        from app.models import VendorProfile
        rs = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
        vp = rs.scalars().first()
        if not vp or item.vendor_id != vp.id:
            raise HTTPException(status_code=403, detail='Access denied')
        return item
    
    raise HTTPException(status_code=403, detail='Access denied')


@router.get("/{item_id}/media")
async def get_item_media(
    item_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get all media for an item (public endpoint, no auth required for viewing)"""
    # Verify item exists (but don't require auth)
    rs = await session.execute(select(Item).where(Item.id == item_id))
    item = rs.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    rs = await session.execute(
        select(ItemMedia)
        .where(ItemMedia.item_id == item_id)
        .order_by(ItemMedia.display_order, ItemMedia.created_at)
    )
    media_list = rs.scalars().all()
    
    return {
        "media": [
            {
                "id": m.id,
                "item_id": m.item_id,
                "media_type": m.media_type,
                "file_path": m.file_path,
                "file_url": m.file_url,
                "is_primary": m.is_primary,
                "display_order": m.display_order,
                "title": m.title,
                "description": m.description,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in media_list
        ]
    }


@router.post("/{item_id}/media/upload")
async def upload_item_media(
    item_id: int,
    files: List[UploadFile] = File(...),
    media_type: str = Form("image"),  # "image" or "video"
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Upload multiple images or videos for an item"""
    item = await verify_item_access(item_id, user, session)
    
    if media_type not in ["image", "video"]:
        raise HTTPException(status_code=400, detail="media_type must be 'image' or 'video'")
    
    uploaded_media = []
    
    for file in files:
        # Validate file extension
        file_ext = os.path.splitext(file.filename or "")[1].lower()
        allowed_exts = ALLOWED_IMAGE_EXTENSIONS if media_type == "image" else ALLOWED_VIDEO_EXTENSIONS
        
        if file_ext not in allowed_exts:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {media_type} file type. Allowed: {', '.join(allowed_exts)}"
            )
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_name = f"item_{item_id}_{timestamp}_{os.urandom(4).hex()}{file_ext}"
        file_path = UPLOAD_DIR / unique_name
        
        # Stream file to disk in chunks to avoid loading entire file into memory
        # This prevents MemoryError with large images/videos
        total_size = 0
        try:
            with open(file_path, 'wb') as out_file:
                while True:
                    # Read in 2MB chunks
                    chunk = await file.read(2 * 1024 * 1024)
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        if file_path.exists():
                            file_path.unlink()
                        raise HTTPException(
                            status_code=400,
                            detail=f"File {file.filename} exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB"
                        )
                    out_file.write(chunk)
        except MemoryError:
            if file_path.exists():
                file_path.unlink()
            import gc
            gc.collect()
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable: Memory pressure. Please try again later."
            )
        except Exception as e:
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
        
        # Relative path for database
        rel_path = f"item-media/{unique_name}"
        file_url = f"/static/{rel_path}"
        
        # Get current max display_order
        rs = await session.execute(
            select(func.max(ItemMedia.display_order))
            .where(ItemMedia.item_id == item_id)
        )
        max_order = rs.scalar_one() or -1
        
        # Create database entry
        media = ItemMedia(
            item_id=item_id,
            media_type=media_type,
            file_path=rel_path,
            file_url=file_url,
            is_primary=False,
            display_order=max_order + 1,
        )
        session.add(media)
        await session.flush()
        await session.refresh(media)
        
        uploaded_media.append({
            "id": media.id,
            "media_type": media.media_type,
            "file_url": media.file_url,
            "file_path": media.file_path,
            "is_primary": media.is_primary,
            "display_order": media.display_order,
        })
    
    await session.commit()
    
    return {
        "message": f"Successfully uploaded {len(uploaded_media)} {media_type}(s)",
        "media": uploaded_media,
    }


@router.delete("/{item_id}/media/{media_id}")
async def delete_item_media(
    item_id: int,
    media_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete a media item"""
    await verify_item_access(item_id, user, session)
    
    rs = await session.execute(
        select(ItemMedia).where(ItemMedia.id == media_id, ItemMedia.item_id == item_id)
    )
    media = rs.scalars().first()
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete file from disk
    # media.file_path is "item-media/filename.png", so we need to construct the full path
    # UPLOAD_DIR is backend/app/uploads/item-media/, so we just need the filename
    file_path = UPLOAD_DIR / os.path.basename(media.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            print(f"Warning: Failed to delete file {file_path}: {e}")
    
    # Delete from database
    await session.delete(media)
    await session.commit()
    
    return {"message": "Media deleted successfully", "id": media_id}


@router.patch("/{item_id}/media/{media_id}/primary")
async def set_primary_media(
    item_id: int,
    media_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Set a media item as primary (only one primary per item)"""
    await verify_item_access(item_id, user, session)
    
    rs = await session.execute(
        select(ItemMedia).where(ItemMedia.id == media_id, ItemMedia.item_id == item_id)
    )
    media = rs.scalars().first()
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Unset all other primary media for this item
    await session.execute(
        update(ItemMedia)
        .where(ItemMedia.item_id == item_id)
        .values(is_primary=False)
    )
    
    # Set this one as primary
    media.is_primary = True
    await session.commit()
    await session.refresh(media)
    
    return {
        "message": "Primary media updated",
        "media": {
            "id": media.id,
            "is_primary": media.is_primary,
        },
    }


@router.patch("/{item_id}/media/reorder")
async def reorder_item_media(
    item_id: int,
    media_ids: List[int] = Form(...),  # Ordered list of media IDs
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Reorder media items"""
    await verify_item_access(item_id, user, session)
    
    # Update display_order for each media item
    for order, media_id in enumerate(media_ids):
        await session.execute(
            update(ItemMedia)
            .where(ItemMedia.id == media_id, ItemMedia.item_id == item_id)
            .values(display_order=order)
        )
    
    await session.commit()
    
    return {"message": "Media reordered successfully"}


@router.patch("/{item_id}/media/{media_id}")
async def update_item_media(
    item_id: int,
    media_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update media metadata"""
    await verify_item_access(item_id, user, session)
    
    rs = await session.execute(
        select(ItemMedia).where(ItemMedia.id == media_id, ItemMedia.item_id == item_id)
    )
    media = rs.scalars().first()
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    if title is not None:
        media.title = title
    if description is not None:
        media.description = description
    
    await session.commit()
    await session.refresh(media)
    
    return {
        "message": "Media updated successfully",
        "media": {
            "id": media.id,
            "title": media.title,
            "description": media.description,
        },
    }

