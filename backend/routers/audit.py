from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from database import get_db
from models.bid import BidAuditLog
from schemas.bid import AuditLogOut
from typing import List, Optional
from datetime import date

router = APIRouter()


@router.get("/", response_model=List[AuditLogOut])
async def list_audit_logs(
    bid_ref: Optional[str] = None,
    action_type: Optional[str] = None,
    role: Optional[str] = None,
    user: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    q = select(BidAuditLog).order_by(BidAuditLog.created_at.desc()).limit(limit)
    if bid_ref:
        q = q.where(BidAuditLog.bid_reference == bid_ref)
    if action_type and action_type != "all":
        q = q.where(BidAuditLog.action_type == action_type)
    if role:
        q = q.where(BidAuditLog.role == role)
    if user:
        q = q.where(BidAuditLog.performed_by == user)
    if from_date:
        q = q.where(BidAuditLog.created_at >= from_date)
    if to_date:
        q = q.where(BidAuditLog.created_at <= to_date)
    if search:
        s = f"%{search}%"
        q = q.where(or_(
            BidAuditLog.bid_reference.ilike(s),
            BidAuditLog.section_key.ilike(s),
            BidAuditLog.action_type.ilike(s),
            BidAuditLog.performed_by.ilike(s),
            BidAuditLog.detail.ilike(s),
        ))
    result = await db.execute(q)
    return result.scalars().all()
