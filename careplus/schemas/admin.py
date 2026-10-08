from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class SeedCanaryRequest(BaseModel):
    obligation_id: UUID
    rmp_id: UUID


class SeedCanaryResponse(BaseModel):
    canary_id: UUID
    seeded: bool


class VerifyAuditResponse(BaseModel):
    valid: bool
    total_entries: int
    invalid_entries: int
