"""
Seeds bid_sections for every bid that has none.
Assigns realistic statuses based on the bid's stage.
"""
import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

SECTIONS = [
    ("effort",       "Effort Estimation",    "solution_module",    "v3.2", 0.82),
    ("schedule",     "Delivery Schedule",    "solution_module",    "v2.1", 0.88),
    ("pricing",      "Task-wise Pricing",    "pricing_module",     "v1.4", 0.79),
    ("quality",      "Quality Framework",    "quality_module",     "v1.0", 0.91),
    ("deliverables", "Deliverable Register", "deliverable_module", "v2.0", 0.85),
    ("risks",        "Risk Register",        "risk_module",        "v1.7", 0.76),
    ("dependencies", "Dependency Map",       "dependency_module",  "v1.7", 0.80),
    ("acceptance",   "Acceptance Criteria",  "acceptance_module",  "v1.2", 0.93),
]

# Status for each section based on bid stage
def section_status(bid_stage: str, key: str) -> str:
    if bid_stage in ("submitted", "approved"):
        return "approved"
    if bid_stage == "pending":
        # mostly approved, effort has flagged
        return "flagged" if key == "effort" else "approved"
    if bid_stage == "compiling":
        # mix: first 5 complete, last 3 pending
        idx = [s[0] for s in SECTIONS].index(key)
        if idx < 5:
            return "complete"
        return "pending"
    return "complete"

SECTION_FLAGS = {
    "effort": ["Low-confidence task T-09 (0.61) — review ML estimates"],
    "risks":  ["R-02 missing mitigation detail"],
}


async def main():
    async with engine.begin() as conn:
        bids = (await conn.execute(text(
            "SELECT bid_id, bid_reference, stage FROM bids ORDER BY bid_reference"
        ))).all()
        print(f"Found {len(bids)} bids")

        seeded = 0
        for bid_id, bid_ref, stage in bids:
            existing = (await conn.execute(text(
                "SELECT COUNT(*) FROM bid_sections WHERE bid_id = :bid_id"
            ), {"bid_id": bid_id})).scalar()

            if existing and existing > 0:
                print(f"  {bid_ref}: already has {existing} sections — skipping")
                continue

            print(f"  {bid_ref} (stage={stage}): seeding {len(SECTIONS)} sections…")
            for key, name, source, ver, conf in SECTIONS:
                status = section_status(stage, key)
                flags  = SECTION_FLAGS.get(key, []) if status in ("flagged", "complete") else []
                await conn.execute(text("""
                    INSERT INTO bid_sections
                        (bid_id, section_key, section_name, status,
                         source_module, input_version,
                         confidence_score, flag_count, flags)
                    VALUES
                        (:bid_id, :key, :name, :status,
                         :source, :ver,
                         :conf, :flag_count, CAST(:flags AS JSONB))
                """), {
                    "bid_id":     bid_id,
                    "key":        key,
                    "name":       name,
                    "status":     status,
                    "source":     source,
                    "ver":        ver,
                    "conf":       conf,
                    "flag_count": len(flags),
                    "flags":      json.dumps(flags),
                })
            seeded += 1

        total = (await conn.execute(text("SELECT COUNT(*) FROM bid_sections"))).scalar()
        print(f"\nDone — seeded {seeded} bids. Total bid_sections rows: {total}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
