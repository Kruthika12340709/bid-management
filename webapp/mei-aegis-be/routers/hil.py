from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models.bid import Bid, BidSection, BidAuditLog, BidRisk
from schemas.bid import HILSectionAction, MarginOverride, RiskAck, BidSummary
from auth import get_user_role, require_director, require_manager
from typing import List
from datetime import datetime, timezone

router = APIRouter()


@router.get("/queue", response_model=List[BidSummary])
async def hil_queue(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Bid).where(Bid.stage == "pending").order_by(Bid.submission_deadline)
    )
    return result.scalars().all()


@router.post("/{bid_ref}/sections/{section_key}/approve")
async def approve_section(bid_ref: str, section_key: str, payload: HILSectionAction,
                          role: str = Depends(get_user_role),
                          db: AsyncSession = Depends(get_db)):
    require_director(role)
    """
    Approve the section. If field-level edits are present in approved_data, log
    action_type='Edited+Approved' with summary; otherwise log 'Approved'.
    Per MVP §4.3: audit log entries should record 'Approved / Edited+Approved / Rejected'
    as the action with original/revised values when edited.
    """
    bid, section = await _get_bid_and_section(db, bid_ref, section_key)
    section.status      = "approved"
    section.approved_by = payload.performed_by
    section.approved_at = datetime.now(timezone.utc)

    edits = section.approved_data or {}
    has_edits = isinstance(edits, dict) and len(edits) > 0

    if has_edits:
        # Build a compact summary of original / revised for the audit log
        originals = " · ".join(f"{k}: {v.get('original', '')}" for k, v in edits.items() if isinstance(v, dict))
        revised   = " · ".join(f"{k}: {v.get('revised', '')}"  for k, v in edits.items() if isinstance(v, dict))
        action    = "Edited+Approved"
    else:
        originals = None
        revised   = "approved"
        action    = "Approved"

    await _log(db, bid, section_key, action, originals, revised,
               payload.performed_by, payload.role, payload.note, "BR-002")
    await _recount(db, bid)
    await db.commit()
    return {
        "status": "approved",
        "action": action,
        "edits_count": len(edits) if has_edits else 0,
        "bid_reference": bid.bid_reference,
        "section_key": section_key,
    }


@router.post("/{bid_ref}/sections/{section_key}/edit")
async def edit_section(bid_ref: str, section_key: str, payload: HILSectionAction,
                       role: str = Depends(get_user_role),
                       db: AsyncSession = Depends(get_db)):
    require_director(role)
    """
    Store a field-level edit in section.approved_data (BR-08 correction logging).
    Does NOT log a separate audit entry — the audit happens when the section
    is subsequently approved (logs as 'Edited+Approved' with the accumulated edits).

    payload.note format: "fieldKey: original → revised"
    payload.revised_value: the new value
    """
    bid, section = await _get_bid_and_section(db, bid_ref, section_key)

    # Prefer explicit fields; fall back to parsing the note for older clients
    field_key = payload.field_key or "field"
    original  = payload.original_value or ""
    revised   = payload.revised_value  or ""

    if payload.note and (not field_key or field_key == "field"):
        before, _, after = payload.note.partition(":")
        if before:
            field_key = before.strip()
        if "→" in after and not original:
            o, _, r = after.partition("→")
            original = o.strip()
            if not revised:
                revised = r.strip()

    # Merge into approved_data JSON
    edits = dict(section.approved_data or {})
    edits[field_key] = {"original": original, "revised": revised}
    section.approved_data = edits
    section.correction_note = payload.note

    # Mark this row as needing re-save by SQLAlchemy (JSONB mutability)
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(section, "approved_data")

    await db.commit()
    return {
        "status": "edited",
        "bid_reference": bid.bid_reference,
        "section_key": section_key,
        "field": field_key,
        "edits_count": len(edits),
    }


@router.post("/{bid_ref}/sections/{section_key}/reject")
async def reject_section(bid_ref: str, section_key: str, payload: HILSectionAction,
                         role: str = Depends(get_user_role),
                         db: AsyncSession = Depends(get_db)):
    require_director(role)
    bid, section = await _get_bid_and_section(db, bid_ref, section_key)
    section.status = "returned"
    section.correction_note = payload.note
    await _log(db, bid, section_key, "Rejected", None, payload.note, payload.performed_by, payload.role, payload.note, "BR-006")
    await _recount(db, bid)
    await db.commit()
    return {"status": "returned", "bid_reference": bid.bid_reference, "section_key": section_key}


