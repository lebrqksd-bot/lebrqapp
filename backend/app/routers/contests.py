"""
Contest System API
Handles contest creation, entry submission, moderation, and notifications
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
import uuid
import re
import csv
import io
import logging
from urllib.parse import quote
from pathlib import Path

from ..db import get_session, SyncSessionLocal
from ..models import User, Contest, ContestEntry, ContestEntryFile, ContestNotification, UserEventDate
from ..auth import get_current_user
from ..notifications import NotificationService
from ..core import settings

logger = logging.getLogger(__name__)

# Upload directory for contest files
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "contests"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/contests", tags=["contests"])


# ==================== PYDANTIC SCHEMAS ====================

class PrizeSchema(BaseModel):
    title: str
    qty: int
    details: Optional[str] = None


class ContestCreate(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    start_date: date
    end_date: date
    applicable_event_types: Optional[List[str]] = None
    first_x_winners: Optional[int] = None
    eligibility_criteria: Optional[str] = None
    per_user_limit: int = 1
    auto_approve: bool = False
    prizes: Optional[List[PrizeSchema]] = None
    is_published: bool = False


class ContestUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    applicable_event_types: Optional[List[str]] = None
    first_x_winners: Optional[int] = None
    eligibility_criteria: Optional[str] = None
    per_user_limit: Optional[int] = None
    auto_approve: Optional[bool] = None
    prizes: Optional[List[PrizeSchema]] = None
    is_published: Optional[bool] = None


class ContestResponse(BaseModel):
    id: int
    title: str
    slug: str
    description: Optional[str]
    hero_image_url: Optional[str]
    banner_image_url: Optional[str]
    start_date: date
    end_date: date
    applicable_event_types: Optional[List[str]]
    first_x_winners: Optional[int]
    eligibility_criteria: Optional[str]
    per_user_limit: int
    auto_approve: bool
    prizes: Optional[List[Dict[str, Any]]]
    is_published: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContestEntryCreate(BaseModel):
    participant_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    event_type: str
    event_date: date
    relation: str = "self"
    booking_id: Optional[int] = None
    message: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    owner_phone: Optional[str] = None
    file_urls: List[str] = []  # S3 URLs after upload
    file_names: List[str] = []
    file_types: List[str] = []
    file_sizes: List[int] = []
    consent: bool = False


class ContestEntryResponse(BaseModel):
    id: int
    contest_id: int
    participant_name: str
    email: Optional[str]
    phone: Optional[str]
    event_type: str
    event_date: date
    relation: str
    booking_id: Optional[int]
    message: Optional[str]
    owner_email: Optional[str]
    owner_phone: Optional[str]
    status: str
    admin_note: Optional[str]
    ocr_confidence: Optional[float]
    ocr_date_matches: Optional[bool]
    reference_id: str
    created_at: datetime
    files: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True


class EntryStatusUpdate(BaseModel):
    status: str  # pending, approved, rejected, winner
    admin_note: Optional[str] = None


class BulkEntryUpdate(BaseModel):
    entry_ids: List[int]
    status: str
    admin_note: Optional[str] = None


class NotifyRequest(BaseModel):
    channels: List[str]  # ["email", "whatsapp"]
    message_template: str
    subject: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


# ==================== HELPER FUNCTIONS ====================

def admin_required(user: User = Depends(get_current_user)):
    """Require admin role"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def generate_reference_id() -> str:
    """Generate unique reference ID for contest entry"""
    return f"CT{datetime.utcnow().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


# ==================== ADMIN ROUTES ====================

