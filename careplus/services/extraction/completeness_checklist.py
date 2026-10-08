from typing import Dict, List, Set, Any
from careplus.core.logging import logger


# Per-discharge-type checklists defining required categories
COMPLETENESS_CHECKLISTS = {
    "post_cabg": {
        "required_categories": [
            "appointment",
            "test",
            "medication",
            "care_instruction",
            "warning_sign",
            "diet",
            "rehab"
        ],
        "description": "Post-CABG discharge checklist"
    },
    "post_tka": {
        "required_categories": [
            "appointment",
            "test",
            "medication",
            "care_instruction",
            "warning_sign",
            "rehab",
            "wound_care"
        ],
        "description": "Post-TKA (Total Knee Arthroplasty) discharge checklist"
    },
    "general_medical": {
        "required_categories": [
            "appointment",
            "medication",
            "care_instruction",
            "warning_sign"
        ],
        "description": "General medical discharge checklist"
    }
}


def check_completeness(
    extracted_items: List[Dict[str, Any]],
    discharge_type: str = "general_medical"
) -> Dict[str, Any]:
    """
    Check if extracted items cover all required categories for the discharge type.

    Args:
        extracted_items: List of extracted items with 'category' field
        discharge_type: Type of discharge (post_cabg, post_tka, general_medical)

    Returns:
        Dict with checklist_pass boolean and list of missing categories
    """
    checklist = COMPLETENESS_CHECKLISTS.get(discharge_type)
    if not checklist:
        logger.warning(
            "unknown_discharge_type",
            discharge_type=discharge_type,
            using_default="general_medical"
        )
        checklist = COMPLETENESS_CHECKLISTS["general_medical"]

    required_categories = set(checklist["required_categories"])
    extracted_categories = {item.get("category") for item in extracted_items}

    missing_categories = required_categories - extracted_categories

    return {
        "checklist_pass": len(missing_categories) == 0,
        "missing": sorted(list(missing_categories)),
        "discharge_type": discharge_type,
        "required_count": len(required_categories),
        "found_count": len(extracted_categories & required_categories)
    }


def get_required_categories(discharge_type: str) -> List[str]:
    """
    Get the list of required categories for a given discharge type.

    Args:
        discharge_type: Type of discharge

    Returns:
        List of required category names
    """
    checklist = COMPLETENESS_CHECKLISTS.get(discharge_type)
    if not checklist:
        checklist = COMPLETENESS_CHECKLISTS["general_medical"]
    return checklist["required_categories"]
