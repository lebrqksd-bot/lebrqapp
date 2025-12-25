"""
Admin routes for catalog item management with pricing system
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.models import Item, User
from app.schemas.items import (
    ItemCreate, ItemUpdate, ItemResponse,
    BulkMarkupRequest, BulkMarkupResponse,
    BulkPreparationTimeRequest, BulkPreparationTimeResponse,
    ItemPricingInfo
)
from app.auth import require_role
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/catalog/items", tags=["Admin - Catalog Items"])


def calculate_final_price(vendor_price: float, markup_percent: float) -> float:
    """Helper function to calculate final customer price"""
    return round(vendor_price * (1 + markup_percent / 100), 2)


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog_item(
    data: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Create a new catalog item with pricing
    
    **Admin Only**
    - Set vendor_price (cost)
    - Set admin_markup_percent (profit margin)
    - Final price calculated automatically
    """
    try:
        logger.info(f"[Admin Items] Creating item: {data.name}, vendor_price: {data.vendor_price}, markup: {data.admin_markup_percent}%")
        
        # Calculate final price
        final_price = calculate_final_price(data.vendor_price, data.admin_markup_percent)
        
        # Check if performance_team_profile column exists
        has_performance_team_profile = False
        try:
            from sqlalchemy import text
            result = db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'items'
                    AND COLUMN_NAME = 'performance_team_profile'
                """)
            )
            row = result.fetchone()
            has_performance_team_profile = row[0] > 0 if row else False
        except Exception:
            has_performance_team_profile = False
        
        # Build item data dictionary
        item_data = {
            'vendor_id': data.vendor_id,
            'category': data.category,
            'subcategory': data.subcategory,
            'type': data.type,
            'name': data.name,
            'description': data.description,
            'vendor_price': data.vendor_price,
            'admin_markup_percent': data.admin_markup_percent,
            'price': final_price,
            'image_url': data.image_url,
            'video_url': data.video_url,
            'profile_image_url': data.profile_image_url,
            'profile_info': data.profile_info,
            'space_id': data.space_id,
            'available': data.available
        }
        
        # Only add performance_team_profile if column exists
        if has_performance_team_profile and data.performance_team_profile:
            item_data['performance_team_profile'] = data.performance_team_profile
        
        item = Item(**item_data)
        
        db.add(item)
        
        try:
            db.commit()
            db.refresh(item)
        except Exception as e:
            db.rollback()
            error_msg = str(e)
            # Check if error is related to missing column
            if 'performance_team_profile' in error_msg.lower() or 'unknown column' in error_msg.lower():
                # Retry without performance_team_profile
                if 'performance_team_profile' in item_data:
                    del item_data['performance_team_profile']
                item = Item(**item_data)
                db.add(item)
                db.commit()
                db.refresh(item)
                logger.warning(f"[Admin Items] Created item without performance_team_profile (column not found)")
            else:
                raise
        
        logger.info(f"[Admin Items] Created item ID: {item.id}, final price: ₹{final_price}")
        return item
        
    except Exception as e:
        logger.error(f"[Admin Items] Error creating item: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create item: {str(e)}"
        )


@router.put("/{item_id}", response_model=ItemResponse)
async def update_catalog_item(
    item_id: int,
    data: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Update an existing catalog item
    
    **Admin Only**
    - Update any item fields including pricing
    - Final price recalculated if vendor_price or markup changes
    """
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found"
            )
        
        logger.info(f"[Admin Items] Updating item ID: {item_id}")
        
        # Track item_status change for history
        old_item_status = getattr(item, 'item_status', None)
        
        # Update fields
        # Note: performance_team_profile is already parsed by Pydantic validator in the schema
        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(item, key, value)
        
        # Recalculate price if vendor_price or markup changed
        if 'vendor_price' in update_data or 'admin_markup_percent' in update_data:
            item.price = calculate_final_price(item.vendor_price, item.admin_markup_percent)
            logger.info(f"[Admin Items] Recalculated price for item {item_id}: ₹{item.price}")
        
        db.commit()
        db.refresh(item)
        
        # Log item status change to history if status changed
        if 'item_status' in update_data and old_item_status != update_data.get('item_status'):
            try:
                from app.models_vendor_enhanced import BookingItemStatusHistory
                history = BookingItemStatusHistory(
                    booking_item_id=None,  # Not applicable for catalog items
                    old_status=old_item_status,
                    new_status=update_data.get('item_status'),
                    changed_by_user_id=current_user.id,
                    changed_by_role='admin',
                    reason='Catalog item status changed',
                    notes=f'Item ID: {item_id}, Item Name: {item.name}',
                )
                db.add(history)
                db.commit()
                logger.info(f"[Admin Items] Successfully logged item status history: Item {item_id}, {old_item_status} -> {update_data.get('item_status')}")
            except Exception as e:
                import traceback
                logger.error(f"[Admin Items] Failed to log item status history: {e}")
                logger.error(f"[Admin Items] Traceback: {traceback.format_exc()}")
                # Don't fail the request if history logging fails - item update already succeeded
        
        return item
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin Items] Error updating item {item_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update item: {str(e)}"
        )


