from careplus.services.extraction.ensemble import run_ensemble_extraction, merge_ensemble_results
from careplus.services.extraction.span_resolver import resolve_span, validate_quote_exactness
from careplus.services.extraction.completeness_checklist import check_completeness, get_required_categories
from careplus.services.extraction.lint import lint_extracted_items
from careplus.services.extraction.confidence import compute_confidence, compute_agreement_rate
from careplus.services.extraction.prompts import EXTRACTION_SYSTEM_PROMPT
from careplus.services.extraction.deidentification import deidentify_text, reidentify_text, restore_quotes_with_original

__all__ = [
    "run_ensemble_extraction",
    "merge_ensemble_results",
    "resolve_span",
    "validate_quote_exactness",
    "check_completeness",
    "get_required_categories",
    "lint_extracted_items",
    "compute_confidence",
    "compute_agreement_rate",
    "EXTRACTION_SYSTEM_PROMPT",
    "deidentify_text",
    "reidentify_text",
    "restore_quotes_with_original"
]
