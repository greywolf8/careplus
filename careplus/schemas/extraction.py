from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date
from enum import Enum


class ItemCategory(str, Enum):
    """Allowed categories for extracted items."""
    APPOINTMENT = "appointment"
    TEST = "test"
    REFERRAL = "referral"
    MEDICATION = "medication"
    CARE_INSTRUCTION = "care_instruction"
    WARNING_SIGN = "warning_sign"
    DIET = "diet"
    REHAB = "rehab"
    WOUND_CARE = "wound_care"


class ExtractRequest(BaseModel):
    patient_id: UUID
    discharge_summary_id: Optional[UUID] = None
    raw_text: str = Field(..., description="The discharge summary text")
    discharge_date: date
    language: str = Field(default="en", description="Language of the summary")


class SourceSpan(BaseModel):
    quote: str
    start: int
    end: int


class ExtractedItem(BaseModel):
    id: Optional[UUID] = None
    item_type: ItemCategory = Field(..., description="Category of the item")
    content: str
    quote: str
    due_date: Optional[str] = None
    priority: str = Field(default="low", description="high, medium, or low")
    source_span: Optional[SourceSpan] = None
    state: str = Field(default="drafted")
    metadata: Optional[Dict[str, Any]] = None


class QualityMetrics(BaseModel):
    agreement_rate: float
    models_used: List[str]
    quality_pass: bool
    total_issues: int
    issues: Dict[str, Any]


class CompletenessMetrics(BaseModel):
    checklist_pass: bool
    missing: List[str]
    discharge_type: str
    required_count: int
    found_count: int


class ExtractResponse(BaseModel):
    items: List[ExtractedItem]
    could_not_place: List[Dict[str, Any]]
    quality: QualityMetrics
    completeness: CompletenessMetrics
    summary_id: Optional[UUID] = None
