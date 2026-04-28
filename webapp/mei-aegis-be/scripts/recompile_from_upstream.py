"""
Recomputes the effort + schedule sections for every bid that has an rfp_id link,
using the real compile engine against upstream module data.

This is what AC-02 / AC-03 want: derived calculations, not hardcoded numbers.
Bids without rfp_id keep their templated mock content.
"""
import asyncio
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from sqlalchemy.orm.attributes import flag_modified
from database import engine, AsyncSessionLocal
from compile_engine import compute_effort, compute_schedule


async def main():
    async with AsyncSessionLocal() as db:
        bids = (await db.execute(text(
            "SELECT bid_id, bid_reference, rfp_id FROM bids WHERE rfp_id IS NOT NULL ORDER BY bid_reference"
        ))).all()
        print(f"Bids with rfp_id: {len(bids)}")

        for bid_id, bid_ref, rfp_id in bids:
            print(f"\n{bid_ref}  (RFP {rfp_id})")

            # Effort
            effort = await compute_effort(db, rfp_id)
            if effort:
                await db.execute(text("""
                    UPDATE bid_sections
                    SET compiled_data = CAST(:cd AS JSONB),
                        flags         = CAST(:flags AS JSONB),
                        flag_count    = :fc,
                        confidence_score = :conf,
                        updated_at = now()
                    WHERE bid_id = :bid_id AND section_key = 'effort'
                """), {
                    "cd": json.dumps(effort), "flags": json.dumps(effort["flags"]),
                    "fc": len(effort["flags"]), "conf": effort["summary"]["avg_confidence"],
                    "bid_id": bid_id,
                })
                print(f"  effort:   {effort['summary']['task_count']} tasks · "
                      f"{effort['summary']['total_hours']}h · "
                      f"avg confidence {effort['summary']['avg_confidence']} · "
                      f"{len(effort['flags'])} flag(s)")
            else:
                print(f"  effort:   no upstream data for {rfp_id}")

            # Schedule
            start = date.today() + timedelta(days=14)
            sched = await compute_schedule(db, rfp_id, start)
            if sched:
                await db.execute(text("""
                    UPDATE bid_sections
                    SET compiled_data = CAST(:cd AS JSONB),
                        flags         = CAST(:flags AS JSONB),
                        flag_count    = :fc,
                        updated_at = now()
                    WHERE bid_id = :bid_id AND section_key = 'schedule'
                """), {
                    "cd": json.dumps(sched), "flags": json.dumps(sched["conflicts"]),
                    "fc": len(sched["conflicts"]),
                    "bid_id": bid_id,
                })
                print(f"  schedule: {len(sched['milestones'])} milestones · "
                      f"{sched['duration_weeks']} weeks · "
                      f"{len(sched['conflicts'])} conflict(s)")
            else:
                print(f"  schedule: no upstream data for {rfp_id}")

        await db.commit()
        print("\nDone.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
