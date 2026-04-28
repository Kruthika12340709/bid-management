-- ============================================================================
-- Bid Management — Live DDL (auto-generated; target schema: 'mei')
-- ============================================================================

-- Create the namespace schema and make subsequent unqualified references resolve to it.
CREATE SCHEMA IF NOT EXISTS mei;
SET search_path TO mei, public;

-- ── GROUP 1: Upstream module tables (BR-001 input source) ──

CREATE TABLE IF NOT EXISTS mei.rfp_module (
    rfp_id                   VARCHAR NOT NULL,
    client_name              VARCHAR,
    title                    TEXT,
    deadline                 DATE,
    duration_days            INTEGER,
    requirements             JSON,
    expected_outcomes        JSON,
    constraints              JSON,
    evaluation_criteria      JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rfp_id)
);

CREATE TABLE IF NOT EXISTS mei.solution_module (
    solution_id              SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    approach                 TEXT,
    frameworks               JSON,
    tasks                    JSON,
    task_dependencies        JSON,
    task_deliverable_mapping JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (solution_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.resource_module (
    resource_id              SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    roles                    JSON,
    task_allocation          JSON,
    total_capacity_hours     INTEGER,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (resource_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.pricing_module (
    pricing_id               SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    pricing_model            VARCHAR,
    rate_card                JSON,
    cost_components          JSON,
    margin_percentage        DOUBLE PRECISION,
    total_estimated_cost     DOUBLE PRECISION,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pricing_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.quality_module (
    quality_id               SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    metrics                  JSON,
    compliance_standards     JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (quality_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.deliverable_module (
    deliverable_id           SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    deliverables             JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deliverable_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.risk_module (
    risk_id                  SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    risks                    JSON,
    risk_summary             TEXT,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (risk_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.dependency_module (
    dependency_id            SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    dependencies             JSON,
    dependency_mapping       JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dependency_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.acceptance_module (
    acceptance_id            SERIAL NOT NULL,
    rfp_id                   VARCHAR,
    acceptance_criteria      JSON,
    mapping_to_deliverables  JSON,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (acceptance_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE CASCADE
);

-- ── GROUP 2: Bid lifecycle tables ──

CREATE TABLE IF NOT EXISTS mei.bids (
    bid_id                   UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_reference            VARCHAR(50) NOT NULL,
    rfp_id                   VARCHAR(100),
    title                    VARCHAR(255) NOT NULL,
    client_name              VARCHAR(255),
    stage                    VARCHAR(50) NOT NULL DEFAULT 'validating'::character varying,
    assigned_manager         VARCHAR(100),
    assigned_director        VARCHAR(100),
    compiled_value           NUMERIC(15, 2),
    approved_value           NUMERIC(15, 2),
    currency                 VARCHAR(3) DEFAULT 'GBP'::character varying,
    compiled_margin_pct      NUMERIC(5, 2),
    approved_margin_pct      NUMERIC(5, 2),
    submission_deadline      DATE,
    sections_total           INTEGER DEFAULT 8,
    sections_complete        INTEGER DEFAULT 0,
    flag_low_conf            INTEGER DEFAULT 0,
    flag_conflicts           INTEGER DEFAULT 0,
    flag_missing_rate        INTEGER DEFAULT 0,
    flag_high_risk           INTEGER DEFAULT 0,
    win_probability          NUMERIC(4, 3),
    tags                     JSONB,
    compile_started_at       TIMESTAMPTZ,
    compile_finished_at      TIMESTAMPTZ,
    hil_approved_at          TIMESTAMPTZ,
    hil_approved_by          VARCHAR(100),
    manager_co_approved_at   TIMESTAMPTZ,
    manager_co_approved_by   VARCHAR(100),
    submitted_at             TIMESTAMPTZ,
    outcome                  VARCHAR(50),
    last_action_text         VARCHAR(255),
    last_action_by           VARCHAR(100),
    last_action_at           TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bid_id),
    FOREIGN KEY (rfp_id) REFERENCES mei.rfp_module(rfp_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mei.bid_sections (
    section_id               UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_id                   UUID NOT NULL,
    section_key              VARCHAR(50) NOT NULL,
    section_name             VARCHAR(100) NOT NULL,
    status                   VARCHAR(50) NOT NULL DEFAULT 'pending'::character varying,
    compiled_data            JSONB,
    approved_data            JSONB,
    source_module            VARCHAR(100),
    input_version            VARCHAR(50),
    confidence_score         NUMERIC(4, 3),
    flag_count               INTEGER DEFAULT 0,
    flags                    JSONB,
    approved_by              VARCHAR(100),
    approved_at              TIMESTAMPTZ,
    correction_note          TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (section_id),
    FOREIGN KEY (bid_id) REFERENCES mei.bids(bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.bid_risks (
    risk_id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_id                   UUID NOT NULL,
    risk_ref                 VARCHAR(20),
    description              TEXT NOT NULL,
    category                 VARCHAR(100),
    probability              VARCHAR(20),
    impact                   VARCHAR(20),
    severity                 VARCHAR(20),
    mitigation               TEXT,
    owner                    VARCHAR(100),
    acknowledged             BOOLEAN DEFAULT false,
    acknowledged_by          VARCHAR(100),
    acknowledged_at          TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (risk_id),
    FOREIGN KEY (bid_id) REFERENCES mei.bids(bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.bid_pricing_lines (
    line_id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_id                   UUID NOT NULL,
    line_no                  INTEGER NOT NULL,
    task                     VARCHAR(255) NOT NULL,
    role                     VARCHAR(100),
    rate                     NUMERIC(10, 2),
    hours                    INTEGER,
    unit                     VARCHAR(20) DEFAULT 'hour'::character varying,
    margin_pct               NUMERIC(5, 2),
    is_missing_rate          BOOLEAN DEFAULT false,
    created_at               TIMESTAMPTZ DEFAULT now(),
    updated_at               TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (line_id),
    FOREIGN KEY (bid_id) REFERENCES mei.bids(bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.bid_compilation_runs (
    run_id                   UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_id                   UUID NOT NULL,
    started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at              TIMESTAMPTZ,
    status                   VARCHAR(50) NOT NULL DEFAULT 'running'::character varying,
    elapsed_seconds          INTEGER,
    sources_merged           INTEGER,
    avg_confidence           NUMERIC(4, 3),
    flags_raised             INTEGER,
    detail                   JSONB,
    PRIMARY KEY (run_id),
    FOREIGN KEY (bid_id) REFERENCES mei.bids(bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mei.bid_audit_log (
    log_id                   UUID NOT NULL DEFAULT gen_random_uuid(),
    bid_id                   UUID,
    bid_reference            VARCHAR(50),
    section_key              VARCHAR(50),
    action_type              VARCHAR(100) NOT NULL,
    original_value           TEXT,
    revised_value            TEXT,
    performed_by             VARCHAR(100),
    role                     VARCHAR(50),
    detail                   TEXT,
    br_reference             VARCHAR(20),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (log_id),
    FOREIGN KEY (bid_id) REFERENCES mei.bids(bid_id) ON DELETE SET NULL
);

-- ── INDEXES ──
CREATE INDEX idx_bid_audit_log_action ON mei.bid_audit_log USING btree (action_type);
CREATE INDEX idx_bid_audit_log_bid_id ON mei.bid_audit_log USING btree (bid_id);
CREATE INDEX idx_bid_audit_log_created ON mei.bid_audit_log USING btree (created_at DESC);
CREATE UNIQUE INDEX bid_pricing_lines_bid_id_line_no_key ON mei.bid_pricing_lines USING btree (bid_id, line_no);
CREATE INDEX idx_bid_pricing_lines_bid_id ON mei.bid_pricing_lines USING btree (bid_id);
CREATE INDEX idx_bid_risks_bid_id ON mei.bid_risks USING btree (bid_id);
CREATE UNIQUE INDEX bid_sections_bid_id_section_key_key ON mei.bid_sections USING btree (bid_id, section_key);
CREATE INDEX idx_bid_sections_bid_id ON mei.bid_sections USING btree (bid_id);
CREATE UNIQUE INDEX bids_bid_reference_key ON mei.bids USING btree (bid_reference);
CREATE INDEX idx_bids_deadline ON mei.bids USING btree (submission_deadline);
CREATE INDEX idx_bids_stage ON mei.bids USING btree (stage);