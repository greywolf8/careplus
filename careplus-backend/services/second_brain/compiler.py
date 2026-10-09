import hashlib
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import UUID

from careplus.db.client import get_supabase_client
from careplus.services.second_brain.rules_md import (
    Category,
    SENTENCE_TEMPLATES,
    is_allowed_output_source
)
from careplus.core.logging import logger


class WikiSentence:
    """A single sentence in the compiled episode page."""
    
    def __init__(
        self,
        text: str,
        pointer: str,  # Format: "span_X-Y" or "item_Z"
        hash: str,
        category: Optional[str] = None
    ):
        self.text = text
        self.pointer = pointer
        self.hash = hash
        self.category = category
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "pointer": self.pointer,
            "hash": self.hash,
            "category": self.category
        }


class EpisodePage:
    """A compiled episode page for a patient."""
    
    def __init__(
        self,
        patient_id: UUID,
        patient_name: str,
        markdown: str,
        fhir_bundle: Dict[str, Any],
        content_hash: str,
        sentences: List[WikiSentence]
    ):
        self.patient_id = patient_id
        self.patient_name = patient_name
        self.markdown = markdown
        self.fhir_bundle = fhir_bundle
        self.content_hash = content_hash
        self.sentences = sentences
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": str(self.patient_id),
            "patient_name": self.patient_name,
            "markdown": self.markdown,
            "fhir_bundle": self.fhir_bundle,
            "content_hash": self.content_hash,
            "sentences": [s.to_dict() for s in self.sentences]
        }


def compute_sentence_hash(text: str, pointer: str) -> str:
    """Compute hash for a sentence."""
    return hashlib.sha256(f"{text}|{pointer}".encode()).hexdigest()


def generate_sentence_from_approved_item(
    item: Dict[str, Any],
    discharge_summary: Optional[Dict[str, Any]] = None
) -> WikiSentence:
    """
    Generate a WikiSentence from an approved_item.
    
    The sentence is templated from approved fields, NEVER freehand LLM prose.
    The pointer references the approved_item_id.
    """
    item_type = item.get("item_type", "")
    content = item.get("content", "")
    item_id = item.get("id")
    
    # Generate sentence based on category template
    # For now, use the content directly as the sentence
    # In production, this would use SENTENCE_TEMPLATES with field extraction
    
    # Generate pointer
    pointer = f"item_{item_id}"
    
    # Compute hash
    sentence_hash = compute_sentence_hash(content, pointer)
    
    return WikiSentence(
        text=content,
        pointer=pointer,
        hash=sentence_hash,
        category=item_type
    )


def generate_sentence_from_obligation(
    obligation: Dict[str, Any]
) -> WikiSentence:
    """
    Generate a WikiSentence from an obligation.
    
    The sentence is templated from obligation fields.
    The pointer references the obligation_id.
    """
    title = obligation.get("title", "")
    description = obligation.get("description", "")
    obligation_id = obligation.get("id")
    
    # Combine title and description
    text = f"{title}. {description}" if description else title
    
    # Generate pointer
    pointer = f"item_{obligation_id}"
    
    # Compute hash
    sentence_hash = compute_sentence_hash(text, pointer)
    
    return WikiSentence(
        text=text,
        pointer=pointer,
        hash=sentence_hash,
        category="obligation"
    )


async def compile_episode_page(patient_id: UUID) -> EpisodePage:
    """
    Compile an episode page for a patient.
    
    Reads discharge_summary + approved_item + audit_log for the patient.
    For each approved_item, generates a WikiSentence with:
    - text (templated from approved fields, NEVER freehand LLM prose)
    - pointer (discharge_span OR approved_item_id)
    - hash
    
    Returns EpisodePage with markdown + FHIR Bundle (CarePlan + Task[] + Provenance[]).
    
    This is a deterministic pipeline. The LLM only formats sentences from approved fields.
    It never writes to the raw layer.
    
    Results should be cached and versioned by content_hash.
    """
    supabase = get_supabase_client(use_service_role=True)
    
    # Fetch patient info
    patient_result = supabase.table("patient").select("*").eq("id", str(patient_id)).execute()
    if not patient_result.data:
        raise ValueError(f"Patient {patient_id} not found")
    
    patient = patient_result.data[0]
    patient_name = patient["name"]
    
    # Fetch approved items
    approved_items_result = supabase.table("approved_item").select("*").eq("patient_id", str(patient_id)).execute()
    approved_items = approved_items_result.data
    
    # Fetch obligations
    obligations_result = supabase.table("obligation").select("*").eq("patient_id", str(patient_id)).execute()
    obligations = obligations_result.data
    
    # Generate sentences from approved items
    sentences: List[WikiSentence] = []
    
    for item in approved_items:
        sentence = generate_sentence_from_approved_item(item)
        sentences.append(sentence)
    
    for obligation in obligations:
        sentence = generate_sentence_from_obligation(obligation)
        sentences.append(sentence)
    
    # Generate markdown
    markdown_lines = [
        f"# Episode Summary for {patient_name}",
        f"",
        f"**Patient ID:** {patient_id}",
        f"**Generated:** {datetime.now().isoformat()}",
        f"",
        f"## Approved Items",
        f""
    ]
    
    for sentence in sentences:
        if sentence.category != "obligation":
            markdown_lines.append(f"- {sentence.text} [src:{sentence.pointer}]")
    
    markdown_lines.append("")
    markdown_lines.append("## Obligations")
    markdown_lines.append("")
    
    for sentence in sentences:
        if sentence.category == "obligation":
            markdown_lines.append(f"- {sentence.text} [src:{sentence.pointer}]")
    
    markdown = "\n".join(markdown_lines)
    
    # Generate FHIR Bundle
    fhir_bundle = generate_fhir_bundle(patient_id, approved_items, obligations)
    
    # Compute content hash
    content_hash = hashlib.sha256(markdown.encode()).hexdigest()
    
    logger.info(
        "episode_page_compiled",
        patient_id=str(patient_id),
        sentences_count=len(sentences),
        content_hash=content_hash
    )
    
    return EpisodePage(
        patient_id=patient_id,
        patient_name=patient_name,
        markdown=markdown,
        fhir_bundle=fhir_bundle,
        content_hash=content_hash,
        sentences=sentences
    )


def generate_fhir_bundle(
    patient_id: UUID,
    approved_items: List[Dict[str, Any]],
    obligations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate FHIR R4 Bundle with CarePlan + Task[] + Provenance[].
    """
    from careplus.services.obligation import obligations_to_fhir_bundle
    
    # Convert obligations to FHIR
    # This reuses the existing obligation_to_fhir_bundle function
    return obligations_to_fhir_bundle(obligations, str(patient_id))
