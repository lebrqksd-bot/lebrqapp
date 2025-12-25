from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db import get_session
from app.auth import get_current_user
from app.models import PageContent, User

router = APIRouter()


def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user


# Public endpoint to fetch a page by slug
@router.get('/content/{slug}')
async def get_public_page(slug: str, session: AsyncSession = Depends(get_session)):
    rs = await session.execute(select(PageContent).where(PageContent.slug == slug))
    page = rs.scalars().first()
    if not page:
        # return empty shell instead of 404 to allow client fallback
        return { 'slug': slug, 'title': None, 'body_html': None }
    return {
        'slug': page.slug,
        'title': page.title,
        'body_html': page.body_html,
        'updated_at': page.updated_at.isoformat() if page.updated_at else None,
    }


# Admin CRUD (minimal)
@router.get('/admin/content/{slug}')
async def admin_get_page(slug: str, session: AsyncSession = Depends(get_session), admin: User = Depends(admin_required)):
    rs = await session.execute(select(PageContent).where(PageContent.slug == slug))
    page = rs.scalars().first()
    if not page:
        raise HTTPException(status_code=404, detail='Not found')
    return {
        'slug': page.slug,
        'title': page.title,
        'body_html': page.body_html,
        'updated_at': page.updated_at.isoformat() if page.updated_at else None,
    }


@router.put('/admin/content/{slug}')
async def admin_put_page(
    slug: str,
    payload: dict,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    title = payload.get('title')
    body_html = payload.get('body_html')
    if body_html is not None and not isinstance(body_html, str):
        raise HTTPException(status_code=422, detail='body_html must be string')
    rs = await session.execute(select(PageContent).where(PageContent.slug == slug))
    page = rs.scalars().first()
    if not page:
        page = PageContent(slug=slug, title=title, body_html=body_html)
        session.add(page)
    else:
        if title is not None:
            page.title = title
        if body_html is not None:
            page.body_html = body_html
    await session.commit()
    return { 'ok': True, 'slug': slug }
