"""
Phase 2 — seed the bid lifecycle tables with rows that match the React mock data.
Idempotent: deletes existing rows in the 5 bid_* tables before inserting.
The 9 module_* tables are NOT touched.
"""
import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import json
from datetime import datetime, date, timezone


def _d(s):
    return date.fromisoformat(s)
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

NOW = datetime.now(timezone.utc)


def days_ago(n):
    return (date(2026, 4, 25) - __import__("datetime").timedelta(days=-n if n > 0 else 0))


# ──────────────────── BIDS ────────────────────
BIDS = [
    {
        "ref": "BID-2026-041", "rfp": None,
        "title": "NHS Digital — Clinical Data Platform", "client": "NHS Digital",
        "stage": "pending", "value": 1240000, "currency": "GBP", "deadline": "2026-04-30",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 22, "approved_margin": 24, "win_prob": 0.62,
        "sections_complete": 7,
        "flags": {"lowConf": 2, "conflicts": 1, "missingRate": 0, "highRisk": 2},
        "tags": ["Healthcare", "High Value", "EU-jurisdiction"],
        "last_action": ("Acked R-02 (BR-005)", "Priya Menon", -11),
    },
    {
        "ref": "BID-2026-040", "rfp": None,
        "title": "BNP Paribas — KYC Automation Engine", "client": "BNP Paribas",
        "stage": "compiling", "value": 890000, "currency": "EUR", "deadline": "2026-05-04",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 25, "approved_margin": None, "win_prob": 0.48,
        "sections_complete": 4,
        "flags": {"lowConf": 4, "conflicts": 0, "missingRate": 1, "highRisk": 1},
        "tags": ["Financial Services", "Compliance"],
        "last_action": ("Pricing compilation running", "Bid Engine", -4),
    },
    {
        "ref": "BID-2026-039", "rfp": None,
        "title": "Centrica — Smart Meter Field Ops", "client": "Centrica plc",
        "stage": "validating", "value": 2150000, "currency": "GBP", "deadline": "2026-05-12",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 20, "approved_margin": None, "win_prob": 0.55,
        "sections_complete": 0,
        "flags": {"lowConf": 0, "conflicts": 0, "missingRate": 0, "highRisk": 0},
        "tags": ["Utilities", "High Value", "Field Services"],
        "last_action": ("Requested Schedule input", "Arjun Kapoor", -32),
    },
    {
        "ref": "BID-2026-038", "rfp": None,
        "title": "DHL Supply Chain — Predictive Routing", "client": "DHL Supply Chain",
        "stage": "approved", "value": 740000, "currency": "EUR", "deadline": "2026-04-26",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 22, "approved_margin": 23, "win_prob": 0.71,
        "sections_complete": 8,
        "flags": {"lowConf": 0, "conflicts": 0, "missingRate": 0, "highRisk": 0},
        "tags": ["Logistics", "AI/ML"],
        "last_action": ("Submitted to DHL portal", "Arjun Kapoor", -60),
    },
    {
        "ref": "BID-2026-037", "rfp": None,
        "title": "TfL — Passenger Flow Analytics", "client": "Transport for London",
        "stage": "submitted", "value": 615000, "currency": "GBP", "deadline": "2026-04-15",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 24, "approved_margin": 24, "win_prob": 0.66,
        "sections_complete": 8,
        "flags": {"lowConf": 0, "conflicts": 0, "missingRate": 0, "highRisk": 0},
        "tags": ["Public Sector", "Submitted"],
        "outcome": "Awarded",
        "last_action": ("Outcome received: Awarded", "Bid Engine", -2880),
    },
    {
        "ref": "BID-2026-036", "rfp": None,
        "title": "Allianz — Claims Triage AI", "client": "Allianz Group",
        "stage": "pending", "value": 1860000, "currency": "EUR", "deadline": "2026-05-02",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 22, "approved_margin": 22, "win_prob": 0.58,
        "sections_complete": 8,
        "flags": {"lowConf": 1, "conflicts": 0, "missingRate": 0, "highRisk": 3},
        "tags": ["Insurance", "High Value"],
        "last_action": ("Opened HIL review", "Priya Menon", -6),
    },
    {
        "ref": "BID-2026-035", "rfp": None,
        "title": "Lloyds — Fraud Signal Aggregator", "client": "Lloyds Banking Group",
        "stage": "compiling", "value": 425000, "currency": "GBP", "deadline": "2026-05-08",
        "manager": "Arjun Kapoor", "director": "Priya Menon",
        "compiled_margin": 23, "approved_margin": None, "win_prob": 0.52,
        "sections_complete": 5,
        "flags": {"lowConf": 2, "conflicts": 1, "missingRate": 0, "highRisk": 0},
        "tags": ["Financial Services"],
        "last_action": ("Compilation 5/8 sections", "Bid Engine", -18),
    },
]

