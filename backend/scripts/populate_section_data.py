"""
Populates bid_sections.compiled_data with realistic JSON content for each section,
so the BidDetail page renders content from the DB instead of hardcoded mock JSX.

Idempotent: only updates rows where compiled_data IS NULL.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine


SECTION_PAYLOADS = {
    "effort": {
        "summary": {"total_hours": 676, "avg_confidence": 0.80, "task_count": 12},
        # MVP §6.1 fields: Task name, resource role, estimated hours, confidence score, source reference
        "tasks": [
            {"id": "T-01", "name": "Discovery & Requirements",        "role": "Solution Architect",  "hours": 40, "confidence": 0.92, "source_ref": "RFP-Solution.tasks[0]"},
            {"id": "T-02", "name": "Discovery & Requirements",        "role": "Business Analyst",    "hours": 60, "confidence": 0.88, "source_ref": "RFP-Solution.tasks[1]"},
            {"id": "T-03", "name": "Data Source Mapping",             "role": "Data Engineer",       "hours": 80, "confidence": 0.81, "source_ref": "RFP-Solution.tasks[2]"},
            {"id": "T-04", "name": "Data Source Mapping",             "role": "Solution Architect",  "hours": 24, "confidence": 0.58, "source_ref": "RFP-Solution.tasks[3]"},
            {"id": "T-05", "name": "Reference Architecture",          "role": "Solution Architect",  "hours": 48, "confidence": 0.84, "source_ref": "RFP-Solution.tasks[4]"},
            {"id": "T-06", "name": "Pipeline Build — Ingestion",      "role": "Data Engineer",       "hours": 96, "confidence": 0.79, "source_ref": "RFP-Solution.tasks[5]"},
            {"id": "T-07", "name": "Pipeline Build — Transformation", "role": "Data Engineer",       "hours": 80, "confidence": 0.82, "source_ref": "RFP-Solution.tasks[6]"},
            {"id": "T-08", "name": "ML Feature Engineering",          "role": "ML Engineer",         "hours": 56, "confidence": 0.75, "source_ref": "Talent-Alignment.tasks[0]"},
            {"id": "T-09", "name": "Model Training & Validation",     "role": "ML Engineer",         "hours": 72, "confidence": 0.61, "source_ref": "Talent-Alignment.tasks[1]"},
            {"id": "T-10", "name": "API Layer & Integration",         "role": "Backend Engineer",    "hours": 64, "confidence": 0.86, "source_ref": "RFP-Solution.tasks[8]"},
            {"id": "T-11", "name": "Compliance & Audit",              "role": "Compliance Engineer", "hours": 32, "confidence": 0.90, "source_ref": "RFP-Solution.tasks[9]"},
            {"id": "T-12", "name": "UAT Support & Handover",          "role": "Solution Architect",  "hours": 24, "confidence": 0.88, "source_ref": "RFP-Solution.tasks[10]"},
        ],
    },
    "schedule": {
        "duration_weeks": 14,
        # Kept for the gantt visual
        "phases": [
            {"name": "Discovery",      "weeks": [1, 2, 3]},
            {"name": "Build",          "weeks": [4, 5, 6, 7, 8, 9, 10]},
            {"name": "UAT & Handover", "weeks": [11, 12, 13, 14]},
        ],
        # MVP §6.2 fields: Milestone name, start date, end date, predecessor tasks, responsible role, delivery mode
        "milestones": [
            {"name": "Discovery sign-off",         "start_date": "2026-05-01", "end_date": "2026-05-21", "predecessor": None,                    "role": "Solution Architect", "mode": "remote"},
            {"name": "Reference architecture",     "start_date": "2026-05-22", "end_date": "2026-06-04", "predecessor": "Discovery sign-off",     "role": "Solution Architect", "mode": "remote"},
            {"name": "Pipeline build complete",    "start_date": "2026-06-05", "end_date": "2026-07-09", "predecessor": "Reference architecture", "role": "Data Engineer",      "mode": "remote"},
            {"name": "ML model validated",         "start_date": "2026-07-10", "end_date": "2026-07-30", "predecessor": "Pipeline build complete","role": "ML Engineer",        "mode": "remote"},
            {"name": "API integration complete",   "start_date": "2026-07-31", "end_date": "2026-08-13", "predecessor": "ML model validated",     "role": "Backend Engineer",   "mode": "remote"},
            {"name": "UAT cohort 1",               "start_date": "2026-08-14", "end_date": "2026-08-27", "predecessor": "API integration complete","role": "Solution Architect","mode": "on-site"},
            {"name": "Production cutover",         "start_date": "2026-08-28", "end_date": "2026-09-03", "predecessor": "UAT cohort 1",           "role": "Delivery Lead",      "mode": "on-site"},
            {"name": "Hypercare handover",         "start_date": "2026-09-04", "end_date": "2026-10-04", "predecessor": "Production cutover",     "role": "Delivery Lead",      "mode": "remote"},
        ],
        "conflicts": [
            {"type": "resource", "week": 6, "description": "Solution Architect double-booked"},
        ],
    },
    # MVP §6.5 fields: name, description, format, acceptance condition, responsible party
    "deliverables": [
        {"id": "DV-01", "name": "Solution Design Document",  "description": "End-to-end architecture, data flows, integration points",  "format": "PDF + DOCX",       "acceptance": "Approved by Solution Architect",     "responsible": "Centific Lead Architect"},
        {"id": "DV-02", "name": "Production Data Pipelines", "description": "Ingestion + transformation pipelines with IaC modules",     "format": "Source code + IaC", "acceptance": "Pipelines pass acceptance test suite", "responsible": "Centific Data Lead"},
        {"id": "DV-03", "name": "Trained ML Models",         "description": "Versioned model artefacts with performance reports",         "format": "Versioned artefacts","acceptance": "Validation against held-out test set", "responsible": "Centific ML Lead"},
        {"id": "DV-04", "name": "Compliance & Audit Pack",   "description": "DPIA, IG sign-off, DSPT submission, security review",        "format": "PDF",              "acceptance": "IG sign-off received from NHS DPO",    "responsible": "Centific Compliance Lead"},
        {"id": "DV-05", "name": "Operations Runbook",        "description": "Day-2 operations, monitoring, incident response procedures","format": "Confluence + PDF", "acceptance": "Reviewed in joint session",            "responsible": "Centific Delivery Lead"},
    ],
    # MVP §6.8 fields: Criterion description, measurement method, verification approach, responsible party
    "acceptance": {
        "criteria": [
            {"id": "AC-01", "description": "Compiled clinical data flows match the documented data dictionary with zero unmapped fields.", "measurement": "Schema diff report",            "verification": "Automated test in CI",                       "responsible": "Data Lead"},
            {"id": "AC-02", "description": "End-to-end pipeline latency for in-scope feeds is less than 90 minutes from source landing.",  "measurement": "Synthetic latency probe",       "verification": "Production monitoring 7-day rolling avg",     "responsible": "Platform Eng"},
            {"id": "AC-03", "description": "Trained models meet or exceed the agreed AUC threshold of 0.82 on the held-out test set.",     "measurement": "Model evaluation script",       "verification": "Joint review with ML Lead",                   "responsible": "ML Lead"},
            {"id": "AC-04", "description": "All HSCN integrations pass NHS Digital security review before production cutover.",            "measurement": "Penetration test report",       "verification": "NHS Digital security board sign-off",         "responsible": "Compliance Lead"},
            {"id": "AC-05", "description": "Compliance pack (DPIA + IG approval + DSPT) is filed and acknowledged by NHS Digital.",        "measurement": "Filing receipt from DPO",       "verification": "Email confirmation from NHS DPO office",      "responsible": "Compliance Lead"},
            {"id": "AC-06", "description": "Operations runbook reviewed and signed off by NHS Digital Service Operations Lead.",           "measurement": "Signed sign-off form",          "verification": "Joint review session minutes",                "responsible": "Delivery Lead"},
            {"id": "AC-07", "description": "Centific delivers training to two cohorts of NHS Trust users (≤25 attendees each).",           "measurement": "Attendance register",           "verification": "Post-training feedback survey ≥ 80% positive","responsible": "Delivery Lead"},
            {"id": "AC-08", "description": "Knowledge transfer artefacts delivered and reviewed in a joint handover workshop.",            "measurement": "Workshop attendance + KT pack", "verification": "Trust IT signs off KT pack",                   "responsible": "Solution Architect"},
            {"id": "AC-09", "description": "Hypercare period of 30 calendar days post go-live with a defined SLA.",                        "measurement": "Hypercare ticket log",          "verification": "Daily standups + SLA dashboard",              "responsible": "Delivery Lead"},
        ],
    },
    # MVP §6.4 fields: Standard name, measurement method, target threshold, verification approach
    "quality": {
        "standards":  ["NIST 800-53", "FISMA", "ISO 27001", "GDPR", "DSPT", "Cyber Essentials Plus"],
        "metrics": [
            {"metric": "Code coverage",         "target": "≥ 85%",       "measurement": "CI suite output",                      "verification": "Codecov report on every PR"},
            {"metric": "Performance SLA",       "target": "p95 < 90 min","measurement": "Synthetic monitoring",                 "verification": "Grafana dashboard + weekly review"},
            {"metric": "Defect escape rate",    "target": "< 2%",        "measurement": "Post-release issues / total tickets",  "verification": "Quarterly defect review"},
            {"metric": "Compliance audit score","target": "≥ 95%",       "measurement": "DSPT submission result",               "verification": "External audit attestation"},
        ],
    },
    # MVP §6.7 fields: Dependency description, type, linked task/deliverable, resolution owner
    "dependencies": {
        "internal": [
            {"name": "Existing data lake access",  "type": "internal", "linked_task": "T-03 Data Source Mapping",   "owner": "Platform Eng", "status": "confirmed"},
            {"name": "Identity / SSO integration", "type": "internal", "linked_task": "T-10 API Layer",              "owner": "Security",      "status": "confirmed"},
            {"name": "Compliance review board",    "type": "internal", "linked_task": "DV-04 Compliance Pack",       "owner": "Legal",         "status": "scheduled"},
            {"name": "Bench availability",         "type": "internal", "linked_task": "All build phases",            "owner": "People Ops",    "status": "confirmed"},
        ],
        "external": [
            {"name": "NHS Digital DPO sign-off",   "type": "external", "linked_task": "DV-04 Compliance Pack",       "owner": "NHS DPO",       "status": "scheduled"},
            {"name": "HSCN connection certificate","type": "external", "linked_task": "T-10 API Layer",              "owner": "NHS Digital",   "status": "pending"},
            {"name": "Trust IG agreement",         "type": "external", "linked_task": "DV-04 Compliance Pack",       "owner": "Trust IG Lead", "status": "pending"},
        ],
    },
}


async def main():
    async with engine.begin() as conn:
        # Re-populate all matching sections with the latest payloads (idempotent overwrite).
        sections = (await conn.execute(text("""
            SELECT section_id, bid_id, section_key
            FROM bid_sections
            WHERE section_key IN ('effort','schedule','deliverables','acceptance','quality','dependencies')
        """))).all()
        print(f"Sections to update: {len(sections)}")

        for sec_id, bid_id, key in sections:
            payload = SECTION_PAYLOADS.get(key)
            if not payload:
                continue
            await conn.execute(text("""
                UPDATE bid_sections
                SET compiled_data = CAST(:payload AS JSONB), updated_at = now()
                WHERE section_id = :id
            """), {"payload": json.dumps(payload), "id": sec_id})

        cnt = (await conn.execute(text("SELECT COUNT(*) FROM bid_sections WHERE compiled_data IS NOT NULL"))).scalar()
        print(f"Sections with compiled_data: {cnt}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
