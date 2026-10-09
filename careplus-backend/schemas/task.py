from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class DraftTaskRequest(BaseModel):
    patient_id: UUID
    doctor_description: str = Field(..., description="Doctor's task description")
    discharge_date: datetime = Field(..., description="Patient's discharge date (anchor for date resolution)")


class DraftTaskResponse(BaseModel):
    category: Optional[str] = None
    what: Optional[str] = None
    specialty: Optional[str] = None
    due_date: Optional[str] = None
    date_rule: Optional[str] = None
    provider_specialty: Optional[str] = None
    vague_timing: bool = False
    valid: bool = True
    error: Optional[str] = None
    reasoning: Optional[str] = None
