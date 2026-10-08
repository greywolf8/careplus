from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class VerifyAuditRequest(BaseModel):
    range_start: Optional[datetime] = Field(None, description="Start of audit log range")
    range_end: Optional[datetime] = Field(None, description="End of audit log range")
    patient_id: Optional[str] = Field(None, description="Patient UUID to filter by")
    since: Optional[datetime] = Field(None, description="Verify audit logs since this timestamp")


class VerifyAuditResponse(BaseModel):
    valid: bool
    total_entries: int
    invalid_entries: int
    broken_at: Optional[str] = Field(None, description="audit_log_id where chain is broken")
    evidence: dict
