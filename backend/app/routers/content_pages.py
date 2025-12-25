"""
Content management router for admin panel
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db import get_db
from app.auth import get_current_user
from app.models import User
from sqlalchemy import text

router = APIRouter(prefix="/admin/content-pages", tags=["content-management"])
public_router = APIRouter(prefix="/content-pages", tags=["public-content"])

def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user

class ContentPageOut(BaseModel):
    id: int
    page_name: str
    title: str
    content: str
    meta_description: Optional[str] = None
    is_published: bool = True
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

class ContentPageCreate(BaseModel):
    page_name: str
    title: str
    content: str
    meta_description: Optional[str] = None
    is_published: bool = True

class ContentPageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    meta_description: Optional[str] = None
    is_published: Optional[bool] = None

class PublicContentPageOut(BaseModel):
    page_name: str
    title: str
    content: str
    meta_description: Optional[str] = None
    updated_at: str

@router.get("/", response_model=List[ContentPageOut])
async def list_content_pages(
    db: Session = Depends(get_db),
    current_user=Depends(admin_required)
):
    """Get all content pages for admin"""
    result = db.execute(text("SELECT * FROM content_pages ORDER BY page_name"))
    pages = result.fetchall()
    
    return [
        ContentPageOut(
            id=page.id,
            page_name=page.page_name,
            title=page.title,
            content=page.content,
            meta_description=page.meta_description,
            is_published=bool(page.is_published),
            created_at=page.created_at.isoformat() if page.created_at else "",
            updated_at=page.updated_at.isoformat() if page.updated_at else ""
        )
        for page in pages
    ]

@router.get("/{page_name}", response_model=ContentPageOut)
async def get_content_page(
    page_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(admin_required)
):
    """Get specific content page for admin"""
    result = db.execute(
        text("SELECT * FROM content_pages WHERE page_name = :page_name"),
        {"page_name": page_name}
    )
    page = result.fetchone()
    
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")
    
    return ContentPageOut(
        id=page.id,
        page_name=page.page_name,
        title=page.title,
        content=page.content,
        meta_description=page.meta_description,
        is_published=bool(page.is_published),
        created_at=page.created_at.isoformat() if page.created_at else "",
        updated_at=page.updated_at.isoformat() if page.updated_at else ""
    )

@router.post("/", response_model=ContentPageOut)
async def create_content_page(
    page_data: ContentPageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_required)
):
    """Create new content page"""
    # Check if page already exists
    existing = db.execute(
        text("SELECT id FROM content_pages WHERE page_name = :page_name"),
        {"page_name": page_data.page_name}
    ).fetchone()
    
    if existing:
        raise HTTPException(status_code=400, detail="Page with this name already exists")
    
    # Insert new page
    result = db.execute(
        text("""
            INSERT INTO content_pages (page_name, title, content, meta_description, is_published)
            VALUES (:page_name, :title, :content, :meta_description, :is_published)
        """),
        {
            "page_name": page_data.page_name,
            "title": page_data.title,
            "content": page_data.content,
            "meta_description": page_data.meta_description,
            "is_published": page_data.is_published
        }
    )
    db.commit()
    
    # Get the created page
    page_id = result.lastrowid
    created_page = db.execute(
        text("SELECT * FROM content_pages WHERE id = :id"),
        {"id": page_id}
    ).fetchone()
    
    return ContentPageOut(
        id=created_page.id,
        page_name=created_page.page_name,
        title=created_page.title,
        content=created_page.content,
        meta_description=created_page.meta_description,
        is_published=bool(created_page.is_published),
        created_at=created_page.created_at.isoformat(),
        updated_at=created_page.updated_at.isoformat()
    )

@router.put("/{page_name}", response_model=ContentPageOut)
async def update_content_page(
    page_name: str,
    page_data: ContentPageUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_required)
):
    """Update content page"""
    # Check if page exists
    existing = db.execute(
        text("SELECT * FROM content_pages WHERE page_name = :page_name"),
        {"page_name": page_name}
    ).fetchone()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Content page not found")
    
    # Build update query dynamically
    update_fields = []
    params = {"page_name": page_name}
    
    if page_data.title is not None:
        update_fields.append("title = :title")
        params["title"] = page_data.title
    
    if page_data.content is not None:
        update_fields.append("content = :content")
        params["content"] = page_data.content
    
    if page_data.meta_description is not None:
        update_fields.append("meta_description = :meta_description")
        params["meta_description"] = page_data.meta_description
    
    if page_data.is_published is not None:
        update_fields.append("is_published = :is_published")
        params["is_published"] = page_data.is_published
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Add updated_at
    update_fields.append("updated_at = CURRENT_TIMESTAMP")
    
    update_sql = f"UPDATE content_pages SET {', '.join(update_fields)} WHERE page_name = :page_name"
    
    db.execute(text(update_sql), params)
    db.commit()
    
    # Return updated page
    updated_page = db.execute(
        text("SELECT * FROM content_pages WHERE page_name = :page_name"),
        {"page_name": page_name}
    ).fetchone()
    
    return ContentPageOut(
        id=updated_page.id,
        page_name=updated_page.page_name,
        title=updated_page.title,
        content=updated_page.content,
        meta_description=updated_page.meta_description,
        is_published=bool(updated_page.is_published),
        created_at=updated_page.created_at.isoformat(),
        updated_at=updated_page.updated_at.isoformat()
    )

@router.delete("/{page_name}")
async def delete_content_page(
    page_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(admin_required)
):
    """Delete content page"""
    result = db.execute(
        text("DELETE FROM content_pages WHERE page_name = :page_name"),
        {"page_name": page_name}
    )
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Content page not found")
    
    return {"message": "Content page deleted successfully"}

# Public endpoint for fetching published content
@router.get("/public/{page_name}", response_model=PublicContentPageOut, tags=["public"])
async def get_public_content_page(
    page_name: str,
    db: Session = Depends(get_db)
):
    """Get published content page for public viewing"""
    # MySQL stores booleans as TINYINT(1), so we check for 1 or true
    result = db.execute(
        text("SELECT * FROM content_pages WHERE page_name = :page_name AND (is_published = 1 OR is_published = true)"),
        {"page_name": page_name}
    )
    page = result.fetchone()
    
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")
    
    # Create response with cache-busting headers to prevent stale content
    from fastapi.responses import JSONResponse
    
    response_data = {
        "page_name": page.page_name,
        "title": page.title,
        "content": page.content,
        "meta_description": page.meta_description,
        "updated_at": page.updated_at.isoformat() if page.updated_at else ""
    }
    
    # Use updated_at timestamp for cache validation
    cache_headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "ETag": f'"{page.updated_at.isoformat() if page.updated_at else ""}"',
        "Last-Modified": page.updated_at.isoformat() if page.updated_at else "",
    }
    
    return JSONResponse(
        content=response_data,
        headers=cache_headers
    )

# Separate public router endpoint for clean client access
@public_router.get("/{page_name}", response_model=PublicContentPageOut)
async def get_public_content_page_clean(
    page_name: str,
    db: Session = Depends(get_db)
):
    """Get published content page for public viewing (clean endpoint)"""
    # MySQL stores booleans as TINYINT(1), so we check for 1 or true
    result = db.execute(
        text("SELECT * FROM content_pages WHERE page_name = :page_name AND (is_published = 1 OR is_published = true)"),
        {"page_name": page_name}
    )
    page = result.fetchone()
    
    if not page:
        # Check if page exists but is not published
        unpublished = db.execute(
            text("SELECT * FROM content_pages WHERE page_name = :page_name"),
            {"page_name": page_name}
        ).fetchone()
        
        if unpublished:
            raise HTTPException(status_code=404, detail="Content page not published")
        else:
            raise HTTPException(status_code=404, detail="Content page not found")
    
    # Create response with cache-busting headers to prevent stale content
    from fastapi.responses import JSONResponse
    import json
    
    response_data = {
        "page_name": page.page_name,
        "title": page.title,
        "content": page.content,
        "meta_description": page.meta_description,
        "updated_at": page.updated_at.isoformat() if page.updated_at else ""
    }
    
    # Use updated_at timestamp for cache validation
    cache_headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "ETag": f'"{page.updated_at.isoformat() if page.updated_at else ""}"',
        "Last-Modified": page.updated_at.isoformat() if page.updated_at else "",
    }
    
    return JSONResponse(
        content=response_data,
        headers=cache_headers
    )