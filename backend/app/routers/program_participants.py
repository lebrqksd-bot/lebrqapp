from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy import func, case

from app.models import ProgramParticipant, User, Booking
from app.db import get_db
from app.auth import get_current_user

router = APIRouter(
    prefix="/program_participants",
    tags=["program_participants"]
)

# Cap large result sets to prevent long-running queries blocking other requests
MAX_LIST_ROWS = 200


# =========================
# SCHEMAS
# =========================

class ParticipantCreate(BaseModel):
    user_id: Optional[int] = None
    name: str
    mobile: str
    program_type: str
    subscription_type: Optional[str] = None
    ticket_quantity: int = 1
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    amount_paid: Optional[float] = None
    booking_id: Optional[int] = None


class ParticipantVerify(BaseModel):
    is_verified: bool


# =========================
# CREATE PARTICIPANT
# =========================

@router.post("/add", response_model=dict)
def add_participant(
    payload: ParticipantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.booking_id:
        booking = (
            db.query(Booking)
            .filter(Booking.id == payload.booking_id)
            .first()
        )
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

    is_admin = current_user.role == "admin"
    effective_user_id = payload.user_id

    if not is_admin:
        if effective_user_id and effective_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only create participants for yourself"
            )
        effective_user_id = current_user.id
    else:
        if effective_user_id is None:
            effective_user_id = current_user.id

    start_dt = (
        datetime.fromisoformat(payload.start_date.replace("Z", "+00:00"))
        if payload.start_date else None
    )
    end_dt = (
        datetime.fromisoformat(payload.end_date.replace("Z", "+00:00"))
        if payload.end_date else None
    )

    participant = ProgramParticipant(
        user_id=effective_user_id,
        name=payload.name,
        mobile=payload.mobile,
        program_type=payload.program_type,
        subscription_type=payload.subscription_type,
        ticket_quantity=payload.ticket_quantity,
        booking_id=payload.booking_id,
        start_date=start_dt,
        end_date=end_dt,
        amount_paid=payload.amount_paid,
        is_active=True,
        joined_at=datetime.utcnow(),
    )

    if hasattr(participant, "metadata_json"):
        meta = dict(participant.metadata_json or {})
        if payload.booking_id:
            meta["booking_id"] = payload.booking_id
        participant.metadata_json = meta

    db.add(participant)
    db.commit()
    db.refresh(participant)

    return {
        "success": True,
        "id": participant.id,
        "booking_id": payload.booking_id
    }


# =========================
# COUNTS BY PROGRAM TYPE
# =========================

@router.get("/counts/{program_type}", response_model=dict)
def get_counts_by_program_type(
    program_type: str,
    db: Session = Depends(get_db)
):
    rows = (
        db.query(
            ProgramParticipant.booking_id,
            func.coalesce(func.sum(ProgramParticipant.ticket_quantity), 0)
        )
        .filter(ProgramParticipant.program_type == program_type)
        .filter(ProgramParticipant.booking_id.isnot(None))
        .group_by(ProgramParticipant.booking_id)
        .all()
    )

    return {str(bid): int(total) for bid, total in rows}


# =========================
# COUNTS BY MULTIPLE BOOKINGS
# =========================

@router.get("/counts/by-bookings", response_model=dict)
def get_counts_by_bookings(
    ids: str,
    db: Session = Depends(get_db)
):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    if not id_list:
        return {}

    rows = (
        db.query(
            ProgramParticipant.booking_id.label("bid"),
            func.count(ProgramParticipant.id).label("total"),
            func.coalesce(
                func.sum(
                    case(
                        (ProgramParticipant.is_verified.is_(True), 1),
                        else_=0
                    )
                ),
                0
            ).label("verified")
        )
        .filter(ProgramParticipant.booking_id.in_(id_list))
        .group_by(ProgramParticipant.booking_id)
        .all()
    )

    result = {
        str(r.bid): {
            "total": int(r.total),
            "verified": int(r.verified)
        }
        for r in rows
    }

    for bid in id_list:
        result.setdefault(str(bid), {"total": 0, "verified": 0})

    return result


