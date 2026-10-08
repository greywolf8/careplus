from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from uuid import UUID


class EvalMetric(BaseModel):
    metric_name: str
    value: float
    computed_at: str
    dataset_ref: Optional[str] = None
    metadata: Optional[dict] = None


class EvalMetricsResponse(BaseModel):
    metrics: List[EvalMetric]


class CanarySeedRequest(BaseModel):
    obligation_id: UUID
    corruption_type: str = Field(default="dose_error", description="Type of corruption: dose_error, date_error, medication_error")
    corruption_value: Optional[str] = Field(default=None, description="Optional specific corruption value")


class CanarySeedResponse(BaseModel):
    canary_id: UUID
    obligation_id: UUID
    corruption_type: str
    created_at: str


class EvalRunRequest(BaseModel):
    gold_standard_items: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional gold-standard items for omission rate")
    extractor_a_results: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional extractor A results")
    extractor_b_results: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional extractor B results")


class EvalRunResponse(BaseModel):
    job_id: str
    status: str
    created_at: str


class EvalJobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
