"""
Migration: move all 15 tables and their auto-increment sequences from
the 'public' schema into a new 'mei' schema on the live Aiven database.

Idempotent — checks the current schema before moving each object.
Run this once, then update DATABASE_URL / connect_args so the backend
sees mei in its search_path.
"""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

TABLES_IN_FK_ORDER = [
    'rfp_module',
    'solution_module', 'resource_module', 'pricing_module', 'quality_module',
    'deliverable_module', 'risk_module', 'dependency_module', 'acceptance_module',
    'bids',
    'bid_sections', 'bid_risks', 'bid_pricing_lines',
    'bid_compilation_runs', 'bid_audit_log',
]


async def main():
    async with engine.begin() as conn:
        # 1. Create the schema
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS mei"))
        print("[OK] schema 'mei' exists")

        # 2. Move tables that are still in 'public'
        moved_tables = 0
        for t in TABLES_IN_FK_ORDER:
            row = (await conn.execute(text("""
                SELECT table_schema FROM information_schema.tables
                WHERE table_name = :t AND table_schema IN ('public','mei')
            """), {"t": t})).first()
            if not row:
                print(f"  --{t}: not found anywhere"); continue
            if row[0] == 'mei':
                print(f"  .{t}: already in mei"); continue
            await conn.execute(text(f"ALTER TABLE public.{t} SET SCHEMA mei"))
            print(f"  -> {t}: public -> mei")
            moved_tables += 1

        # 3. Move all sequences that belong to these tables
        seqs = (await conn.execute(text("""
            SELECT sequence_schema, sequence_name
            FROM information_schema.sequences
            WHERE sequence_schema IN ('public','mei')
            ORDER BY sequence_name
        """))).all()
        moved_seqs = 0
        for sch, name in seqs:
            if sch == 'mei':
                print(f"  .sequence {name}: already in mei"); continue
            await conn.execute(text(f"ALTER SEQUENCE public.{name} SET SCHEMA mei"))
            print(f"  -> sequence {name}: public -> mei")
            moved_seqs += 1

        # 4. Verify
        remaining = (await conn.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              AND table_name = ANY(:names)
        """), {"names": TABLES_IN_FK_ORDER})).all()

        print(f"\nMoved {moved_tables} tables, {moved_seqs} sequences.")
        if remaining:
            print(f"[WARN] still in public: {[r[0] for r in remaining]}")
        else:
            print("[OK] all 15 tables now in mei")

        # Sanity: count rows in a few key tables
        for t in ('rfp_module', 'bids', 'bid_audit_log'):
            n = (await conn.execute(text(f"SELECT COUNT(*) FROM mei.{t}"))).scalar()
            print(f"  mei.{t}: {n} rows")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
