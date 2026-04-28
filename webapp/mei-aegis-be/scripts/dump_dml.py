"""Dump every row in every table as runnable INSERT statements → seed.sql.

Output is qualified with TARGET_SCHEMA. The file starts with TRUNCATE statements
in FK order so you can re-apply it cleanly to a freshly created schema.
"""
import asyncio, json, sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

TARGET_SCHEMA = "mei"  # qualifies every INSERT / TRUNCATE

# Order matters: parents before children for INSERT, children before parents for TRUNCATE.
INSERT_ORDER = [
    # ── Module tables (parent → child) ──
    "rfp_module",
    "solution_module", "resource_module", "pricing_module", "quality_module",
    "deliverable_module", "risk_module", "dependency_module", "acceptance_module",
    # ── Bid lifecycle tables (parent → child) ──
    "bids",
    "bid_sections", "bid_risks", "bid_pricing_lines",
    "bid_compilation_runs", "bid_audit_log",
]


def sql_lit(v):
    """Convert a Python value to a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float, Decimal)):
        return str(v)
    if isinstance(v, UUID):
        return f"'{v}'::uuid"
    if isinstance(v, datetime):
        # asyncpg returns tz-aware datetimes for TIMESTAMPTZ columns
        return f"'{v.isoformat()}'::timestamptz" if v.tzinfo else f"'{v.isoformat()}'::timestamp"
    if isinstance(v, date):
        return f"'{v.isoformat()}'::date"
    if isinstance(v, (dict, list)):
        # JSON / JSONB
        return f"'{json.dumps(v).replace(chr(39), chr(39)+chr(39))}'::jsonb"
    # str / fallback
    s = str(v).replace("'", "''")
    return f"'{s}'"


async def main():
    out_path = Path(__file__).resolve().parents[1] / "scripts" / "seed.sql"
    chunks = []

    chunks.append("-- ============================================================================")
    chunks.append("-- Bid Management — Full DML (data dump)")
    chunks.append(f"-- Generated: {datetime.utcnow().isoformat()}Z")
    chunks.append(f"-- Target schema: '{TARGET_SCHEMA}'")
    chunks.append("-- Run order: TRUNCATE (reverse FK) → INSERTs (FK order)")
    chunks.append(f"-- Apply against schema.sql — assumes 15 tables exist under '{TARGET_SCHEMA}'.")
    chunks.append("-- ============================================================================\n")

    chunks.append(f"SET search_path TO {TARGET_SCHEMA}, public;\n")

    def q(t):
        return f"{TARGET_SCHEMA}.{t}"

    async with engine.begin() as conn:
        # ── Reset (children before parents) ──
        chunks.append("-- ── Reset (children first to satisfy FKs) ──")
        for t in reversed(INSERT_ORDER):
            chunks.append(f"TRUNCATE TABLE {q(t)} RESTART IDENTITY CASCADE;")
        chunks.append("")

        # ── INSERTs ──
        for table in INSERT_ORDER:
            # Live data still lives in 'public' on Aiven, so we read from public
            cols = (await conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name = :t
                ORDER BY ordinal_position
            """), {"t": table})).all()
            col_names = [c[0] for c in cols]
            if not col_names:
                continue

            rows = (await conn.execute(text(f"SELECT {', '.join(col_names)} FROM public.{table}"))).all()
            if not rows:
                chunks.append(f"-- {q(table)}: 0 rows\n")
                continue

            chunks.append(f"-- {q(table)}: {len(rows)} rows")
            for row in rows:
                vals = ", ".join(sql_lit(v) for v in row)
                chunks.append(f"INSERT INTO {q(table)} ({', '.join(col_names)}) VALUES ({vals});")
            chunks.append("")

    await engine.dispose()

    out_path.write_text("\n".join(chunks), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"  Tables exported: {len(INSERT_ORDER)}")
    print(f"  Total lines: {len(chunks)}")
    print(f"  File size: {out_path.stat().st_size:,} bytes")


if __name__ == "__main__":
    asyncio.run(main())
