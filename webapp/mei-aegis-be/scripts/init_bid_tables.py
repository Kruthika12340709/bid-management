"""
Phase 1 — create the bid-lifecycle tables on top of the existing 9 module tables.

Adds: bids, bid_sections, bid_risks, bid_audit_log, bid_compilation_runs.
The 9 module_* tables (rfp_module, solution_module, ...) are NOT touched —
they are the BR-001 upstream input source. Bids reference rfp_module.rfp_id.

Idempotent (CREATE TABLE IF NOT EXISTS).
"""
import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine

DDL = """
CREATE TABLE IF NOT EXISTS bids (
    bid_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_reference           VARCHAR(50)  UNIQUE NOT NULL,
    rfp_id                  VARCHAR(100) REFERENCES rfp_module(rfp_id) ON DELETE SET NULL,
    title                   VARCHAR(255) NOT NULL,
    client_name             VARCHAR(255),
    stage                   VARCHAR(50)  NOT NULL DEFAULT 'validating',
    assigned_manager        VARCHAR(100),
    assigned_director       VARCHAR(100),
    compiled_value          NUMERIC(15, 2),
    approved_value          NUMERIC(15, 2),
    currency                VARCHAR(3)   DEFAULT 'GBP',
    compiled_margin_pct     NUMERIC(5, 2),
    approved_margin_pct     NUMERIC(5, 2),
    submission_deadline     DATE,
    sections_total          INTEGER      DEFAULT 8,
    sections_complete       INTEGER      DEFAULT 0,
    flag_low_conf           INTEGER      DEFAULT 0,
    flag_conflicts          INTEGER      DEFAULT 0,
    flag_missing_rate       INTEGER      DEFAULT 0,
    flag_high_risk          INTEGER      DEFAULT 0,
    win_probability         NUMERIC(4, 3),
    tags                    JSONB,
    compile_started_at      TIMESTAMPTZ,
    compile_finished_at     TIMESTAMPTZ,
    hil_approved_at         TIMESTAMPTZ,
    hil_approved_by         VARCHAR(100),
    manager_co_approved_at  TIMESTAMPTZ,
    manager_co_approved_by  VARCHAR(100),
    submitted_at            TIMESTAMPTZ,
    outcome                 VARCHAR(50),
    last_action_text        VARCHAR(255),
    last_action_by          VARCHAR(100),
    last_action_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bid_sections (
    section_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id              UUID         NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    section_key         VARCHAR(50)  NOT NULL,
    section_name        VARCHAR(100) NOT NULL,
    status              VARCHAR(50)  NOT NULL DEFAULT 'pending',
    compiled_data       JSONB,
    approved_data       JSONB,
    source_module       VARCHAR(100),
    input_version       VARCHAR(50),
    confidence_score    NUMERIC(4, 3),
    flag_count          INTEGER      DEFAULT 0,
    flags               JSONB,
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ,
    correction_note     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bid_id, section_key)
);

CREATE TABLE IF NOT EXISTS bid_risks (
    risk_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id          UUID         NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    risk_ref        VARCHAR(20),
    description     TEXT         NOT NULL,
    category        VARCHAR(100),
    probability     VARCHAR(20),
    impact          VARCHAR(20),
    severity        VARCHAR(20),
    mitigation      TEXT,
    owner           VARCHAR(100),
    acknowledged    BOOLEAN      DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bid_audit_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id          UUID         REFERENCES bids(bid_id) ON DELETE SET NULL,
    bid_reference   VARCHAR(50),
    section_key     VARCHAR(50),
    action_type     VARCHAR(100) NOT NULL,
    original_value  TEXT,
    revised_value   TEXT,
    performed_by    VARCHAR(100),
    role            VARCHAR(50),
    detail          TEXT,
    br_reference    VARCHAR(20),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bid_compilation_runs (
    run_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id          UUID NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(50) NOT NULL DEFAULT 'running',
    elapsed_seconds INTEGER,
    sources_merged  INTEGER,
    avg_confidence  NUMERIC(4, 3),
    flags_raised    INTEGER,
    detail          JSONB
);

CREATE INDEX IF NOT EXISTS idx_bid_sections_bid_id     ON bid_sections (bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_risks_bid_id        ON bid_risks (bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_audit_log_bid_id    ON bid_audit_log (bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_audit_log_action    ON bid_audit_log (action_type);
CREATE INDEX IF NOT EXISTS idx_bid_audit_log_created   ON bid_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_stage              ON bids (stage);
CREATE INDEX IF NOT EXISTS idx_bids_deadline           ON bids (submission_deadline);
"""


async def main():
    async with engine.begin() as conn:
        for stmt in [s.strip() for s in DDL.split(";") if s.strip()]:
            await conn.execute(text(stmt))
        print("Tables created (or already existed):")
        rows = (await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name LIKE 'bid%' "
            "ORDER BY table_name"
        ))).all()
        for r in rows:
            cnt = (await conn.execute(text(f'SELECT COUNT(*) FROM "{r[0]}"'))).scalar()
            print(f"  {r[0]:<28} ({cnt} rows)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
