from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, text
from datetime import datetime
from typing import Optional, Dict, Any
import asyncio
import logging
import gc
import httpx

from app.db import get_db, AsyncSessionLocal
from app.models import User, Booking, Payment, ProgramParticipant, Space, Venue
from app.auth import get_current_user
from app.razorpay_service import get_razorpay_service
from app.notifications import NotificationService
from app.schemas import (
    PaymentStatusResponse,
    AdvancePaymentSettingsResponse,
    AdvancePaymentSettingsRequest
)

# Import event ticketing models (if available)
try:
    from app.models_events import EventSchedule, EventDefinition
    EVENT_TICKETING_ENABLED = True
except ImportError:
    EVENT_TICKETING_ENABLED = False

logger = logging.getLogger(__name__)

# Razorpay API base URL for async client
RAZORPAY_API_URL = "https://api.razorpay.com/v1"

def _get_async_client(req: Optional[Request], key_id: str, key_secret: str) -> httpx.AsyncClient:
    """Create a pooled async HTTP client for Razorpay with basic auth.

    Uses sane timeouts and connection limits to avoid resource exhaustion.
    """
    timeout = httpx.Timeout(15.0, connect=5.0)
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    headers = {
        "User-Agent": "LebrQ-Payment-Service/1.0",
        "Content-Type": "application/json",
    }
    return httpx.AsyncClient(
        base_url=RAZORPAY_API_URL,
        auth=(key_id, key_secret),
        timeout=timeout,
        limits=limits,
        headers=headers,
    )

# Router prefix should NOT include the global API prefix.
# core.py includes this router with prefix=settings.API_PREFIX ("/api").
# Use "/payments" here so the final path becomes "/api/payments/...".
router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

