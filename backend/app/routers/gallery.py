from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import os
import shutil
from datetime import datetime
from typing import List

from ..db import get_session
from ..models import GalleryImage
from ..auth import require_role

router = APIRouter(prefix="/gallery", tags=["gallery"]) 

# Create uploads directory if it doesn't exist (app/uploads/gallery)
STATIC_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
UPLOAD_DIR = os.path.join(STATIC_ROOT, "gallery")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class GalleryImageOut(BaseModel):
    id: int
    filename: str
    media_type: str
    title: Optional[str]
    description: Optional[str]
    url: str
    created_at: datetime

    class Config:
        from_attributes = True


def build_abs_url(request: Request, rel_path: str) -> str:
    # rel_path like 'gallery/filename.ext'; static is mounted at /static
    try:
        return str(request.url_for("static", path=rel_path))
    except Exception:
        base = str(request.base_url).rstrip('/')
        return f"{base}/static/{rel_path}"


@router.get("", response_model=List[GalleryImageOut])
async def list_gallery_images(
    request: Request,
    session: AsyncSession = Depends(get_session),
    _user = Depends(require_role("admin"))
):
    """List all gallery videos (admin only)"""
    stmt = select(GalleryImage).order_by(GalleryImage.created_at.desc())
    result = await session.execute(stmt)
    images = result.scalars().all()
    
    # Add URL to each image/video
    out: list[GalleryImageOut] = []
    for img in images:
        rel = img.filepath if img.filepath else f"gallery/{img.filename}"
        url = build_abs_url(request, rel)
        out.append(GalleryImageOut(
            id=img.id,
            filename=img.filename,
            media_type=getattr(img, 'media_type', 'image'),  # Default to 'image' for backward compatibility
            title=img.title,
            description=img.description,
            url=url,
            created_at=img.created_at
        ))
    return out


@router.post("/upload")
async def upload_gallery_image(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    _user = Depends(require_role("admin"))
):
    """Upload a new gallery image or video (admin only)"""
    # Validate file type - both images and videos allowed
    allowed_image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    allowed_video_extensions = {".mp4", ".mov", ".avi", ".webm", ".mpeg", ".mpg"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    # Determine media type
    if file_ext in allowed_video_extensions:
        media_type = "video"
        allowed_extensions = allowed_video_extensions
    elif file_ext in allowed_image_extensions:
        media_type = "image"
        allowed_extensions = allowed_image_extensions
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed formats: Images: {', '.join(allowed_image_extensions)}, Videos: {', '.join(allowed_video_extensions)}"
        )
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"gallery_{timestamp}{file_ext}"
    abs_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(abs_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Create database entry
    rel_path = f"gallery/{unique_filename}"
    new_image = GalleryImage(
        filename=unique_filename, 
        filepath=rel_path, 
        media_type=media_type,
        title=None, 
        description=None
    )
    session.add(new_image)
    await session.commit()
    await session.refresh(new_image)
    
    return {
        "message": f"{media_type.capitalize()} uploaded successfully",
        "id": new_image.id,
        "filename": new_image.filename,
        "media_type": new_image.media_type,
        "url": f"/static/{rel_path}"
    }


@router.patch("/{image_id}")
async def update_gallery_image(
    image_id: int,
    payload: dict,
    session: AsyncSession = Depends(get_session),
    _user = Depends(require_role("admin"))
):
    """Edit gallery image metadata (title/description)."""
    stmt = select(GalleryImage).where(GalleryImage.id == image_id)
    result = await session.execute(stmt)
    image = result.scalars().first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    title = payload.get("title")
    description = payload.get("description")
    if title is not None:
        image.title = str(title)
    if description is not None:
        image.description = str(description)
    await session.commit()
    return {"ok": True}


@router.delete("/{image_id}", status_code=status.HTTP_200_OK)
async def delete_gallery_image(
    image_id: int,
    session: AsyncSession = Depends(get_session),
    _user = Depends(require_role("admin"))
):
    """Delete a gallery image (admin only)"""
    try:
        # Get image
        stmt = select(GalleryImage).where(GalleryImage.id == image_id)
        result = await session.execute(stmt)
        image = result.scalars().first()
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Delete file from filesystem
        file_deleted = False
        try:
            rel = image.filepath or f"gallery/{image.filename}"
            abs_path = os.path.abspath(os.path.join(STATIC_ROOT, rel.replace("/", os.sep)))
            if os.path.exists(abs_path):
                os.remove(abs_path)
                file_deleted = True
                print(f"[GALLERY] Deleted file: {abs_path}")
        except Exception as e:
            print(f"[GALLERY] Warning: Failed to delete file {abs_path}: {e}")
            # Continue with database deletion even if file deletion fails
        
        # Delete from database
        await session.execute(delete(GalleryImage).where(GalleryImage.id == image_id))
        await session.commit()
        
        print(f"[GALLERY] Successfully deleted image ID: {image_id}")
        return {
            "success": True,
            "message": "Image deleted successfully",
            "id": image_id
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GALLERY] Error deleting image {image_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {str(e)}"
        )


@router.get("/public", response_model=List[GalleryImageOut])
async def list_public_gallery_images(request: Request, session: AsyncSession = Depends(get_session)):
    """List all gallery images and videos (public endpoint for client-side display)"""
    # Show both images and videos
    stmt = select(GalleryImage).order_by(GalleryImage.created_at.desc())
    result = await session.execute(stmt)
    images = result.scalars().all()
    
    # Add URL to each image/video
    out: list[GalleryImageOut] = []
    for img in images:
        rel = img.filepath if img.filepath else f"gallery/{img.filename}"
        url = build_abs_url(request, rel)
        # Get media_type from database, default to 'image' if not set
        media_type = getattr(img, 'media_type', None)
        if not media_type:
            # Fallback: detect from filename extension
            filename_lower = img.filename.lower()
            if any(filename_lower.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg']):
                media_type = 'video'
            else:
                media_type = 'image'
        out.append(GalleryImageOut(
            id=img.id,
            filename=img.filename,
            media_type=media_type,
            title=img.title,
            description=img.description,
            url=url,
            created_at=img.created_at
        ))
    return out

