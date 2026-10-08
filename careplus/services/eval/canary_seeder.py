"""
Canary seeder for reviewer vigilance testing.

5% of items in the review queue get deliberately corrupted (dose 5mg→50mg, date off by one day).
POST /admin/canary/seed endpoint (auditor-only role). Track detection in canary table.
"""
from typing import Dict, List, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta
import random

from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


def seed_canary(
    obligation_id: UUID,
    corruption_type: str = "dose_error",
    corruption_value: Optional[str] = None
) -> str:
    """
    Seed a canary in the review queue.

    Deliberately corrupts an obligation to test reviewer vigilance.

    Args:
        obligation_id: UUID of the obligation to corrupt
        corruption_type: Type of corruption ('dose_error', 'date_error', 'medication_error')
        corruption_value: Optional specific corruption value

    Returns:
        canary_id: UUID of the seeded canary
    """
    supabase = get_supabase_client(use_service_role=True)

    # Fetch the obligation
    obligation_result = supabase.table("obligation").select("*").eq("id", str(obligation_id)).execute()

    if not obligation_result.data:
        raise ValueError(f"Obligation {obligation_id} not found")

    obligation = obligation_result.data[0]
    original_value = obligation.get("description", "")

    # Generate corruption based on type
    if corruption_type == "dose_error":
        # Change dose (e.g., 5mg → 50mg)
        if corruption_value:
            corrupted_value = original_value.replace("5mg", corruption_value)
        else:
            corrupted_value = original_value.replace("5mg", "50mg").replace("10mg", "100mg")
    elif corruption_type == "date_error":
        # Shift date by one day
        if corruption_value:
            corrupted_value = corruption_value
        else:
            # Simple heuristic: replace "tomorrow" with "yesterday" or vice versa
            corrupted_value = original_value.replace("tomorrow", "yesterday").replace("today", "yesterday")
    elif corruption_type == "medication_error":
        # Change medication name
        if corruption_value:
            corrupted_value = corruption_value
        else:
            # Replace common medications with wrong ones
            corrupted_value = original_value.replace("Amoxicillin", "Penicillin").replace("Ibuprofen", "Aspirin")
    else:
        raise ValueError(f"Unknown corruption type: {corruption_type}")

    # Store canary record
    canary_data = {
        "obligation_id": str(obligation_id),
        "original_value": original_value,
        "corrupted_value": corrupted_value,
        "detected_by_rmp_id": None,
        "detected_at": None,
        "created_at": datetime.now().isoformat()
    }

    result = supabase.table("canary").insert(canary_data).execute()
    canary_id = result.data[0]["id"]

    logger.info(
        "canary_seeded",
        canary_id=str(canary_id),
        obligation_id=str(obligation_id),
        corruption_type=corruption_type
    )

    return str(canary_id)


def detect_canary(
    canary_id: UUID,
    rmp_id: UUID
) -> bool:
    """
    Mark a canary as detected by a reviewer.

    Called when an RMP catches the corruption during review.

    Args:
        canary_id: UUID of the canary
        rmp_id: UUID of the RMP who detected it

    Returns:
        True if detection was recorded
    """
    supabase = get_supabase_client(use_service_role=True)

    # Update canary record
    update_data = {
        "detected_by_rmp_id": str(rmp_id),
        "detected_at": datetime.now().isoformat()
    }

    result = supabase.table("canary").update(update_data).eq("id", str(canary_id)).execute()

    if not result.data:
        raise ValueError(f"Canary {canary_id} not found")

    logger.info(
        "canary_detected",
        canary_id=str(canary_id),
        rmp_id=str(rmp_id)
    )

    return True


def get_canary_detection_rate(days: int = 30) -> Dict[str, Any]:
    """
    Compute canary detection rate for the last N days.

    Args:
        days: Number of days to look back

    Returns:
        Dict with:
        - total_canaries: int
        - detected_canaries: int
        - detection_rate: float (percentage)
    """
    supabase = get_supabase_client(use_service_role=True)

    cutoff_date = datetime.now() - timedelta(days=days)

    # Get canaries created in the last N days
    result = supabase.table("canary").select("*").gte("created_at", cutoff_date.isoformat()).execute()

    canaries = result.data
    total_canaries = len(canaries)
    detected_canaries = sum(1 for c in canaries if c.get("detected_by_rmp_id"))

    detection_rate = (detected_canaries / total_canaries * 100) if total_canaries > 0 else 0.0

    logger.info(
        "canary_detection_rate_computed",
        total_canaries=total_canaries,
        detected_canaries=detected_canaries,
        detection_rate=detection_rate,
        days=days
    )

    return {
        "total_canaries": total_canaries,
        "detected_canaries": detected_canaries,
        "detection_rate": detection_rate,
        "days": days
    }


def auto_seed_canaries(
    percentage: float = 5.0,
    patient_id: Optional[UUID] = None
) -> List[str]:
    """
    Automatically seed canaries in a percentage of obligations.

    Used for automated testing of reviewer vigilance.

    Args:
        percentage: Percentage of obligations to corrupt (default 5%)
        patient_id: Optional patient ID to filter obligations

    Returns:
        List of canary IDs that were seeded
    """
    supabase = get_supabase_client(use_service_role=True)

    # Fetch obligations
    query = supabase.table("obligation").select("*")
    if patient_id:
        query = query.eq("patient_id", str(patient_id))

    result = query.execute()
    obligations = result.data

    # Calculate how many to corrupt
    num_to_corrupt = max(1, int(len(obligations) * (percentage / 100)))

    # Randomly select obligations
    selected_obligations = random.sample(obligations, min(num_to_corrupt, len(obligations)))

    # Seed canaries
    canary_ids = []
    corruption_types = ["dose_error", "date_error", "medication_error"]

    for obligation in selected_obligations:
        try:
            corruption_type = random.choice(corruption_types)
            canary_id = seed_canary(
                obligation_id=UUID(obligation["id"]),
                corruption_type=corruption_type
            )
            canary_ids.append(canary_id)
        except Exception as e:
            logger.error(
                "auto_seed_canary_failed",
                obligation_id=obligation["id"],
                error=str(e)
            )

    logger.info(
        "auto_seed_canaries_completed",
        total_obligations=len(obligations),
        seeded_count=len(canary_ids),
        percentage=percentage
    )

    return canary_ids
