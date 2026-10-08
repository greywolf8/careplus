"""
Evaluation metrics for CarePlus backend.

Computes and stores metrics in eval_metric table.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from uuid import UUID
import hashlib

from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


def store_metric(
    metric_name: str,
    value: float,
    dataset_ref: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Store a metric in the eval_metric table.

    Args:
        metric_name: Name of the metric
        value: Numeric value of the metric
        dataset_ref: Reference to the dataset used
        metadata: Additional metadata as JSON

    Returns:
        metric_id: UUID of the stored metric
    """
    supabase = get_supabase_client(use_service_role=True)

    metric_data = {
        "metric_name": metric_name,
        "value": value,
        "computed_at": datetime.now().isoformat(),
        "dataset_ref": dataset_ref,
        "metadata": metadata or {}
    }

    result = supabase.table("eval_metric").insert(metric_data).execute()
    metric_id = result.data[0]["id"]

    logger.info(
        "metric_stored",
        metric_name=metric_name,
        value=value,
        metric_id=str(metric_id)
    )

    return str(metric_id)


def get_all_metrics() -> List[Dict[str, Any]]:
    """
    Get the latest value for each metric.

    Returns:
        List of metric records with latest values
    """
    supabase = get_supabase_client(use_service_role=True)

    # Get the most recent entry for each metric
    result = supabase.table("eval_metric").select("*").execute()

    # Group by metric_name and keep the latest
    metrics_by_name: Dict[str, Dict[str, Any]] = {}
    for metric in result.data:
        name = metric["metric_name"]
        if name not in metrics_by_name:
            metrics_by_name[name] = metric
        else:
            # Keep the most recent
            if metric["computed_at"] > metrics_by_name[name]["computed_at"]:
                metrics_by_name[name] = metric

    return list(metrics_by_name.values())


