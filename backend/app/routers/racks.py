"""
Rack API Routes - Public and Admin endpoints
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from ..db import get_session
from ..models_rack import Rack, RackProduct, RackOrder
from ..auth import get_current_user, get_current_admin

router = APIRouter(prefix="/racks", tags=["racks"])


# Pydantic Models
class RackBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    location: Optional[str] = None
    category_name: Optional[str] = None
    category_image_url: Optional[str] = None
    active: bool = True


class RackCreate(RackBase):
    pass


class RackUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category_name: Optional[str] = None
    category_image_url: Optional[str] = None
    active: Optional[bool] = None


class RackProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None  # Multiple images
    videos: Optional[List[str]] = None  # Multiple videos
    price: float
    stock_quantity: int = 0
    delivery_time: Optional[str] = None
    category: Optional[str] = None
    status: str = "active"


class RackProductCreate(RackProductBase):
    pass


class RackProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    delivery_time: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


class RackProductResponse(RackProductBase):
    id: int
    rack_id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RackResponse(RackBase):
    id: int
    products: List[RackProductResponse] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# Public Routes
@router.get("/products/all", response_model=List[RackProductResponse])
async def get_all_products(
    active_only: bool = Query(True, description="Only return products from active racks"),
    status_filter: Optional[str] = Query("active", description="Filter by product status"),
    session: AsyncSession = Depends(get_session),
):
    """Get all products from all racks (public endpoint)"""
    # Query all products, optionally filtered by rack active status
    query = select(RackProduct)
    
    if active_only:
        # Join with Rack to filter by active racks
        query = query.join(Rack).where(Rack.active == True)
    
    if status_filter:
        query = query.where(RackProduct.status == status_filter)
    
    result = await session.execute(query)
    products = result.scalars().all()
    
    # Get images and videos from JSON fields
    def get_product_images(p):
        if p.images_json and isinstance(p.images_json, list):
            return p.images_json
        elif p.image_url:
            return [p.image_url]
        return []
    
    def get_product_videos(p):
        if p.videos_json and isinstance(p.videos_json, list):
            return p.videos_json
        return []
    
    return [
        {
            "id": p.id,
            "rack_id": p.rack_id,
            "name": p.name,
            "description": p.description,
            "image_url": p.image_url,
            "images": get_product_images(p),
            "videos": get_product_videos(p),
            "price": p.price,
            "stock_quantity": p.stock_quantity,
            "delivery_time": p.delivery_time,
            "category": p.category,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat(),
        }
        for p in products
    ]


@router.get("", response_model=List[RackResponse])
async def list_racks(
    active_only: bool = Query(True, description="Only return active racks"),
    session: AsyncSession = Depends(get_session),
):
    """List all racks (public endpoint)"""
    query = select(Rack).options(selectinload(Rack.products))
    if active_only:
        query = query.where(Rack.active == True)
    
    result = await session.execute(query)
    racks = result.scalars().all()
    
    # Format response
    racks_list = []
    for rack in racks:
        # Get images and videos from JSON fields
        def get_product_images(p):
            if p.images_json and isinstance(p.images_json, list):
                return p.images_json
            elif p.image_url:
                return [p.image_url]
            return []
        
        def get_product_videos(p):
            if p.videos_json and isinstance(p.videos_json, list):
                return p.videos_json
            return []
        
        rack_dict = {
            "id": rack.id,
            "name": rack.name,
            "code": rack.code,
            "description": rack.description,
            "location": rack.location,
            "category_name": rack.category_name,
            "category_image_url": rack.category_image_url,
            "active": rack.active,
            "created_at": rack.created_at.isoformat(),
            "updated_at": rack.updated_at.isoformat(),
            "products": [
                {
                    "id": p.id,
                    "rack_id": p.rack_id,
                    "name": p.name,
                    "description": p.description,
                    "image_url": p.image_url,
                    "images": get_product_images(p),
                    "videos": get_product_videos(p),
                    "price": p.price,
                    "stock_quantity": p.stock_quantity,
                    "delivery_time": p.delivery_time,
                    "category": p.category,
                    "status": p.status,
                    "created_at": p.created_at.isoformat(),
                    "updated_at": p.updated_at.isoformat(),
                }
                for p in rack.products
            ],
        }
        racks_list.append(rack_dict)
    
    return racks_list


# Admin Routes
@router.post("/admin", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
async def create_rack(
    rack_data: RackCreate,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Create a new rack (admin only)"""
    from datetime import datetime
    
    rack = Rack(
        name=rack_data.name,
        code=rack_data.code,
        description=rack_data.description,
        location=rack_data.location,
        category_name=rack_data.category_name,
        category_image_url=rack_data.category_image_url,
        active=rack_data.active,
    )
    
    session.add(rack)
    await session.commit()
    await session.refresh(rack)
    
    return {
        "id": rack.id,
        "name": rack.name,
        "code": rack.code,
        "description": rack.description,
        "location": rack.location,
        "category_name": rack.category_name,
        "category_image_url": rack.category_image_url,
        "active": rack.active,
        "created_at": rack.created_at.isoformat(),
        "updated_at": rack.updated_at.isoformat(),
        "products": [],
    }


