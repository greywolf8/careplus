from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID
from enum import Enum
from datetime import datetime


class ObligationStatus(str, Enum):
    DRAFTED = "drafted"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"


class ApproveObligationRequest(BaseModel):
    extracted_id: UUID
    rmp_id: UUID
    mci_reg: str = Field(..., description="MCI registration number")
    final_text: str


class ApproveObligationResponse(BaseModel):
    obligation_id: UUID
    state: ObligationStatus
    content_hash: str
    approver_rmp_id: UUID
    approved_at: datetime


class CloseObligationRequest(BaseModel):
    obligation_id: UUID
    evidence: str = Field(..., description="Evidence of completion (e.g., appointment confirmation, lab result link)")


class CloseObligationResponse(BaseModel):
    obligation_id: UUID
    state: ObligationStatus
    closed_at: datetime


class ObligationGraphResponse(BaseModel):
    patient_id: UUID
    bundle_type: str
    entry: list

