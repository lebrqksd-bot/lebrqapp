from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert, text
from ..db import get_session
from ..models import Venue, Space
from ..schemas.venues import VenueOut, SpaceOut, VenueWithSpaces
from .auth import require_role
from pydantic import BaseModel, Field, model_validator
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/venues", tags=["venues"])


def parse_json_field(value: Any) -> Any:
    """Parse JSON string fields from database.
    
    PostgreSQL may store JSON as text strings when migrated from other databases.
    This helper safely parses those strings back to Python objects.
    """
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


@router.get("/", response_model=List[VenueOut])
async def get_venues(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records per page (default 100, max 500)"),
    session: AsyncSession = Depends(get_session)
):
    """Get venues with pagination to prevent memory exhaustion from unbounded result fetching.
    
    SSL connections require that large result sets don't accumulate in memory.
    Default limit of 100 per page prevents ORM overhead from bloating response size.
    """
    result = await session.execute(
        select(Venue)
        .order_by(Venue.id.asc())
        .offset(skip)
        .limit(limit)
    )
    venues = result.scalars().all()
    return venues


@router.get("/spaces", response_model=List[SpaceOut])
async def list_spaces(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records per page (default 100, max 500)"),
    session: AsyncSession = Depends(get_session)
):
    """Get all spaces across venues with pagination.
    
    Prevents memory exhaustion from loading all spaces into memory simultaneously.
    Each space object has relationship overhead, pagination ensures memory efficiency.
    """
    rs = await session.execute(
        select(Space)
        .order_by(Space.id.asc())
        .offset(skip)
        .limit(limit)
    )
    return rs.scalars().all()


@router.get("/spaces/{space_id}", response_model=SpaceOut)
async def get_space(space_id: int, session: AsyncSession = Depends(get_session)):
    """Get a specific space"""
    try:
        # Direct query without connection check to avoid extra round-trip
        result = await session.execute(select(Space).where(Space.id == space_id))
        space = result.scalars().first()
        
        if not space:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
        
        # Parse JSON string fields from database (may be stored as text after migration)
        features_data = parse_json_field(space.features)
        pricing_overrides_data = parse_json_field(space.pricing_overrides)
        event_types_data = parse_json_field(space.event_types)
        stage_options_data = parse_json_field(space.stage_options)
        banner_sizes_data = parse_json_field(space.banner_sizes)
        
        # Normalize features safely without modifying the space object directly
        # We'll create a normalized copy and use it only for serialization
        normalized_features = None
        
        if features_data:
            try:
                # Handle both list format (old) and dict format (new with top_banners)
                if isinstance(features_data, dict):
                    # It's a dict with hall_features and/or top_banners
                    normalized_dict = {}
                    for key, value in features_data.items():
                        if key == 'hall_features' and isinstance(value, list):
                            normalized_features_list = []
                            for f in value:
                                if isinstance(f, dict):
                                    normalized_f = dict(f)  # Create a copy
                                    # Normalize paid field to boolean - handle various formats
                                    paid_value = normalized_f.get('paid')
                                    if paid_value is not None:
                                        normalized_f['paid'] = bool(paid_value is True or str(paid_value).lower() == 'true' if isinstance(paid_value, str) else paid_value == 1 or paid_value is True)
                                    else:
                                        normalized_f['paid'] = False
                                    normalized_features_list.append(normalized_f)
                                else:
                                    normalized_features_list.append(f)
                            normalized_dict['hall_features'] = normalized_features_list
                        else:
                            # Preserve other keys like top_banners
                            normalized_dict[key] = value
                    normalized_features = normalized_dict
                elif isinstance(features_data, list):
                    # It's a list of hall features (old format)
                    normalized_features_list = []
                    for f in features_data:
                        if isinstance(f, dict):
                            normalized_f = dict(f)  # Create a copy
                            # Normalize paid field to boolean - handle various formats
                            paid_value = normalized_f.get('paid')
                            if paid_value is not None:
                                normalized_f['paid'] = bool(paid_value is True or str(paid_value).lower() == 'true' if isinstance(paid_value, str) else paid_value == 1 or paid_value is True)
                            else:
                                normalized_f['paid'] = False
                            normalized_features_list.append(normalized_f)
                        else:
                            normalized_features_list.append(f)
                    normalized_features = normalized_features_list
                else:
                    # Unknown format, keep as is
                    normalized_features = features_data
            except Exception as e:
                logger.warning(f"[VENUES] Error normalizing features for space {space_id}: {e}", exc_info=True)
                # On error, keep parsed features
                normalized_features = features_data
        
        # Create a dict representation of the space for response
        # This avoids modifying the SQLAlchemy object directly
        try:
            space_dict = {
                'id': space.id,
                'venue_id': space.venue_id,
                'name': space.name,
                'description': space.description,
                'capacity': space.capacity,
                'price_per_hour': space.price_per_hour,
                'image_url': space.image_url,
                'features': normalized_features if normalized_features is not None else features_data,
                'pricing_overrides': pricing_overrides_data,
                'event_types': event_types_data,
                'stage_options': stage_options_data,
                'banner_sizes': banner_sizes_data,
                'active': space.active,
                'created_at': space.created_at,
                'updated_at': space.updated_at,
            }
            
            # Ensure response is fully constructed before returning
            response = SpaceOut(**space_dict)
            return response
        except Exception as serialization_error:
            logger.error(f"[VENUES] Error serializing space {space_id}: {serialization_error}", exc_info=True)
            try:
                await session.rollback()
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error serializing space data: {str(serialization_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VENUES] Error getting space {space_id}: {e}", exc_info=True)
        # Ensure session is rolled back on error
        try:
            await session.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving space: {str(e)}"
        )