SECTIONS_TEMPLATE = [
    ("effort",       "Effort Estimation",    "solution_module",    "v3.2"),
    ("schedule",     "Delivery Schedule",    "solution_module",    "v2.1"),
    ("pricing",      "Task-wise Pricing",    "pricing_module",     "v1.4"),
    ("quality",      "Quality Framework",    "quality_module",     "v1.0"),
    ("deliverables", "Deliverable Register", "deliverable_module", "v2.0"),
    ("risks",        "Risk Register",        "risk_module",        "v1.7"),
    ("dependencies", "Dependency Map",       "dependency_module",  "v1.7"),
    ("acceptance",   "Acceptance Criteria",  "acceptance_module",  "v1.2"),
]

# section status mix per bid (matches mock data feel)
def sections_for_bid(bid):
    n = bid["sections_complete"]
    statuses = {}
    keys = [s[0] for s in SECTIONS_TEMPLATE]
    if bid["stage"] == "validating":
        for k in keys: statuses[k] = "pending"
    elif bid["stage"] == "compiling":
        for i, k in enumerate(keys):
            statuses[k] = "approved" if i < n else ("flagged" if i == n else "pending")
    elif bid["stage"] == "pending":
        for i, k in enumerate(keys):
            statuses[k] = "approved" if i < n else "flagged"
    elif bid["stage"] in ("approved", "submitted"):
        for k in keys: statuses[k] = "approved"
    return statuses


# ──────────────────── RISKS for the headline bid ────────────────────
RISKS = [
    ("R-01", "Source data quality varies across legacy NHS Trust feeds",            "Data",       "High",   "High",   "High",   "Two-stage validation pipeline + Trust-specific transforms",      "Data Lead",          False),
    ("R-02", "Information governance approval timing on patient data flows",        "Compliance", "Medium", "High",   "High",   "Pre-engagement IG steering with NHS Digital DPO",                "Compliance Lead",    False),
    ("R-03", "Concurrent rollout to 6 ICBs strains Field Engineering capacity",     "Resource",   "Medium", "Medium", "Medium", "Phased ICB onboarding aligned to FE bench",                      "Delivery Lead",      True),
    ("R-04", "Model drift over 24-month operating window",                          "AI/ML",      "Medium", "Medium", "Medium", "Quarterly retraining contract + drift dashboard",                "ML Lead",            True),
    ("R-05", "Scheduling overlap with EHR integration milestone",                   "Schedule",   "Medium", "Low",    "Low",    "Buffer week + dependency-driven re-sequencing",                  None,                 False),
    ("R-06", "Currency exposure on contracted GBP price during 18-month delivery",  "Financial",  "Low",    "Medium", "Low",    "Forward-contract via Treasury per quarter",                      "Finance Lead",       True),
    ("R-07", "Sub-contractor security clearance lead time",                         "Resource",   "Low",    "Medium", "Low",    "Pre-cleared bench + SC sponsorship pipeline",                    "People Ops",         True),
    ("R-08", "Acceptance criteria interpretation on \"near real-time\"",            "Scope",      "Low",    "Low",    "Low",    "Glossary appendix in SoW + signed-off SLAs",                     "Solution Architect", True),
]