# =========================
# LIST PARTICIPANTS BY BOOKING
# =========================

@router.get("/by-booking/{booking_id}", response_model=List[dict])
def list_participants_by_booking(
    booking_id: int,
    db: Session = Depends(get_db)
):
    participants = (
        db.query(ProgramParticipant)
        .filter(ProgramParticipant.booking_id == booking_id)
        .order_by(ProgramParticipant.joined_at.desc())
        .limit(MAX_LIST_ROWS)
        .all()
    )

    user_ids = {p.user_id for p in participants if p.user_id}
    users_map = {}

    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "user_email": getattr(users_map.get(p.user_id), "username", None),
            "name": p.name,
            "mobile": p.mobile,
            "program_type": p.program_type,
            "subscription_type": p.subscription_type,
            "ticket_quantity": p.ticket_quantity,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "amount_paid": p.amount_paid,
            "is_active": p.is_active,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            "is_verified": p.is_verified,
            "scan_count": p.scan_count or 0,
            "booking_id": p.booking_id,
        }
        for p in participants
    ]


# =========================
# LIST CURRENT USER PARTICIPANTS
# =========================

@router.get("/list/{program_type}", response_model=List[dict])
def list_participants(
    program_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    paid_statuses = ["paid", "approved", "confirmed"]

    participants = (
        db.query(ProgramParticipant)
        .join(
            Booking,
            ProgramParticipant.booking_id == Booking.id,
            isouter=True
        )
        .filter(ProgramParticipant.program_type == program_type)
        .filter(ProgramParticipant.user_id == current_user.id)
        .filter(
            (
                ProgramParticipant.amount_paid.isnot(None)
                & (ProgramParticipant.amount_paid > 0)
            )
            |
            (
                ProgramParticipant.booking_id.isnot(None)
                & Booking.status.in_(paid_statuses)
                & (
                    (Booking.is_admin_booking.is_(False))
                    | (Booking.is_admin_booking.is_(None))
                )
            )
        )
        .order_by(ProgramParticipant.joined_at.desc())
        .limit(MAX_LIST_ROWS)
        .all()
    )

    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "name": p.name,
            "mobile": p.mobile,
            "program_type": p.program_type,
            "subscription_type": p.subscription_type,
            "ticket_quantity": p.ticket_quantity,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "amount_paid": p.amount_paid,
            "is_active": p.is_active,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            "is_verified": p.is_verified,
            "scan_count": p.scan_count or 0,
            "booking_id": p.booking_id,
        }
        for p in participants
    ]


# =========================
# VERIFY PARTICIPANT
# =========================

@router.patch("/{participant_id}/verify", response_model=dict)
def verify_participant(
    participant_id: int,
    payload: ParticipantVerify,
    db: Session = Depends(get_db)
):
    participant = (
        db.query(ProgramParticipant)
        .filter(ProgramParticipant.id == participant_id)
        .first()
    )

    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if payload.is_verified:
        participant.scan_count = (participant.scan_count or 0) + 1
        if participant.scan_count >= (participant.ticket_quantity or 1):
            participant.is_verified = True
            participant.verified_at = datetime.utcnow()
    else:
        participant.is_verified = False
        participant.scan_count = 0
        participant.verified_at = None

    if participant.is_verified and participant.booking_id:
        booking = (
            db.query(Booking)
            .filter(Booking.id == participant.booking_id)
            .first()
        )
        if booking and booking.status not in ["completed", "finished", "arrived"]:
            booking.status = "arrived"

    db.commit()
    db.refresh(participant)

    return {
        "success": True,
        "id": participant.id,
        "is_verified": participant.is_verified,
        "scan_count": participant.scan_count,
        "ticket_quantity": participant.ticket_quantity,
        "verified_at": participant.verified_at.isoformat()
        if participant.verified_at else None,
    }
