from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ErrorCode(str, Enum):
    EXTRACTION_UNAVAILABLE = "EXTRACTION_UNAVAILABLE"
    TRANSLATION_UNAVAILABLE = "TRANSLATION_UNAVAILABLE"
    INVALID_INPUT = "INVALID_INPUT"
    NOT_AUTHORIZED = "NOT_AUTHORIZED"
    ITEM_NOT_FOUND = "ITEM_NOT_FOUND"
    QUESTION_ROUTING_FAILED = "QUESTION_ROUTING_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    dependencies: Dict[str, str]
