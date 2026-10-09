from typing import Dict, Any, Tuple, Optional
import re
from careplus.core.logging import logger


def resolve_span(document: str, quote: str) -> Optional[Dict[str, int]]:
    """
    Resolve the span (start and end positions) of a quote within the document.

    Tries an exact substring match first; if that fails, falls back to a
    whitespace- and case-insensitive match (LLMs often reformat whitespace or
    capitalization when quoting). WORD differences still fail — this preserves
    the hallucination guard while not dropping quotes over mere formatting.

    Args:
        document: The full discharge summary text
        quote: The quote extracted by the LLM

    Returns:
        Dict with 'start' and 'end' indices if found, None otherwise.
    """
    try:
        # Exact match first
        start = document.find(quote)
        if start != -1:
            return {"start": start, "end": start + len(quote)}

        # Tolerant fallback: collapse whitespace runs + ignore case.
        if quote and quote.strip():
            pattern = r"\s+".join(re.escape(tok) for tok in quote.split())
            match = re.search(pattern, document, re.IGNORECASE)
            if match:
                return {"start": match.start(), "end": match.end()}

        logger.warning(
            "quote_not_found_in_document",
            quote_preview=quote[:100] if len(quote) > 100 else quote,
            document_length=len(document),
        )
        return None

    except Exception as e:
        logger.error("span_resolution_error", error=str(e))
        return None


def validate_quote_exactness(document: str, quote: str) -> bool:
    """
    Validate that the quote exists exactly as provided in the document.

    Args:
        document: The full discharge summary text
        quote: The quote to validate

    Returns:
        True if quote exists exactly, False otherwise
    """
    return quote in document
