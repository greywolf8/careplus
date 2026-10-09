from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from uuid import UUID


class EpisodeResponse(BaseModel):
    patient_id: UUID
    patient_name: str
    markdown: str
    fhir_bundle: Dict[str, Any]
    content_hash: str
    lint_status: str
    lint_reason: Optional[str] = None
    orphan_sentences: Optional[List[Dict[str, Any]]] = None
    contradictions: Optional[List[Dict[str, Any]]] = None
    stale_obligations: Optional[List[Dict[str, Any]]] = None
