from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, Any, List


class BidSummary(BaseModel):
    bid_id: UUID
    bid_reference: str
    title: str
    client_name: Optional[str]
    rfp_id: Optional[str]
    stage: str
    compiled_value: Optional[Decimal]
    approved_value: Optional[Decimal]
    currency: str
    submission_deadline: Optional[date]
    sections_total: int
    sections_complete: int
    flag_low_conf: int
    flag_conflicts: int
    flag_missing_rate: int
    flag_high_risk: int
    win_probability: Optional[Decimal]
    tags: Optional[List[str]]
    outcome: Optional[str]
    last_action_text: Optional[str]
    last_action_by: Optional[str]
    last_action_at: Optional[datetime]
    assigned_manager: Optional[str]
    assigned_director: Optional[str]
    compiled_margin_pct: Optional[Decimal]
    approved_margin_pct: Optional[Decimal]

    model_config = {"from_attributes": True}


class BidOut(BidSummary):
    hil_approved_at: Optional[datetime]
    hil_approved_by: Optional[str]
    manager_co_approved_at: Optional[datetime]
    manager_co_approved_by: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class BidSectionOut(BaseModel):
    section_id: UUID
    bid_id: UUID
    section_key: str
    section_name: str
    status: str
    compiled_data: Optional[Any]
    approved_data: Optional[Any]
    source_module: Optional[str]
    input_version: Optional[str]
    confidence_score: Optional[Decimal]
    flag_count: int
    flags: Optional[Any]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    correction_note: Optional[str]

    model_config = {"from_attributes": True}


class RiskOut(BaseModel):
    risk_id: UUID
    bid_id: UUID
    risk_ref: Optional[str]
    description: str
    category: Optional[str]
    probability: Optional[str]
    impact: Optional[str]
    severity: Optional[str]
    mitigation: Optional[str]
    owner: Optional[str]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    log_id: UUID
    bid_id: Optional[UUID]
    bid_reference: Optional[str]
    section_key: Optional[str]
    action_type: str
    original_value: Optional[str]
    revised_value: Optional[str]
    performed_by: Optional[str]
    role: Optional[str]
    detail: Optional[str]
    br_reference: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class HILSectionAction(BaseModel):
    performed_by: str
    role: str
    note: Optional[str] = None
    revised_value:  Optional[str] = None
    original_value: Optional[str] = None
    field_key:      Optional[str] = None


class MarginOverride(BaseModel):
    new_margin_pct: Decimal
    performed_by: str
    note: Optional[str] = None


class RiskAck(BaseModel):
    performed_by: str
