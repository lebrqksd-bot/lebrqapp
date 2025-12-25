from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel


class VenueOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = "UTC"
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpaceOut(BaseModel):
    id: int
    venue_id: int
    name: str
    description: Optional[str] = None
    capacity: int
    price_per_hour: float
    image_url: Optional[str] = None
    # Accept either legacy list of feature objects or new dict with keys like top_banners
    features: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None
    pricing_overrides: Optional[Dict[str, Any]] = None
    event_types: Optional[List[Dict[str, Any]]] = None
    stage_options: Optional[List[Dict[str, Any]]] = None
    banner_sizes: Optional[List[Dict[str, Any]]] = None
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VenueWithSpaces(VenueOut):
    spaces: List[SpaceOut] = []
