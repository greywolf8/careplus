from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from enum import Enum


class QuestionRoute(str, Enum):
    TO_DOCTOR = "to_doctor"
    TO_SELF = "to_self"
    ESCALATE = "escalate"


class ClassifyQuestionRequest(BaseModel):
    question: str
    patient_id: UUID


class ClassifyQuestionResponse(BaseModel):
    route: QuestionRoute
    confidence: float
    reasoning: Optional[str] = None


class AnswerPlanQuestionRequest(BaseModel):
    question: str
    patient_id: UUID
    cited_item_ids: Optional[List[UUID]] = Field(default_factory=list)


class AnswerPlanQuestionResponse(BaseModel):
    answer: str
    cited_items: List[UUID]
    confidence: float


class AnswerDoctorQuestionRequest(BaseModel):
    question: str
    patient_id: UUID
    context: Optional[str] = None


class AnswerDoctorQuestionResponse(BaseModel):
    answer: str
    suggested_doctor_specialization: Optional[str] = None
    urgency: Optional[str] = None
