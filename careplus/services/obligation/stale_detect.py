from datetime import datetime, timedelta
from typing import List, Dict, Any
from careplus.core.logging import logger


def detect_stale_obligations(
    obligations: List[Dict[str, Any]],
    days_threshold: int = 30
) -> List[Dict[str, Any]]:
    """
    Detect obligations that are overdue and not completed.

    CQL-equivalent rule:
    obligation.due_date < NOW() - 30 days AND state != completed

    Args:
        obligations: List of obligation objects with due_date and state
        days_threshold: Number of days past due date to consider stale (default 30)

    Returns:
        List of stale obligations
    """
    stale = []
    threshold_date = datetime.now() - timedelta(days=days_threshold)

    for obligation in obligations:
        due_date_str = obligation.get("due_date")
        state = obligation.get("state")

        if not due_date_str or state == "completed":
            continue

        try:
            due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            if due_date < threshold_date:
                stale.append(obligation)
        except (ValueError, AttributeError) as e:
            logger.warning(
                "invalid_due_date",
                obligation_id=obligation.get("id"),
                due_date=due_date_str,
                error=str(e)
            )

    if stale:
        logger.warning(
            "stale_obligations_detected",
            count=len(stale),
            days_threshold=days_threshold,
            obligation_ids=[o.get("id") for o in stale]
        )

    return stale
