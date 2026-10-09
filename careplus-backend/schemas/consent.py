from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID


class GrantConsentRequest(BaseModel):
    patient_id: UUID
    purpose: str
    expires_at: Optional[str] = None


class GrantConsentResponse(BaseModel):
    consent_id: UUID
    granted: bool


class RevokeConsentRequest(BaseModel):
    consent_id: UUID


class RevokeConsentResponse(BaseModel):
    consent_id: UUID
    revoked: bool