def get_metric_history(days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get metric history for the last N days.

    Args:
        days: Number of days to look back

    Returns:
        Dict mapping metric_name to list of historical values
    """
    supabase = get_supabase_client(use_service_role=True)

    cutoff_date = datetime.now() - timedelta(days=days)

    result = supabase.table("eval_metric").select("*").gte("computed_at", cutoff_date.isoformat()).execute()

    # Group by metric_name
    history: Dict[str, List[Dict[str, Any]]] = {}
    for metric in result.data:
        name = metric["metric_name"]
        if name not in history:
            history[name] = []
        history[name].append(metric)

    return history


def compute_omission_rate(
    gold_standard_items: List[Dict[str, Any]],
    extractor_a_results: List[Dict[str, Any]],
    extractor_b_results: List[Dict[str, Any]]
) -> float:
    """
    Compute omission rate: percentage of gold-standard items not extracted by either ensemble member.

    Args:
        gold_standard_items: List of gold-standard items with content_hash
        extractor_a_results: Items extracted by extractor A
        extractor_b_results: Items extracted by extractor B

    Returns:
        Omission rate as percentage (0-100)
    """
    gold_hashes = {item.get("content_hash") for item in gold_standard_items}

    extractor_a_hashes = {item.get("content_hash") for item in extractor_a_results}
    extractor_b_hashes = {item.get("content_hash") for item in extractor_b_results}

    # Items found by either extractor
    found_hashes = extractor_a_hashes | extractor_b_hashes

    # Items not found by either
    omitted_hashes = gold_hashes - found_hashes

    if not gold_hashes:
        return 0.0

    omission_rate = (len(omitted_hashes) / len(gold_hashes)) * 100

    logger.info(
        "omission_rate_computed",
        gold_count=len(gold_hashes),
        found_count=len(found_hashes),
        omitted_count=len(omitted_hashes),
        omission_rate=omission_rate
    )

    return omission_rate


def compute_hallucination_rate(
    compiled_sentences: List[Dict[str, Any]]
) -> float:
    """
    Compute hallucination rate: percentage of compiled wiki sentences that fail RAGAS faithfulness.

    A sentence without a source pointer is considered hallucinated.

    Args:
        compiled_sentences: List of compiled sentences with source pointers

    Returns:
        Hallucination rate as percentage (0-100)
    """
    if not compiled_sentences:
        return 0.0

    hallucinated_count = 0
    for sentence in compiled_sentences:
        # Check if sentence has a valid source pointer
        if not sentence.get("source_pointer") or sentence.get("source_pointer") == "None":
            hallucinated_count += 1

    hallucination_rate = (hallucinated_count / len(compiled_sentences)) * 100

    logger.info(
        "hallucination_rate_computed",
        total_sentences=len(compiled_sentences),
        hallucinated_count=hallucinated_count,
        hallucination_rate=hallucination_rate
    )

    return hallucination_rate


def compute_readability(translations: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Compute readability metrics for translations.

    Uses Flesch-Kincaid grade level and average sentence length.
    Target: grade ≤ 9, avg sentence < 20 words.

    Args:
        translations: List of translation records with grade_level and avg_sentence_length

    Returns:
        Dict with average_grade_level, avg_sentence_length, and pass_rate
    """
    if not translations:
        return {
            "average_grade_level": 0.0,
            "avg_sentence_length": 0.0,
            "pass_rate": 0.0
        }

    grade_levels = [t.get("grade_level", 0) for t in translations if t.get("grade_level")]
    sentence_lengths = [t.get("avg_sentence_length", 0) for t in translations if t.get("avg_sentence_length")]

    avg_grade = sum(grade_levels) / len(grade_levels) if grade_levels else 0.0
    avg_sentence = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0.0

    # Count passing translations (grade ≤ 9 AND sentence < 20)
    passing_count = 0
    for t in translations:
        grade = t.get("grade_level", 0)
        sentence = t.get("avg_sentence_length", 0)
        if grade and sentence and grade <= 9 and sentence < 20:
            passing_count += 1

    pass_rate = (passing_count / len(translations)) * 100 if translations else 0.0

    logger.info(
        "readability_computed",
        total_translations=len(translations),
        avg_grade=avg_grade,
        avg_sentence=avg_sentence,
        pass_rate=pass_rate
    )

    return {
        "average_grade_level": avg_grade,
        "avg_sentence_length": avg_sentence,
        "pass_rate": pass_rate
    }


def compute_injection_resistance(
    injection_test_results: List[Dict[str, Any]]
) -> float:
    """
    Compute injection resistance: percentage of adversarial inputs that did NOT produce unauthorized output.

    Args:
        injection_test_results: List of test results with 'blocked' boolean

    Returns:
        Injection resistance rate as percentage (0-100)
    """
    if not injection_test_results:
        return 100.0  # No tests = assumed resistant

    blocked_count = sum(1 for result in injection_test_results if result.get("blocked", False))
    resistance_rate = (blocked_count / len(injection_test_results)) * 100

    logger.info(
        "injection_resistance_computed",
        total_tests=len(injection_test_results),
        blocked_count=blocked_count,
        resistance_rate=resistance_rate
    )

    return resistance_rate


def compute_reviewer_time_saved(
    baseline_time_minutes: float,
    ai_assisted_time_minutes: float
) -> float:
    """
    Compute reviewer time saved as a percentage improvement.

    Mock synthetic numbers for hackathon demonstration.

    Args:
        baseline_time_minutes: Time without AI assistance (e.g., 6.5)
        ai_assisted_time_minutes: Time with AI assistance (e.g., 3.5)

    Returns:
        Time saved as percentage (0-100)
    """
    if baseline_time_minutes <= 0:
        return 0.0

    time_saved = baseline_time_minutes - ai_assisted_time_minutes
    saved_percentage = (time_saved / baseline_time_minutes) * 100

    logger.info(
        "reviewer_time_saved_computed",
        baseline=baseline_time_minutes,
        ai_assisted=ai_assisted_time_minutes,
        saved_percentage=saved_percentage
    )

    return saved_percentage


def compute_reviewer_vigilance(
    total_canaries: int,
    detected_canaries: int
) -> float:
    """
    Compute reviewer vigilance: percentage of seeded canaries caught by reviewers.

    Args:
        total_canaries: Total number of canaries seeded
        detected_canaries: Number of canaries detected by reviewers

    Returns:
        Vigilance rate as percentage (0-100)
    """
    if total_canaries <= 0:
        return 0.0

    vigilance_rate = (detected_canaries / total_canaries) * 100

    logger.info(
        "reviewer_vigilance_computed",
        total_canaries=total_canaries,
        detected_canaries=detected_canaries,
        vigilance_rate=vigilance_rate
    )

    return vigilance_rate


def compute_translation_entity_preservation(
    translations: List[Dict[str, Any]]
) -> float:
    """
    Compute translation entity preservation: percentage of translations where round-trip entity check passes.

    Args:
        translations: List of translation records with verified flag

    Returns:
        Entity preservation rate as percentage (0-100)
    """
    if not translations:
        return 0.0

    # A translation with verified=True has passed round-trip entity check
    verified_count = sum(1 for t in translations if t.get("verified", False))
    preservation_rate = (verified_count / len(translations)) * 100

    logger.info(
        "translation_entity_preservation_computed",
        total_translations=len(translations),
        verified_count=verified_count,
        preservation_rate=preservation_rate
    )

    return preservation_rate


def compute_calibrated_abstention_rate(
    escalated_items: int,
    gold_standard_escalations: int
) -> float:
    """
    Compute calibrated abstention rate: percentage of items the system escalated vs gold-standard escalations.

    A rate close to 100% indicates good calibration.

    Args:
        escalated_items: Number of items the system escalated
        gold_standard_escalations: Number of items that should have been escalated (gold standard)

    Returns:
        Calibration rate as percentage (0-100)
    """
    if gold_standard_escalations <= 0:
        return 0.0

    # If we escalated more than gold standard, we're being conservative (good)
    # If we escalated less, we missed some
    calibration_rate = min((escalated_items / gold_standard_escalations) * 100, 100.0)

    logger.info(
        "calibrated_abstention_rate_computed",
        escalated_items=escalated_items,
        gold_standard_escalations=gold_standard_escalations,
        calibration_rate=calibration_rate
    )

    return calibration_rate


def compute_model_ensemble_agreement(
    extractor_a_results: List[Dict[str, Any]],
    extractor_b_results: List[Dict[str, Any]]
) -> float:
    """
    Compute model ensemble agreement: percentage of items both extractors found.

    Shows the OpenRouter multi-model advantage on the dashboard.

    Args:
        extractor_a_results: Items extracted by extractor A
        extractor_b_results: Items extracted by extractor B

    Returns:
        Agreement rate as percentage (0-100)
    """
    extractor_a_hashes = {item.get("content_hash") for item in extractor_a_results}
    extractor_b_hashes = {item.get("content_hash") for item in extractor_b_results}

    # Items found by both
    common_hashes = extractor_a_hashes & extractor_b_hashes

    # Total unique items found by either
    total_unique = extractor_a_hashes | extractor_b_hashes

    if not total_unique:
        return 0.0

    agreement_rate = (len(common_hashes) / len(total_unique)) * 100

    logger.info(
        "model_ensemble_agreement_computed",
        extractor_a_count=len(extractor_a_hashes),
        extractor_b_count=len(extractor_b_hashes),
        common_count=len(common_hashes),
        total_unique=len(total_unique),
        agreement_rate=agreement_rate
    )

    return agreement_rate
