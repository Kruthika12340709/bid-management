"""
Backfills timestamps on existing bids and adds a few historical bids so the
Dashboard metrics + 8-week chart have meaningful data.

Idempotent: only inserts bids whose bid_reference doesn't already exist.
"""
import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime, date, timedelta, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine


# Historical bids: ~7 weeks of "submitted" history with mixed outcomes.
# All in the past relative to demo "today" 2026-04-25.
HIST = [
    # ref           client                     value    cur  margin won?     wks_ago
    ("BID-2026-020", "Sodexo Workplace Insights",   720000, "GBP", 24, "Awarded",     7),
    ("BID-2026-021", "Vodafone — Network Forecast", 540000, "GBP", 22, "Awarded",     7),
    ("BID-2026-022", "Aviva — Underwriting Edge",   880000, "GBP", 23, "Not Awarded", 6),
    ("BID-2026-023", "Tesco — Demand Sensing",      465000, "GBP", 25, "Awarded",     6),
    ("BID-2026-024", "Bayer — Trial Analytics",     950000, "EUR", 22, "Not Awarded", 5),
    ("BID-2026-025", "BT Group — Capacity Planner", 380000, "GBP", 24, "Awarded",     5),
    ("BID-2026-026", "ENGIE — Grid Optimiser",      1100000,"EUR", 21, "Awarded",     4),
    ("BID-2026-027", "Santander — AML Engine",      695000, "GBP", 23, "Not Awarded", 4),
    ("BID-2026-028", "Heathrow — Pax Flow",         415000, "GBP", 26, "Awarded",     3),
    ("BID-2026-029", "M&S — Returns Vision",        320000, "GBP", 25, "Awarded",     3),
    ("BID-2026-030", "Standard Chartered — Reg",    760000, "EUR", 22, "Awarded",     2),
    ("BID-2026-031", "Sky — Subscriber Churn",      590000, "GBP", 24, "Not Awarded", 2),
    ("BID-2026-032", "John Lewis — Visual Search",  445000, "GBP", 26, "Awarded",     1),
]

DEMO_TODAY = datetime(2026, 4, 25, 12, 0, 0, tzinfo=timezone.utc)


async def main():
    async with engine.begin() as conn:
        # ── Backfill timestamps on the existing 7 bids so cycle/variance metrics work ──
        await conn.execute(text("""
            UPDATE bids SET
              compile_finished_at = created_at + interval '14 minutes',
              hil_approved_at     = CASE WHEN stage IN ('approved','submitted') THEN created_at + interval '4 hours 12 minutes' ELSE NULL END,
              hil_approved_by     = CASE WHEN stage IN ('approved','submitted') THEN 'Priya Menon' ELSE NULL END,
              submitted_at        = CASE WHEN stage = 'submitted' THEN created_at + interval '5 hours' ELSE NULL END,
              approved_value      = CASE WHEN approved_margin_pct IS NOT NULL THEN compiled_value * (1 + approved_margin_pct/100) / (1 + compiled_margin_pct/100) ELSE approved_value END
            WHERE bid_reference LIKE 'BID-2026-03%' OR bid_reference LIKE 'BID-2026-04%'
        """))

        # ── Insert historical bids (last 8 weeks, mixed outcomes) ──
        existing = {r[0] for r in (await conn.execute(text("SELECT bid_reference FROM bids"))).all()}

        for ref, client, value, cur, margin, outcome, wks in HIST:
            if ref in existing:
                continue
            submitted_at = DEMO_TODAY - timedelta(weeks=wks, days=2)
            compile_started = submitted_at - timedelta(hours=8)
            compile_finished = compile_started + timedelta(minutes=14)
            hil_approved = compile_finished + timedelta(hours=4, minutes=12)
            deadline = (submitted_at + timedelta(days=2)).date()
            approved_margin = margin + 1  # tiny override
            approved_value = int(value * (1 + approved_margin/100) / (1 + margin/100))

            await conn.execute(text("""
                INSERT INTO bids (
                    bid_reference, title, client_name, stage,
                    assigned_manager, assigned_director,
                    compiled_value, approved_value, currency,
                    compiled_margin_pct, approved_margin_pct,
                    submission_deadline, sections_total, sections_complete,
                    flag_low_conf, flag_conflicts, flag_missing_rate, flag_high_risk,
                    win_probability, tags, outcome,
                    compile_started_at, compile_finished_at,
                    hil_approved_at, hil_approved_by, submitted_at,
                    last_action_text, last_action_by, last_action_at
                ) VALUES (
                    :ref, :title, :client, 'submitted',
                    'Arjun Kapoor', 'Priya Menon',
                    :value, :avalue, :cur,
                    :margin, :amargin,
                    :deadline, 8, 8,
                    0, 0, 0, 0,
                    :winprob, CAST(:tags AS JSONB), :outcome,
                    :cs, :cf,
                    :ha, 'Priya Menon', :sa,
                    :last, 'Bid Engine', :sa
                )
            """), {
                "ref": ref, "title": client.split('—')[0].strip() + ' delivery package' if '—' in client else f"{client} engagement",
                "client": client, "value": value, "avalue": approved_value, "cur": cur,
                "margin": margin, "amargin": approved_margin, "deadline": deadline,
                "winprob": 0.62 if outcome == "Awarded" else 0.38,
                "tags": json.dumps(["History"]),
                "outcome": outcome,
                "cs": compile_started, "cf": compile_finished,
                "ha": hil_approved, "sa": submitted_at,
                "last": f"Outcome received: {outcome}",
            })

            # Audit trail for each historical bid
            for action, role, by, det, at in [
                ("Compiled",   "System",   "Bid Engine",    f"{ref} compiled from upstream modules", compile_finished),
                ("Approved",   "Director", "Priya Menon",  "8/8 sections approved",                  hil_approved),
                ("Submitted",  "Manager",  "Arjun Kapoor", f"{client} bid submitted",                submitted_at),
                ("Outcome",    "System",   "Bid Engine",    f"Outcome received: {outcome}",           submitted_at + timedelta(days=14)),
            ]:
                await conn.execute(text("""
                    INSERT INTO bid_audit_log (bid_reference, action_type, role, performed_by, detail, br_reference, created_at)
                    VALUES (:ref, :a, :r, :by, :det, NULL, :at)
                """), {"ref": ref, "a": action, "r": role, "by": by, "det": det, "at": at})

        cnt = (await conn.execute(text("SELECT COUNT(*) FROM bids"))).scalar()
        wins = (await conn.execute(text("SELECT COUNT(*) FROM bids WHERE outcome = 'Awarded'"))).scalar()
        losses = (await conn.execute(text("SELECT COUNT(*) FROM bids WHERE outcome = 'Not Awarded'"))).scalar()
        print(f"Total bids: {cnt}   Awarded: {wins}   Not Awarded: {losses}")
        print(f"Win rate among submitted: {wins / max(wins + losses, 1) * 100:.1f}%")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
