from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional


class RFPCreate(BaseModel):
    rfp_reference: str
    client_name: str
    description: Optional[str] = None
    issuer_contact: Optional[str] = None
    issue_date: Optional[date] = None
    submission_deadline: Optional[date] = None
    estimated_value: Optional[Decimal] = None
    currency: str = "GBP"
    status: str = "open"


class RFPOut(RFPCreate):
    rfp_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
