from enum import Enum
from typing import Dict, List, Set
from careplus.core.logging import logger


class ObligationStatus(str, Enum):
    """States in the obligation lifecycle."""
    DRAFTED = "drafted"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"


# Legal state transitions
TRANSITIONS: Dict[ObligationStatus, Set[ObligationStatus]] = {
    ObligationStatus.DRAFTED: {ObligationStatus.AWAITING_APPROVAL, ObligationStatus.CANCELLED},
    ObligationStatus.AWAITING_APPROVAL: {ObligationStatus.APPROVED, ObligationStatus.CANCELLED},
    ObligationStatus.APPROVED: {ObligationStatus.PENDING, ObligationStatus.CANCELLED},
    ObligationStatus.PENDING: {ObligationStatus.IN_PROGRESS, ObligationStatus.ON_HOLD, ObligationStatus.CANCELLED},
    ObligationStatus.IN_PROGRESS: {ObligationStatus.COMPLETED, ObligationStatus.FAILED, ObligationStatus.ON_HOLD},
    ObligationStatus.ON_HOLD: {ObligationStatus.IN_PROGRESS, ObligationStatus.CANCELLED},
    ObligationStatus.COMPLETED: set(),  # Terminal state
    ObligationStatus.FAILED: {ObligationStatus.PENDING, ObligationStatus.CANCELLED},
    ObligationStatus.CANCELLED: set(),  # Terminal state
}


def is_valid_transition(current_state: ObligationStatus, new_state: ObligationStatus) -> bool:
    """
    Check if a state transition is valid.

    Args:
        current_state: Current obligation state
        new_state: Desired new state

    Returns:
        True if transition is valid, False otherwise
    """
    allowed_transitions = TRANSITIONS.get(current_state, set())
    is_valid = new_state in allowed_transitions

    if not is_valid:
        logger.warning(
            "invalid_state_transition",
            current_state=current_state.value,
            new_state=new_state.value,
            allowed_transitions=[s.value for s in allowed_transitions]
        )

    return is_valid


def transition(
    current_state: ObligationStatus,
    new_state: ObligationStatus,
    actor_id: str,
    actor_mci_reg: str
) -> ObligationStatus:
    """
    Perform a state transition with validation.

    Args:
        current_state: Current obligation state
        new_state: Desired new state
        actor_id: ID of the actor performing the transition
        actor_mci_reg: MCI registration number of the actor

    Returns:
        New state if transition is valid

    Raises:
        ValueError: If transition is invalid
    """
    if not is_valid_transition(current_state, new_state):
        raise ValueError(
            f"Invalid transition from {current_state.value} to {new_state.value}"
        )

    logger.info(
        "state_transition",
        current_state=current_state.value,
        new_state=new_state.value,
        actor_id=actor_id,
        actor_mci_reg=actor_mci_reg
    )

    return new_state
