"""
/api/inputs/* — reads from the 9 module_* tables (BR-001 upstream input source).

Used by the Input Validation Dashboard. Each module table represents one of the
8 BR-001 input categories for a given RFP. "Confirm Compilation" creates a new
bid + 8 sections progressively over ~20 seconds (simulated compilation).
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from database import get_db, AsyncSessionLocal
from models.bid import Bid, BidSection, BidAuditLog
from auth import get_user_role, require_manager
from typing import List, Dict, Any
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel

router = APIRouter()

# (category, table, select_cols)  — first col after created_at is the primary data field
INPUT_CATEGORIES = [
    ("RFP/RFQ document",     "rfp_module",         "created_at, title, client_name, deadline, duration_days"),
    ("Effort estimation",    "solution_module",    "created_at, tasks"),
    ("Delivery schedule",    "solution_module",    "created_at, task_dependencies"),
    ("Quality framework",    "quality_module",     "created_at, metrics"),
    ("Deliverable register", "deliverable_module", "created_at, deliverables"),
    ("Risks & dependencies", "risk_module",        "created_at, risks"),
    ("Pricing inputs",       "pricing_module",     "created_at, rate_card, margin_percentage, total_estimated_cost"),
    ("Acceptance criteria",  "acceptance_module",  "created_at, acceptance_criteria"),
]


def _parse(val):
    import json as _json
    if isinstance(val, str):
        try:
            return _json.loads(val)
        except Exception:
            return None
    return val


def _validate_input(category: str, table: str, row) -> list:
    """Content-validate a fetched module row. Returns list of human-readable issues."""
    issues = []

    if table == "rfp_module":
        title, client_name, deadline, duration_days = row[1], row[2], row[3], row[4]
        if not title or not str(title).strip():
            issues.append("title is empty")
        if not client_name or not str(client_name).strip():
            issues.append("client_name is empty")
        if not deadline:
            issues.append("deadline is missing")
        if not duration_days or int(duration_days) <= 0:
            issues.append("duration_days must be a positive integer")

    elif table == "solution_module" and category == "Effort estimation":
        tasks = _parse(row[1])
        if not tasks or not isinstance(tasks, list) or len(tasks) == 0:
            issues.append("tasks array is empty or missing")
        else:
            for i, t in enumerate(tasks):
                if not t.get("id"):
                    issues.append(f"task[{i}] missing 'id'")
                if not t.get("name"):
                    issues.append(f"task[{i}] missing 'name'")
                hours = t.get("estimated_hours", 0)
                if not hours or float(hours) <= 0:
                    issues.append(f"task[{i}] estimated_hours must be > 0")
                conf = t.get("confidence")
                if conf is None or not (0 <= float(conf) <= 1):
                    issues.append(f"task[{i}] confidence must be 0–1")

    elif table == "solution_module" and category == "Delivery schedule":
        deps = _parse(row[1])
        if deps is None:
            issues.append("task_dependencies field is null")
        elif not isinstance(deps, list):
            issues.append("task_dependencies must be an array")

    elif table == "quality_module":
        metrics = _parse(row[1])
        if not metrics or not isinstance(metrics, list) or len(metrics) == 0:
            issues.append("metrics array is empty or missing")
        else:
            for i, m in enumerate(metrics):
                for field in ("metric", "target", "measurement"):
                    if not m.get(field):
                        issues.append(f"metric[{i}] missing '{field}'")

    elif table == "deliverable_module":
        deliverables = _parse(row[1])
        if not deliverables or not isinstance(deliverables, list) or len(deliverables) == 0:
            issues.append("deliverables array is empty or missing")
        else:
            for i, d in enumerate(deliverables):
                for field in ("name", "description", "owner"):
                    if not d.get(field):
                        issues.append(f"deliverable[{i}] missing '{field}'")

    elif table == "risk_module":
        risks = _parse(row[1])
        if not risks or not isinstance(risks, list) or len(risks) == 0:
            issues.append("risks array is empty or missing")
        else:
            for i, r in enumerate(risks):
                for field in ("risk", "probability", "impact", "mitigation"):
                    if not r.get(field):
                        issues.append(f"risk[{i}] missing '{field}'")

    elif table == "pricing_module":
        rate_card = _parse(row[1])
        margin = row[2]
        cost = row[3]
        if not rate_card or not isinstance(rate_card, dict) or len(rate_card) == 0:
            issues.append("rate_card is empty or missing")
        if margin is None:
            issues.append("margin_percentage is missing")
        elif not (0 < float(margin) < 100):
            issues.append(f"margin_percentage ({margin}) must be between 0 and 100")
        if not cost or float(cost) <= 0:
            issues.append("total_estimated_cost must be > 0")

    elif table == "acceptance_module":
        criteria = _parse(row[1])
        if not criteria or not isinstance(criteria, list) or len(criteria) == 0:
            issues.append("acceptance_criteria array is empty or missing")

    return issues


LOW_CONFIDENCE_THRESHOLD = 0.75


def _compute_confidence(category: str, table: str, row) -> float:
    if table == "rfp_module":
        fields = [row[1], row[2], row[3], row[4]]
        filled = sum(1 for f in fields if f is not None and str(f).strip())
        return round(filled / len(fields), 2)

    elif table == "solution_module" and category == "Effort estimation":
        tasks = _parse(row[1]) or []
        if not tasks:
            return 0.0
        confs = [float(t.get("confidence", 0.5)) for t in tasks if isinstance(t, dict)]
        return round(sum(confs) / len(confs), 2) if confs else 0.5

    elif table == "solution_module":
        deps = _parse(row[1])
        if deps is None:
            return 0.0
        return 0.9 if isinstance(deps, list) else 0.5

    elif table == "quality_module":
        metrics = _parse(row[1]) or []
        if not metrics:
            return 0.0
        complete = sum(1 for m in metrics if all(m.get(f) for f in ("metric", "target", "measurement")))
        return round(complete / len(metrics), 2)

    elif table == "deliverable_module":
        items = _parse(row[1]) or []
        if not items:
            return 0.0
        complete = sum(1 for d in items if all(d.get(f) for f in ("name", "description", "owner")))
        return round(complete / len(items), 2)

    elif table == "risk_module":
        risks = _parse(row[1]) or []
        if not risks:
            return 0.0
        complete = sum(1 for r in risks if all(r.get(f) for f in ("risk", "probability", "impact", "mitigation")))
        return round(complete / len(risks), 2)

    elif table == "pricing_module":
        score = 0.0
        rate_card = _parse(row[1])
        margin, cost = row[2], row[3]
        if rate_card and isinstance(rate_card, dict) and len(rate_card) > 0:
            score += 0.4
        if margin is not None and 0 < float(margin) < 100:
            score += 0.3
        if cost and float(cost) > 0:
            score += 0.3
        return round(score, 2)

    elif table == "acceptance_module":
        criteria = _parse(row[1]) or []
        return 1.0 if criteria and isinstance(criteria, list) and len(criteria) > 0 else 0.0

    return 1.0


SECTIONS_FROM_MODULES = [
    ("effort",       "Effort Estimation",    "solution_module",    "v3.2"),
    ("schedule",     "Delivery Schedule",    "solution_module",    "v2.1"),
    ("pricing",      "Task-wise Pricing",    "pricing_module",     "v1.4"),
    ("quality",      "Quality Framework",    "quality_module",     "v1.0"),
    ("deliverables", "Deliverable Register", "deliverable_module", "v2.0"),
    ("risks",        "Risk Register",        "risk_module",        "v1.7"),
    ("dependencies", "Dependency Map",       "dependency_module",  "v1.7"),
    ("acceptance",   "Acceptance Criteria",  "acceptance_module",  "v1.2"),
]


class CreateFromJsonPayload(BaseModel):
    rfp_id: str
    client_name: str = ""
    title: str = ""
    deadline: date | None = None
    modules: Dict[str, Any]


@router.get("/")
async def list_input_status(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """For every RFP, report status, confidence, and manager decisions for all 8 input categories."""
    rfps = (await db.execute(text(
        "SELECT rfp_id, client_name, title FROM rfp_module ORDER BY rfp_id"
    ))).all()

    out = []
    for rfp in rfps:
        rfp_id = rfp[0]

        existing_bid = (await db.execute(
            select(Bid.bid_reference, Bid.stage).where(Bid.rfp_id == rfp_id)
        )).first()

        # Latest manager decision per category
        decision_rows = (await db.execute(text("""
            SELECT DISTINCT ON (section_key) section_key, detail, performed_by, created_at
            FROM bid_audit_log
            WHERE bid_reference = :rfp_id AND action_type = 'Input Decision'
            ORDER BY section_key, created_at DESC
        """), {"rfp_id": rfp_id})).all()
        decisions = {r[0]: {"action": r[1], "by": r[2], "at": r[3].isoformat() if r[3] else None}
                     for r in decision_rows}

        inputs = []
        for category, table, select_cols in INPUT_CATEGORIES:
            row = (await db.execute(text(
                f"SELECT {select_cols} FROM {table} "
                f"WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1"
            ), {"rfp_id": rfp_id})).first()

            decision = decisions.get(category)

            if not row:
                inputs.append({
                    "module": table, "category": category,
                    "status": "missing", "confidence": 0.0,
                    "ts": None, "issues": [], "decision": decision,
                })
            else:
                issues     = _validate_input(category, table, row)
                confidence = _compute_confidence(category, table, row)
                if issues:
                    status = "invalid"
                elif confidence < LOW_CONFIDENCE_THRESHOLD:
                    status = "low_confidence"
                else:
                    status = "valid"
                inputs.append({
                    "module":     table,
                    "category":   category,
                    "status":     status,
                    "confidence": confidence,
                    "ts":         row[0].isoformat() if row[0] else None,
                    "issues":     issues,
                    "decision":   decision,
                })

        out.append({
            "rfp_id":             rfp_id,
            "client":             rfp[1],
            "title":              rfp[2],
            "inputs":             inputs,
            "compiled_bid_ref":   existing_bid[0] if existing_bid else None,
            "compiled_bid_stage": existing_bid[1] if existing_bid else None,
        })
    return out


@router.post("/{rfp_id}/decisions")
async def record_decision(rfp_id: str, payload: dict,
                          role: str = Depends(get_user_role),
                          db: AsyncSession = Depends(get_db)):
    """Record a manager decision: proceed | request | descope."""
    require_manager(role)
    action   = payload.get("action")
    category = payload.get("category")
    actor    = payload.get("performed_by", "Arjun Kapoor")
    if action not in ("proceed", "request", "descope"):
        raise HTTPException(status_code=400, detail="action must be proceed | request | descope")
    db.add(BidAuditLog(
        action_type="Input Decision",
        role="Manager",
        performed_by=actor,
        bid_reference=rfp_id,
        section_key=category,
        detail=action,
        br_reference="BR-001",
    ))
    await db.commit()
    return {"rfp_id": rfp_id, "category": category, "action": action}


@router.post("/{rfp_id}/request-missing/{category}")
async def request_missing(rfp_id: str, category: str,
                          role: str = Depends(get_user_role),
                          db: AsyncSession = Depends(get_db)):
    require_manager(role)
    db.add(BidAuditLog(
        action_type="Request Missing Data",
        role="Manager",
        performed_by="Arjun Kapoor",
        detail=f"Requested missing input '{category}' for {rfp_id}",
        br_reference="BR-001",
        bid_reference=rfp_id,
    ))
    await db.commit()
    return {"status": "request sent", "rfp_id": rfp_id, "category": category}


async def _compile_section_progressively(bid_id: UUID, bid_ref: str, rfp_id: str | None,
                                         key: str, name: str, source: str, ver: str, delay_seconds: float):
    """Background task — wait, then materialise one section.
    For 'effort' and 'schedule', invoke the real compile engine (AC-02 / AC-03).
    """
    from compile_engine import (
        compute_effort, compute_schedule, compute_pricing,
        compute_quality, compute_deliverables, compute_risks,
        compute_dependencies, compute_acceptance,
    )

    await asyncio.sleep(delay_seconds)
    async with AsyncSessionLocal() as db:
        compiled_data = None
        flag_count = 0
        flags_list: list = []
        confidence = Decimal("0.78")

        if rfp_id:
            if key == "effort":
                compiled_data = await compute_effort(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
                    avg = compiled_data.get("summary", {}).get("avg_confidence", 0.78)
                    confidence = Decimal(str(avg))
            elif key == "schedule":
                start = date.today() + timedelta(days=14)
                compiled_data = await compute_schedule(db, rfp_id, start)
                if compiled_data:
                    flags_list = compiled_data.get("conflicts", [])
                    flag_count = len(flags_list)
            elif key == "pricing":
                compiled_data = await compute_pricing(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
                    confidence = Decimal(str(compiled_data.get("confidence", 0.78)))
            elif key == "quality":
                compiled_data = await compute_quality(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
            elif key == "deliverables":
                compiled_data = await compute_deliverables(db, rfp_id)
                if isinstance(compiled_data, list):
                    compiled_data = {"items": compiled_data, "flags": []}
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
            elif key == "risks":
                compiled_data = await compute_risks(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
            elif key == "dependencies":
                compiled_data = await compute_dependencies(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)
            elif key == "acceptance":
                compiled_data = await compute_acceptance(db, rfp_id)
                if compiled_data:
                    flags_list = compiled_data.get("flags", [])
                    flag_count = len(flags_list)

        db.add(BidSection(
            bid_id=bid_id, section_key=key, section_name=name,
            status="pending", source_module=source, input_version=ver,
            compiled_data=compiled_data,
            confidence_score=confidence,
            flag_count=flag_count,
            flags=flags_list,
        ))
        db.add(BidAuditLog(
            bid_id=bid_id, bid_reference=bid_ref,
            action_type="Section Compiled", role="System", performed_by="Bid Engine",
            section_key=key,
            detail=(f"Compiled section '{name}' from {source} (v{ver}) — "
                    f"{flag_count} flag(s)" if compiled_data else
                    f"Compiled section '{name}' from {source} (v{ver}) — no upstream data, used template"),
            br_reference="BR-002",
        ))
        await db.commit()


async def _finalise_compile(bid_id: UUID, bid_ref: str, total_delay: float):
    """Background task — wait until all sections are compiled, then mark compile_finished_at."""
    await asyncio.sleep(total_delay + 1)
    async with AsyncSessionLocal() as db:
        bid = await db.get(Bid, bid_id)
        if bid:
            bid.stage = "pending"
            bid.compile_finished_at = datetime.now(timezone.utc)
            bid.last_action_text    = "Compilation complete — routed to Director"
            bid.last_action_by      = "Bid Engine"
            bid.last_action_at      = datetime.now(timezone.utc)
            db.add(BidAuditLog(
                bid_id=bid_id, bid_reference=bid_ref,
                action_type="Compiled", role="System", performed_by="Bid Engine",
                detail=f"All 8 sections compiled — ready for Director review",
                br_reference="BR-002",
            ))
            await db.commit()


@router.post("/{rfp_id}/confirm-compilation")
async def confirm_compilation_route(rfp_id: str,
                              role: str = Depends(get_user_role),
                              db: AsyncSession = Depends(get_db)):
    return await _confirm_compilation(rfp_id, role, db)


async def _confirm_compilation(rfp_id: str, role: str, db: AsyncSession):
    require_manager(role)
    """
    Creates the bid immediately, then schedules background tasks that materialise
    the 8 sections one at a time over ~24 seconds (3s apart). The Compilation page
    polls /compilation-telemetry to show live progress.
    """
    existing = (await db.execute(select(Bid).where(Bid.rfp_id == rfp_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Bid {existing.bid_reference} already compiled for {rfp_id}")

    rfp = (await db.execute(text("SELECT title, client_name, deadline FROM rfp_module WHERE rfp_id = :rfp_id"),
                            {"rfp_id": rfp_id})).first()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")

    pricing = (await db.execute(text(
        "SELECT total_estimated_cost, margin_percentage FROM pricing_module WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1"
    ), {"rfp_id": rfp_id})).first()
    cost = Decimal(str(pricing[0])) if pricing and pricing[0] else Decimal("0")
    margin = Decimal(str(pricing[1])) if pricing and pricing[1] else Decimal("20")
    bid_value = (cost / (1 - margin / 100)) if margin < 100 else cost

    last = (await db.execute(text(
        "SELECT bid_reference FROM bids WHERE bid_reference LIKE 'BID-2026-%' ORDER BY bid_reference DESC LIMIT 1"
    ))).first()
    next_n = int(last[0].split("-")[-1]) + 1 if last else 1
    new_ref = f"BID-2026-{next_n:03d}"

    deadline = rfp[2] or (date.today() + timedelta(days=30))

    bid = Bid(
        bid_reference=new_ref,
        rfp_id=rfp_id,
        title=rfp[0] or "Untitled RFP",
        client_name=rfp[1],
        stage="compiling",
        assigned_manager="Arjun Kapoor",
        assigned_director="Priya Menon",
        compiled_value=bid_value,
        currency="GBP",
        compiled_margin_pct=margin,
        submission_deadline=deadline,
        sections_total=8,
        sections_complete=0,
        win_probability=Decimal("0.55"),
        tags=["Auto-compiled", rfp[1] or "Demo"],
        compile_started_at=datetime.now(timezone.utc),
        last_action_text="Compilation started from upstream modules",
        last_action_by="Arjun Kapoor",
        last_action_at=datetime.now(timezone.utc),
    )
    db.add(bid)
    await db.flush()
    bid_id = bid.bid_id

    db.add(BidAuditLog(
        bid_id=bid_id, bid_reference=new_ref, action_type="Input Confirmed",
        role="Manager", performed_by="Arjun Kapoor",
        detail=f"Manager confirmed all 8 inputs for {rfp_id} — compilation started",
        br_reference="BR-001",
    ))
    db.add(BidAuditLog(
        bid_id=bid_id, bid_reference=new_ref, action_type="Compilation Started",
        role="System", performed_by="Bid Engine",
        detail=f"Compiling {new_ref} from 8 upstream module rows",
        br_reference="BR-002",
    ))

    await db.commit()

    # Schedule the 8 sections to compile one every 3 seconds.
    SECTION_INTERVAL_S = 3.0
    for i, (key, name, source, ver) in enumerate(SECTIONS_FROM_MODULES):
        await _compile_section_progressively(
            bid_id, new_ref, rfp_id, key, name, source, ver, delay_seconds=0
        )
    await _finalise_compile(bid_id, new_ref, total_delay=0)

    return {
        "status": "compilation triggered",
        "rfp_id": rfp_id,
        "bid_reference": new_ref,
        "stage": "pending",
        "estimated_seconds": 0,
    }


@router.post("/create-from-json")
async def create_from_json(payload: CreateFromJsonPayload,
                           role: str = Depends(get_user_role),
                           db: AsyncSession = Depends(get_db)):
    require_manager(role)

    import json

    rfp_id = payload.rfp_id
    modules = payload.modules

    if not rfp_id:
        raise HTTPException(status_code=400, detail="rfp_id required")

    if not modules or not isinstance(modules, dict):
        raise HTTPException(status_code=400, detail="modules required")

    required_fields = {
        "rfp_module": ["title"],
        "solution_module": ["tasks", "task_dependencies"],
        "quality_module": ["metrics"],
        "deliverable_module": ["deliverables"],
        "risk_module": ["risks"],
        "dependency_module": ["dependencies", "dependency_mapping"],
        "pricing_module": ["rate_card"],
        "acceptance_module": ["acceptance_criteria"],
    }
    
    # resource_module is optional but needed for roles
    if "resource_module" in modules:
        if not isinstance(modules["resource_module"], dict):
            raise HTTPException(status_code=400, detail="resource_module must be object")
        if "task_allocation" not in modules["resource_module"]:
            raise HTTPException(status_code=400, detail="Missing task_allocation in resource_module")

    for mod, fields in required_fields.items():
        if mod not in modules:
            raise HTTPException(status_code=400, detail=f"Missing module {mod}")
        mod_data = modules[mod]
        if not isinstance(mod_data, dict):
            raise HTTPException(status_code=400, detail=f"{mod} must be object")
        for field in fields:
            if field not in mod_data:
                raise HTTPException(status_code=400, detail=f"Missing {field} in {mod}")

    try:
        # Sync sequences to avoid UniqueViolationError from manually seeded data
        for t_name, pk_col in [
            ("solution_module", "solution_id"), ("resource_module", "resource_id"),
            ("pricing_module", "pricing_id"), ("quality_module", "quality_id"),
            ("deliverable_module", "deliverable_id"), ("risk_module", "risk_id"),
            ("dependency_module", "dependency_id"), ("acceptance_module", "acceptance_id")
        ]:
            await db.execute(text(f"SELECT setval('mei.{t_name}_{pk_col}_seq', COALESCE((SELECT MAX({pk_col}) FROM mei.{t_name}), 1))"))

        # Insert rfp_module
        await db.execute(text(
            "INSERT INTO rfp_module (rfp_id, client_name, title, deadline) "
            "VALUES (:rfp_id, :client_name, :title, :deadline) "
            "ON CONFLICT (rfp_id) DO UPDATE SET client_name = :client_name, title = :title, deadline = :deadline"
        ), {
            "rfp_id": rfp_id,
            "client_name": payload.client_name or "",
            "title": payload.title or "",
            "deadline": payload.deadline,
        })

        # Insert solution_module
        if "solution_module" in modules:
            sol = modules["solution_module"]
            await db.execute(text(
                "INSERT INTO solution_module (rfp_id, tasks, task_dependencies) "
                "VALUES (:rfp_id, :tasks, :task_dependencies)"
            ), {
                "rfp_id": rfp_id,
                "tasks": json.dumps(sol.get("tasks")),
                "task_dependencies": json.dumps(sol.get("task_dependencies")),
            })

        # Insert quality_module
        if "quality_module" in modules:
            qual = modules["quality_module"]
            await db.execute(text(
                "INSERT INTO quality_module (rfp_id, metrics) "
                "VALUES (:rfp_id, :metrics)"
            ), {
                "rfp_id": rfp_id,
                "metrics": json.dumps(qual.get("metrics")),
            })

        # Insert deliverable_module
        if "deliverable_module" in modules:
            deliv = modules["deliverable_module"]
            await db.execute(text(
                "INSERT INTO deliverable_module (rfp_id, deliverables) "
                "VALUES (:rfp_id, :deliverables)"
            ), {
                "rfp_id": rfp_id,
                "deliverables": json.dumps(deliv.get("deliverables")),
            })

        # Insert risk_module
        if "risk_module" in modules:
            risk = modules["risk_module"]
            await db.execute(text(
                "INSERT INTO risk_module (rfp_id, risks) "
                "VALUES (:rfp_id, :risks)"
            ), {
                "rfp_id": rfp_id,
                "risks": json.dumps(risk.get("risks")),
            })

        # Insert dependency_module
        if "dependency_module" in modules:
            dep = modules["dependency_module"]
            await db.execute(text(
                "INSERT INTO dependency_module (rfp_id, dependencies, dependency_mapping) "
                "VALUES (:rfp_id, :dependencies, :dependency_mapping)"
            ), {
                "rfp_id": rfp_id,
                "dependencies": json.dumps(dep.get("dependencies")),
                "dependency_mapping": json.dumps(dep.get("dependency_mapping")),
            })

        # Insert pricing_module
        if "pricing_module" in modules:
            price = modules["pricing_module"]
            rate_card = price.get("rate_card", {})
            if isinstance(rate_card, dict):
                margin = rate_card.get("margin_percentage", price.get("margin_percentage", 20))
                cost = rate_card.get("total_estimated_cost", price.get("total_estimated_cost", 0))
            else:
                margin = price.get("margin_percentage", 20)
                cost = price.get("total_estimated_cost", 0)
            await db.execute(text(
                "INSERT INTO pricing_module (rfp_id, rate_card, margin_percentage, total_estimated_cost) "
                "VALUES (:rfp_id, :rate_card, :margin_percentage, :total_estimated_cost)"
            ), {
                "rfp_id": rfp_id,
                "rate_card": json.dumps(rate_card),
                "margin_percentage": margin,
                "total_estimated_cost": cost,
            })

        # Insert acceptance_module
        if "acceptance_module" in modules:
            accept = modules["acceptance_module"]
            await db.execute(text(
                "INSERT INTO acceptance_module (rfp_id, acceptance_criteria) "
                "VALUES (:rfp_id, :acceptance_criteria)"
            ), {
                "rfp_id": rfp_id,
                "acceptance_criteria": json.dumps(accept.get("acceptance_criteria")),
            })

        # Insert resource_module (optional, for roles)
        if "resource_module" in modules:
            res_mod = modules["resource_module"]
            await db.execute(text(
                "INSERT INTO resource_module (rfp_id, task_allocation) "
                "VALUES (:rfp_id, :task_allocation)"
            ), {
                "rfp_id": rfp_id,
                "task_allocation": json.dumps(res_mod.get("task_allocation")),
            })

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Confirm compilation
    return await _confirm_compilation(rfp_id, role, db)
