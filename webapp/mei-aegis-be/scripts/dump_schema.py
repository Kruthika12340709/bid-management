"""Reverse-engineer the live DDL from the Aiven database into schema.sql.
Tables are emitted under a target schema (default: 'mei')."""
import asyncio, sys, io
from collections import defaultdict
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

TARGET_SCHEMA = "mei"  # all CREATE TABLE / FK / INDEX statements will use this

GROUP_MODULE = ('rfp_module','solution_module','resource_module','pricing_module','quality_module',
                'deliverable_module','risk_module','dependency_module','acceptance_module')

# Strict FK-safe order (parents before children) for emission.
EMIT_ORDER = [
    # parent
    'rfp_module',
    # other modules (all FK → rfp_module)
    'solution_module', 'resource_module', 'pricing_module', 'quality_module',
    'deliverable_module', 'risk_module', 'dependency_module', 'acceptance_module',
    # bid lifecycle root
    'bids',
    # bid children (all FK → bids)
    'bid_sections', 'bid_risks', 'bid_pricing_lines',
    'bid_compilation_runs', 'bid_audit_log',
]

TYPE_FIX = {
    "character varying":           lambda L: f"VARCHAR({L})" if L else "VARCHAR",
    "character":                   lambda L: f"CHAR({L})" if L else "CHAR",
    "timestamp without time zone": lambda L: "TIMESTAMP",
    "timestamp with time zone":    lambda L: "TIMESTAMPTZ",
    "double precision":            lambda L: "DOUBLE PRECISION",
    "integer":                     lambda L: "INTEGER",
    "boolean":                     lambda L: "BOOLEAN",
    "uuid":                        lambda L: "UUID",
    "text":                        lambda L: "TEXT",
    "date":                        lambda L: "DATE",
    "json":                        lambda L: "JSON",
    "jsonb":                       lambda L: "JSONB",
    "numeric":                     lambda L: "NUMERIC",
}


async def main():
    async with engine.begin() as conn:
        cols = (await conn.execute(text("""
            SELECT table_name, column_name, data_type,
                   character_maximum_length, numeric_precision, numeric_scale,
                   is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """))).all()

        idx = (await conn.execute(text("""
            SELECT tablename, indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE 'pg_%'
            ORDER BY tablename, indexname
        """))).all()

        fks = (await conn.execute(text("""
            SELECT
              tc.table_name AS from_table, kcu.column_name AS from_col,
              ccu.table_name AS to_table,  ccu.column_name AS to_col,
              rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints rc
              ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
            ORDER BY tc.table_name, kcu.column_name
        """))).all()

        pks = (await conn.execute(text("""
            SELECT kcu.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema='public'
            ORDER BY tc.table_name, kcu.ordinal_position
        """))).all()

    by_table = defaultdict(list)
    for r in cols: by_table[r[0]].append(r)
    pk_by = defaultdict(list)
    for t,c in pks: pk_by[t].append(c)
    fk_by = defaultdict(list)
    for r in fks: fk_by[r[0]].append(r)

    out = ["-- ============================================================================",
           f"-- Bid Management — Live DDL (auto-generated; target schema: '{TARGET_SCHEMA}')",
           "-- ============================================================================",
           "",
           f"-- Create the namespace schema and make subsequent unqualified references resolve to it.",
           f"CREATE SCHEMA IF NOT EXISTS {TARGET_SCHEMA};",
           f"SET search_path TO {TARGET_SCHEMA}, public;",
           ""]

    def qualify(t):
        return f"{TARGET_SCHEMA}.{t}"

    def render_table(t):
        lines = [f"CREATE TABLE IF NOT EXISTS {qualify(t)} ("]
        col_lines = []
        for _, name, dtype, char_max, num_p, num_s, nullable, default in by_table[t]:
            length = char_max
            # Auto-increment shorthand: an INTEGER column whose DEFAULT calls nextval()
            # is the equivalent of SERIAL. Emit SERIAL so the sequence is auto-created
            # inside the target schema.
            if default and "nextval(" in default and dtype in ("integer", "bigint", "smallint"):
                ty = {"integer": "SERIAL", "bigint": "BIGSERIAL", "smallint": "SMALLSERIAL"}[dtype]
                default = None
            elif dtype == "numeric" and num_p:
                ty = f"NUMERIC({num_p}, {num_s or 0})"
            else:
                ty = TYPE_FIX.get(dtype, lambda L: dtype.upper())(length)
            null  = "" if nullable == "YES" else " NOT NULL"
            dflt  = f" DEFAULT {default}" if default else ""
            col_lines.append(f"    {name:<24} {ty}{null}{dflt}")
        # PK
        if pk_by[t]:
            col_lines.append(f"    PRIMARY KEY ({', '.join(pk_by[t])})")
        # FKs (target table is also in the target schema)
        for from_t, from_c, to_t, to_c, rule in fk_by[t]:
            col_lines.append(f"    FOREIGN KEY ({from_c}) REFERENCES {qualify(to_t)}({to_c}) ON DELETE {rule}")
        lines.append(",\n".join(col_lines))
        lines.append(");")
        return "\n".join(lines)

    # Emit in FK-safe order; group separators inserted at the right transitions.
    out.append("-- ── GROUP 1: Upstream module tables (BR-001 input source) ──")
    for t in EMIT_ORDER:
        if t not in by_table:
            continue
        if t == "bids":
            out.append("")
            out.append("-- ── GROUP 2: Bid lifecycle tables ──")
        out.append(""); out.append(render_table(t))

    if idx:
        out.append("")
        out.append("-- ── INDEXES ──")
        for t, n, d in idx:
            # Indexes pulled from pg_indexes reference 'public.<table>'; rewrite to the target schema.
            d_rewritten = d.replace(" public.", f" {TARGET_SCHEMA}.")
            out.append(d_rewritten + ";")

    Path(__file__).resolve().parents[1].joinpath("scripts", "schema.sql").write_text("\n".join(out), encoding="utf-8")
    print("Wrote schema.sql")
    print(f"  Tables: {len(by_table)}")
    print(f"  Foreign keys: {len(fks)}")
    print(f"  Indexes (non-PK): {len(idx)}")
    await engine.dispose()


asyncio.run(main())
