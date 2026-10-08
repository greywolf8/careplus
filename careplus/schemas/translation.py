from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class TranslateRequest(BaseModel):
    item_id: UUID
    item_type: str = Field(..., description="Type of item: 'approved_item' or 'obligation'")
    target_language: str = Field(..., description="Target language code, e.g., 'hi', 'ta'")


class TranslateResponse(BaseModel):
    translation_id: UUID
    translated_content: str
    verified: bool = False
    flags: List[str] = Field(default_factory=list)
    back_translation: Optional[str] = None
    grade_level: Optional[float] = None
    avg_sentence_length: Optional[float] = None


class VerifyTranslationRequest(BaseModel):
    translation_id: UUID
    rmp_id: UUID
    mci_reg: str
    decision: str = Field(..., description="Decision: 'approve' or 'reject'")
    reason: Optional[str] = None


class VerifyTranslationResponse(BaseModel):
    translation_id: UUID
    verified: bool
    verifier_rmp_id: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    content_hash: Optional[str] = None
