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
    logger.info(
        "extraction_started",
        discharge_type=discharge_type,
        text_length=len(raw_text),
        text_preview=raw_text[:500] if raw_text else ""
    )

    # Step 1: De-identify text
    deidentified_text, token_mapping = deidentify_text(raw_text)

    # Step 2: Run ensemble extraction
    ensemble_result = await run_ensemble_extraction(deidentified_text)
    extractor_a_items = ensemble_result["extractor_a_items"]
    extractor_b_items = ensemble_result["extractor_b_items"]
    models_used = ensemble_result["models_used"]

    logger.info(
        "ensemble_extraction_results",
        extractor_a_count=len(extractor_a_items),
        extractor_b_count=len(extractor_b_items),
        extractor_a_categories=[item.get("category") for item in extractor_a_items],
        extractor_b_categories=[item.get("category") for item in extractor_b_items]
    )

    # Step 3: Merge ensemble results
    merged_items = merge_ensemble_results(extractor_a_items, extractor_b_items)

    logger.info(
        "merged_items",
        merged_count=len(merged_items),
        merged_categories=[item.get("category") for item in merged_items]
    )

    # Step 4: Restore PHI in quotes (span resolution needs original text)
    items_with_original_quotes = restore_quotes_with_original(merged_items, token_mapping)

    logger.info(
        "restore_quotes_complete",
        items_with_quotes_count=len(items_with_original_quotes),
        items_with_quotes_categories=[item.get("category") for item in items_with_original_quotes]
    )

    # Step 5: Resolve spans (tolerant). Keep every identified item so results
    # and completeness reflect what the model found; items whose quote cannot
    # be verified are FLAGGED (not dropped) and still surfaced for human review.
    valid_items = []
    could_not_place = []
    missing_quote_count = 0
    quote_not_found_count = 0
    span_resolution_failed_count = 0

    for item in items_with_original_quotes:
        if not isinstance(item.get("metadata"), dict):
            item["metadata"] = {}
        flags = item["metadata"].setdefault("quality_flags", [])

        quote = item.get("quote", "")
        if not quote:
            missing_quote_count += 1
            logger.warning(
                "item_missing_quote",
                category=item.get("category"),
                content=item.get("content", "")[:100]
            )
            if "missing_quote" not in flags:
                flags.append("missing_quote")
            could_not_place.append({
                "item": item,
                "reason": "missing_quote"
            })
            valid_items.append(item)
            continue

        # Resolve span tolerantly (exact, then whitespace/case-insensitive).
        span = resolve_span(raw_text, quote)
        if span is not None:
            item["source_span"] = span
        else:
            item["source_span"] = None
            quote_not_found_count += 1
            logger.warning(
                "unverified_quote_not_dropped",
                category=item.get("category"),
                quote=quote[:100],
                content=item.get("content", "")[:100]
            )
            if "unverified_quote" not in flags:
                flags.append("unverified_quote")
            could_not_place.append({
                "item": item,
                "reason": "quote_not_found_in_document"
            })
        valid_items.append(item)

    logger.info(
        "span_resolution_complete",
        valid_items_count=len(valid_items),
        could_not_place_count=len(could_not_place),
        missing_quote_count=missing_quote_count,
        quote_not_found_count=quote_not_found_count,
        span_resolution_failed_count=span_resolution_failed_count,
        valid_item_categories=[item.get("category") for item in valid_items]
    )

    # Step 6: Check completeness
    completeness_result = check_completeness(valid_items, discharge_type)

    logger.info(
        "completeness_check",
        discharge_type=discharge_type,
        required_count=completeness_result["required_count"],
        found_count=completeness_result["found_count"],
        missing_categories=completeness_result["missing"],
        extracted_categories=[item.get("category") for item in valid_items],
        checklist_pass=completeness_result["checklist_pass"]
    )

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
