"""
Vehicle Management API Routes

Complete CRUD operations and availability checking for vehicles
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
import logging
import os
from datetime import datetime

from app.db import get_db
from app.models_vehicles import Vehicle, VehicleBooking
from app.schemas.vehicles import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    VehicleListResponse,
    PriceCalculationRequest,
    PriceCalculationResponse,
    VehicleBookingCreate,
    VehicleBookingResponse,
)
from app.schemas.responses import (
    create_success_response,
    ErrorCodes,
    SuccessCodes,
)
from app.auth import get_current_user, require_role
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# ==================== FILE UPLOAD CONFIG ====================

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads", "vehicles")
)
UPLOAD_URL_PREFIX = "/static/vehicles"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== CLIENT ENDPOINTS ====================

@router.get("/available", response_model=VehicleListResponse)
def get_available_vehicles(
    guests: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.vehicle_capacity >= guests,
            Vehicle.is_active.is_(True)
        )
        .order_by(Vehicle.vehicle_capacity.asc())
        .all()
    )

    return {
        "vehicles": vehicles,
        "total_count": len(vehicles),
        "available_count": len(vehicles),
    }


@router.post("/calculate-price", response_model=PriceCalculationResponse)
def calculate_transportation_price(
    data: PriceCalculationRequest,
    db: Session = Depends(get_db),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    if not vehicle or not vehicle.is_active:
        raise HTTPException(
            status_code=404,
            detail={"message": "Vehicle not available", "code": ErrorCodes.ITEM_NOT_AVAILABLE}
        )

    base_fare = float(vehicle.base_fare)
    per_km_rate = float(vehicle.per_km_rate)
    distance = float(data.estimated_distance_km)

    chargeable_km = max(distance, vehicle.minimum_km)
    distance_cost = chargeable_km * per_km_rate
    night_charges = float(vehicle.night_charges) if data.is_night else 0.0
    peak_multiplier = float(vehicle.peak_hour_multiplier) if data.is_peak_hour else 1.0
    peak_hour_charges = distance_cost * (peak_multiplier - 1)
    extra_charges = float(vehicle.extra_charges)

    total_cost = (
        base_fare +
        distance_cost +
        night_charges +
        peak_hour_charges +
        extra_charges
    )

    return PriceCalculationResponse(
        vehicle_id=vehicle.id,
        vehicle_name=vehicle.vehicle_name,
        base_fare=Decimal(str(base_fare)),
        per_km_rate=Decimal(str(per_km_rate)),
        distance_cost=Decimal(str(distance_cost)),
        night_charges=Decimal(str(night_charges)),
        peak_hour_charges=Decimal(str(peak_hour_charges)),
        extra_charges=Decimal(str(extra_charges)),
        total_cost=Decimal(str(total_cost)),
        breakdown={
            "chargeable_km": chargeable_km,
            "total_cost": total_cost
        },
    )


# ==================== ADMIN VEHICLES ====================

@router.get("/", response_model=List[VehicleResponse])
def list_all_vehicles(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    min_capacity: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(Vehicle)

    if active_only:
        query = query.filter(Vehicle.is_active.is_(True))

    if min_capacity:
        query = query.filter(Vehicle.vehicle_capacity >= min_capacity)

    return (
        query
        .order_by(Vehicle.vehicle_capacity.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    try:
        vehicle = Vehicle(**data.dict())
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return create_success_response(
            message="Vehicle created",
            code=SuccessCodes.CREATED,
            data={"id": vehicle.id}
        )
    except Exception:
        db.rollback()
        raise


@router.put("/{vehicle_id}")
def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        for k, v in data.dict(exclude_unset=True).items():
            setattr(vehicle, k, v)

        vehicle.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(vehicle)

        return create_success_response(
            message="Vehicle updated",
            code=SuccessCodes.UPDATED,
            data={"id": vehicle.id}
        )
    except Exception:
        db.rollback()
        raise


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.is_active = False
    vehicle.updated_at = datetime.utcnow()
    db.commit()

    return create_success_response(
        message="Vehicle deleted",
        code=SuccessCodes.DELETED,
        data={"id": vehicle.id}
    )


@router.post("/{vehicle_id}/upload-image")
def upload_vehicle_image(
    vehicle_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    filename = f"vehicle_{vehicle_id}_{int(datetime.utcnow().timestamp())}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(contents)

    # Optimize the uploaded image
    optimization_info = None
    try:
        from ..utils.image_optimizer import optimize_image, PILLOW_AVAILABLE
        if PILLOW_AVAILABLE:
            optimized_path, orig_size, opt_size = optimize_image(
                path,
                image_type="thumbnail",
                keep_original=False
            )
            # Update filename if extension changed
            filename = os.path.basename(optimized_path)
            optimization_info = {
                "original_kb": round(orig_size / 1024, 1),
                "optimized_kb": round(opt_size / 1024, 1),
                "reduction_pct": round((1 - opt_size / orig_size) * 100, 1) if orig_size > 0 else 0
            }
    except Exception as opt_err:
        print(f"[VEHICLE] Image optimization failed: {opt_err}")
        # Continue with unoptimized image

    vehicle.vehicle_image = f"{UPLOAD_URL_PREFIX}/{filename}"
    vehicle.updated_at = datetime.utcnow()
    db.commit()

    response_data = {"image_url": vehicle.vehicle_image}
    if optimization_info:
        response_data["optimization"] = optimization_info

    return create_success_response(
        message="Image uploaded",
        code=SuccessCodes.SUCCESS,
        data=response_data
    )


# ==================== VEHICLE BOOKINGS ====================

@router.post("/bookings", response_model=VehicleBookingResponse)
def create_vehicle_booking(
    data: VehicleBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    if not vehicle or not vehicle.is_active:
        raise HTTPException(status_code=400, detail="Vehicle unavailable")

    try:
        booking = VehicleBooking(**data.dict())
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking
    except Exception:
        db.rollback()
        raise


@router.get("/bookings/{booking_id}", response_model=VehicleBookingResponse)
def get_vehicle_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(VehicleBooking).filter(
        VehicleBooking.booking_id == booking_id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Vehicle booking not found")

    return booking


@router.put("/bookings/{vehicle_booking_id}/status")
def update_vehicle_booking_status(
    vehicle_booking_id: int,
    booking_status: str,
    driver_assigned: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    booking = db.query(VehicleBooking).filter(
        VehicleBooking.id == vehicle_booking_id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Vehicle booking not found")

    booking.booking_status = booking_status
    if driver_assigned is not None:
        booking.driver_assigned = driver_assigned
    if notes is not None:
        booking.notes = notes

    booking.updated_at = datetime.utcnow()
    db.commit()

    return create_success_response(
        message="Booking status updated",
        code=SuccessCodes.UPDATED,
        data={"id": booking.id, "status": booking_status}
    )
