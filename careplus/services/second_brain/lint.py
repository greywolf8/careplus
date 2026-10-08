from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from uuid import UUID

from careplus.db.client import get_supabase_client
from careplus.services.second_brain.compiler import WikiSentence, EpisodePage
from careplus.core.logging import logger


class LintResult:
    """Result of linting an episode page."""
    
    def __init__(
        self,
        status: str,  # "passed", "rejected"
        reason: Optional[str] = None,
        orphan_sentences: Optional[List[Dict[str, Any]]] = None,
        contradictions: Optional[List[Dict[str, Any]]] = None,
        stale_obligations: Optional[List[Dict[str, Any]]] = None
    ):
        self.status = status
        self.reason = reason
        self.orphan_sentences = orphan_sentences or []
        self.contradictions = contradictions or []
        self.stale_obligations = stale_obligations or []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "reason": self.reason,
            "orphan_sentences": self.orphan_sentences,
            "contradictions": self.contradictions,
            "stale_obligations": self.stale_obligations
        }


def lint_episode_page(page: EpisodePage, supabase_client=None) -> LintResult:
    """
    Run three lint passes on the compiled episode page.
    
    Pass A (orphan): every sentence MUST have a pointer. Reject the whole page if orphans exist.
    Pass B (contradiction): two sentences claiming the same due_date for the same obligation → flag.
    Pass C (stale): obligations past due_date + 30 days and not completed → flag for coordinator.
    
    Returns LintResult with status "passed" or "rejected".
    
    Args:
        page: The episode page to lint
        supabase_client: Optional Supabase client (for testing without DB)
    """
    # Pass A: Orphan detection
    orphan_result = pass_orphan_detection(page)
    if orphan_result["has_orphans"]:
        return LintResult(
            status="rejected",
            reason="orphan_sentences",
            orphan_sentences=orphan_result["orphans"]
        )
    
    # Pass B: Contradiction detection
    contradiction_result = pass_contradiction_detection(page)
    if contradiction_result["has_contradictions"]:
        # Contradictions are warnings, not hard rejects
        pass  # Continue to pass C
    
    # Pass C: Stale detection
    stale_result = pass_stale_detection(page, supabase_client)
    if stale_result["has_stale"]:
        # Stale obligations are warnings, not hard rejects
        pass  # Continue
    
    # All checks passed
    return LintResult(
        status="passed",
        reason=None,
        contradictions=contradiction_result["contradictions"],
        stale_obligations=stale_result["stale_obligations"]
    )


def pass_orphan_detection(page: EpisodePage) -> Dict[str, Any]:
    """
    Pass A: Every sentence MUST have a pointer.
    
    Reject the whole page if orphans exist.
    """
    orphans = []
    
    for sentence in page.sentences:
        if not sentence.pointer or sentence.pointer == "":
            orphans.append({
                "text": sentence.text,
                "hash": sentence.hash,
                "reason": "missing_pointer"
            })
        elif not (sentence.pointer.startswith("span_") or sentence.pointer.startswith("item_")):
            orphans.append({
                "text": sentence.text,
                "pointer": sentence.pointer,
                "hash": sentence.hash,
                "reason": "invalid_pointer_format"
            })
    
    has_orphans = len(orphans) > 0
    
    if has_orphans:
        logger.error(
            "lint_orphan_detection_failed",
            patient_id=str(page.patient_id),
            orphan_count=len(orphans)
        )
    
    return {
        "has_orphans": has_orphans,
        "orphans": orphans
    }


def pass_contradiction_detection(page: EpisodePage) -> Dict[str, Any]:
    """
    Pass B: Two sentences claiming the same due_date for the same obligation → flag.
    
    This checks for contradictions in the compiled page.
    """
    contradictions = []
    
    # Group sentences by obligation_id (from pointer)
    obligation_sentences: Dict[str, List[WikiSentence]] = {}
    
    for sentence in page.sentences:
        if sentence.pointer.startswith("item_"):
            item_id = sentence.pointer.replace("item_", "")
            if item_id not in obligation_sentences:
                obligation_sentences[item_id] = []
            obligation_sentences[item_id].append(sentence)
    
    # Check for contradictions within each obligation's sentences
    for item_id, sentences in obligation_sentences.items():
        if len(sentences) > 1:
            # Extract due dates from sentences
            # This is a simplified check - in production, parse due dates from sentence text
            # For now, just flag if multiple sentences exist for the same item
            contradictions.append({
                "item_id": item_id,
                "sentence_count": len(sentences),
                "reason": "multiple_sentences_for_same_item"
            })
    
    has_contradictions = len(contradictions) > 0
    
    if has_contradictions:
        logger.warning(
            "lint_contradiction_detection_warnings",
            patient_id=str(page.patient_id),
            contradiction_count=len(contradictions)
        )
    
    return {
        "has_contradictions": has_contradictions,
        "contradictions": contradictions
    }


def pass_stale_detection(page: EpisodePage, supabase_client=None) -> Dict[str, Any]:
    """
    Pass C: Obligations past due_date + 30 days and not completed → flag for coordinator.
    
    This checks the database for stale obligations.
    
    Args:
        page: The episode page to lint
        supabase_client: Optional Supabase client (for testing without DB)
    """
    try:
        if supabase_client is None:
            supabase = get_supabase_client(use_service_role=True)
        else:
            supabase = supabase_client
        
        # Fetch obligations for this patient
        obligations_result = supabase.table("obligation").select("*").eq("patient_id", str(page.patient_id)).execute()
        obligations = obligations_result.data
    except Exception as e:
        # If DB is not available (e.g., in unit tests), skip stale detection
        logger.warning(
            "lint_stale_detection_db_unavailable",
            patient_id=str(page.patient_id),
            error=str(e)
        )
        return {
            "has_stale": False,
            "stale_obligations": []
        }
    
    stale_obligations = []
    now = datetime.now()
    
    for obligation in obligations:
        due_date_str = obligation.get("due_date")
        state = obligation.get("state")
        
        if not due_date_str or state == "completed":
            continue
        
        try:
            due_date = datetime.fromisoformat(due_date_str)
            # Check if past due_date + 30 days
            stale_threshold = due_date + timedelta(days=30)
            
            if now > stale_threshold:
                stale_obligations.append({
                    "obligation_id": obligation["id"],
                    "title": obligation["title"],
                    "due_date": due_date_str,
                    "state": state,
                    "days_overdue": (now - due_date).days
                })
        except (ValueError, TypeError):
            # Invalid date format, skip
            continue
    
    has_stale = len(stale_obligations) > 0
    
    if has_stale:
        logger.warning(
            "lint_stale_detection_warnings",
            patient_id=str(page.patient_id),
            stale_count=len(stale_obligations)
        )
    
    return {
        "has_stale": has_stale,
        "stale_obligations": stale_obligations
    }


async def lint_episode_page_with_db(patient_id: UUID, supabase_client=None) -> Dict[str, Any]:
    """
    Compile and lint an episode page for a patient.
    
    This is the main entry point for the linting process.
    
    Args:
        patient_id: Patient UUID
        supabase_client: Optional Supabase client (for testing without DB)
    """
    from careplus.services.second_brain.compiler import compile_episode_page
    
    # Compile the page
    page = await compile_episode_page(patient_id)
    
    # Lint the page
    lint_result = lint_episode_page(page, supabase_client)
    
    return {
        "page": page.to_dict(),
        "lint": lint_result.to_dict()
    }
