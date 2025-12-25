from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Form
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.auth import get_current_user
from app.models import Item, User, VendorProfile

router = APIRouter()


def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user


@router.get('/items')
async def list_public_items(
    main_category: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    subcategory: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None, alias='item_type'),
    space_id: Optional[int] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    now = datetime.utcnow()
    # Join with VendorProfile to filter out suspended vendors
    stmt = (
        select(Item)
        .outerjoin(VendorProfile, Item.vendor_id == VendorProfile.id)
        .where(Item.available == True)  # noqa: E712
        .where(
            # Include items if vendor_id is NULL (no vendor) OR vendor is not suspended
            or_(
                Item.vendor_id.is_(None),
                VendorProfile.suspended_until.is_(None),
                VendorProfile.suspended_until <= now
            )
        )
    )
    conditions = []
    if main_category:
        conditions.append(Item.main_category == main_category)
    if category:
        conditions.append(Item.category == category)
    if subcategory:
        conditions.append(Item.subcategory == subcategory)
    if type:
        conditions.append(Item.type == type)
    if space_id:
        conditions.append((Item.space_id == space_id) | (Item.space_id.is_(None)))
    if vendor_id is not None:
        conditions.append(Item.vendor_id == vendor_id)
    if q:
        like = f"%{q}%"
        conditions.append(func.lower(Item.name).like(func.lower(like)))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    # Cross-dialect NULL ordering: emulate "NULLS LAST" by ordering on IS NULL, then value
    stmt = stmt.order_by(
        Item.space_id.is_(None), Item.space_id.asc(),
        Item.subcategory.is_(None), Item.subcategory.asc(),
        Item.name.asc()
    )
    rs = await session.execute(stmt)
    items = rs.scalars().all()
    return {'items': [
        {
            'id': it.id,
            'name': it.name,
            'description': it.description,
            'price': it.price,
            'main_category': it.main_category,
            'category': it.category,
            'subcategory': it.subcategory,
            'type': it.type,
            'image_url': it.image_url,
            'video_url': it.video_url,
            'profile_image_url': it.profile_image_url,
            'profile_info': it.profile_info,
            'performance_team_profile': getattr(it, 'performance_team_profile', None),
            'space_id': it.space_id,
            'vendor_id': it.vendor_id,
            'item_status': it.item_status,
            'preparation_time_minutes': it.preparation_time_minutes,
        } for it in items
    ], 'count': len(items)}


@router.get('/admin/items')
async def admin_list_items(
    main_category: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    subcategory: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None, alias='item_type'),
    space_id: Optional[int] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Admin version: Returns ALL items (including unavailable ones) - Simplified query for performance"""
    try:
        # Use explicit column selection to avoid issues with missing columns
        # Select all columns except performance_team_profile first, then add it if exists
        
        # Build WHERE clause conditions
        where_conditions = []
        params = {}
        
        if main_category:
            where_conditions.append("items.main_category = :main_category")
            params['main_category'] = main_category
        if category:
            where_conditions.append("items.category = :category")
            params['category'] = category
        if subcategory:
            where_conditions.append("items.subcategory = :subcategory")
            params['subcategory'] = subcategory
        if type:
            where_conditions.append("items.type = :type")
            params['type'] = type
        if space_id:
            where_conditions.append("(items.space_id = :space_id OR items.space_id IS NULL)")
            params['space_id'] = space_id
        if vendor_id is not None:
            where_conditions.append("items.vendor_id = :vendor_id")
            params['vendor_id'] = vendor_id
        if q:
            where_conditions.append("LOWER(items.name) LIKE LOWER(:q)")
            params['q'] = f"%{q}%"
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Try to select with performance_team_profile, fall back if column doesn't exist
        sql_query = text(f"""
            SELECT 
                items.id, items.vendor_id, items.main_category, items.category, 
                items.subcategory, items.type, items.name, items.description, 
                items.vendor_price, items.admin_markup_percent, items.price, 
                items.image_url, items.video_url, items.profile_image_url, 
                items.profile_info, items.space_id, items.available, 
                items.item_status, items.preparation_time_minutes, 
                items.created_at, items.updated_at
            FROM items 
            WHERE {where_clause}
            ORDER BY items.created_at DESC
        """)
        
        # Check if performance_team_profile column exists by querying information_schema
        try:
            check_query = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'items'
                AND COLUMN_NAME = 'performance_team_profile'
            """)
            check_result = await session.execute(check_query)
            check_row = check_result.fetchone()
            has_performance_team_profile = check_row[0] > 0 if check_row else False
            
            if has_performance_team_profile:
                # Column exists, add it to the SELECT
                sql_query = text(f"""
                    SELECT 
                        items.id, items.vendor_id, items.main_category, items.category, 
                        items.subcategory, items.type, items.name, items.description, 
                        items.vendor_price, items.admin_markup_percent, items.price, 
                        items.image_url, items.video_url, items.profile_image_url, 
                        items.profile_info, items.performance_team_profile,
                        items.space_id, items.available, 
                        items.item_status, items.preparation_time_minutes, 
                        items.created_at, items.updated_at
                    FROM items 
                    WHERE {where_clause}
                    ORDER BY items.created_at DESC
                """)
        except Exception:
            # If check fails, assume column doesn't exist
            has_performance_team_profile = False
        
        result = await session.execute(sql_query, params)
        rows = result.all()
        
        items = []
        for row in rows:
            # Access columns by name (row._mapping provides dict-like access)
            row_dict = dict(row._mapping) if hasattr(row, '_mapping') else dict(row)
            
            item_dict = {
                'id': row_dict.get('id'),
                'name': row_dict.get('name'),
                'description': row_dict.get('description'),
                'price': row_dict.get('price'),
                'main_category': row_dict.get('main_category'),
                'category': row_dict.get('category'),
                'subcategory': row_dict.get('subcategory'),
                'type': row_dict.get('type'),
                'image_url': row_dict.get('image_url'),
                'video_url': row_dict.get('video_url'),
                'profile_image_url': row_dict.get('profile_image_url'),
                'profile_info': row_dict.get('profile_info'),
                'space_id': row_dict.get('space_id'),
                'vendor_id': row_dict.get('vendor_id'),
                'item_status': row_dict.get('item_status', 'available'),
                'preparation_time_minutes': row_dict.get('preparation_time_minutes', 0),
                'available': row_dict.get('available', True),
            }
            
            # Add performance_team_profile if column exists
            if has_performance_team_profile:
                item_dict['performance_team_profile'] = row_dict.get('performance_team_profile')
            else:
                item_dict['performance_team_profile'] = None
                
            items.append(item_dict)
        
        return {'items': items, 'count': len(items)}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in admin_list_items: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load items: {str(e)}")