# ──────────────────── AUDIT LOG ────────────────────
AUDIT = [
    ("2026-04-25 09:14:02", "BID-2026-041", "Pricing",    "Compiled",        None,           "Total £105,000",                "Bid Engine",   "System",   "Initial pricing draft from rate card",      None),
    ("2026-04-25 09:18:44", "BID-2026-041", "Schedule",   "Flagged",         None,           "Resource conflict W6",          "Bid Engine",   "System",   "BR-002 conflict: ML Engineer over-allocated", "BR-002"),
    ("2026-04-25 09:31:12", "BID-2026-041", "Pricing",    "Edited",          "20% margin",   "22% margin",                    "Priya Menon",  "Director", "BR-003 margin override applied",            "BR-003"),
    ("2026-04-25 09:34:08", "BID-2026-041", "Pricing",    "Approved",        "£105,000",     "£107,140",                      "Arjun Kapoor", "Manager",  "Director sign-off on margin variance",      "BR-003"),
    ("2026-04-25 09:42:51", "BID-2026-041", "Risks",      "Acknowledged",    None,           "R-01 acknowledged",             "Priya Menon",  "Director", "BR-005 high-risk ack — vendor delay",       "BR-005"),
    ("2026-04-25 09:48:19", "BID-2026-041", "Risks",      "Acknowledged",    None,           "R-02 acknowledged",             "Priya Menon",  "Director", "BR-005 high-risk ack — data access",        "BR-005"),
    ("2026-04-25 09:49:30", "BID-2026-041", "Feedback",   "Rejected",        None,           "R-05 owner gap → RFP Solution", "Bid Engine",   "System",   "BR-006 corrective feedback dispatched",     "BR-006"),
    ("2026-04-25 10:02:12", "BID-2026-040", "Validation", "Input Confirmed", None,           "Talent Alignment payload",      "Bid Engine",   "System",   "BR-001 input registered",                   "BR-001"),
    ("2026-04-25 10:14:55", "BID-2026-038", "Submission", "Approved",        "7/8",          "8/8 sections",                  "Priya Menon",  "Director", "Final HIL approval gate cleared",           "BR-002"),
    ("2026-04-25 10:24:01", "BID-2026-038", "Submission", "Submitted",       None,           "DHL portal submitted",          "Arjun Kapoor", "Manager",  "External submission receipt #DHL-RFP-2026-0411", None),
]


