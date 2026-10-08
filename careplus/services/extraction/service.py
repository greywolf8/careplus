from typing import Dict, Any, List
from careplus.services.extraction import (
    run_ensemble_extraction,
    merge_ensemble_results,
    resolve_span,
    validate_quote_exactness,
    check_completeness,
    lint_extracted_items,
    compute_confidence,
    compute_agreement_rate,
    deidentify_text,
    restore_quotes_with_original
)
from careplus.core.logging import logger


async def extract_from_discharge_summary(
    raw_text: str,
    discharge_type: str = "general_medical"
) -> Dict[str, Any]:
    """
    Run the full extraction pipeline on a discharge summary.

    Pipeline:
    1. De-identify text (remove PHI before LLM call)
    2. Run ensemble extraction (two models in parallel)
    3. Merge ensemble results
    4. Resolve spans (compute start/end positions in original text)
    5. Check completeness (per-discharge-type checklist)
    6. Lint pass (quality checks)
    7. Compute confidence score

    Args:
        raw_text: The discharge summary text
        discharge_type: Type of discharge (post_cabg, post_tka, general_medical)

    Returns:
        Dict with items, could_not_place, quality, and completeness metrics
    """
    # Step 1: De-identify text
    deidentified_text, token_mapping = deidentify_text(raw_text)

    # Step 2: Run ensemble extraction
    ensemble_result = await run_ensemble_extraction(deidentified_text)
    extractor_a_items = ensemble_result["extractor_a_items"]
    extractor_b_items = ensemble_result["extractor_b_items"]
    models_used = ensemble_result["models_used"]

    # Step 3: Merge ensemble results
    merged_items = merge_ensemble_results(extractor_a_items, extractor_b_items)

    # Step 4: Restore PHI in quotes (span resolution needs original text)
    items_with_original_quotes = restore_quotes_with_original(merged_items, token_mapping)

    # Step 5: Resolve spans and validate quotes
    valid_items = []
    could_not_place = []

    for item in items_with_original_quotes:
        quote = item.get("quote", "")
        if not quote:
            could_not_place.append({
                "item": item,
                "reason": "missing_quote"
            })
            continue

        # Validate quote exists in original text
        if not validate_quote_exactness(raw_text, quote):
            could_not_place.append({
                "item": item,
                "reason": "quote_not_found_in_document"
            })
            continue

        # Resolve span
        span = resolve_span(raw_text, quote)
        if span:
            item["source_span"] = span
            valid_items.append(item)
        else:
            could_not_place.append({
                "item": item,
                "reason": "span_resolution_failed"
            })

    # Step 6: Check completeness
    completeness_result = check_completeness(valid_items, discharge_type)

    # Step 7: Lint pass
    lint_result = lint_extracted_items(valid_items)

    # Step 8: Compute agreement rate
    agreement_rate = compute_agreement_rate(extractor_a_items, extractor_b_items)

    # Step 9: Compute confidence
    confidence_score = compute_confidence(
        agreement_rate=agreement_rate,
        checklist_pass=completeness_result["checklist_pass"],
        lint_pass=lint_result["quality_pass"]
    )

    # Add confidence to each item
    for item in valid_items:
        item["confidence_score"] = confidence_score
        item["state"] = "drafted"

    logger.info(
        "extraction_complete",
        valid_items_count=len(valid_items),
        could_not_place_count=len(could_not_place),
        agreement_rate=agreement_rate,
        confidence_score=confidence_score
    )

    return {
        "items": valid_items,
        "could_not_place": could_not_place,
        "quality": {
            "agreement_rate": agreement_rate,
            "models_used": models_used,
            "quality_pass": lint_result["quality_pass"],
            "total_issues": lint_result["total_issues"],
            "issues": lint_result["issues"]
        },
        "completeness": completeness_result
    }
