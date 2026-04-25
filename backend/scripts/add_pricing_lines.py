"""
Adds bid_pricing_lines table + seeds it for active bids.
Idempotent: CREATE IF NOT EXISTS, skips bids that already have lines.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

DDL = """
CREATE TABLE IF NOT EXISTS bid_pricing_lines (
    line_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id           UUID NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    line_no          INTEGER NOT NULL,
    task             VARCHAR(255) NOT NULL,
    role             VARCHAR(100),
    rate             NUMERIC(10, 2),
    hours            INTEGER,
    unit             VARCHAR(20)  DEFAULT 'hour',
    margin_pct       NUMERIC(5, 2),
    is_missing_rate  BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (bid_id, line_no)
);
CREATE INDEX IF NOT EXISTS idx_bid_pricing_lines_bid_id ON bid_pricing_lines (bid_id);
"""

LINES = [
    ('Discovery & Requirements Workshop',  'Solution Architect',  950, 40,  20, False),
    ('Discovery & Requirements Workshop',  'Business Analyst',    650, 60,  20, False),
    ('Data Source Mapping',                'Data Engineer',       750, 80,  20, False),
    ('Data Source Mapping',                'Solution Architect',  950, 24,  20, False),
    ('Reference Architecture',             'Solution Architect',  950, 48,  20, False),
    ('Pipeline Build — Ingestion',         'Data Engineer',       750, 96,  20, False),
    ('Pipeline Build — Transformation',    'Data Engineer',       750, 80,  22, False),
    ('ML Feature Engineering',             'ML Engineer',         850, 56,  22, False),
    ('Model Training & Validation',        'ML Engineer',         850, 72,  22, False),
    ('API Layer & Integration',            'Backend Engineer',    700, 64,  20, False),
    ('Compliance & Audit Hardening',       'Compliance Engineer', None, 32, 20, True),  # Missing rate!
    ('UAT Support & Handover',             'Solution Architect',  950, 24,  20, False),
]


async def main():
    async with engine.begin() as conn:
        for stmt in [s.strip() for s in DDL.split(";") if s.strip()]:
            await conn.execute(text(stmt))
        print("Table bid_pricing_lines created (or already existed).")

        bids = (await conn.execute(text(
            "SELECT bid_id, bid_reference FROM bids WHERE stage IN ('compiling','pending','approved','submitted') ORDER BY bid_reference"
        ))).all()

        for bid_id, ref in bids:
            existing = (await conn.execute(text(
                "SELECT COUNT(*) FROM bid_pricing_lines WHERE bid_id = :id"
            ), {"id": bid_id})).scalar()
            if existing > 0:
                print(f"  {ref}: skipped ({existing} lines exist)")
                continue
            for i, (task, role, rate, hours, margin, missing) in enumerate(LINES, start=1):
                await conn.execute(text("""
                    INSERT INTO bid_pricing_lines
                      (bid_id, line_no, task, role, rate, hours, margin_pct, is_missing_rate)
                    VALUES (:b, :n, :t, :r, :rt, :h, :m, :mr)
                """), {"b": bid_id, "n": i, "t": task, "r": role, "rt": rate, "h": hours, "m": margin, "mr": missing})
            print(f"  {ref}: 12 lines inserted")

        cnt = (await conn.execute(text("SELECT COUNT(*) FROM bid_pricing_lines"))).scalar()
        print(f"\nTotal pricing lines in DB: {cnt}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