# -------------------------------------------------------------------
# Admin dependency
# -------------------------------------------------------------------
def admin_required(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

# -------------------------------------------------------------------
# Payment Prepare
# -------------------------------------------------------------------
@router.post("/prepare")
async def prepare_payment(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Prepare a payment.

    Supports two modes:
    - With booking_id: validates ownership and state, returns booking amount & details.
    - Without booking_id: returns provided amount/currency for pre-confirmation UI.
    """
    booking_id = payload.get("booking_id")
    if booking_id is not None:
        booking = db.query(Booking).filter(
            Booking.id == int(booking_id),
            Booking.user_id == user.id
        ).first()

        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        if booking.status not in ("pending", "confirmed"):
            raise HTTPException(status_code=400, detail="Invalid booking state")

        return {
            "success": True,
            "booking_id": booking.id,
            "amount": float(booking.total_amount or 0),
            "currency": "INR",
            "booking_type": getattr(booking, "booking_type", None)
        }

    # No booking_id provided: use payload values for a lightweight preview
    amount = float(payload.get("amount") or 0)
    currency = str(payload.get("currency") or "INR")
    return {
        "success": True,
        "amount": amount,
        "currency": currency,
    }

# -------------------------------------------------------------------
# Payment Callback Handler
# -------------------------------------------------------------------
async def handle_payment_callback(
    verification_result: dict,
    booking: Booking,
    db: Session
):
    try:
        if verification_result.get("success") and booking:
            
            # --- RESERVE TICKETS IN EVENT SCHEDULE ---
            # This should happen FIRST before creating participants
            event_schedule_id = getattr(booking, 'event_schedule_id', None)
            event_definition_id = getattr(booking, 'event_definition_id', None)
            
            if EVENT_TICKETING_ENABLED and event_schedule_id:
                try:
                    schedule = db.query(EventSchedule).filter(
                        EventSchedule.id == event_schedule_id
                    ).with_for_update().first()  # Lock row for atomic update
                    
                    if schedule:
                        quantity = booking.attendees or 1
                        tickets_available = schedule.max_tickets - schedule.tickets_sold
                        
                        if tickets_available >= quantity:
                            schedule.tickets_sold += quantity
                            db.commit()
                            logger.info(f"Reserved {quantity} tickets for schedule {schedule.id}")
                        else:
                            # Race condition: not enough tickets
                            logger.error(
                                f"Ticket oversold for schedule {schedule.id}. "
                                f"Available: {tickets_available}, Requested: {quantity}"
                            )
                            # Don't fail the payment, but log for manual resolution
                except Exception as e:
                    logger.error(f"Failed to reserve tickets: {e}")
                    db.rollback()

            # --- LIVE SHOW PARTICIPANT ---
            if booking.booking_type == "live-":
                user = db.query(User).filter(User.id == booking.user_id).first()
                if user:
                    existing = db.query(ProgramParticipant).filter(
                        ProgramParticipant.booking_id == booking.id,
                        ProgramParticipant.user_id == user.id,
                        ProgramParticipant.program_type == "live"
                    ).first()

                    if not existing:
                        participant = ProgramParticipant(
                            user_id=user.id,
                            name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or "User",
                            mobile=user.mobile or "",
                            program_type="live",
                            ticket_quantity=booking.attendees or 1,
                            booking_id=booking.id,
                            start_date=booking.start_datetime,
                            end_date=booking.end_datetime,
                            amount_paid=float(booking.total_amount or 0),
                            is_active=True,
                            is_verified=False,
                            joined_at=datetime.utcnow(),
                        )
                        
                        # Link to event schedule if available
                        try:
                            if event_schedule_id:
                                participant.event_schedule_id = event_schedule_id
                            if event_definition_id:
                                participant.event_definition_id = event_definition_id
                        except Exception:
                            pass  # Columns may not exist yet
                        
                        db.add(participant)
                        db.commit()

            # --- Notifications ---
            booking_full = db.query(Booking).options(
                selectinload(Booking.space).selectinload(Space.venue)
            ).filter(Booking.id == booking.id).first()

            async def notify():
                async_db = AsyncSessionLocal()
                try:
                    await NotificationService.send_booking_confirmation_after_payment(
                        booking=booking_full,
                        user=user,
                        space=booking_full.space,
                        venue=booking_full.space.venue if booking_full.space else None,
                        session=async_db
                    )
                finally:
                    await async_db.close()

            asyncio.create_task(notify())

        return {
            "success": verification_result.get("success"),
            "transaction_id": verification_result.get("transaction_id"),
            "order_id": verification_result.get("order_id"),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Callback error: {str(e)}")

# -------------------------------------------------------------------
# Get Payment Status
# -------------------------------------------------------------------
@router.get("/status/{payment_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    payment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    payment = db.query(Payment).filter(
        Payment.provider_payment_id == payment_id,
        Payment.booking_id.in_(
            db.query(Booking.id).filter(Booking.user_id == user.id)
        )
    ).first()

    if not payment:
        raise HTTPException(404, "Payment not found")

    return PaymentStatusResponse(
        payment_id=payment.provider_payment_id or "",
        order_id=payment.order_id,
        amount=payment.amount,
        currency=payment.currency,
        payment_status=payment.status,
        transaction_id=(payment.gateway_response or {}).get("transaction_id"),
        created_at=payment.created_at,
        updated_at=payment.updated_at
    )

# -------------------------------------------------------------------
# Refund Payment
# -------------------------------------------------------------------
@router.post("/refund/{payment_id}")
async def refund_payment(
    payment_id: str,
    refund_amount: float,
    reason: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    payment = db.query(Payment).filter(
        Payment.provider_payment_id == payment_id
    ).first()

    if not payment:
        raise HTTPException(404, "Payment not found")

    if payment.status != "success":
        raise HTTPException(400, "Only successful payments can be refunded")

    payment.status = "refunded"
    payment.gateway_response = {
        **(payment.gateway_response or {}),
        "refund": {
            "amount": refund_amount,
            "reason": reason,
            "date": datetime.utcnow().isoformat()
        }
    }
    db.commit()

    return {"success": True}

# -------------------------------------------------------------------
# Admin Payment List
# -------------------------------------------------------------------
@router.get("/admin/payments")
async def admin_payments(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_required)
):
    per_page = min(per_page, 50)
    gc.collect()

    total = db.query(Payment).count()
    rows = (
        db.query(Payment)
        .order_by(desc(Payment.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "success": True,
        "total": total,
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "status": p.status,
                "order_id": p.order_id,
                "created_at": p.created_at,
            }
            for p in rows
        ]
    }

# -------------------------------------------------------------------
# Advance Payment Settings (GET)
# -------------------------------------------------------------------
@router.get(
    "/admin/settings/advance-payment",
    response_model=AdvancePaymentSettingsResponse
)
async def get_advance_payment_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(admin_required)
):
    result = db.execute(text("""
        SELECT setting_key, value FROM admin_settings
        WHERE setting_key IN (
            'advance_payment_enabled',
            'advance_payment_percentage',
            'advance_payment_fixed_amount',
            'advance_payment_type'
        )
    """))

    data = {r[0]: r[1] for r in result}

    return AdvancePaymentSettingsResponse(
        enabled=data.get("advance_payment_enabled", "true") == "true",
        percentage=float(data.get("advance_payment_percentage", 50)),
        fixed_amount=float(data.get("advance_payment_fixed_amount", 0))
        if data.get("advance_payment_type") == "fixed" else None,
        type=data.get("advance_payment_type", "percentage")
    )

# -------------------------------------------------------------------
# Advance Payment Settings (POST)
# -------------------------------------------------------------------
@router.post("/admin/settings/advance-payment")
async def update_advance_payment_settings(
    req: AdvancePaymentSettingsRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_required)
):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE,
            value TEXT
        )
    """))

    settings = [
        ("advance_payment_enabled", "true" if req.enabled else "false"),
        ("advance_payment_type", req.type),
        ("advance_payment_percentage", str(req.percentage or 0)),
        ("advance_payment_fixed_amount", str(req.fixed_amount or 0)),
    ]

    for k, v in settings:
        db.execute(text("""
            INSERT INTO admin_settings (setting_key, value)
            VALUES (:k, :v)
            ON DUPLICATE KEY UPDATE value = :v
        """), {"k": k, "v": v})

    db.commit()
    return {"success": True}

