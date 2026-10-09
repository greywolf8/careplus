from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AppLanguage(str, Enum):
    EN = "en"
    HI = "hi"
    TA = "ta"


class AppUserRole(str, Enum):
    PATIENT = "patient"
    CAREGIVER = "caregiver"


class FollowupItemStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"
    ESCALATED = "escalated"
    OVERDUE = "overdue"
    MISSED = "missed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class FollowupItemCategory(str, Enum):
    APPOINTMENT = "appointment"
    TEST = "test"
    CARE = "care"
    GENERAL = "general"


class FollowupItemSection(str, Enum):
    OVERDUE = "OVERDUE"
    DUE_TODAY = "DUE TODAY"
    NEXT_UP = "NEXT UP"
    DAILY_CARE = "DAILY CARE"


class UserProfileResponse(BaseModel):
    id: UUID
    name: str
    role: AppUserRole
    preferred_language: AppLanguage
    email: str


class PatientContextResponse(BaseModel):
    user_id: UUID
    role: AppUserRole
    patient_id: UUID
    patient_name: str
    relationship: Optional[str] = None
    can_mark_done: bool = True


class TabPermissionsResponse(BaseModel):
    can_see_today: bool = True
    can_see_plan: bool = True
    can_see_medicines: bool = True
    can_see_ask: bool = True
    can_see_more: bool = True
    can_see_warning_signs: bool = True
    can_see_tests: bool = True
    can_see_find_care: bool = True
    can_see_reminders: bool = True
    can_mark_done: bool = True


class ProviderSuggestion(BaseModel):
    name: str
    location: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None


class FollowupItemResponse(BaseModel):
    id: UUID
    patient_id: UUID
    title: str
    section: Optional[FollowupItemSection] = None
    category: FollowupItemCategory
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    effective_status: FollowupItemStatus
    original_text: str
    source: str
    added_by: Optional[str] = None
    provider_suggestion: Optional[ProviderSuggestion] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None


class ItemTranslationResponse(BaseModel):
    item_id: UUID
    language: AppLanguage
    translated_title: str
    translated_instruction: str
    is_verified: bool


class MedicationResponse(BaseModel):
    id: UUID
    patient_id: UUID
    drug_name: str
    dose: Optional[str] = None
    how_often: Optional[str] = None
    for_how_long: Optional[str] = None
    original_instruction: str


class AdherenceLogResponse(BaseModel):
    id: UUID
    medication_id: UUID
    log_date: date = Field(validation_alias="date", serialization_alias="date")
    status: str
    logged_by: str
    logged_at: datetime

    model_config = {"populate_by_name": True}


class AdherenceLogRequest(BaseModel):
    medication_id: UUID
    patient_id: UUID
    status: str
    log_date: Optional[date] = Field(default=None, validation_alias="date")
    logged_by_name: Optional[str] = None

    model_config = {"populate_by_name": True}


class WarningSignResponse(BaseModel):
    id: UUID
    patient_id: UUID
    original_text: str
    severity: str


class TestResultResponse(BaseModel):
    id: UUID
    patient_id: UUID
    test_name: str
    result_date: date = Field(validation_alias="date", serialization_alias="date")
    is_released: bool
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None
    result_content: Optional[str] = None

    model_config = {"populate_by_name": True}


class CareProviderResponse(BaseModel):
    id: UUID
    name: str
    kind: str
    distance: Optional[str] = Field(default=None, alias="distance_label")
    address: str
    specialties: List[str] = Field(default_factory=list)
    phone: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None

    model_config = {"populate_by_name": True}


class PatientMessageResponse(BaseModel):
    id: UUID
    patient_id: UUID
    sender: str
    sender_name: str
    text: str = Field(alias="body")
    created_at: datetime
    type: str = Field(alias="message_type")
    cited_item_ids: List[UUID] = Field(default_factory=list)
    escalation_reason: Optional[str] = None

    model_config = {"populate_by_name": True}


class PatientMessageCreateRequest(BaseModel):
    text: str
    sender_name: Optional[str] = None


class ReminderResponse(BaseModel):
    id: UUID
    patient_id: UUID
    item_title: str
    due_time: str = Field(alias="due_time_label")
    channel: str
    is_past: bool
    preview_text: str

    model_config = {"populate_by_name": True}


class AccessRequestResponse(BaseModel):
    id: UUID
    caregiver_name: str
    caregiver_email: str
    relationship: str
    status: str
    requested_at: datetime


class AccessRequestCreate(BaseModel):
    patient_id: UUID
    caregiver_name: str
    caregiver_email: str
    relationship: str


class AccessRequestDecision(BaseModel):
    decision: str


class CoordinationCardCreate(BaseModel):
    type: str
    description: str
    raised_by_name: Optional[str] = None


class CoordinationCardUpdate(BaseModel):
    status: str
    care_team_notes: Optional[str] = None


class CoordinationCardResponse(BaseModel):
    id: UUID
    patientId: UUID = Field(alias="patient_id")
    type: str = Field(alias="card_type")
    raisedBy: str = Field(alias="raised_by")
    raisedByName: str = Field(alias="raised_by_name")
    description: str
    status: str
    createdAt: datetime = Field(alias="created_at")
    resolvedAt: Optional[datetime] = Field(default=None, alias="resolved_at")
    careTeamNotes: Optional[str] = Field(default=None, alias="care_team_notes")

    model_config = {"populate_by_name": True}


class MarkItemDoneRequest(BaseModel):
    toggle: bool = True


class PatientQuestionSubmitRequest(BaseModel):
    patient_id: UUID
    question: str
    language: AppLanguage = AppLanguage.EN
    sender_name: Optional[str] = None


class PatientQuestionSubmitResponse(BaseModel):
    route: str
    answer: Optional[str] = None
    cited_item_ids: List[UUID] = Field(default_factory=list)
    escalated: bool = False
    escalation_reason: Optional[str] = None
    emergency_phone: Optional[str] = None
    warning_signs: List[str] = Field(default_factory=list)
    message: Optional[str] = None
    patient_message_id: Optional[UUID] = None
    system_message_id: Optional[UUID] = None


class UpdateLanguageRequest(BaseModel):
    preferred_language: AppLanguage


class CaregiverMarkDoneSetting(BaseModel):
    allowed: bool


class SyncPlanResponse(BaseModel):
    patient_id: UUID
    followup_items_synced: int
    medications_synced: int
    warning_signs_synced: int


class ReleaseTestResultRequest(BaseModel):
    result_content: str
    released_by: str


class GenericSuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class ReviewFlagCreate(BaseModel):
    card_type: str
    description: str
    raised_by_name: Optional[str] = None
    severity: str = "medium"
    question_id: Optional[UUID] = None


class ReviewFlagUpdate(BaseModel):
    resolved: bool
    care_team_notes: Optional[str] = None


class ReviewFlagResponse(BaseModel):
    id: UUID
    patient_id: UUID
    card_type: Optional[str] = None
    raised_by_name: Optional[str] = None
    reason: str
    severity: str
    care_team_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved: bool = False
    question_id: Optional[UUID] = None


class SendMessageRequest(BaseModel):
    body: str
    message_type: str = "question"
    cited_item_ids: Optional[List[UUID]] = None


class MessageResponse(BaseModel):
    id: UUID
    patient_id: UUID
    sender: str
    sender_name: str
    body: str
    message_type: str
    cited_item_ids: Optional[List[str]] = None
    created_at: datetime