@router.post("/bulk-markup", response_model=BulkMarkupResponse)
async def apply_bulk_markup(
    data: BulkMarkupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Apply markup to multiple items from a vendor
    
    **Admin Only**
    - If item_ids provided: Apply to specific items
    - If item_ids empty: Apply to ALL items from the vendor
    
    Example:
    ```json
    {
      "vendor_id": 5,
      "markup_percent": 10,
      "item_ids": [101, 102]  // Or [] for all
    }
    ```
    """
    try:
        logger.info(f"[Admin Items] Bulk markup: vendor_id={data.vendor_id}, markup={data.markup_percent}%")
        
        # Build query
        query = db.query(Item).filter(Item.vendor_id == data.vendor_id)
        
        # Filter by specific items if provided
        if data.item_ids:
            query = query.filter(Item.id.in_(data.item_ids))
            logger.info(f"[Admin Items] Applying to {len(data.item_ids)} specific items")
        else:
            logger.info(f"[Admin Items] Applying to ALL items from vendor {data.vendor_id}")
        
        items = query.all()
        
        if not items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No items found for vendor ID {data.vendor_id}"
            )
        
        # Apply markup to each item
        updated_items = []
        for item in items:
            old_price = item.price
            item.admin_markup_percent = data.markup_percent
            item.price = calculate_final_price(item.vendor_price, data.markup_percent)
            updated_items.append(item)
            logger.info(f"[Admin Items] Item {item.id}: ₹{old_price} → ₹{item.price}")
        
        db.commit()
        
        # Refresh all items
        for item in updated_items:
            db.refresh(item)
        
        logger.info(f"[Admin Items] Bulk markup complete: {len(updated_items)} items updated")
        
        return BulkMarkupResponse(
            success=True,
            message=f"Applied {data.markup_percent}% markup to {len(updated_items)} items",
            updated_count=len(updated_items),
            items=updated_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin Items] Error applying bulk markup: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply bulk markup: {str(e)}"
        )


@router.post("/bulk-preparation-time", response_model=BulkPreparationTimeResponse)
async def apply_bulk_preparation_time(
    data: BulkPreparationTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Apply preparation time to multiple items (bulk operation)
    
    **Admin Only**
    - If item_ids provided: Apply to specific items
    - If vendor_id with no item_ids: Apply to ALL items from that vendor
    - If only item_ids: Apply to those specific items regardless of vendor
    
    Example:
    ```json
    {
      "vendor_id": 5,
      "preparation_time_minutes": 30,
      "item_ids": [101, 102]  // Or [] for all vendor items, or null for specific items only
    }
    ```
    """
    try:
        logger.info(f"[Admin Items] Bulk preparation time: vendor_id={data.vendor_id}, time={data.preparation_time_minutes} min")
        
        # Build query
        query = db.query(Item)
        
        # If vendor_id provided, filter by vendor
        if data.vendor_id is not None:
            query = query.filter(Item.vendor_id == data.vendor_id)
            logger.info(f"[Admin Items] Filtering by vendor ID: {data.vendor_id}")
        
        # Filter by specific items if provided
        if data.item_ids:
            query = query.filter(Item.id.in_(data.item_ids))
            logger.info(f"[Admin Items] Applying to {len(data.item_ids)} specific items")
        elif data.vendor_id is not None:
            logger.info(f"[Admin Items] Applying to ALL items from vendor {data.vendor_id}")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either vendor_id or item_ids must be provided"
            )
        
        items = query.all()
        
        if not items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No items found matching the criteria"
            )
        
        # Apply preparation time to each item
        updated_items = []
        for item in items:
            old_prep_time = item.preparation_time_minutes
            item.preparation_time_minutes = data.preparation_time_minutes
            updated_items.append(item)
            logger.info(f"[Admin Items] Item {item.id} ({item.name}): {old_prep_time} min → {data.preparation_time_minutes} min")
        
        db.commit()
        
        # Refresh all items
        for item in updated_items:
            db.refresh(item)
        
        logger.info(f"[Admin Items] Bulk preparation time complete: {len(updated_items)} items updated")
        
        return BulkPreparationTimeResponse(
            success=True,
            message=f"Set preparation time to {data.preparation_time_minutes} minutes for {len(updated_items)} items",
            updated_count=len(updated_items),
            items=updated_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin Items] Error applying bulk preparation time: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply bulk preparation time: {str(e)}"
        )


