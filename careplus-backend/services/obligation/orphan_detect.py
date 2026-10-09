from typing import List, Dict, Any
from careplus.core.logging import logger


def detect_orphan_obligations(obligations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detect obligations that have no assigned owner.

    CQL-equivalent rule:
    obligation.state in (pending, in_progress) AND obligation.owner_practitioner_id IS NULL

    Args:
        obligations: List of obligation objects

    Returns:
        List of orphan obligations
    """
    orphans = []

    for obligation in obligations:
        state = obligation.get("state")
        owner_id = obligation.get("owner_practitioner_id")

        if state in ["pending", "in_progress"] and not owner_id:
            orphans.append(obligation)

    if orphans:
        logger.warning(
            "orphan_obligations_detected",
            count=len(orphans),
            obligation_ids=[o.get("id") for o in orphans]
        )

    return orphans
