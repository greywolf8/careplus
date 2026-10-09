"""
Second-brain rules configuration.

This file defines the type system for the second brain:
- Categories for obligations
- Flags for priority/severity
- Date rules for due dates
- Escalation matrix
- Allowed output sources
"""
from typing import Dict, List, Any
from enum import Enum


class Category(str, Enum):
    """Obligation categories."""
    APPOINTMENT = "appointment"
    TEST = "test"
    REFERRAL = "referral"
    MEDICATION = "medication"
    CARE_INSTRUCTION = "care_instruction"
    WARNING_SIGN = "warning_sign"
    DIET = "diet"
    REHAB = "rehab"
    WOUND_CARE = "wound_care"


class Flag(str, Enum):
    """Priority/severity flags."""
    URGENT = "urgent"
    ROUTINE = "routine"
    OPTIONAL = "optional"
    CRITICAL = "critical"


class OutputSource(str, Enum):
    """Allowed output sources."""
    APPROVED_ITEMS = "approved_items"
    RMP_AUTHORED = "rmp_authored"
    # Note: llm_freehand is NOT allowed


# Escalation matrix: when to escalate based on category + flag
ESCALATION_MATRIX: Dict[str, Dict[str, str]] = {
    Category.APPOINTMENT.value: {
        Flag.URGENT.value: "immediate",
        Flag.CRITICAL.value: "immediate",
        Flag.ROUTINE.value: "within_24h",
        Flag.OPTIONAL.value: "within_72h"
    },
    Category.TEST.value: {
        Flag.URGENT.value: "immediate",
        Flag.CRITICAL.value: "immediate",
        Flag.ROUTINE.value: "within_48h",
        Flag.OPTIONAL.value: "within_1_week"
    },
    Category.MEDICATION.value: {
        Flag.URGENT.value: "immediate",
        Flag.CRITICAL.value: "immediate",
        Flag.ROUTINE.value: "within_24h",
        Flag.OPTIONAL.value: "within_48h"
    },
    Category.WARNING_SIGN.value: {
        Flag.URGENT.value: "immediate",
        Flag.CRITICAL.value: "immediate",
        Flag.ROUTINE.value: "within_24h",
        Flag.OPTIONAL.value: "within_24h"
    }
}


# Date rules: how to interpret relative dates
DATE_RULES: Dict[str, str] = {
    "immediately": "0 days",
    "today": "0 days",
    "tomorrow": "1 day",
    "in 2 days": "2 days",
    "in 3 days": "3 days",
    "in 1 week": "7 days",
    "in 2 weeks": "14 days",
    "in 1 month": "30 days",
    "in 6 weeks": "42 days",
    "in 3 months": "90 days"
}


# Allowed output sources
ALLOWED_OUTPUT_SOURCES = [
    OutputSource.APPROVED_ITEMS.value,
    OutputSource.RMP_AUTHORED.value
]


def get_escalation_timing(category: str, flag: str) -> str:
    """
    Get escalation timing for a category + flag combination.
    
    Returns "within_24h", "within_48h", "within_72h", "within_1_week", or "immediate".
    """
    if category not in ESCALATION_MATRIX:
        return "within_72h"  # Default for unknown categories
    
    category_rules = ESCALATION_MATRIX[category]
    return category_rules.get(flag, "within_72h")


def is_allowed_output_source(source: str) -> bool:
    """Check if output source is allowed."""
    return source in ALLOWED_OUTPUT_SOURCES


# Template rules for WikiSentence generation
SENTENCE_TEMPLATES: Dict[str, str] = {
    Category.APPOINTMENT.value: "Follow up with {specialist} on {date} for {reason}.",
    Category.TEST.value: "Complete {test_name} on or before {date}.",
    Category.MEDICATION.value: "Take {medication} {dose} {frequency} for {duration}.",
    Category.CARE_INSTRUCTION.value: "{instruction}",
    Category.WARNING_SIGN.value: "Contact doctor immediately if you experience: {symptoms}.",
    Category.DIET.value: "{diet_instruction}",
    Category.REHAB.value: "{rehab_instruction}",
    Category.WOUND_CARE.value: "{wound_care_instruction}",
    Category.REFERRAL.value: "Visit {specialist} at {facility} for {reason}."
}
