from typing import Dict, Any, Tuple, Optional
from careplus.core.logging import logger


def resolve_span(document: str, quote: str) -> Optional[Dict[str, int]]:
    """
    Resolve the span (start and end positions) of a quote within the document.

    This function uses Python's str.find to locate the exact quote in the document.
    If the quote is not found exactly as provided, the function returns None,
    indicating the LLM may have hallucinated or modified the quote.

    Args:
        document: The full discharge summary text
        quote: The exact quote extracted by the LLM

    Returns:
        Dict with 'start' and 'end' indices if found, None otherwise
    """
    try:
        # Try to find the exact quote in the document
        start = document.find(quote)

        if start == -1:
            # Quote not found - may be hallucinated or modified
            logger.warning(
                "quote_not_found_in_document",
                quote_preview=quote[:100] if len(quote) > 100 else quote,
                document_length=len(document)
            )
            return None

        end = start + len(quote)
        return {"start": start, "end": end}

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
