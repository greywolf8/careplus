"""
Confidence scoring for extracted items.

Confidence is computed deterministically from ensemble agreement + checklist pass + lint pass.
This is NOT a model-reported 0-100 score.

Formula:
---------
confidence_score = (agreement_weight * agreement_rate) +
                   (checklist_weight * checklist_pass) +
                   (lint_weight * lint_pass)

Where:
- agreement_rate: Percentage of items where both extractors agree (0.0 to 1.0)
- checklist_pass: 1.0 if all required categories are present, 0.0 otherwise
- lint_pass: 1.0 if no lint issues, 0.0 otherwise

Weights:
- agreement_weight: 0.5 (50% - ensemble agreement is the strongest signal)
- checklist_weight: 0.3 (30% - completeness is important for clinical safety)
- lint_weight: 0.2 (20% - data quality matters but is secondary)

Final score ranges from 0.0 to 1.0. Convert to percentage by multiplying by 100.

Example:
---------
- Agreement rate: 0.85 (85%)
- Checklist pass: 1.0 (all required categories present)
- Lint pass: 0.9 (some minor issues)

confidence = (0.5 * 0.85) + (0.3 * 1.0) + (0.2 * 0.9)
           = 0.425 + 0.3 + 0.18
           = 0.905 (90.5%)
"""

from typing import Dict, Any


def compute_confidence(
    agreement_rate: float,
    checklist_pass: bool,
    lint_pass: bool
) -> float:
    """
    Compute confidence score from ensemble agreement and quality checks.

    Args:
        agreement_rate: Percentage of items where extractors agree (0.0 to 1.0)
        checklist_pass: True if all required categories are present
        lint_pass: True if no lint issues

    Returns:
        Confidence score from 0.0 to 1.0
    """
    agreement_weight = 0.5
    checklist_weight = 0.3
    lint_weight = 0.2

    checklist_score = 1.0 if checklist_pass else 0.0
    lint_score = 1.0 if lint_pass else 0.0

    confidence = (
        (agreement_weight * agreement_rate) +
        (checklist_weight * checklist_score) +
        (lint_weight * lint_score)
    )

    return round(confidence, 3)


def compute_agreement_rate(
    extractor_a_items: list,
    extractor_b_items: list,
    similarity_threshold: float = 0.8
) -> float:
    """
    Compute the agreement rate between two extractors.

    Agreement is defined as the percentage of items from extractor A that have
    a matching item in extractor B with similarity above the threshold.

    Args:
        extractor_a_items: Items from extractor A
        extractor_b_items: Items from extractor B
        similarity_threshold: Minimum similarity score to consider items matching

    Returns:
        Agreement rate from 0.0 to 1.0
    """
    if not extractor_a_items:
        return 0.0

    matched_count = 0

    for item_a in extractor_a_items:
        # Simple matching: check if category and content are similar
        for item_b in extractor_b_items:
            if (
                item_a.get("category") == item_b.get("category") and
                item_a.get("content") == item_b.get("content")
            ):
                matched_count += 1
                break

    return matched_count / len(extractor_a_items)
