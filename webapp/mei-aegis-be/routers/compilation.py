from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.bid import Bid, BidAuditLog
from uuid import UUID
from datetime import datetime, timezone

router = APIRouter()


@router.post("/{bid_id}/trigger")
async def trigger_compilation(bid_id: UUID, triggered_by: str, db: AsyncSession = Depends(get_db)):
    bid = await db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    if bid.stage not in ("validating", "draft"):
        raise HTTPException(status_code=400, detail=f"Cannot compile bid in stage '{bid.stage}'")
    bid.stage = "compiling"
    db.add(BidAuditLog(
        bid_id=bid_id,
        section_key=None,
        action_type="Compilation triggered",
        performed_by=triggered_by,
        role="manager",
        detail="BR-001 compilation pipeline started",
        br_reference="BR-001",
    ))
    await db.commit()
    return {"bid_id": str(bid_id), "stage": "compiling", "triggered_at": datetime.now(timezone.utc).isoformat()}


@router.get("/{bid_id}/status")
async def compilation_status(bid_id: UUID, db: AsyncSession = Depends(get_db)):
    bid = await db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    return {
        "bid_id": str(bid_id),
        "stage": bid.stage,
        "sections_complete": bid.sections_complete,
        "sections_total": bid.sections_total,
    }
