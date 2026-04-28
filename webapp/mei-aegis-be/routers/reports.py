from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from datetime import date, timedelta
from collections import OrderedDict

router = APIRouter()


FX_TO_GBP = {"GBP": 1.0, "EUR": 0.85, "USD": 0.79}


@router.get("/dashboard")
async def dashboard_metrics(db: AsyncSession = Depends(get_db)):
    # ── Pipeline value + counts (multi-currency aware, normalised to GBP) ──
    rows = (await db.execute(text(
        "SELECT compiled_value, currency FROM bids WHERE stage != 'submitted'"
    ))).all()
    pipeline_value = sum(
        float(r[0] or 0) * FX_TO_GBP.get(r[1] or "GBP", 1.0) for r in rows
    )

    stage_counts_rows = (await db.execute(text(
        "SELECT stage, COUNT(*) FROM bids GROUP BY stage"
    ))).all()
    stage_counts = {r[0]: r[1] for r in stage_counts_rows}

    # ── Win rate (decided submissions only) ─────────────────────────────────
    win_row = (await db.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE outcome = 'Awarded')        AS won,
          COUNT(*) FILTER (WHERE outcome IN ('Awarded','Not Awarded')) AS decided
        FROM bids
    """))).first()
    won, decided = win_row[0] or 0, win_row[1] or 0
    win_rate = (won / decided * 100) if decided else 0

    # ── HIL Override rate (proportion of edits among approve+edit actions) ──
    or_row = (await db.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE action_type = 'Edited') AS edits,
          COUNT(*) FILTER (WHERE action_type IN ('Edited','Approved')) AS reviewed
        FROM bid_audit_log
    """))).first()
    edits, reviewed = or_row[0] or 0, or_row[1] or 0
    override_rate = (edits / reviewed * 100) if reviewed else 0

    # ── Approval cycle time (compile → final approval) ──────────────────────
    cycle_minutes = (await db.execute(text("""
        SELECT AVG(EXTRACT(EPOCH FROM (hil_approved_at - compile_finished_at))) / 60
        FROM bids
        WHERE hil_approved_at IS NOT NULL AND compile_finished_at IS NOT NULL
    """))).scalar() or 0

    # ── Flag mix (active pipeline only) ─────────────────────────────────────
    fm = (await db.execute(text("""
        SELECT
          COALESCE(SUM(flag_low_conf), 0)     AS low_conf,
          COALESCE(SUM(flag_conflicts), 0)    AS conflicts,
          COALESCE(SUM(flag_missing_rate), 0) AS missing_rate,
          COALESCE(SUM(flag_high_risk), 0)    AS high_risk
        FROM bids
        WHERE stage NOT IN ('submitted')
    """))).first()
    flag_mix = {
        "low_conf":     int(fm[0]),
        "conflicts":    int(fm[1]),
        "missing_rate": int(fm[2]),
        "high_risk":    int(fm[3]),
    }
    flag_mix["total"] = sum(flag_mix.values())

    # ── Pricing variance (compiled vs approved value) ───────────────────────
    pricing_var = (await db.execute(text("""
        SELECT AVG(((approved_value - compiled_value) / NULLIF(compiled_value, 0)) * 100)
        FROM bids
        WHERE compiled_value IS NOT NULL AND approved_value IS NOT NULL
    """))).scalar() or 0

    # ── Compilation accuracy (sections that pass = approved or complete) ────
    accuracy_overall = (await db.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE status IN ('approved','complete'))::float
          / NULLIF(COUNT(*), 0) * 100
        FROM bid_sections
    """))).scalar() or 0

    accuracy_per_section_rows = (await db.execute(text("""
        SELECT section_key,
               COUNT(*) FILTER (WHERE status IN ('approved','complete'))::float
                 / NULLIF(COUNT(*), 0) * 100 AS pct
        FROM bid_sections
        GROUP BY section_key
        ORDER BY section_key
    """))).all()
    accuracy_per_section = [{"section": r[0], "pct": round(float(r[1] or 0), 1)} for r in accuracy_per_section_rows]

    # ── 8-week submitted vs won series ──────────────────────────────────────
    weekly_rows = (await db.execute(text("""
        SELECT date_trunc('week', submitted_at)::date AS week,
               COUNT(*) AS submitted,
               COUNT(*) FILTER (WHERE outcome = 'Awarded') AS won,
               COALESCE(SUM(compiled_value), 0) AS value
        FROM bids
        WHERE submitted_at IS NOT NULL
          AND submitted_at >= now() - interval '9 weeks'
        GROUP BY week
        ORDER BY week
    """))).all()

    # Pad to 8 contiguous weeks ending now (in demo time)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    weeks_index = [monday - timedelta(weeks=i) for i in range(7, -1, -1)]
    series = OrderedDict((w, {"submitted": 0, "won": 0, "value": 0}) for w in weeks_index)
    for r in weekly_rows:
        if r[0] in series:
            series[r[0]] = {"submitted": int(r[1]), "won": int(r[2]), "value": float(r[3] or 0)}

    weekly_series = {
        "weeks":     [w.strftime("W%W") for w in series.keys()],
        "submitted": [v["submitted"] for v in series.values()],
        "won":       [v["won"] for v in series.values()],
        "value":     [round(v["value"] / 1000) for v in series.values()],   # in £k
    }

    return {
        "active_pipeline_value":   float(pipeline_value or 0),
        "pending_approvals":       int(stage_counts.get("pending", 0)),
        "active_compilations":     int(stage_counts.get("compiling", 0)) + int(stage_counts.get("validating", 0)),
        "total_bids":              int(sum(stage_counts.values())),
        "win_rate_pct":            round(float(win_rate), 1),
        "win_count":               int(won),
        "decided_count":           int(decided),
        "hil_override_rate_pct":   round(float(override_rate), 1),
        "approval_cycle_minutes":  round(float(cycle_minutes), 1) if cycle_minutes else 0,
        "compilation_accuracy_pct":round(float(accuracy_overall), 1),
        "accuracy_per_section":    accuracy_per_section,
        "flag_mix":                flag_mix,
        "pricing_variance_pct":    round(float(pricing_var), 2),
        "weekly_series":           weekly_series,
    }


@router.get("/pipeline")
async def pipeline_report(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text(
        "SELECT stage, COUNT(*) FROM bids GROUP BY stage"
    ))).all()
    return {"by_stage": [{"stage": r[0], "count": r[1]} for r in rows]}


# ─── R-02 Compilation Quality Report ────────────────────────────────────────
@router.get("/compilation-quality")
async def report_compilation_quality(db: AsyncSession = Depends(get_db)):
    """Sections flagged during compilation; flag types by section; HIL override rate."""
    by_section = (await db.execute(text("""
        SELECT
          section_key,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE flag_count > 0)        AS flagged,
          COUNT(*) FILTER (WHERE status = 'returned')   AS returned,
          COUNT(*) FILTER (WHERE status = 'approved')   AS approved,
          AVG(confidence_score)::float                  AS avg_confidence
        FROM bid_sections
        GROUP BY section_key
        ORDER BY section_key
    """))).all()

    overrides = (await db.execute(text("""
        SELECT section_key,
               COUNT(*) FILTER (WHERE action_type = 'Edited')   AS edits,
               COUNT(*) FILTER (WHERE action_type = 'Approved') AS approvals
        FROM bid_audit_log
        WHERE section_key IS NOT NULL
        GROUP BY section_key
    """))).all()
    override_map = {r[0]: {"edits": r[1] or 0, "approvals": r[2] or 0} for r in overrides}

    return {
        "by_section": [
            {
                "section":         r[0],
                "total":           int(r[1]),
                "flagged":         int(r[2]),
                "returned":        int(r[3]),
                "approved":        int(r[4]),
                "avg_confidence":  round(float(r[5] or 0), 2),
                "edits":           override_map.get(r[0], {}).get("edits", 0),
                "override_rate":   round(override_map.get(r[0], {}).get("edits", 0)
                                        / max(override_map.get(r[0], {}).get("approvals", 1), 1) * 100, 1),
            }
            for r in by_section
        ],
    }


# ─── R-03 Pricing Variance Report ───────────────────────────────────────────
@router.get("/pricing-variance")
async def report_pricing_variance(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT bid_reference, client_name, currency,
               compiled_value, approved_value,
               compiled_margin_pct, approved_margin_pct,
               outcome
        FROM bids
        WHERE compiled_value IS NOT NULL AND approved_value IS NOT NULL
        ORDER BY bid_reference DESC
    """))).all()
    return {
        "bids": [
            {
                "bid_reference":     r[0],
                "client":            r[1],
                "currency":          r[2],
                "compiled_value":    float(r[3]),
                "approved_value":    float(r[4]),
                "variance_value":    float(r[4]) - float(r[3]),
                "variance_pct":      round((float(r[4]) - float(r[3])) / float(r[3]) * 100, 2) if r[3] else 0,
                "compiled_margin":   float(r[5]) if r[5] else 0,
                "approved_margin":   float(r[6]) if r[6] else 0,
                "outcome":           r[7],
            }
            for r in rows
        ],
    }


