"""
Admin Client Insights API
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..auth import get_current_user
from ..db import get_session
from ..models import User

router = APIRouter(prefix="/admin/clients", tags=["admin-clients"])


def admin_required(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return user


@router.get("")
async def list_clients(
    search: str = Query("", description="Search by name, email or mobile"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    search_term = (search or "").strip().lower()
    where_clause = ["u.role = 'customer'"]
    params = {"limit": limit, "offset": offset, "admin_id": admin.id}
    if search_term:
        where_clause.append(
            "(LOWER(u.username) LIKE :search OR LOWER(COALESCE(u.first_name,'')) LIKE :search "
            "OR LOWER(COALESCE(u.last_name,'')) LIKE :search OR LOWER(COALESCE(u.mobile,'')) LIKE :search)"
        )
        params["search"] = f"%{search_term}%"
    where_sql = " AND ".join(where_clause)

    count_stmt = text(f"SELECT COUNT(*) FROM users u WHERE {where_sql}")
    total_rs = await session.execute(count_stmt, params)
    total_clients = total_rs.scalar() or 0

    data_stmt = text(
        f"""
        WITH client_base AS (
            SELECT u.id, u.username, u.first_name, u.last_name, u.mobile, u.created_at, u.suspended_until
            FROM users u
            WHERE {where_sql}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        ),
        booking_stats AS (
            SELECT
                user_id,
                COUNT(*) AS total_bookings,
                SUM(CASE WHEN LOWER(status) IN ('pending') THEN 1 ELSE 0 END) AS pending_bookings,
                SUM(CASE WHEN LOWER(status) IN ('pending','approved','confirmed') THEN 1 ELSE 0 END) AS active_bookings,
                MAX(start_datetime) AS last_event_at
            FROM bookings
            GROUP BY user_id
        ),
        payment_stats AS (
            SELECT
                b.user_id,
                SUM(p.amount) AS total_paid
            FROM payments p
            JOIN bookings b ON b.id = p.booking_id
            WHERE LOWER(p.status) IN ('paid','captured','completed','success','successful')
            GROUP BY b.user_id
        ),
        message_stats AS (
            SELECT
                CASE
                    WHEN sender_id = :admin_id THEN recipient_id
                    ELSE sender_id
                END AS client_id,
                SUM(CASE WHEN recipient_id = :admin_id AND is_read = FALSE THEN 1 ELSE 0 END) AS unread_messages,
                MAX(created_at) AS last_message_at
            FROM client_messages
            WHERE sender_id = :admin_id OR recipient_id = :admin_id
            GROUP BY client_id
        )
        SELECT
            cb.id,
            cb.username,
            cb.first_name,
            cb.last_name,
            cb.mobile,
            cb.created_at,
            cb.suspended_until,
            COALESCE(bs.total_bookings, 0) AS total_bookings,
            COALESCE(bs.active_bookings, 0) AS active_bookings,
            COALESCE(bs.pending_bookings, 0) AS pending_bookings,
            COALESCE(bs.last_event_at, NULL) AS last_event_at,
            COALESCE(ps.total_paid, 0) AS total_paid,
            COALESCE(ms.unread_messages, 0) AS unread_messages,
            COALESCE(ms.last_message_at, NULL) AS last_message_at
        FROM client_base cb
        LEFT JOIN booking_stats bs ON bs.user_id = cb.id
        LEFT JOIN payment_stats ps ON ps.user_id = cb.id
        LEFT JOIN message_stats ms ON ms.client_id = cb.id
        ORDER BY cb.created_at DESC
        """
    )
    rs = await session.execute(data_stmt, params)
    rows = rs.mappings().all()

    stats_stmt = text(
        """
        WITH booking_stats AS (
            SELECT
                user_id,
                COUNT(*) AS total_bookings,
                SUM(CASE WHEN LOWER(status) IN ('pending','approved','confirmed') THEN 1 ELSE 0 END) AS active_bookings,
                SUM(CASE WHEN LOWER(status) IN ('pending') THEN 1 ELSE 0 END) AS pending_bookings
            FROM bookings
            GROUP BY user_id
        ),
        payment_stats AS (
            SELECT
                b.user_id,
                SUM(p.amount) AS total_paid
            FROM payments p
            JOIN bookings b ON b.id = p.booking_id
            WHERE LOWER(p.status) IN ('paid','captured','completed','success','successful')
            GROUP BY b.user_id
        )
        SELECT
            COUNT(*) AS total_clients,
            COALESCE(SUM(bs.active_bookings), 0) AS total_active_bookings,
            COALESCE(SUM(bs.pending_bookings), 0) AS total_pending_bookings,
            COALESCE(SUM(ps.total_paid), 0) AS total_revenue
        FROM users u
        LEFT JOIN booking_stats bs ON bs.user_id = u.id
        LEFT JOIN payment_stats ps ON ps.user_id = u.id
        WHERE u.role = 'customer'
        """
    )
    stats_rs = await session.execute(stats_stmt)
    stats = stats_rs.mappings().first() or {}

    def serialize(row):
        from datetime import datetime
        suspended_until = row.get("suspended_until")
        now = datetime.utcnow()
        is_suspended = suspended_until is not None and suspended_until > now
        return {
            "id": row["id"],
            "email": row["username"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "mobile": row["mobile"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "suspended_until": suspended_until.isoformat() if suspended_until else None,
            "is_suspended": is_suspended,
            "total_bookings": int(row["total_bookings"] or 0),
            "active_bookings": int(row["active_bookings"] or 0),
            "pending_bookings": int(row["pending_bookings"] or 0),
            "last_event_at": row["last_event_at"].isoformat() if row["last_event_at"] else None,
            "total_paid": float(row["total_paid"] or 0),
            "unread_messages": int(row["unread_messages"] or 0),
            "last_message_at": row["last_message_at"].isoformat() if row["last_message_at"] else None,
        }

    return {
        "items": [serialize(r) for r in rows],
        "meta": {
            "total": total_clients,
            "limit": limit,
            "offset": offset,
            "stats": {
                "total_clients": int(stats.get("total_clients") or 0),
                "active_bookings": int(stats.get("total_active_bookings") or 0),
                "pending_bookings": int(stats.get("total_pending_bookings") or 0),
                "total_revenue": float(stats.get("total_revenue") or 0),
            },
        },
    }

