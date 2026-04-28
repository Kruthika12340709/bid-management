from sqlalchemy import (
    Column, String, Text, Numeric, Integer, Boolean, Date, DateTime,
    ForeignKey, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from database import Base


class Bid(Base):
    __tablename__ = "bids"

    bid_id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bid_reference           = Column(String(50), unique=True, nullable=False)
    rfp_id                  = Column(String(100), ForeignKey("rfp_module.rfp_id", ondelete="SET NULL"))
    title                   = Column(String(255), nullable=False)
    client_name             = Column(String(255))
    stage                   = Column(String(50), nullable=False, default="validating")
    assigned_manager        = Column(String(100))
    assigned_director       = Column(String(100))
    compiled_value          = Column(Numeric(15, 2))
    approved_value          = Column(Numeric(15, 2))
    currency                = Column(String(3), default="GBP")
    compiled_margin_pct     = Column(Numeric(5, 2))
    approved_margin_pct     = Column(Numeric(5, 2))
    submission_deadline     = Column(Date)
    sections_total          = Column(Integer, default=8)
    sections_complete       = Column(Integer, default=0)
    flag_low_conf           = Column(Integer, default=0)
    flag_conflicts          = Column(Integer, default=0)
    flag_missing_rate       = Column(Integer, default=0)
    flag_high_risk          = Column(Integer, default=0)
    win_probability         = Column(Numeric(4, 3))
    tags                    = Column(JSONB)
    compile_started_at      = Column(DateTime(timezone=True))
    compile_finished_at     = Column(DateTime(timezone=True))
    hil_approved_at         = Column(DateTime(timezone=True))
    hil_approved_by         = Column(String(100))
    manager_co_approved_at  = Column(DateTime(timezone=True))
    manager_co_approved_by  = Column(String(100))
    submitted_at            = Column(DateTime(timezone=True))
    outcome                 = Column(String(50))
    last_action_text        = Column(String(255))
    last_action_by          = Column(String(100))
    last_action_at          = Column(DateTime(timezone=True))
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BidSection(Base):
    __tablename__ = "bid_sections"

    section_id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bid_id              = Column(UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="CASCADE"), nullable=False)
    section_key         = Column(String(50), nullable=False)
    section_name        = Column(String(100), nullable=False)
    status              = Column(String(50), nullable=False, default="pending")
    compiled_data       = Column(JSONB)
    approved_data       = Column(JSONB)
    source_module       = Column(String(100))
    input_version       = Column(String(50))
    confidence_score    = Column(Numeric(4, 3))
    flag_count          = Column(Integer, default=0)
    flags               = Column(JSONB)
    approved_by         = Column(String(100))
    approved_at         = Column(DateTime(timezone=True))
    correction_note     = Column(Text)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BidRisk(Base):
    __tablename__ = "bid_risks"

    risk_id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bid_id          = Column(UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="CASCADE"), nullable=False)
    risk_ref        = Column(String(20))
    description     = Column(Text, nullable=False)
    category        = Column(String(100))
    probability     = Column(String(20))
    impact          = Column(String(20))
    severity        = Column(String(20))
    mitigation      = Column(Text)
    owner           = Column(String(100))
    acknowledged    = Column(Boolean, default=False)
    acknowledged_by = Column(String(100))
    acknowledged_at = Column(DateTime(timezone=True))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class BidAuditLog(Base):
    __tablename__ = "bid_audit_log"

    log_id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bid_id          = Column(UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="SET NULL"))
    bid_reference   = Column(String(50))
    section_key     = Column(String(50))
    action_type     = Column(String(100), nullable=False)
    original_value  = Column(Text)
    revised_value   = Column(Text)
    performed_by    = Column(String(100))
    role            = Column(String(50))
    detail          = Column(Text)
    br_reference    = Column(String(20))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