@router.patch("/admin/{rack_id}", response_model=RackResponse)
async def update_rack(
    rack_id: int,
    rack_data: RackUpdate,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Update a rack (admin only)"""
    result = await session.execute(select(Rack).where(Rack.id == rack_id))
    rack = result.scalar_one_or_none()
    
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    if rack_data.name is not None:
        rack.name = rack_data.name
    if rack_data.code is not None:
        rack.code = rack_data.code
    if rack_data.description is not None:
        rack.description = rack_data.description
    if rack_data.location is not None:
        rack.location = rack_data.location
    if rack_data.category_name is not None:
        rack.category_name = rack_data.category_name
    if rack_data.category_image_url is not None:
        rack.category_image_url = rack_data.category_image_url
    if rack_data.active is not None:
        rack.active = rack_data.active
    
    await session.commit()
    await session.refresh(rack)
    
    # Get images and videos from JSON fields
    def get_product_images(p):
        if p.images_json and isinstance(p.images_json, list):
            return p.images_json
        elif p.image_url:
            return [p.image_url]
        return []
    
    def get_product_videos(p):
        if p.videos_json and isinstance(p.videos_json, list):
            return p.videos_json
        return []
    
    return {
        "id": rack.id,
        "name": rack.name,
        "code": rack.code,
        "description": rack.description,
        "location": rack.location,
        "category_name": rack.category_name,
        "category_image_url": rack.category_image_url,
        "active": rack.active,
        "created_at": rack.created_at.isoformat(),
        "updated_at": rack.updated_at.isoformat(),
        "products": [
            {
                "id": p.id,
                "rack_id": p.rack_id,
                "name": p.name,
                "description": p.description,
                "image_url": p.image_url,
                "images": get_product_images(p),
                "videos": get_product_videos(p),
                "price": p.price,
                "stock_quantity": p.stock_quantity,
                "delivery_time": p.delivery_time,
                "category": p.category,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat(),
            }
            for p in rack.products
        ],
    }


@router.delete("/admin/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rack(
    rack_id: int,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Delete a rack (admin only)"""
    result = await session.execute(select(Rack).where(Rack.id == rack_id))
    rack = result.scalar_one_or_none()
    
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    await session.delete(rack)
    await session.commit()
    
    return None


@router.get("/admin/default-rack")
async def get_or_create_default_rack(
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Get or create a default rack for all products (admin only)"""
    # Try to find existing default rack
    result = await session.execute(select(Rack).where(Rack.code == "DEFAULT").limit(1))
    default_rack = result.scalar_one_or_none()
    
    if not default_rack:
        # Create default rack
        from datetime import datetime
        default_rack = Rack(
            name="All Products",
            code="DEFAULT",
            description="Default rack for all products",
            active=True,
        )
        session.add(default_rack)
        await session.commit()
        await session.refresh(default_rack)
    
    return {
        "id": default_rack.id,
        "name": default_rack.name,
        "code": default_rack.code,
        "description": default_rack.description,
        "location": default_rack.location,
        "category_name": default_rack.category_name,
        "category_image_url": default_rack.category_image_url,
        "active": default_rack.active,
        "created_at": default_rack.created_at.isoformat(),
        "updated_at": default_rack.updated_at.isoformat(),
        "products": [],
    }


@router.post("/admin/{rack_id}/products", response_model=RackProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    rack_id: int,
    product_data: RackProductCreate,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Create a new product for a rack (admin only)"""
    # Verify rack exists
    rack_result = await session.execute(select(Rack).where(Rack.id == rack_id))
    rack = rack_result.scalar_one_or_none()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    import json
    product = RackProduct(
        rack_id=rack_id,
        name=product_data.name,
        description=product_data.description,
        image_url=product_data.image_url,
        images_json=json.dumps(product_data.images) if product_data.images else None,
        videos_json=json.dumps(product_data.videos) if product_data.videos else None,
        price=product_data.price,
        stock_quantity=product_data.stock_quantity,
        delivery_time=product_data.delivery_time,
        category=product_data.category,
        status=product_data.status,
    )
    
    session.add(product)
    await session.commit()
    await session.refresh(product)
    
    # Parse JSON fields for response
    images = json.loads(product.images_json) if product.images_json else []
    if not images and product.image_url:
        images = [product.image_url]
    videos = json.loads(product.videos_json) if product.videos_json else []
    
    return {
        "id": product.id,
        "rack_id": product.rack_id,
        "name": product.name,
        "description": product.description,
        "image_url": product.image_url,
        "images": images,
        "videos": videos,
        "price": product.price,
        "stock_quantity": product.stock_quantity,
        "delivery_time": product.delivery_time,
        "category": product.category,
        "status": product.status,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
    }


@router.patch("/admin/products/{product_id}", response_model=RackProductResponse)
async def update_product(
    product_id: int,
    product_data: RackProductUpdate,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Update a product (admin only)"""
    result = await session.execute(select(RackProduct).where(RackProduct.id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    import json
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.description is not None:
        product.description = product_data.description
    if product_data.image_url is not None:
        product.image_url = product_data.image_url
    if product_data.images is not None:
        product.images_json = json.dumps(product_data.images)
    if product_data.videos is not None:
        product.videos_json = json.dumps(product_data.videos)
    if product_data.price is not None:
        product.price = product_data.price
    if product_data.stock_quantity is not None:
        product.stock_quantity = product_data.stock_quantity
    if product_data.delivery_time is not None:
        product.delivery_time = product_data.delivery_time
    if product_data.category is not None:
        product.category = product_data.category
    if product_data.status is not None:
        product.status = product_data.status
    
    await session.commit()
    await session.refresh(product)
    
    # Parse JSON fields for response
    images = json.loads(product.images_json) if product.images_json else []
    if not images and product.image_url:
        images = [product.image_url]
    videos = json.loads(product.videos_json) if product.videos_json else []
    
    return {
        "id": product.id,
        "rack_id": product.rack_id,
        "name": product.name,
        "description": product.description,
        "image_url": product.image_url,
        "images": images,
        "videos": videos,
        "price": product.price,
        "stock_quantity": product.stock_quantity,
        "delivery_time": product.delivery_time,
        "category": product.category,
        "status": product.status,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
    }


@router.delete("/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Delete a product (admin only)"""
    result = await session.execute(select(RackProduct).where(RackProduct.id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await session.delete(product)
    await session.commit()
    
    return None


@router.post("/admin/{rack_id}/generate-qr", response_model=dict)
async def generate_qr_code(
    rack_id: int,
    session: AsyncSession = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    """Generate QR code for a rack (admin only)"""
    result = await session.execute(select(Rack).where(Rack.id == rack_id))
    rack = result.scalar_one_or_none()
    
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    import qrcode
    import io
    import base64
    from ..core import settings
    
    # Generate QR code URL
    rack_url = f"{settings.WEB_APP_URL}/rack/{rack.code}"
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(rack_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    qr_code_url = f"data:image/png;base64,{qr_code_base64}"
    
    return {
        "qr_code_base64": qr_code_base64,
        "qr_code_url": qr_code_url,
        "rack_url": rack_url,
    }


# Rack Orders
class RackOrderCreate(BaseModel):
    rack_id: Optional[int] = None  # Optional - will use default rack if not provided
    cart_items: List[dict]
    total_amount: float
    original_amount: Optional[float] = None
    applied_offer_id: Optional[int] = None
    discount_amount: Optional[float] = None
    surprise_gift: Optional[dict] = None
    payment_id: Optional[str] = None


class RackOrderResponse(BaseModel):
    id: int
    user_id: int
    rack_id: int
    order_reference: str
    total_amount: float
    original_amount: Optional[float] = None
    items_json: List[dict]
    applied_offer_id: Optional[int] = None
    discount_amount: Optional[float] = None
    is_surprise_gift: bool
    recipient_name: Optional[str] = None
    recipient_mobile: Optional[str] = None
    delivery_address: Optional[str] = None
    pin_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    occasion_type: Optional[str] = None
    birthday_date: Optional[str] = None
    personal_message: Optional[str] = None
    payment_id: Optional[str] = None
    payment_status: str
    status: str
    created_at: str
    updated_at: str
    surprise_gift_name: Optional[str] = None
    surprise_gift_image_url: Optional[str] = None


@router.post("/orders", response_model=RackOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_rack_order(
    order_data: RackOrderCreate,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Create a new rack order after payment"""
    import uuid
    from datetime import datetime
    
    # If rack_id is not provided, use default rack
    rack_id = order_data.rack_id
    if not rack_id:
        # Get or create default rack
        rack_result = await session.execute(select(Rack).where(Rack.code == "DEFAULT").limit(1))
        default_rack = rack_result.scalar_one_or_none()
        if not default_rack:
            default_rack = Rack(
                name="All Products",
                code="DEFAULT",
                description="Default rack for all products",
                active=True,
            )
            session.add(default_rack)
            await session.commit()
            await session.refresh(default_rack)
        rack_id = default_rack.id
    
    # Validate rack exists
    rack_result = await session.execute(select(Rack).where(Rack.id == rack_id))
    rack = rack_result.scalar_one_or_none()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    # Generate order reference
    order_ref = "RO-" + uuid.uuid4().hex[:10].upper()
    
    # Parse surprise gift data if present
    surprise_gift = order_data.surprise_gift or {}
    birthday_date = None
    if surprise_gift.get('birthday_date'):
        try:
            # Handle both date string and datetime
            if isinstance(surprise_gift['birthday_date'], str):
                birthday_date = datetime.fromisoformat(surprise_gift['birthday_date'].replace('Z', '+00:00'))
            else:
                birthday_date = surprise_gift['birthday_date']
        except (ValueError, AttributeError):
            birthday_date = None
    
    # Get surprise gift info from offer if available
    surprise_gift_name = None
    surprise_gift_image_url = None
    if order_data.applied_offer_id:
        from ..models import Offer
        offer_result = await session.execute(
            select(Offer).where(Offer.id == order_data.applied_offer_id)
        )
        offer = offer_result.scalar_one_or_none()
        if offer:
            surprise_gift_name = offer.surprise_gift_name
            surprise_gift_image_url = offer.surprise_gift_image_url
    
    # Create rack order
    rack_order = RackOrder(
        user_id=current_user.id,
        rack_id=order_data.rack_id,
        order_reference=order_ref,
        total_amount=order_data.total_amount,
        original_amount=order_data.original_amount,
        items_json=order_data.cart_items,
        applied_offer_id=order_data.applied_offer_id,
        discount_amount=order_data.discount_amount,
        is_surprise_gift=bool(surprise_gift) or bool(surprise_gift_name),
        recipient_name=surprise_gift.get('recipient_name'),
        recipient_mobile=surprise_gift.get('recipient_mobile'),
        delivery_address=surprise_gift.get('delivery_address'),
        pin_code=surprise_gift.get('pin_code'),
        city=surprise_gift.get('city'),
        state=surprise_gift.get('state'),
        occasion_type=surprise_gift.get('occasion_type'),
        birthday_date=birthday_date,
        personal_message=surprise_gift.get('personal_message'),
        payment_id=order_data.payment_id,
        payment_status="completed" if order_data.payment_id else "pending",
        status="confirmed"
    )
    
    session.add(rack_order)
    await session.commit()
    await session.refresh(rack_order)
    
    return {
        "id": rack_order.id,
        "user_id": rack_order.user_id,
        "rack_id": rack_order.rack_id,
        "order_reference": rack_order.order_reference,
        "total_amount": rack_order.total_amount,
        "original_amount": rack_order.original_amount,
        "items_json": rack_order.items_json,
        "applied_offer_id": rack_order.applied_offer_id,
        "discount_amount": rack_order.discount_amount,
        "is_surprise_gift": rack_order.is_surprise_gift,
        "recipient_name": rack_order.recipient_name,
        "recipient_mobile": rack_order.recipient_mobile,
        "delivery_address": rack_order.delivery_address,
        "pin_code": rack_order.pin_code,
        "city": rack_order.city,
        "state": rack_order.state,
        "occasion_type": rack_order.occasion_type,
        "birthday_date": rack_order.birthday_date.isoformat() if rack_order.birthday_date else None,
        "personal_message": rack_order.personal_message,
        "payment_id": rack_order.payment_id,
        "payment_status": rack_order.payment_status,
        "status": rack_order.status,
        "created_at": rack_order.created_at.isoformat(),
        "updated_at": rack_order.updated_at.isoformat(),
        "surprise_gift_name": surprise_gift_name,
        "surprise_gift_image_url": surprise_gift_image_url,
    }


@router.get("/orders/{order_id}", response_model=RackOrderResponse)
async def get_rack_order(
    order_id: int,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Get a rack order by ID"""
    result = await session.execute(
        select(RackOrder).where(RackOrder.id == order_id)
    )
    rack_order = result.scalar_one_or_none()
    
    if not rack_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if user owns this order
    if rack_order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to view this order")
    
    # Get surprise gift info from offer if available
    surprise_gift_name = None
    surprise_gift_image_url = None
    if rack_order.applied_offer_id:
        from ..models import Offer
        offer_result = await session.execute(
            select(Offer).where(Offer.id == rack_order.applied_offer_id)
        )
        offer = offer_result.scalar_one_or_none()
        if offer:
            surprise_gift_name = offer.surprise_gift_name
            surprise_gift_image_url = offer.surprise_gift_image_url
    
    return {
        "id": rack_order.id,
        "user_id": rack_order.user_id,
        "rack_id": rack_order.rack_id,
        "order_reference": rack_order.order_reference,
        "total_amount": rack_order.total_amount,
        "original_amount": rack_order.original_amount,
        "items_json": rack_order.items_json,
        "applied_offer_id": rack_order.applied_offer_id,
        "discount_amount": rack_order.discount_amount,
        "is_surprise_gift": rack_order.is_surprise_gift,
        "recipient_name": rack_order.recipient_name,
        "recipient_mobile": rack_order.recipient_mobile,
        "delivery_address": rack_order.delivery_address,
        "pin_code": rack_order.pin_code,
        "city": rack_order.city,
        "state": rack_order.state,
        "occasion_type": rack_order.occasion_type,
        "birthday_date": rack_order.birthday_date.isoformat() if rack_order.birthday_date else None,
        "personal_message": rack_order.personal_message,
        "payment_id": rack_order.payment_id,
        "payment_status": rack_order.payment_status,
        "status": rack_order.status,
        "created_at": rack_order.created_at.isoformat(),
        "updated_at": rack_order.updated_at.isoformat(),
        "surprise_gift_name": surprise_gift_name,
        "surprise_gift_image_url": surprise_gift_image_url,
    }


class SurpriseGiftDetailsUpdate(BaseModel):
    recipient_name: str
    recipient_mobile: str
    delivery_address: str
    pin_code: str
    city: str
    state: str
    occasion_type: Optional[str] = None
    birthday_date: Optional[str] = None
    personal_message: Optional[str] = None


@router.post("/orders/{order_id}/surprise-gift-details", response_model=RackOrderResponse)
async def update_surprise_gift_details(
    order_id: int,
    details: SurpriseGiftDetailsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Update surprise gift delivery details for a rack order"""
    from datetime import datetime
    
    result = await session.execute(
        select(RackOrder).where(RackOrder.id == order_id)
    )
    rack_order = result.scalar_one_or_none()
    
    if not rack_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if user owns this order
    if rack_order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this order")
    
    # Parse birthday date if provided
    birthday_date = None
    if details.birthday_date:
        try:
            birthday_date = datetime.fromisoformat(details.birthday_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            birthday_date = None
    
    # Update the order
    rack_order.recipient_name = details.recipient_name
    rack_order.recipient_mobile = details.recipient_mobile
    rack_order.delivery_address = details.delivery_address
    rack_order.pin_code = details.pin_code
    rack_order.city = details.city
    rack_order.state = details.state
    rack_order.occasion_type = details.occasion_type
    rack_order.birthday_date = birthday_date
    rack_order.personal_message = details.personal_message
    rack_order.is_surprise_gift = True
    
    await session.commit()
    await session.refresh(rack_order)
    
    # Get surprise gift info from offer if available
    surprise_gift_name = None
    surprise_gift_image_url = None
    if rack_order.applied_offer_id:
        from ..models import Offer
        offer_result = await session.execute(
            select(Offer).where(Offer.id == rack_order.applied_offer_id)
        )
        offer = offer_result.scalar_one_or_none()
        if offer:
            surprise_gift_name = offer.surprise_gift_name
            surprise_gift_image_url = offer.surprise_gift_image_url
    
    return {
        "id": rack_order.id,
        "user_id": rack_order.user_id,
        "rack_id": rack_order.rack_id,
        "order_reference": rack_order.order_reference,
        "total_amount": rack_order.total_amount,
        "original_amount": rack_order.original_amount,
        "items_json": rack_order.items_json,
        "applied_offer_id": rack_order.applied_offer_id,
        "discount_amount": rack_order.discount_amount,
        "is_surprise_gift": rack_order.is_surprise_gift,
        "recipient_name": rack_order.recipient_name,
        "recipient_mobile": rack_order.recipient_mobile,
        "delivery_address": rack_order.delivery_address,
        "pin_code": rack_order.pin_code,
        "city": rack_order.city,
        "state": rack_order.state,
        "occasion_type": rack_order.occasion_type,
        "birthday_date": rack_order.birthday_date.isoformat() if rack_order.birthday_date else None,
        "personal_message": rack_order.personal_message,
        "payment_id": rack_order.payment_id,
        "payment_status": rack_order.payment_status,
        "status": rack_order.status,
        "created_at": rack_order.created_at.isoformat(),
        "updated_at": rack_order.updated_at.isoformat(),
        "surprise_gift_name": surprise_gift_name,
        "surprise_gift_image_url": surprise_gift_image_url,
    }


@router.get("/admin/orders")
async def list_rack_orders_admin(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    admin = Depends(get_current_admin)
):
    """List all rack orders (admin only)"""
    from ..models import User
    
    stmt = (
        select(RackOrder, User.first_name, User.last_name, User.username, User.mobile)
        .join(User, User.id == RackOrder.user_id)
        .order_by(RackOrder.created_at.desc())
    )
    
    if status:
        stmt = stmt.where(RackOrder.status == status)
    if payment_status:
        stmt = stmt.where(RackOrder.payment_status == payment_status)
    
    result = await session.execute(stmt)
    rows = result.all()
    
    orders_list = []
    for rack_order, first_name, last_name, username, mobile in rows:
        # Get surprise gift info from offer if available
        surprise_gift_name = None
        surprise_gift_image_url = None
        if rack_order.applied_offer_id:
            from ..models import Offer
            offer_result = await session.execute(
                select(Offer).where(Offer.id == rack_order.applied_offer_id)
            )
            offer = offer_result.scalar_one_or_none()
            if offer:
                surprise_gift_name = offer.surprise_gift_name
                surprise_gift_image_url = offer.surprise_gift_image_url
        
        # Get user name
        user_name = f"{first_name} {last_name}".strip() if first_name or last_name else username or "Unknown"
        
        orders_list.append({
            "id": rack_order.id,
            "user_id": rack_order.user_id,
            "user_name": user_name,
            "user_mobile": mobile,
            "rack_id": rack_order.rack_id,
            "order_reference": rack_order.order_reference,
            "total_amount": rack_order.total_amount,
            "original_amount": rack_order.original_amount,
            "items_json": rack_order.items_json,
            "applied_offer_id": rack_order.applied_offer_id,
            "discount_amount": rack_order.discount_amount,
            "is_surprise_gift": rack_order.is_surprise_gift,
            "recipient_name": rack_order.recipient_name,
            "recipient_mobile": rack_order.recipient_mobile,
            "delivery_address": rack_order.delivery_address,
            "pin_code": rack_order.pin_code,
            "city": rack_order.city,
            "state": rack_order.state,
            "occasion_type": rack_order.occasion_type,
            "birthday_date": rack_order.birthday_date.isoformat() if rack_order.birthday_date else None,
            "personal_message": rack_order.personal_message,
            "payment_id": rack_order.payment_id,
            "payment_status": rack_order.payment_status,
            "status": rack_order.status,
            "created_at": rack_order.created_at.isoformat(),
            "updated_at": rack_order.updated_at.isoformat(),
            "surprise_gift_name": surprise_gift_name,
            "surprise_gift_image_url": surprise_gift_image_url,
        })
    
    return {"orders": orders_list}