# ─── R-04 Approval & Correction Report ──────────────────────────────────────
@router.get("/approval-correction")
async def report_approval_correction(db: AsyncSession = Depends(get_db)):
    bids_rows = (await db.execute(text("""
        SELECT b.bid_reference, b.client_name, b.stage,
               EXTRACT(EPOCH FROM (b.hil_approved_at - b.compile_finished_at)) / 60 AS cycle_minutes,
               (SELECT COUNT(*) FROM bid_audit_log WHERE bid_reference = b.bid_reference AND action_type = 'Edited')      AS edits,
               (SELECT COUNT(*) FROM bid_audit_log WHERE bid_reference = b.bid_reference AND action_type = 'Approved')    AS approvals,
               (SELECT COUNT(*) FROM bid_audit_log WHERE bid_reference = b.bid_reference AND action_type = 'Rejected')    AS rejections
        FROM bids b
        WHERE b.hil_approved_at IS NOT NULL OR b.stage IN ('pending', 'approved', 'submitted')
        ORDER BY cycle_minutes NULLS LAST
        LIMIT 30
    """))).all()

    section_corrections = (await db.execute(text("""
        SELECT section_key,
               COUNT(*) FILTER (WHERE action_type = 'Edited')   AS edits,
               COUNT(*) FILTER (WHERE action_type = 'Rejected') AS rejections
        FROM bid_audit_log
        WHERE section_key IS NOT NULL
        GROUP BY section_key
        ORDER BY edits DESC
    """))).all()

    reviewer_volume = (await db.execute(text("""
        SELECT performed_by, role, COUNT(*) AS actions
        FROM bid_audit_log
        WHERE role IN ('Director', 'Manager')
        GROUP BY performed_by, role
        ORDER BY actions DESC
    """))).all()

    return {
        "bids": [
            {
                "bid_reference": r[0], "client": r[1], "stage": r[2],
                "cycle_minutes": round(float(r[3]), 1) if r[3] else None,
                "edits":         int(r[4] or 0),
                "approvals":     int(r[5] or 0),
                "rejections":    int(r[6] or 0),
            } for r in bids_rows
        ],
        "section_corrections": [
            {"section": r[0], "edits": int(r[1] or 0), "rejections": int(r[2] or 0)}
            for r in section_corrections
        ],
        "reviewer_volume": [
            {"reviewer": r[0], "role": r[1], "actions": int(r[2])}
            for r in reviewer_volume
        ],
    }