@router.post("/admin/contests", response_model=ContestResponse)
async def create_contest(
    contest: ContestCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Create a new contest"""
    # Check if slug already exists
    stmt = select(Contest).where(Contest.slug == contest.slug)
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Contest slug already exists")
    
    # Convert prizes to JSON
    prizes_json = None
    if contest.prizes:
        prizes_json = [p.dict() for p in contest.prizes]
    
    db_contest = Contest(
        title=contest.title,
        slug=contest.slug,
        description=contest.description,
        hero_image_url=contest.hero_image_url,
        banner_image_url=contest.banner_image_url,
        start_date=contest.start_date,
        end_date=contest.end_date,
        applicable_event_types=contest.applicable_event_types,
        first_x_winners=contest.first_x_winners,
        eligibility_criteria=contest.eligibility_criteria,
        per_user_limit=contest.per_user_limit,
        auto_approve=contest.auto_approve,
        prizes=prizes_json,
        is_published=contest.is_published,
        created_by_user_id=user.id
    )
    
    session.add(db_contest)
    await session.commit()
    await session.refresh(db_contest)
    
    return db_contest


@router.put("/admin/contests/{contest_id}", response_model=ContestResponse)
async def update_contest(
    contest_id: int,
    contest: ContestUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Update a contest"""
    stmt = select(Contest).where(Contest.id == contest_id)
    result = await session.execute(stmt)
    db_contest = result.scalar_one_or_none()
    
    if not db_contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    # Update fields
    update_data = contest.dict(exclude_unset=True)
    if "prizes" in update_data and update_data["prizes"]:
        update_data["prizes"] = [p if isinstance(p, dict) else p.dict() for p in update_data["prizes"]]
    
    for key, value in update_data.items():
        setattr(db_contest, key, value)
    
    await session.commit()
    await session.refresh(db_contest)
    
    return db_contest


@router.delete("/admin/contests/{contest_id}")
async def delete_contest(
    contest_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Delete a contest"""
    stmt = select(Contest).where(Contest.id == contest_id)
    result = await session.execute(stmt)
    db_contest = result.scalar_one_or_none()
    
    if not db_contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    await session.delete(db_contest)
    await session.commit()
    
    return {"message": "Contest deleted successfully"}


@router.get("/admin/contests", response_model=List[ContestResponse])
async def list_contests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_published: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """List all contests with pagination"""
    stmt = select(Contest)
    
    if is_published is not None:
        stmt = stmt.where(Contest.is_published == is_published)
    
    stmt = stmt.order_by(desc(Contest.created_at)).offset(skip).limit(limit)
    result = await session.execute(stmt)
    contests = result.scalars().all()
    
    return contests


@router.get("/admin/contests/{contest_id}", response_model=ContestResponse)
async def get_contest(
    contest_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Get contest details"""
    stmt = select(Contest).where(Contest.id == contest_id)
    result = await session.execute(stmt)
    db_contest = result.scalar_one_or_none()
    
    if not db_contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    return db_contest


@router.get("/admin/contests/{contest_id}/entries", response_model=List[ContestEntryResponse])
async def list_contest_entries(
    contest_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """List entries for a contest with filters"""
    stmt = select(ContestEntry).where(ContestEntry.contest_id == contest_id)
    
    if status:
        stmt = stmt.where(ContestEntry.status == status)
    if event_type:
        stmt = stmt.where(ContestEntry.event_type == event_type)
    if phone:
        stmt = stmt.where(ContestEntry.phone == phone)
    if email:
        stmt = stmt.where(ContestEntry.email == email)
    
    stmt = stmt.order_by(desc(ContestEntry.created_at)).offset(skip).limit(limit)
    result = await session.execute(stmt)
    entries = result.scalars().all()
    
    # Load files for each entry
    entry_list = []
    for entry in entries:
        files_stmt = select(ContestEntryFile).where(ContestEntryFile.entry_id == entry.id)
        files_result = await session.execute(files_stmt)
        files = files_result.scalars().all()
        
        entry_dict = {
            "id": entry.id,
            "contest_id": entry.contest_id,
            "participant_name": entry.participant_name,
            "email": entry.email,
            "phone": entry.phone,
            "event_type": entry.event_type,
            "event_date": entry.event_date,
            "relation": entry.relation,
            "booking_id": entry.booking_id,
            "message": entry.message,
            "owner_email": entry.owner_email,
            "owner_phone": entry.owner_phone,
            "status": entry.status,
            "admin_note": entry.admin_note,
            "ocr_confidence": entry.ocr_confidence,
            "ocr_date_matches": entry.ocr_date_matches,
            "reference_id": entry.reference_id,
            "created_at": entry.created_at,
            "files": [
                {
                    "id": f.id,
                    "file_url": f.file_url,
                    "file_name": f.file_name,
                    "file_type": f.file_type,
                    "file_size": f.file_size
                }
                for f in files
            ]
        }
        entry_list.append(entry_dict)
    
    return entry_list


@router.post("/admin/contests/{contest_id}/entries/{entry_id}/status")
async def update_entry_status(
    contest_id: int,
    entry_id: int,
    update: EntryStatusUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Update entry status (approve/reject/mark winner)"""
    stmt = select(ContestEntry).where(
        and_(
            ContestEntry.id == entry_id,
            ContestEntry.contest_id == contest_id
        )
    )
    result = await session.execute(stmt)
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry.status = update.status
    if update.admin_note:
        entry.admin_note = update.admin_note
    
    if update.status == "approved":
        entry.approved_at = datetime.utcnow()
    elif update.status == "winner":
        entry.marked_winner_at = datetime.utcnow()
    
    await session.commit()
    
    return {"message": f"Entry status updated to {update.status}"}


@router.post("/admin/contests/{contest_id}/entries/bulk-update")
async def bulk_update_entries(
    contest_id: int,
    update: BulkEntryUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Bulk update entry statuses"""
    stmt = select(ContestEntry).where(
        and_(
            ContestEntry.contest_id == contest_id,
            ContestEntry.id.in_(update.entry_ids)
        )
    )
    result = await session.execute(stmt)
    entries = result.scalars().all()
    
    if not entries:
        raise HTTPException(status_code=404, detail="No entries found")
    
    now = datetime.utcnow()
    for entry in entries:
        entry.status = update.status
        if update.admin_note:
            entry.admin_note = update.admin_note
        if update.status == "approved":
            entry.approved_at = now
        elif update.status == "winner":
            entry.marked_winner_at = now
    
    await session.commit()
    
    return {"message": f"Updated {len(entries)} entries to {update.status}"}


# ==================== PUBLIC ROUTES ====================

@router.get("/{slug}", response_model=ContestResponse)
async def get_public_contest(
    slug: str,
    session: AsyncSession = Depends(get_session)
):
    """Get public contest by slug"""
    stmt = select(Contest).where(
        and_(
            Contest.slug == slug,
            Contest.is_published == True
        )
    )
    result = await session.execute(stmt)
    contest = result.scalar_one_or_none()
    
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    # Check if contest is active
    today = date.today()
    if contest.start_date > today or contest.end_date < today:
        raise HTTPException(status_code=400, detail="Contest is not currently active")
    
    return contest


@router.post("/{slug}/entries", response_model=Dict[str, Any])
async def submit_entry(
    slug: str,
    entry: ContestEntryCreate,
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Submit a contest entry"""
    try:
        # Get contest
        stmt = select(Contest).where(
            and_(
                Contest.slug == slug,
                Contest.is_published == True
            )
        )
        result = await session.execute(stmt)
        contest = result.scalar_one_or_none()
        
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")
        
        # Check if contest is active
        today = date.today()
        if contest.start_date > today or contest.end_date < today:
            raise HTTPException(status_code=400, detail="Contest is not currently active")
        
        # Check consent
        if not entry.consent:
            raise HTTPException(status_code=400, detail="Consent is required to participate")
        
        # Check per-user limit
        if entry.email or entry.phone:
            check_stmt = select(func.count(ContestEntry.id)).where(
                and_(
                    ContestEntry.contest_id == contest.id,
                    or_(
                        ContestEntry.email == entry.email if entry.email else False,
                        ContestEntry.phone == entry.phone if entry.phone else False
                    )
                )
            )
            count_result = await session.execute(check_stmt)
            count = count_result.scalar()
            
            if count >= contest.per_user_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"You have reached the maximum entry limit of {contest.per_user_limit} for this contest"
                )
        
        # Check first X winners limit
        if contest.first_x_winners:
            winner_stmt = select(func.count(ContestEntry.id)).where(
                and_(
                    ContestEntry.contest_id == contest.id,
                    ContestEntry.status.in_(["approved", "winner"])
                )
            )
            winner_result = await session.execute(winner_stmt)
            winner_count = winner_result.scalar()
            
            if winner_count >= contest.first_x_winners:
                raise HTTPException(
                    status_code=400,
                    detail="Contest has reached maximum number of winners"
                )
        
        # Create entry
        reference_id = generate_reference_id()
        ip_address = request.client.host if request.client else None
        
        db_entry = ContestEntry(
            contest_id=contest.id,
            participant_name=entry.participant_name,
            email=entry.email,
            phone=entry.phone,
            event_type=entry.event_type,
            event_date=entry.event_date,
            relation=entry.relation,
            booking_id=entry.booking_id,
            message=entry.message,
            owner_email=entry.owner_email,
            owner_phone=entry.owner_phone,
            reference_id=reference_id,
            ip_address=ip_address,
            status="approved" if contest.auto_approve else "pending"
        )
        
        if contest.auto_approve:
            db_entry.approved_at = datetime.utcnow()
        
        session.add(db_entry)
        await session.flush()  # Get entry ID
        
        # Add files
        for i, file_url in enumerate(entry.file_urls):
            if i < len(entry.file_names) and i < len(entry.file_types) and i < len(entry.file_sizes):
                file_entry = ContestEntryFile(
                    entry_id=db_entry.id,
                    file_url=file_url,
                    file_name=entry.file_names[i],
                    file_type=entry.file_types[i],
                    file_size=entry.file_sizes[i]
                )
                session.add(file_entry)
        
        # Commit with error handling
        try:
            await session.commit()
            await session.refresh(db_entry)
        except Exception as commit_error:
            await session.rollback()
            logger.error(f"[Contest Entry] Failed to commit entry: {commit_error}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to submit entry: {str(commit_error)}"
            )
        
        # TODO: Enqueue OCR job if enabled
        
        return {
            "id": db_entry.id,
            "reference_id": reference_id,
            "message": "Entry submitted successfully"
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any other unexpected errors and ensure session is rolled back
        await session.rollback()
        logger.error(f"[Contest Entry] Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.post("/admin/contests/{contest_id}/entries/{entry_id}/notify")
async def notify_entry(
    contest_id: int,
    entry_id: int,
    notify: NotifyRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Send notification to contest entry participant"""
    try:
        # Get entry
        stmt = select(ContestEntry).where(
            and_(
                ContestEntry.id == entry_id,
                ContestEntry.contest_id == contest_id
            )
        )
        result = await session.execute(stmt)
        entry = result.scalar_one_or_none()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Get contest
        contest_stmt = select(Contest).where(Contest.id == contest_id)
        contest_result = await session.execute(contest_stmt)
        contest = contest_result.scalar_one_or_none()
        
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")
        
        # Prepare variables for template
        variables = notify.variables or {}
        variables.setdefault("name", entry.participant_name)
        variables.setdefault("contest_title", contest.title)
        variables.setdefault("event_date", str(entry.event_date))
        variables.setdefault("entry_id", entry.reference_id)
        variables.setdefault("admin_note", entry.admin_note or "")
        
        # Get prize info if winner
        prize_info = ""
        if entry.status == "winner" and contest.prizes:
            prizes = contest.prizes if isinstance(contest.prizes, list) else []
            if prizes:
                prize_info = prizes[0].get("title", "Prize") if isinstance(prizes[0], dict) else str(prizes[0])
        variables.setdefault("prize", prize_info)
        
        # Generate booking link if booking_id exists
        booking_link = ""
        if entry.booking_id:
            from ..core import settings
            booking_link = f"{settings.WEB_APP_URL}bookings/{entry.booking_id}"
        variables.setdefault("booking_link", booking_link)
        
        # Substitute variables in message
        message_body = notify.message_template
        for key, value in variables.items():
            message_body = message_body.replace(f"{{{key}}}", str(value))
        
        # Send notifications
        notifications_sent = []
        errors = []
        notification_records = []
        
        # Create notification records first
        for channel in notify.channels:
            try:
                notification = ContestNotification(
                    entry_id=entry.id,
                    channel=channel,
                    recipient_email=entry.email if channel == "email" else None,
                    recipient_phone=entry.phone if channel == "whatsapp" else None,
                    subject=notify.subject or (notify.message_template[:100] if channel == "email" else None),
                    message_body=message_body,
                    sent_by_user_id=user.id,
                    status="pending"
                )
                session.add(notification)
                notification_records.append((notification, channel))
            except Exception as e:
                logger.error(f"[Contest Notify] Error creating notification record for {channel}: {e}")
                errors.append(f"{channel} setup error: {str(e)}")
        
        # Mark notification status
        for notification, channel in notification_records:
            recipient = entry.email if channel == "email" else (entry.phone if channel == "whatsapp" else None)
            
            if not recipient:
                notification.status = "failed"
                notification.error_message = f"No {channel} recipient available"
                errors.append(f"{channel}: No recipient available")
            else:
                notifications_sent.append(f"{channel} queued for {recipient}")
        
        # Commit all changes - wrap in try/except to prevent blocking
        try:
            await session.commit()
        except Exception as commit_error:
            await session.rollback()
            logger.error(f"[Contest Notify] Failed to commit notifications: {commit_error}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save notifications: {str(commit_error)}"
            )
        
        # Return immediately - notifications will be sent in background if needed
        return {
            "message": "Notifications queued successfully",
            "sent": notifications_sent,
            "errors": errors
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any other unexpected errors and ensure session is rolled back
        await session.rollback()
        logger.error(f"[Contest Notify] Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.post("/admin/contests/{contest_id}/entries/export")
async def export_entries_csv(
    contest_id: int,
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Export contest entries as CSV"""
    stmt = select(ContestEntry).where(ContestEntry.contest_id == contest_id)
    
    if status:
        stmt = stmt.where(ContestEntry.status == status)
    
    stmt = stmt.order_by(desc(ContestEntry.created_at))
    result = await session.execute(stmt)
    entries = result.scalars().all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'ID', 'Reference ID', 'Participant Name', 'Email', 'Phone',
        'Event Type', 'Event Date', 'Relation', 'Status', 'Admin Note',
        'OCR Confidence', 'OCR Date Matches', 'Created At', 'File URLs'
    ])
    
    # Rows
    for entry in entries:
        # Get files
        files_stmt = select(ContestEntryFile).where(ContestEntryFile.entry_id == entry.id)
        files_result = await session.execute(files_stmt)
        files = files_result.scalars().all()
        file_urls = ', '.join([f.file_url for f in files])
        
        writer.writerow([
            entry.id,
            entry.reference_id,
            entry.participant_name,
            entry.email or '',
            entry.phone or '',
            entry.event_type,
            str(entry.event_date),
            entry.relation,
            entry.status,
            entry.admin_note or '',
            entry.ocr_confidence or '',
            entry.ocr_date_matches or '',
            entry.created_at.isoformat(),
            file_urls
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=contest_{contest_id}_entries.csv"
        }
    )


# ==================== USER EVENT DATES (Family Member Dates) ====================

class UserEventDateCreate(BaseModel):
    person_name: str
    event_type: str  # birthday, anniversary, other
    event_date: date
    relation: str = "family"
    email: Optional[str] = None
    phone: Optional[str] = None
    notify_on_offers: bool = True


class UserEventDateResponse(BaseModel):
    id: int
    person_name: str
    event_type: str
    event_date: date
    relation: str
    notify_on_offers: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/user-event-dates", response_model=UserEventDateResponse)
async def add_user_event_date(
    event_date: UserEventDateCreate,
    session: AsyncSession = Depends(get_session)
):
    """Add a family member event date (birthday, anniversary) for offer notifications"""
    if not event_date.email and not event_date.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    
    db_event_date = UserEventDate(
        email=event_date.email,
        phone=event_date.phone,
        person_name=event_date.person_name,
        event_type=event_date.event_type,
        event_date=event_date.event_date,
        relation=event_date.relation,
        notify_on_offers=event_date.notify_on_offers
    )
    
    session.add(db_event_date)
    await session.commit()
    await session.refresh(db_event_date)
    
    return db_event_date


@router.get("/user-event-dates", response_model=List[UserEventDateResponse])
async def get_user_event_dates(
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    """Get user's event dates by email or phone"""
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    
    stmt = select(UserEventDate)
    if email:
        stmt = stmt.where(UserEventDate.email == email)
    if phone:
        stmt = stmt.where(UserEventDate.phone == phone)
    
    stmt = stmt.order_by(UserEventDate.event_date)
    result = await session.execute(stmt)
    event_dates = result.scalars().all()
    
    return event_dates


@router.delete("/user-event-dates/{event_date_id}")
async def delete_user_event_date(
    event_date_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a user event date"""
    stmt = select(UserEventDate).where(UserEventDate.id == event_date_id)
    result = await session.execute(stmt)
    event_date = result.scalar_one_or_none()
    
    if not event_date:
        raise HTTPException(status_code=404, detail="Event date not found")
    
    await session.delete(event_date)
    await session.commit()
    
    return {"message": "Event date deleted successfully"}


@router.post("/admin/contests/upload-file")
async def upload_contest_file(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(admin_required)
):
    """Upload file for contest (hero/banner images)"""
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Generate unique filename
    ext = Path(file.filename or "").suffix or ".jpg"
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"contest_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename
    
    # Save file
    content = await file.read()
    dest.write_bytes(content)
    
    # Return URL (relative to static serving)
    return {"url": f"/api/uploads/contests/{filename}"}


@router.post("/{slug}/upload-proof")
async def upload_proof_file(
    slug: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """Upload proof file for contest entry (public endpoint)"""
    # Get contest to verify it exists and is active
    stmt = select(Contest).where(
        and_(
            Contest.slug == slug,
            Contest.is_published == True
        )
    )
    result = await session.execute(stmt)
    contest = result.scalar_one_or_none()
    
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    # Check if contest is active
    today = date.today()
    if contest.start_date > today or contest.end_date < today:
        raise HTTPException(status_code=400, detail="Contest is not currently active")
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only image (JPEG, PNG) and PDF files are allowed"
        )
    
    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Generate unique filename
    ext = Path(file.filename or "").suffix or (".pdf" if file.content_type == "application/pdf" else ".jpg")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"proof_{slug}_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename
    
    # Save file
    dest.write_bytes(content)
    
    # Return file info
    return {
        "url": f"/api/uploads/contests/{filename}",
        "filename": filename,
        "file_type": file.content_type,
        "file_size": len(content)
    }


# ==================== CONTEST INVITATION NOTIFICATIONS ====================

@router.get("/admin/contests/{contest_id}/users")
async def get_users_for_contest_notification(
    contest_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Get list of users with their informed status for a contest invitation"""
    # Verify contest exists
    stmt_contest = select(Contest).where(Contest.id == contest_id)
    rs_contest = await session.execute(stmt_contest)
    contest = rs_contest.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    # Get all customer users
    stmt_users = select(User).where(User.role == 'customer').order_by(User.first_name, User.last_name, User.username)
    rs_users = await session.execute(stmt_users)
    users = rs_users.scalars().all()
    
    # For now, we'll use a simple approach - check if user has mobile/email
    # In the future, we can add a ContestInvitationNotification model similar to OfferNotification
    users_list = []
    for user in users:
        users_list.append({
            'id': user.id,
            'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or 'Unknown',
            'username': user.username,
            'mobile': user.mobile,
            'email': user.username if user.username and '@' in user.username else None,
            'is_informed': False,  # TODO: Implement tracking when ContestInvitationNotification model is added
            'informed_at': None,
            'channels': None
        })
    
    return {
        'contest_id': contest_id,
        'contest_title': contest.title,
        'total_users': len(users_list),
        'informed_count': 0,  # TODO: Update when tracking is implemented
        'users': users_list
    }


@router.post("/admin/contests/{contest_id}/notify-all")
async def notify_all_users_about_contest(
    contest_id: int,
    request: dict = Body(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required)
):
    """Send notifications to all existing users about a contest via selected channels (WhatsApp, SMS, Email)"""
    try:
        # Get selected channels from request body
        channels = request.get('channels', {})
        use_whatsapp = channels.get('whatsapp', True)
        use_sms = channels.get('sms', False)
        use_email = channels.get('email', False)
        
        if not use_whatsapp and not use_sms and not use_email:
            raise HTTPException(status_code=400, detail="At least one notification channel must be selected")
        
        # Get selected user IDs (optional - if not provided, send to all)
        selected_user_ids = request.get('user_ids', None)
        
        # Get the contest
        stmt = select(Contest).where(Contest.id == contest_id)
        rs = await session.execute(stmt)
        contest = rs.scalar_one_or_none()
        
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")
        
        # Prepare contest details
        contest_name = contest.title or "Contest"
        # Format date to match template example: "jan-01-2026" (lowercase month abbreviation)
        if contest.start_date:
            month_abbr = contest.start_date.strftime('%b').lower()  # jan, feb, etc.
            day = contest.start_date.strftime('%d')
            year = contest.start_date.strftime('%Y')
            contest_date = f"{month_abbr}-{day}-{year}"
        else:
            contest_date = "TBD"
        
        # Format prize information - keep it simple and short
        prize_text = "Exciting prizes"
        if contest.prizes:
            prizes_list = contest.prizes if isinstance(contest.prizes, list) else []
            if prizes_list:
                # Take first prize only to keep it short
                first_prize = prizes_list[0].get('title', 'Prize')
                prize_text = first_prize
                # If there are more prizes, add count
                if len(prizes_list) > 1:
                    prize_text = f"{first_prize} and more"
        
        # Generate submission link - use just the path, not full URL (as per template example)
        # Template example shows: "lebrq,com/participant" (note: comma might be typo, but we'll use dot)
        # Format: domain.com/path (no https://, no trailing slash)
        submission_link = f"lebrq.com/contest/{contest.slug}"
        # Remove any special characters that might cause issues
        submission_link = submission_link.replace(' ', '').replace('\n', '').replace('\r', '')
        
        # Store necessary data for the background thread
        stored_contest_id = contest_id
        stored_selected_user_ids = selected_user_ids
        stored_admin_id = admin.id
        stored_channels = channels
        stored_contest_details = {
            'contest_name': contest_name,
            'contest_date': contest_date,
            'prize': prize_text,
            'submission_link': submission_link,
        }
        
        # Use threading for truly non-blocking execution
        import threading
        import time
        from datetime import datetime
        
        def send_notifications_in_thread():
            """Send notifications in completely isolated thread"""
            print(f"[CONTEST] [THREAD] Starting notification thread for contest {stored_contest_id}")
            
            # Small delay to ensure main session is fully released before starting
            time.sleep(0.2)
            
            try:
                # Use sync session in thread to avoid event loop issues
                sync_session = SyncSessionLocal()
                try:
                    print(f"[CONTEST] [THREAD] Loading contest and users")
                    # Load contest
                    contest_obj = sync_session.query(Contest).filter(Contest.id == stored_contest_id).first()
                    if not contest_obj:
                        print(f"[CONTEST] [THREAD] Contest not found")
                        return
                    
                    # Load users
                    if stored_selected_user_ids:
                        users_query = sync_session.query(User).filter(
                            User.role == 'customer',
                            User.id.in_(stored_selected_user_ids)
                        )
                    else:
                        users_query = sync_session.query(User).filter(User.role == 'customer')
                    
                    users_data = []
                    for user in users_query.all():
                        # Skip users without mobile/email based on selected channels
                        has_mobile = bool(user.mobile)
                        has_email = bool(user.username and '@' in user.username)
                        
                        if (stored_channels.get('whatsapp') or stored_channels.get('sms')) and not has_mobile:
                            continue
                        if stored_channels.get('email') and not has_email:
                            continue
                        
                        users_data.append({
                            'id': user.id,
                            'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or 'Customer',
                            'mobile': user.mobile,
                            'email': user.username if user.username and '@' in user.username else None,
                        })
                    
                    print(f"[CONTEST] [THREAD] Found {len(users_data)} users to notify")
                    
                    # Close sync session before async work
                    sync_session.close()
                    sync_session = None
                    
                    # Run async notifications in a new isolated event loop
                    import asyncio
                    
                    async def send_notifications_async():
                        """Run async notifications in isolated event loop"""
                        from app.db import AsyncSessionLocal
                        
                        print(f"[CONTEST] [THREAD] Starting async notifications")
                        total_sent = 0
                        
                        async with AsyncSessionLocal() as async_session:
                            for user_data in users_data:
                                try:
                                    customer_name = user_data['name']
                                    
                                    # Send WhatsApp
                                    if stored_channels.get('whatsapp') and user_data.get('mobile'):
                                        try:
                                            await NotificationService.send_contest_invitation_whatsapp(
                                                mobile=user_data['mobile'],
                                                customer_name=customer_name,
                                                contest_name=stored_contest_details['contest_name'],
                                                contest_date=stored_contest_details['contest_date'],
                                                prize=stored_contest_details['prize'],
                                                submission_link=stored_contest_details['submission_link']
                                            )
                                            total_sent += 1
                                        except Exception as e:
                                            print(f"[CONTEST] [THREAD] WhatsApp error for {user_data.get('mobile')}: {e}")
                                    
                                    # Send SMS
                                    if stored_channels.get('sms') and user_data.get('mobile'):
                                        try:
                                            await NotificationService.send_contest_invitation_sms(
                                                mobile=user_data['mobile'],
                                                customer_name=customer_name,
                                                contest_name=stored_contest_details['contest_name'],
                                                contest_date=stored_contest_details['contest_date'],
                                                prize=stored_contest_details['prize'],
                                                submission_link=stored_contest_details['submission_link']
                                            )
                                            total_sent += 1
                                        except Exception as e:
                                            print(f"[CONTEST] [THREAD] SMS error for {user_data.get('mobile')}: {e}")
                                    
                                    # Send Email
                                    if stored_channels.get('email') and user_data.get('email'):
                                        try:
                                            # Basic email validation
                                            email = user_data['email']
                                            if email and '@' in email and '.' in email.split('@')[1]:
                                                await NotificationService.send_contest_invitation_email(
                                                    email=email,
                                                    customer_name=customer_name,
                                                    contest_name=stored_contest_details['contest_name'],
                                                    contest_date=stored_contest_details['contest_date'],
                                                    prize=stored_contest_details['prize'],
                                                    submission_link=stored_contest_details['submission_link']
                                                )
                                                total_sent += 1
                                            else:
                                                print(f"[CONTEST] [THREAD] Skipping invalid email: {email}")
                                        except Exception as e:
                                            print(f"[CONTEST] [THREAD] Email error for {user_data.get('email')}: {e}")
                                    
                                    # Small delay to avoid rate limiting
                                    await asyncio.sleep(0.1)
                                    
                                except Exception as user_error:
                                    print(f"[CONTEST] [THREAD] Error processing user {user_data.get('id')}: {user_error}")
                                    continue
                        
                        print(f"[CONTEST] [THREAD] ✓ Notifications sent: {total_sent}")
                    
                    # Run in new event loop - completely isolated
                    print(f"[CONTEST] [THREAD] Running async notifications in new event loop")
                    asyncio.run(send_notifications_async())
                    print(f"[CONTEST] [THREAD] ✓ Notification thread completed successfully for contest {stored_contest_id}")
                    
                except Exception as sync_error:
                    print(f"[CONTEST] [THREAD] Sync session error: {sync_error}")
                    import traceback
                    traceback.print_exc()
                    if sync_session:
                        try:
                            sync_session.close()
                        except:
                            pass
            except Exception as thread_error:
                print(f"[CONTEST] [THREAD] Thread notification error: {thread_error}")
                import traceback
                traceback.print_exc()
        
        # Use thread pool instead of creating unlimited threads
        from app.utils.thread_pool import submit_task
        submit_task(send_notifications_in_thread)
        
        estimated_user_count = len(selected_user_ids) if selected_user_ids else "all eligible"
        
        return {
            'success': True,
            'message': f'Notification process started for {estimated_user_count} users. Notifications are being sent in the background.',
            'total_users': estimated_user_count,
            'status': 'processing',
            'note': 'Notifications are being sent asynchronously. Check server logs for detailed progress.'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONTEST] Error in notify_all_users_about_contest: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send notifications: {str(e)}")