@router.get("/{venue_id}", response_model=VenueWithSpaces)
async def get_venue(venue_id: int, session: AsyncSession = Depends(get_session)):
    """Get a specific venue with its spaces"""
    # Get venue
    venue_result = await session.execute(select(Venue).where(Venue.id == venue_id))
    venue = venue_result.scalars().first()
    
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    
    # Get spaces for this venue
    spaces_result = await session.execute(
        select(Space).where(Space.venue_id == venue_id, Space.active == True)
    )
    spaces = spaces_result.scalars().all()
    
    return VenueWithSpaces(
        id=venue.id,
        name=venue.name,
        address=venue.address,
        city=venue.city,
        timezone=venue.timezone,
        metadata_json=venue.metadata_json,
        created_at=venue.created_at,
        updated_at=venue.updated_at,
        spaces=spaces
    )


@router.get("/{venue_id}/spaces", response_model=List[SpaceOut])
async def get_venue_spaces(venue_id: int, session: AsyncSession = Depends(get_session)):
    """Get all spaces for a specific venue"""
    # Check if venue exists
    venue_result = await session.execute(select(Venue).where(Venue.id == venue_id))
    venue = venue_result.scalars().first()
    
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    
    # Get spaces
    result = await session.execute(
        select(Space).where(Space.venue_id == venue_id, Space.active == True)
    )
    spaces = result.scalars().all()
    return spaces




class StageOptionModel(BaseModel):
    id: str = Field(..., description="Unique identifier for the stage option")
    label: str = Field(..., min_length=1, description="Display name for the stage option")
    price: float = Field(..., ge=0, description="Non-negative price for the stage option")
    image: Optional[str] = Field(default=None, description="Image URL or /static path")

class BannerSizeModel(BaseModel):
    id: str = Field(..., description="Unique identifier for the banner option")
    label: str = Field(..., min_length=1, description="Display name for the banner option")
    width: Optional[int] = Field(default=None, ge=1, description="Width in inches or cm (positive integer)")
    height: Optional[int] = Field(default=None, ge=1, description="Height in inches or cm (positive integer)")
    price: float = Field(..., ge=0, description="Non-negative price for the printed banner")
    image: Optional[str] = Field(default=None, description="Image URL or /static path")

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_banner(cls, v):
        """Allow legacy banner entries that may miss width/height by inferring or defaulting.
        This makes PATCH operations (like delete) succeed even if existing stored entries lack these fields.
        """
        try:
            if isinstance(v, dict):
                # Normalize price to float
                if 'price' in v:
                    try:
                        v['price'] = float(v['price'])
                    except Exception:
                        v['price'] = 0.0

                # If width/height are missing or falsy, try to infer from label like "6x3" or "6 x 3" or "6×3"
                w = v.get('width')
                h = v.get('height')
                if not w or not h:
                    import re
                    label = str(v.get('label') or '')
                    m = re.search(r'(\d+)\s*[xX×]\s*(\d+)', label)
                    if m:
                        v['width'] = int(m.group(1))
                        v['height'] = int(m.group(2))
                    else:
                        # Fallback minimal dimensions to satisfy constraints
                        v['width'] = int(w or 1)
                        v['height'] = int(h or 1)
        except Exception:
            return v
        return v


class SpaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    capacity: int = 0
    price_per_hour: float = 0.0
    image_url: Optional[str] = None
    features: Optional[List[Dict[str, Any]]] = None  # Changed to List for hall specialties
    pricing_overrides: Optional[Dict[str, Any]] = None
    event_types: Optional[List[Dict[str, Any]]] = None
    # Accept arrays for stage decorations and banner sizes
    stage_options: Optional[List[StageOptionModel]] = None
    banner_sizes: Optional[List[BannerSizeModel]] = None
    active: bool = True


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    price_per_hour: Optional[float] = None
    image_url: Optional[str] = None
    # Features can be either a list (hall features) or a dict (with hall_features and top_banners)
    # Using Any to allow both list and dict formats
    features: Optional[Any] = None
    # Optional list of feature ids to remove without resending entire list
    features_remove_ids: Optional[List[str]] = None
    pricing_overrides: Optional[Dict[str, Any]] = None
    event_types: Optional[List[Dict[str, Any]]] = None
    # Accept arrays for stage decorations and banner sizes
    stage_options: Optional[List[StageOptionModel]] = None
    banner_sizes: Optional[List[BannerSizeModel]] = None
    active: Optional[bool] = None




@router.post("/{venue_id}/spaces", response_model=SpaceOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("admin"))])
async def create_space(venue_id: int, payload: SpaceCreate, session: AsyncSession = Depends(get_session)):
    """Create a new space for a venue (admin only)"""
    # Ensure venue exists
    v_rs = await session.execute(select(Venue).where(Venue.id == venue_id))
    venue = v_rs.scalars().first()
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    space = Space(
        venue_id=venue_id,
        name=payload.name,
        description=payload.description,
        capacity=payload.capacity,
        price_per_hour=payload.price_per_hour,
        image_url=payload.image_url,
        features=payload.features,
        pricing_overrides=payload.pricing_overrides,
        event_types=payload.event_types,
        stage_options=payload.stage_options,
        banner_sizes=payload.banner_sizes,
        active=payload.active,
    )
    session.add(space)
    await session.commit()
    await session.refresh(space)
    return space


