from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.bid import Bid, BidSection, BidRisk, BidAuditLog
from schemas.bid import BidOut, BidSummary, BidSectionOut, RiskOut
from auth import get_user_role, require_manager, require_director
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel

router = APIRouter()


class ActorPayload(BaseModel):
    performed_by: str
    role: str = "Manager"
    note: str | None = None


@router.get("/")
async def list_bids(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text as sa_text
    rows = (await db.execute(sa_text("""
        SELECT b.*,
               COALESCE(SUM(s.flag_count), 0)::int AS section_flag_count
        FROM bids b
        LEFT JOIN bid_sections s ON s.bid_id = b.bid_id
        GROUP BY b.bid_id
        ORDER BY b.submission_deadline
    """))).mappings().all()
    return [dict(r) for r in rows]


@router.get("/{bid_ref}", response_model=BidOut)
async def get_bid(bid_ref: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail=f"Bid {bid_ref} not found")
    return bid


@router.get("/{bid_ref}/sections", response_model=List[BidSectionOut])
async def get_bid_sections(bid_ref: str, db: AsyncSession = Depends(get_db)):
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail=f"Bid {bid_ref} not found")
    result = await db.execute(select(BidSection).where(BidSection.bid_id == bid.bid_id).order_by(BidSection.created_at))
    return result.scalars().all()


@router.get("/{bid_ref}/risks", response_model=List[RiskOut])
async def get_bid_risks(bid_ref: str, db: AsyncSession = Depends(get_db)):
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail=f"Bid {bid_ref} not found")
    result = await db.execute(select(BidRisk).where(BidRisk.bid_id == bid.bid_id).order_by(BidRisk.risk_ref))
    return result.scalars().all()