@router.post('/admin/items')
async def admin_create_item(
    name: str = Form(...),
    price: float = Form(...),
    main_category: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    subcategory: Optional[str] = Form(default=None),
    item_type: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    image_url: Optional[str] = Form(default=None),
    video_url: Optional[str] = Form(default=None),
    profile_image_url: Optional[str] = Form(default=None),
    profile_info: Optional[str] = Form(default=None),
    performance_team_profile: Optional[str] = Form(default=None, description="JSON string of performance team profile"),
    vendor_id: Optional[int] = Form(default=None),
    space_id: Optional[int] = Form(default=None),
    available: bool = Form(default=True),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    # Server-side validation for mandatory fields
    errors = []
    if not name or not str(name).strip():
        errors.append({"loc": ["form", "name"], "msg": "Name is required", "type": "value_error.missing"})
    try:
        p = float(price)
        if p <= 0:
            errors.append({"loc": ["form", "price"], "msg": "Price must be greater than 0", "type": "value_error"})
    except Exception:
        errors.append({"loc": ["form", "price"], "msg": "Price must be a number", "type": "type_error.float"})
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # Parse performance_team_profile JSON if provided
    import json
    profile_json = None
    if performance_team_profile:
        try:
            profile_json = json.loads(performance_team_profile) if isinstance(performance_team_profile, str) else performance_team_profile
        except (json.JSONDecodeError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid performance_team_profile JSON: {str(e)}")
    
    # Check if performance_team_profile column exists
    has_performance_team_profile = False
    try:
        check_query = text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'items'
            AND COLUMN_NAME = 'performance_team_profile'
        """)
        check_result = await session.execute(check_query)
        check_row = check_result.fetchone()
        has_performance_team_profile = check_row[0] > 0 if check_row else False
    except Exception:
        # If check fails, assume column doesn't exist
        has_performance_team_profile = False
    
    # Create item dictionary
    item_data = {
        'name': name,
        'price': price,
        'main_category': main_category,
        'category': category,
        'subcategory': subcategory,
        'type': item_type,
        'description': description,
        'image_url': image_url,
        'video_url': video_url,
        'profile_image_url': profile_image_url,
        'profile_info': profile_info,
        'vendor_id': vendor_id,
        'space_id': space_id,
        'available': available,
    }
    
    # Only add performance_team_profile if column exists
    if has_performance_team_profile and profile_json:
        item_data['performance_team_profile'] = profile_json
    
    it = Item(**item_data)
    session.add(it)
    
    try:
        await session.commit()
        await session.refresh(it)
        return {'ok': True, 'id': it.id}
    except Exception as e:
        await session.rollback()
        error_msg = str(e)
        # Check if error is related to missing column
        if 'performance_team_profile' in error_msg.lower() or 'unknown column' in error_msg.lower():
            # Retry without performance_team_profile
            if 'performance_team_profile' in item_data:
                del item_data['performance_team_profile']
            it = Item(**item_data)
            session.add(it)
            await session.commit()
            await session.refresh(it)
            return {'ok': True, 'id': it.id, 'warning': 'performance_team_profile column not found, item created without it'}
        raise HTTPException(status_code=500, detail=f"Failed to create item: {error_msg}")


@router.put('/admin/items/{item_id}')
async def admin_update_item(
    item_id: int,
    name: Optional[str] = Form(default=None),
    price: Optional[float] = Form(default=None),
    main_category: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    subcategory: Optional[str] = Form(default=None),
    item_type: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    image_url: Optional[str] = Form(default=None),
    video_url: Optional[str] = Form(default=None),
    profile_image_url: Optional[str] = Form(default=None),
    profile_info: Optional[str] = Form(default=None),
    performance_team_profile: Optional[str] = Form(default=None, description="JSON string of performance team profile"),
    vendor_id: Optional[int] = Form(default=None),
    space_id: Optional[int] = Form(default=None),
    available: Optional[bool] = Form(default=None),
    item_status: Optional[str] = Form(default=None),
    preparation_time_minutes: Optional[int] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    rs = await session.execute(select(Item).where(Item.id == item_id))
    it = rs.scalars().first()
    if not it:
        raise HTTPException(status_code=404, detail='Item not found')
    # Validate provided fields (partial)
    errors = []
    if name is not None and not str(name).strip():
        errors.append({"loc": ["form", "name"], "msg": "Name cannot be empty", "type": "value_error"})
    if price is not None:
        try:
            p = float(price)
            if p <= 0:
                errors.append({"loc": ["form", "price"], "msg": "Price must be greater than 0", "type": "value_error"})
        except Exception:
            errors.append({"loc": ["form", "price"], "msg": "Price must be a number", "type": "type_error.float"})
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    
    # Track item_status change for history
    old_item_status = it.item_status if hasattr(it, 'item_status') else None
    
    # Parse performance_team_profile JSON if provided
    if performance_team_profile is not None:
        import json
        try:
            profile_json = json.loads(performance_team_profile) if isinstance(performance_team_profile, str) else performance_team_profile
            it.performance_team_profile = profile_json
        except (json.JSONDecodeError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid performance_team_profile JSON: {str(e)}")
    
    if name is not None: it.name = name
    if price is not None: it.price = price
    if main_category is not None: it.main_category = main_category
    if category is not None: it.category = category
    if subcategory is not None: it.subcategory = subcategory
    if item_type is not None: it.type = item_type
    if description is not None: it.description = description
    if image_url is not None: it.image_url = image_url
    if video_url is not None: it.video_url = video_url
    if profile_image_url is not None: it.profile_image_url = profile_image_url
    if profile_info is not None: it.profile_info = profile_info
    if vendor_id is not None: it.vendor_id = vendor_id
    if space_id is not None: it.space_id = space_id
    if available is not None: it.available = available
    if item_status is not None: it.item_status = item_status
    if preparation_time_minutes is not None: it.preparation_time_minutes = preparation_time_minutes
    
    await session.commit()
    
    # Log item status change to history if status changed
    if item_status is not None and old_item_status != item_status:
        try:
            from ..models_vendor_enhanced import BookingItemStatusHistory
            # Note: Using booking_item_status_history for item status tracking
            # booking_item_id will be NULL for catalog item status changes
            # We'll use a special approach: create history entry with item_id in notes
            history = BookingItemStatusHistory(
                booking_item_id=None,  # Not applicable for catalog items
                old_status=old_item_status,
                new_status=item_status,
                changed_by_user_id=admin.id,
                changed_by_role='admin',
                reason=f'Catalog item status changed',
                notes=f'Item ID: {item_id}, Item Name: {it.name}',
            )
            session.add(history)
            await session.commit()
            print(f"[ADMIN] Successfully logged item status history: Item {item_id}, {old_item_status} -> {item_status}")
        except Exception as e:
            import traceback
            print(f"[ADMIN] Failed to log item status history: {e}")
            print(f"[ADMIN] Traceback: {traceback.format_exc()}")
            # Don't fail the request if history logging fails
    
    return {'ok': True}


@router.delete('/admin/items/{item_id}')
async def admin_delete_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    rs = await session.execute(select(Item).where(Item.id == item_id))
    it = rs.scalars().first()
    if not it:
        raise HTTPException(status_code=404, detail='Item not found')
    await session.delete(it)
    await session.commit()
    return {'ok': True}