@router.patch("/spaces/{space_id}", response_model=SpaceOut, dependencies=[Depends(require_role("admin"))])
async def update_space(space_id: int, payload: SpaceUpdate, session: AsyncSession = Depends(get_session)):
    """Update a space (admin only)"""
    rs = await session.execute(select(Space).where(Space.id == space_id))
    space = rs.scalars().first()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    # Log incoming payload, especially features
    payload_dict = payload.model_dump(exclude_unset=True)

    # Support removing existing features by id without resending the whole array
    if 'features_remove_ids' in payload_dict:
        remove_ids = payload_dict.pop('features_remove_ids') or []
        try:
            if remove_ids and space.features:
                current = space.features
                ids_set = set(str(rid) for rid in remove_ids)
                # Dict form with hall_features
                if isinstance(current, dict):
                    hall = current.get('hall_features')
                    if isinstance(hall, list):
                        current['hall_features'] = [f for f in hall if not (isinstance(f, dict) and str(f.get('id', '')) in ids_set)]
                    space.features = current
                # List form
                elif isinstance(current, list):
                    space.features = [f for f in current if not (isinstance(f, dict) and str(f.get('id', '')) in ids_set)]
        except Exception as e:
            print(f"[VENUES] Error applying features_remove_ids: {e}")
    
    # Handle features - can be either a list (hall features) or a dict (with top_banners)
    if 'features' in payload_dict:
        try:
            print(f"[VENUES] Updating space {space_id} - Features received: {payload_dict['features']}")
            if payload_dict['features'] is not None:
                # Check if features is a dict (contains top_banners) or a list (hall features)
                if isinstance(payload_dict['features'], dict):
                    # It's a dict with top_banners and possibly hall_features
                    # Normalize hall_features if present, but preserve the dict structure
                    if 'hall_features' in payload_dict['features'] and isinstance(payload_dict['features']['hall_features'], list):
                        normalized_hall_features = []
                        for f in payload_dict['features']['hall_features']:
                            if isinstance(f, dict):
                                # Skip features explicitly flagged as deleted by admin UI
                                if f.get('deleted') is True or str(f.get('deleted', '')).lower() == 'true':
                                    continue
                                normalized_f = {
                                    'id': f.get('id', ''),
                                    'label': f.get('label', ''),
                                }
                                if 'image' in f and f['image']:
                                    normalized_f['image'] = f['image']
                                if 'icon' in f and f['icon']:
                                    normalized_f['icon'] = f['icon']
                                # Always include paid field as boolean - preserve it even if no pricing
                                paid_value = f.get('paid')
                                if paid_value is not None:
                                    normalized_f['paid'] = bool(paid_value is True or (str(paid_value).lower() == 'true' if isinstance(paid_value, str) else paid_value == 1))
                                else:
                                    normalized_f['paid'] = False
                                # Preserve pricing fields for paid features (but paid field is saved regardless)
                                if normalized_f['paid']:
                                    if 'pricing_type' in f:
                                        normalized_f['pricing_type'] = f['pricing_type']
                                    # Be tolerant of empty strings and invalid numbers to avoid 500s
                                    try:
                                        if 'base_price' in f and f['base_price'] is not None:
                                            normalized_f['base_price'] = float(f['base_price']) if f['base_price'] not in (None, '', False) else 0
                                        if 'additional_hour_price' in f and f['additional_hour_price'] is not None:
                                            normalized_f['additional_hour_price'] = float(f['additional_hour_price']) if f['additional_hour_price'] not in (None, '', False) else 0
                                        if 'item_price' in f and f['item_price'] is not None:
                                            normalized_f['item_price'] = float(f['item_price']) if f['item_price'] not in (None, '', False) else 0
                                    except Exception:
                                        pass
                                # Preserve details field (can exist for both paid and free)
                                if 'details' in f and f['details']:
                                    normalized_f['details'] = f['details']
                                # Preserve addon_trigger field
                                if 'addon_trigger' in f and f['addon_trigger']:
                                    normalized_f['addon_trigger'] = f['addon_trigger']
                                normalized_hall_features.append(normalized_f)
                    payload_dict['features']['hall_features'] = normalized_hall_features
                    print(f"[VENUES] Features is a dict, preserving structure: {payload_dict['features']}")
                elif isinstance(payload_dict['features'], list):
                    # It's a list of hall features - normalize them but preserve all fields
                    normalized_features = []
                    for f in payload_dict['features']:
                        if isinstance(f, dict):
                            # Skip features explicitly flagged as deleted by admin UI
                            if f.get('deleted') is True or str(f.get('deleted', '')).lower() == 'true':
                                continue
                            normalized_f = {
                                'id': f.get('id', ''),
                                'label': f.get('label', ''),
                            }
                            if 'image' in f and f['image']:
                                normalized_f['image'] = f['image']
                            if 'icon' in f and f['icon']:
                                normalized_f['icon'] = f['icon']
                            # Always include paid field as boolean - preserve it even if no pricing
                            paid_value = f.get('paid')
                            if paid_value is not None:
                                normalized_f['paid'] = bool(paid_value is True or (str(paid_value).lower() == 'true' if isinstance(paid_value, str) else paid_value == 1))
                            else:
                                normalized_f['paid'] = False
                            # Preserve pricing fields for paid features (but paid field is saved regardless)
                            if normalized_f['paid']:
                                if 'pricing_type' in f:
                                    normalized_f['pricing_type'] = f['pricing_type']
                                # Be tolerant of empty strings and invalid numbers to avoid 500s
                                try:
                                    if 'base_price' in f and f['base_price'] is not None:
                                        normalized_f['base_price'] = float(f['base_price']) if f['base_price'] not in (None, '', False) else 0
                                    if 'additional_hour_price' in f and f['additional_hour_price'] is not None:
                                        normalized_f['additional_hour_price'] = float(f['additional_hour_price']) if f['additional_hour_price'] not in (None, '', False) else 0
                                    if 'item_price' in f and f['item_price'] is not None:
                                        normalized_f['item_price'] = float(f['item_price']) if f['item_price'] not in (None, '', False) else 0
                                except Exception:
                                    pass
                            # Preserve details field (can exist for both paid and free)
                            if 'details' in f and f['details']:
                                normalized_f['details'] = f['details']
                            # Preserve addon_trigger field
                            if 'addon_trigger' in f and f['addon_trigger']:
                                normalized_f['addon_trigger'] = f['addon_trigger']
                            # Append regardless of paid/free so free features are not dropped
                            normalized_features.append(normalized_f)
                    payload_dict['features'] = normalized_features
                    print(f"[VENUES] Normalized features: {normalized_features}")
        except Exception as e:
            print(f"[VENUES] Error normalizing features for space {space_id}: {e}")

    # Coerce select scalars if present
    try:
        if 'price_per_hour' in payload_dict and payload_dict['price_per_hour'] is not None:
            try:
                payload_dict['price_per_hour'] = float(payload_dict['price_per_hour'])
            except Exception:
                payload_dict['price_per_hour'] = space.price_per_hour
        if 'capacity' in payload_dict and payload_dict['capacity'] is not None:
            try:
                payload_dict['capacity'] = int(payload_dict['capacity'])
            except Exception:
                payload_dict['capacity'] = space.capacity
    except Exception:
        pass

    # Apply partial updates
    for field, value in payload_dict.items():
        setattr(space, field, value)

    try:
        await session.commit()
    except Exception as e:
        try:
            await session.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Failed to update space: {e}")
    await session.refresh(space)
    
    # Log what's being returned
    if space.features:
        print(f"[VENUES] Space {space_id} - Features after save: {space.features}")
    
    return space


@router.delete("/spaces/{space_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("admin"))])
async def delete_space(space_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a space (admin only)"""
    rs = await session.execute(select(Space).where(Space.id == space_id))
    space = rs.scalars().first()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    await session.delete(space)
    await session.commit()
    return None
