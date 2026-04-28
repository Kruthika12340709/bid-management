from sqlalchemy import Column, String, Text, Integer, Date, DateTime, func
from sqlalchemy.dialects.postgresql import JSON
from database import Base


class RFPModule(Base):
    """Existing rfp_module table — the master RFP record (BR-001 input)."""
    __tablename__ = "rfp_module"

    rfp_id              = Column(String(100), primary_key=True)
    client_name         = Column(String(255))
    title               = Column(Text)
    deadline            = Column(Date)
    duration_days       = Column(Integer)
    requirements        = Column(JSON)
    expected_outcomes   = Column(JSON)
    constraints         = Column(JSON)
    evaluation_criteria = Column(JSON)
    created_at          = Column(DateTime, server_default=func.now())
