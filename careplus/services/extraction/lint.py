from typing import Dict, List, Set, Any
from datetime import datetime
from careplus.core.logging import logger


# Keywords that indicate medication changes
MEDICATION_CHANGE_KEYWORDS = [
    "stop", "hold", "start", "increase", "decrease",
    "replace", "switch", "change", "discontinue", "resume"
]


def lint_extracted_items(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Run a lint pass on extracted items to detect quality issues.

    Checks:
    - Duplicate items
    - Vague timing on dates
    - Conflicting dates
    - Medication change keywords
    - Missing medication fields (dose, frequency, duration)

    Args:
        items: List of extracted items

    Returns:
        Dict with quality flags and issues found
    """
    issues = {
        "duplicates": [],
        "vague_timing": [],
        "conflicting_dates": [],
        "medication_changes": [],
        "missing_medication_fields": []
    }

    # Check for duplicates
    issues["duplicates"] = find_duplicates(items)

    # Check for vague timing
    issues["vague_timing"] = find_vague_timing(items)

    # Check for conflicting dates
    issues["conflicting_dates"] = find_conflicting_dates(items)

    # Check for medication changes
    issues["medication_changes"] = find_medication_changes(items)

    # Check for missing medication fields
    issues["missing_medication_fields"] = find_missing_medication_fields(items)

    # Compute overall quality score
    total_issues = sum(len(issues[key]) for key in issues)
    quality_pass = total_issues == 0

    return {
        "quality_pass": quality_pass,
        "total_issues": total_issues,
        "issues": issues
    }


def find_duplicates(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Find duplicate items based on category and content similarity.

    Args:
        items: List of extracted items

    Returns:
        List of duplicate items (marked with index)
    """
    seen = {}
    duplicates = []

    for idx, item in enumerate(items):
        key = (item.get("category"), item.get("content", "").lower().strip())
        if key in seen:
            duplicates.append({
                "index": idx,
                "duplicate_of": seen[key],
                "category": item.get("category"),
                "content": item.get("content")
            })
        else:
            seen[key] = idx

    return duplicates


def find_vague_timing(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Find items with vague or unresolvable dates.

    Args:
        items: List of extracted items

    Returns:
        List of items with vague timing
    """
    vague_items = []

    for idx, item in enumerate(items):
        due_date = item.get("due_date")
        if not due_date or due_date == "unknown" or due_date == "TBD":
            vague_items.append({
                "index": idx,
                "category": item.get("category"),
                "content": item.get("content"),
                "due_date": due_date
            })

    return vague_items


def find_conflicting_dates(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Find items with conflicting dates (same due_date but different categories).

    Args:
        items: List of extracted items

    Returns:
        List of conflicting date groups
    """
    date_map: Dict[str, List[Dict[str, Any]]] = {}

    for idx, item in enumerate(items):
        due_date = item.get("due_date")
        if due_date and due_date != "unknown":
            if due_date not in date_map:
                date_map[due_date] = []
            date_map[due_date].append({
                "index": idx,
                "category": item.get("category"),
                "content": item.get("content")
            })

    # Find dates with multiple different categories
    conflicts = []
    for date, date_items in date_map.items():
        categories = {item["category"] for item in date_items}
        if len(categories) > 1:
            conflicts.append({
                "date": date,
                "categories": list(categories),
                "items": date_items
            })

    return conflicts


def find_medication_changes(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Find medication items with change keywords.

    Args:
        items: List of extracted items

    Returns:
        List of medication change items
    """
    changes = []

    for idx, item in enumerate(items):
        if item.get("category") != "medication":
            continue

        content = item.get("content", "").lower()
        quote = item.get("quote", "").lower()

        for keyword in MEDICATION_CHANGE_KEYWORDS:
            if keyword in content or keyword in quote:
                changes.append({
                    "index": idx,
                    "keyword": keyword,
                    "content": item.get("content"),
                    "quote": item.get("quote")
                })
                break

    return changes


def find_missing_medication_fields(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Find medication items missing required fields (dose, frequency, duration).

    Args:
        items: List of extracted items

    Returns:
        List of medication items with missing fields
    """
    missing_fields = []

    for idx, item in enumerate(items):
        if item.get("category") != "medication":
            continue

        metadata = item.get("metadata", {})
        med_details = metadata.get("medication_details", {})

        missing = []
        if not med_details.get("dose"):
            missing.append("dose")
        if not med_details.get("frequency"):
            missing.append("frequency")
        if not med_details.get("duration"):
            missing.append("duration")

        if missing:
            missing_fields.append({
                "index": idx,
                "content": item.get("content"),
                "missing_fields": missing
            })

    return missing_fields