@router.get("/{bid_ref}/pricing-lines")
async def get_pricing_lines(bid_ref: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text as sa_text
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    rows = (await db.execute(sa_text("""
        SELECT line_no, task, role, rate, hours, unit, margin_pct, is_missing_rate
        FROM bid_pricing_lines
        WHERE bid_id = :bid_id
        ORDER BY line_no
    """), {"bid_id": bid.bid_id})).all()
    return [
        {
            "line_no":         r[0],
            "task":            r[1],
            "role":            r[2],
            "rate":            float(r[3]) if r[3] else None,
            "hours":           r[4],
            "unit":            r[5],
            "margin_pct":      float(r[6]) if r[6] else 0,
            "is_missing_rate": r[7],
        }
        for r in rows
    ]


@router.post("/{bid_ref}/pricing-lines/{line_no}/margin")
async def update_pricing_line_margin(bid_ref: str, line_no: int, payload: ActorPayload,
                                     role: str = Depends(get_user_role),
                                     db: AsyncSession = Depends(get_db)):
    require_director(role)
    from sqlalchemy import text as sa_text
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    # parse new margin from note ("Margin X% → Y%") OR accept it directly
    # We expect note to encode the new margin, OR accept it via payload (we'll add a field)
    new_margin = float(payload.note) if payload.note and payload.note.replace('.', '').isdigit() else None
    if new_margin is None:
        raise HTTPException(status_code=400, detail="Pass new margin pct as 'note' field (e.g. '24.5')")

    cur = (await db.execute(sa_text("""
        SELECT margin_pct, task, role FROM bid_pricing_lines WHERE bid_id = :bid_id AND line_no = :n
    """), {"bid_id": bid.bid_id, "n": line_no})).first()
    if not cur:
        raise HTTPException(status_code=404, detail="Line not found")

    await db.execute(sa_text("""
        UPDATE bid_pricing_lines SET margin_pct = :m, updated_at = now()
        WHERE bid_id = :bid_id AND line_no = :n
    """), {"m": new_margin, "bid_id": bid.bid_id, "n": line_no})

    db.add(BidAuditLog(
        bid_id=bid.bid_id, bid_reference=bid.bid_reference,
        section_key="Pricing", action_type="Edited",
        original_value=f"{cur[0]}%", revised_value=f"{new_margin}%",
        performed_by=payload.performed_by, role=payload.role,
        detail=f"BR-003 line override on '{cur[1]}' ({cur[2]})",
        br_reference="BR-003",
    ))
    await db.commit()
    return {"line_no": line_no, "margin_pct": new_margin}


@router.post("/{bid_ref}/pricing-lines/{line_no}/resolve-rate")
async def resolve_missing_rate(bid_ref: str, line_no: int, payload: ActorPayload,
                               role: str = Depends(get_user_role),
                               db: AsyncSession = Depends(get_db)):
    require_director(role)
    from sqlalchemy import text as sa_text
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    new_rate = float(payload.note) if payload.note else None
    if new_rate is None:
        raise HTTPException(status_code=400, detail="Pass rate in 'note' field")
    await db.execute(sa_text("""
        UPDATE bid_pricing_lines
        SET rate = :r, is_missing_rate = FALSE, updated_at = now()
        WHERE bid_id = :bid_id AND line_no = :n
    """), {"r": new_rate, "bid_id": bid.bid_id, "n": line_no})
    db.add(BidAuditLog(
        bid_id=bid.bid_id, bid_reference=bid.bid_reference,
        section_key="Pricing", action_type="Edited",
        original_value="Missing Rate", revised_value=f"£{new_rate}/h",
        performed_by=payload.performed_by, role=payload.role,
        detail="Rate card entry resolved", br_reference="BR-003",
    ))
    await db.commit()
    return {"line_no": line_no, "rate": new_rate}


@router.get("/{bid_ref}/compilation-telemetry")
async def compilation_telemetry(bid_ref: str, db: AsyncSession = Depends(get_db)):
    """Per-bid compilation status — derived from bids + bid_sections."""
    from sqlalchemy import text, func
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    sec_rows = (await db.execute(
        select(BidSection).where(BidSection.bid_id == bid.bid_id).order_by(BidSection.created_at)
    )).scalars().all()
    confidences = [float(s.confidence_score) for s in sec_rows if s.confidence_score is not None]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0
    flag_count_total = sum((s.flag_count or 0) for s in sec_rows)

    elapsed_seconds = None
    if bid.compile_started_at and bid.compile_finished_at:
        elapsed_seconds = (bid.compile_finished_at - bid.compile_started_at).total_seconds()

    return {
        "bid_reference":   bid.bid_reference,
        "stage":           bid.stage,
        "elapsed_seconds": elapsed_seconds,
        "sources_merged":  len(sec_rows),
        "sources_total":   bid.sections_total or 8,
        "avg_confidence":  round(avg_conf, 2),
        "flags_raised":    flag_count_total,
        "started_at":      bid.compile_started_at.isoformat() if bid.compile_started_at else None,
        "finished_at":     bid.compile_finished_at.isoformat() if bid.compile_finished_at else None,
        "sections": [
            {
                "key":           s.section_key,
                "name":          s.section_name,
                "status":        s.status,
                "source_module": s.source_module,
                "input_version": s.input_version,
                "confidence":    float(s.confidence_score) if s.confidence_score else 0,
                "flag_count":    s.flag_count or 0,
                "flags":         s.flags or [],
            }
            for s in sec_rows
        ],
    }


@router.post("/{bid_ref}/route-to-director")
async def route_to_director(bid_ref: str, payload: ActorPayload,
                            role: str = Depends(get_user_role),
                            db: AsyncSession = Depends(get_db)):
    """Manager moves a 'compiling' bid to 'pending' (HIL queue)."""
    require_manager(role)
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    if bid.stage not in ("compiling", "validating"):
        raise HTTPException(status_code=400, detail=f"Cannot route from stage '{bid.stage}'")

    bid.stage = "pending"
    bid.compile_finished_at = datetime.now(timezone.utc)
    bid.last_action_text = "Routed to Director for HIL approval"
    bid.last_action_by = payload.performed_by
    bid.last_action_at = datetime.now(timezone.utc)

    db.add(BidAuditLog(
        bid_id=bid.bid_id, bid_reference=bid.bid_reference,
        action_type="Routed to Director", role=payload.role, performed_by=payload.performed_by,
        detail=payload.note or "Compilation complete — Director review queue",
        br_reference="BR-002",
    ))
    await db.commit()
    return {"bid_reference": bid_ref, "stage": "pending"}


@router.post("/{bid_ref}/submit")
async def submit_bid(bid_ref: str, payload: ActorPayload,
                     role: str = Depends(get_user_role),
                     db: AsyncSession = Depends(get_db)):
    """Manager submits an 'approved' bid externally."""
    require_manager(role)
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    if bid.stage != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot submit from stage '{bid.stage}'")

    bid.stage = "submitted"
    bid.submitted_at = datetime.now(timezone.utc)
    bid.last_action_text = "Submitted to client portal"
    bid.last_action_by = payload.performed_by
    bid.last_action_at = datetime.now(timezone.utc)

    db.add(BidAuditLog(
        bid_id=bid.bid_id, bid_reference=bid.bid_reference,
        action_type="Submitted", role=payload.role, performed_by=payload.performed_by,
        detail=payload.note or "External submission complete",
        br_reference=None,
    ))
    await db.commit()
    return {"bid_reference": bid_ref, "stage": "submitted"}