# ─── R-05 Outcome & Conversion Report ───────────────────────────────────────
@router.get("/outcomes")
async def report_outcomes(db: AsyncSession = Depends(get_db)):
    by_outcome = (await db.execute(text("""
        SELECT outcome, COUNT(*) AS cnt, SUM(compiled_value) AS total_value, AVG(compiled_value) AS avg_value
        FROM bids
        WHERE outcome IS NOT NULL
        GROUP BY outcome
    """))).all()

    by_band = (await db.execute(text("""
        SELECT
          CASE
            WHEN compiled_value < 500000   THEN '<£500k'
            WHEN compiled_value < 1000000  THEN '£500k–£1M'
            WHEN compiled_value < 2000000  THEN '£1M–£2M'
            ELSE '>£2M'
          END AS band,
          COUNT(*) FILTER (WHERE outcome = 'Awarded')      AS won,
          COUNT(*) FILTER (WHERE outcome = 'Not Awarded')  AS lost,
          COUNT(*)                                          AS total
        FROM bids
        WHERE outcome IS NOT NULL
        GROUP BY band
        ORDER BY MIN(compiled_value)
    """))).all()

    by_client = (await db.execute(text("""
        SELECT client_name,
               COUNT(*) FILTER (WHERE outcome = 'Awarded')     AS won,
               COUNT(*) FILTER (WHERE outcome = 'Not Awarded') AS lost
        FROM bids
        WHERE outcome IS NOT NULL
        GROUP BY client_name
        ORDER BY won DESC, lost DESC
        LIMIT 10
    """))).all()

    return {
        "by_outcome": [
            {"outcome": r[0], "count": int(r[1]), "total_value": float(r[2] or 0), "avg_value": float(r[3] or 0)}
            for r in by_outcome
        ],
        "by_value_band": [
            {"band": r[0], "won": int(r[1]), "lost": int(r[2]), "total": int(r[3])}
            for r in by_band
        ],
        "by_client": [
            {"client": r[0], "won": int(r[1]), "lost": int(r[2])}
            for r in by_client
        ],
    }


# ─── R-06 Risk Profile Report ───────────────────────────────────────────────
@router.get("/risk-profile")
async def report_risk_profile(db: AsyncSession = Depends(get_db)):
    by_severity = (await db.execute(text("""
        SELECT severity,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE acknowledged = TRUE) AS acked,
               COUNT(*) FILTER (WHERE owner IS NOT NULL AND owner <> '') AS has_owner
        FROM bid_risks
        GROUP BY severity
        ORDER BY CASE severity WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
    """))).all()

    by_category = (await db.execute(text("""
        SELECT category,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE severity = 'High') AS high
        FROM bid_risks
        GROUP BY category
        ORDER BY total DESC
    """))).all()

    high_unacked = (await db.execute(text("""
        SELECT b.bid_reference, br.risk_ref, br.description, br.owner
        FROM bid_risks br
        JOIN bids b ON b.bid_id = br.bid_id
        WHERE br.severity = 'High' AND br.acknowledged = FALSE
        LIMIT 20
    """))).all()

    return {
        "by_severity": [
            {
                "severity":  r[0],
                "total":     int(r[1]),
                "acked":     int(r[2]),
                "has_owner": int(r[3]),
                "ack_rate":  round(int(r[2]) / max(int(r[1]), 1) * 100, 1),
            } for r in by_severity
        ],
        "by_category": [
            {"category": r[0], "total": int(r[1]), "high": int(r[2])}
            for r in by_category
        ],
        "high_unacked": [
            {"bid_reference": r[0], "risk_ref": r[1], "description": r[2], "owner": r[3]}
            for r in high_unacked
        ],
    }