async def main():
    async with engine.begin() as conn:
        # Wipe in FK order
        for t in ["bid_compilation_runs", "bid_audit_log", "bid_risks", "bid_sections", "bids"]:
            await conn.execute(text(f"DELETE FROM {t}"))
        print("Cleared existing bid_* rows.")

        # Bids
        for b in BIDS:
            la_text, la_by, la_min = b["last_action"]
            await conn.execute(text("""
                INSERT INTO bids (
                    bid_reference, rfp_id, title, client_name, stage,
                    assigned_manager, assigned_director,
                    compiled_value, approved_value, currency,
                    compiled_margin_pct, approved_margin_pct,
                    submission_deadline, sections_total, sections_complete,
                    flag_low_conf, flag_conflicts, flag_missing_rate, flag_high_risk,
                    win_probability, tags, outcome,
                    last_action_text, last_action_by, last_action_at
                ) VALUES (
                    :ref, :rfp, :title, :client, :stage,
                    :manager, :director,
                    :value, :approved_value, :currency,
                    :compiled_margin, :approved_margin,
                    :deadline, 8, :sections_complete,
                    :lowconf, :conf, :missrate, :highrisk,
                    :winprob, CAST(:tags AS JSONB), :outcome,
                    :la_text, :la_by, now() + (:la_min || ' minutes')::interval
                )
            """), {
                "ref": b["ref"], "rfp": b["rfp"], "title": b["title"], "client": b["client"], "stage": b["stage"],
                "manager": b["manager"], "director": b["director"],
                "value": b["value"], "approved_value": b["value"] if b["approved_margin"] else None,
                "currency": b["currency"],
                "compiled_margin": b["compiled_margin"], "approved_margin": b["approved_margin"],
                "deadline": _d(b["deadline"]), "sections_complete": b["sections_complete"],
                "lowconf": b["flags"]["lowConf"], "conf": b["flags"]["conflicts"],
                "missrate": b["flags"]["missingRate"], "highrisk": b["flags"]["highRisk"],
                "winprob": b["win_prob"], "tags": json.dumps(b["tags"]),
                "outcome": b.get("outcome"),
                "la_text": la_text, "la_by": la_by, "la_min": str(la_min),
            })

        # Sections
        bid_id_by_ref = {r[0]: r[1] for r in (await conn.execute(text("SELECT bid_reference, bid_id FROM bids"))).all()}
        for b in BIDS:
            statuses = sections_for_bid(b)
            for key, name, source, ver in SECTIONS_TEMPLATE:
                conf = 0.78 + (0 if b["flags"]["lowConf"] == 0 else -0.05)
                flags = []
                if statuses[key] == "flagged":
                    flags = [f"Flag raised during {source} compilation"]
                await conn.execute(text("""
                    INSERT INTO bid_sections (
                        bid_id, section_key, section_name, status,
                        source_module, input_version,
                        confidence_score, flag_count, flags
                    ) VALUES (
                        :bid_id, :key, :name, :status,
                        :source, :ver,
                        :conf, :flag_count, CAST(:flags AS JSONB)
                    )
                """), {
                    "bid_id": bid_id_by_ref[b["ref"]],
                    "key": key, "name": name, "status": statuses[key],
                    "source": source, "ver": ver,
                    "conf": conf, "flag_count": len(flags), "flags": json.dumps(flags),
                })

        # Risks for headline bid
        headline = bid_id_by_ref["BID-2026-041"]
        for ref, desc, cat, prob, impact, sev, mit, owner, ack in RISKS:
            await conn.execute(text("""
                INSERT INTO bid_risks (
                    bid_id, risk_ref, description, category,
                    probability, impact, severity, mitigation, owner,
                    acknowledged, acknowledged_by, acknowledged_at
                ) VALUES (
                    :bid_id, :ref, :desc, :cat,
                    :prob, :impact, :sev, :mit, :owner,
                    :ack, :ackby, :ackat
                )
            """), {
                "bid_id": headline, "ref": ref, "desc": desc, "cat": cat,
                "prob": prob, "impact": impact, "sev": sev, "mit": mit, "owner": owner,
                "ack": ack, "ackby": "Priya Menon" if ack else None,
                "ackat": NOW if ack else None,
            })

        # Audit log
        for ts, ref, sec, action, orig, rev, by, role, detail, br in AUDIT:
            await conn.execute(text("""
                INSERT INTO bid_audit_log (
                    bid_id, bid_reference, section_key, action_type,
                    original_value, revised_value, performed_by, role,
                    detail, br_reference, created_at
                ) VALUES (
                    :bid_id, :ref, :sec, :action,
                    :orig, :rev, :by, :role,
                    :detail, :br, :ts
                )
            """), {
                "bid_id": bid_id_by_ref.get(ref), "ref": ref, "sec": sec, "action": action,
                "orig": orig, "rev": rev, "by": by, "role": role,
                "detail": detail, "br": br, "ts": datetime.fromisoformat(ts).replace(tzinfo=timezone.utc),
            })

        # Verify
        for t in ["bids", "bid_sections", "bid_risks", "bid_audit_log"]:
            cnt = (await conn.execute(text(f"SELECT COUNT(*) FROM {t}"))).scalar()
            print(f"  {t:<20} {cnt} rows")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