@router.get("/vendor/{vendor_id}", response_model=List[ItemResponse])
async def get_vendor_items(
    vendor_id: int,
    category: Optional[str] = Query(None, description="Filter by category"),
    available_only: bool = Query(True, description="Show only available items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Get all items from a vendor with pricing details
    
    **Admin Only**
    - View all vendor's products
    - See cost, markup, and profit for each item
    """
    try:
        query = db.query(Item).filter(Item.vendor_id == vendor_id)
        
        if category:
            query = query.filter(Item.category == category)
        
        if available_only:
            query = query.filter(Item.available == True)
        
        items = query.all()
        logger.info(f"[Admin Items] Found {len(items)} items for vendor {vendor_id}")
        
        return items
        
    except Exception as e:
        logger.error(f"[Admin Items] Error fetching vendor items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch vendor items: {str(e)}"
        )


@router.get("/{item_id}/pricing", response_model=ItemPricingInfo)
async def get_item_pricing_details(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Get detailed pricing information for an item
    
    **Admin Only**
    - See complete pricing breakdown
    - View profit margins and amounts
    """
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found"
            )
        
        markup_amount = item.vendor_price * (item.admin_markup_percent / 100)
        profit_margin = (markup_amount / item.price * 100) if item.price > 0 else 0
        
        return ItemPricingInfo(
            item_id=item.id,
            item_name=item.name,
            vendor_price=item.vendor_price,
            admin_markup_percent=item.admin_markup_percent,
            markup_amount=round(markup_amount, 2),
            final_price=item.price,
            profit_per_unit=round(markup_amount, 2),
            profit_margin_percent=round(profit_margin, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin Items] Error fetching pricing details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pricing details: {str(e)}"
        )


@router.get("/", response_model=List[ItemResponse])
async def list_all_catalog_items(
    main_category: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    available_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    List all catalog items with filtering
    
    **Admin Only**
    - View all items with pricing
    - Filter by category, vendor, availability
    """
    try:
        query = db.query(Item)
        
        if main_category:
            query = query.filter(Item.main_category == main_category)
        if category:
            query = query.filter(Item.category == category)
        if subcategory:
            query = query.filter(Item.subcategory == subcategory)
        
        if vendor_id:
            query = query.filter(Item.vendor_id == vendor_id)
        
        if available_only:
            query = query.filter(Item.available == True)
        
        items = query.offset(skip).limit(limit).all()
        logger.info(f"[Admin Items] Listed {len(items)} items")
        
        return items
        
    except Exception as e:
        logger.error(f"[Admin Items] Error listing items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list items: {str(e)}"
        )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Delete a catalog item
    
    **Admin Only**
    """
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found"
            )
        
        db.delete(item)
        db.commit()
        
        logger.info(f"[Admin Items] Deleted item ID: {item_id}")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin Items] Error deleting item: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete item: {str(e)}"
        )