# -------------------------------------------------------------------
# Create Razorpay Order
# -------------------------------------------------------------------
@router.post("/create-razorpay-order")
async def create_razorpay_order(
    request: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    req: Request = None,
):
    """
    Create a Razorpay order for payment processing.
    Requires authentication.
    """
    max_retries = 2
    base_backoff = 0.5  # seconds

    try:
        logger.info(f"Creating Razorpay order request from user {current_user.id}: {request}")

        # Validate request
        if not isinstance(request, dict):
            raise HTTPException(status_code=400, detail="Invalid request format")

        amount = request.get("amount", 0)
        currency = request.get("currency", "INR")

        # Validate amount
        try:
            amount = int(float(amount))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Amount must be a valid number. Received: {amount}")

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0 paise")
        if amount < 100:
            raise HTTPException(status_code=400, detail="Minimum payment amount is ₹1 (100 paise)")

        # Initialize Razorpay service
        razorpay_service = get_razorpay_service()
        if not razorpay_service.is_configured():
            raise HTTPException(status_code=503, detail="Payment service is not configured. Please contact support.")

        key_id = getattr(razorpay_service, "key_id", None)
        key_secret = getattr(razorpay_service, "key_secret", None)
        client = _get_async_client(req, key_id, key_secret)

        # Build payload
        receipt_id = f"order_{int(datetime.now().timestamp())}_{current_user.id}"
        payload = {
            "amount": amount,
            "currency": currency,
            "receipt": receipt_id,
            "description": "LebrQ Payment",
            "notes": {
                "user_id": current_user.id,
                "user_name": f"{(current_user.first_name or '').strip()} {(current_user.last_name or '').strip()}".strip() or current_user.username or "Guest",
            },
        }

        last_error: Optional[str] = None
        response_json: Optional[Dict[str, Any]] = None

        try:
            for attempt in range(1, max_retries + 1):
                try:
                    t0 = asyncio.get_event_loop().time()
                    resp = await client.post("/orders", json=payload)
                    latency_ms = (asyncio.get_event_loop().time() - t0) * 1000.0
                    key_preview = (key_id or "")[:8]
                    logger.info(f"[Razorpay] create_order latency: {latency_ms:.0f} ms (attempt {attempt}) key={key_preview}...")

                    if resp.is_success:
                        response_json = resp.json()
                        break

                    try:
                        err_json = resp.json()
                        err_detail = err_json.get("error", {}).get("description", str(err_json))
                    except Exception:
                        err_detail = (resp.text or "HTTP error")[0:200]
                    status_code = resp.status_code

                    if status_code in (429, 500, 502, 503, 504) and attempt < max_retries:
                        delay = base_backoff * (2 ** (attempt - 1))
                        logger.warning(f"Retrying Razorpay (attempt {attempt}/{max_retries}) in {delay:.1f}s...")
                        await asyncio.sleep(delay)
                        continue

                    last_error = f"HTTP {status_code}: {err_detail}"
                    break

                except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TransportError) as e:
                    last_error = f"{type(e).__name__}: {str(e)}"
                    if attempt < max_retries:
                        delay = base_backoff * (2 ** (attempt - 1))
                        logger.warning(f"Razorpay transient error, retrying in {delay:.1f}s...")
                        await asyncio.sleep(delay)
                        continue
                    break
                except Exception as e:
                    last_error = f"unexpected_error: {str(e)}"
                    logger.error(f"[Razorpay] Unexpected error: {last_error}", exc_info=True)
                    break
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

        if response_json is None:
            status = 503 if last_error and any(k in last_error for k in ["timeout", "transport", "502", "503", "504"]) else 502
            logger.error(f"[Payment] Razorpay order creation failed: {last_error}")
            return JSONResponse(
                status_code=status,
                content={
                    "success": False,
                    "message": "Payment service is temporarily unavailable. Please try again in a few minutes. If the issue persists, contact support.",
                    "error_id": "razorpay_order_failed",
                },
            )

        order_id = str(response_json.get("id") or response_json.get("order_id") or "").strip()
        if not order_id:
            logger.error(f"[Razorpay Order] Invalid response (missing id): {response_json}")
            return JSONResponse(
                status_code=502,
                content={
                    "success": False,
                    "message": "Payment service encountered an error. Please try again or contact support.",
                    "error_id": "razorpay_invalid_response",
                },
            )
        logger.info(f"[Razorpay Order] ✓ Created order: {order_id} amount: {amount} paise user={current_user.id}")
        gc.collect()

        return JSONResponse(
            content={
                "success": True,
                "id": order_id,
                "order_id": order_id,
                "amount": response_json.get("amount", amount),
                "currency": response_json.get("currency", currency),
                "receipt": response_json.get("receipt"),
                "status": response_json.get("status", "created"),
            }
        )

    except HTTPException as http_exc:
        gc.collect()
        return JSONResponse(
            status_code=http_exc.status_code,
            content={"success": False, "message": str(http_exc.detail), "error_id": "payment_http_exception"},
        )

    except Exception as e:
        logger.error(f"[Payment] Unexpected error creating Razorpay order: {type(e).__name__}: {str(e)}", exc_info=True)
        gc.collect()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Payment service is temporarily unavailable. Please try again later.",
                "error_id": "payment_unexpected_error",
            },
        )