@router.post("/{bid_ref}/margin-override")
async def margin_override(bid_ref: str, payload: MarginOverride,
                          role: str = Depends(get_user_role),
                          db: AsyncSession = Depends(get_db)):
    require_director(role)
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    old = bid.compiled_margin_pct
    bid.approved_margin_pct = payload.new_margin_pct
    await _log(db, bid, "Pricing", "Edited", str(old), str(payload.new_margin_pct), payload.performed_by, "Director", payload.note, "BR-003")
    await db.commit()
    return {"approved_margin_pct": str(payload.new_margin_pct)}


@router.post("/{bid_ref}/sign-off")
async def director_sign_off(bid_ref: str, payload: HILSectionAction,
                            role: str = Depends(get_user_role),
                            db: AsyncSession = Depends(get_db)):
    require_director(role)
    """Director final sign-off: bid moves from pending → approved (after all 8 sections approved)."""
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    not_approved = (await db.execute(
        select(func.count()).select_from(BidSection)
        .where(BidSection.bid_id == bid.bid_id, BidSection.status != "approved")
    )).scalar() or 0
    if not_approved > 0:
        raise HTTPException(status_code=400, detail=f"{not_approved} sections still need approval")

    bid.stage = "approved"
    bid.hil_approved_at = datetime.now(timezone.utc)
    bid.hil_approved_by = payload.performed_by
    await _log(db, bid, None, "Sign-off", None, "8/8 sections approved", payload.performed_by, payload.role,
               "Director final HIL sign-off — routed back to Manager for submission", "BR-002")
    await db.commit()
    return {"bid_reference": bid_ref, "stage": "approved"}


@router.post("/{bid_ref}/manager-co-approve")
async def manager_co_approve(bid_ref: str, payload: HILSectionAction,
                             role: str = Depends(get_user_role),
                             db: AsyncSession = Depends(get_db)):
    require_manager(role)
    """Co-approval: Manager confirms a Director-driven action (e.g. margin override or high-risk bid)."""
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    bid.manager_co_approved_at = datetime.now(timezone.utc)
    bid.manager_co_approved_by = payload.performed_by
    await _log(db, bid, None, "Co-Approved", None, "Manager confirmed",
               payload.performed_by, payload.role,
               payload.note or "BR-003/BR-005 secondary confirmation", "BR-003")
    await db.commit()
    return {"bid_reference": bid_ref, "co_approved": True}


@router.post("/{bid_ref}/risks/{risk_ref}/acknowledge")
async def acknowledge_risk(bid_ref: str, risk_ref: str, payload: RiskAck,
                           role: str = Depends(get_user_role),
                           db: AsyncSession = Depends(get_db)):
    require_director(role)
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    risk = (await db.execute(
        select(BidRisk).where(BidRisk.bid_id == bid.bid_id, BidRisk.risk_ref == risk_ref)
    )).scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    risk.acknowledged = True
    risk.acknowledged_by = payload.performed_by
    risk.acknowledged_at = datetime.now(timezone.utc)
    await _log(db, bid, "Risks", "Acknowledged", None, f"{risk.risk_ref} acknowledged",
               payload.performed_by, "Director", risk.description, "BR-005")
    await db.commit()
    return {"acknowledged": True, "risk_ref": risk.risk_ref}


# ─── helpers ─────────────────────────────────────────────────────────

async def _get_bid_and_section(db, bid_ref, section_key):
    bid = (await db.execute(select(Bid).where(Bid.bid_reference == bid_ref))).scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail=f"Bid {bid_ref} not found")
    section = (await db.execute(
        select(BidSection).where(BidSection.bid_id == bid.bid_id, BidSection.section_key == section_key)
    )).scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail=f"Section {section_key} not found")
    return bid, section


async def _log(db, bid, section_key, action, original, revised, performer, role, detail, br_ref):
    db.add(BidAuditLog(
        bid_id=bid.bid_id,
        bid_reference=bid.bid_reference,
        section_key=section_key,
        action_type=action,
        original_value=str(original) if original else None,
        revised_value=str(revised) if revised else None,
        performed_by=performer,
        role=role,
        detail=detail,
        br_reference=br_ref,
    ))
    bid.last_action_text = f"{action} {section_key}"
    bid.last_action_by = performer
    bid.last_action_at = datetime.now(timezone.utc)


async def _recount(db, bid):
    cnt = (await db.execute(
        select(func.count()).select_from(BidSection).where(BidSection.bid_id == bid.bid_id, BidSection.status == "approved")
    )).scalar() or 0
    bid.sections_complete = cnt
    if cnt == bid.sections_total:
        bid.stage = "approved"
        bid.hil_approved_at = datetime.now(timezone.utc)
