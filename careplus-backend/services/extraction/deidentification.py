import re
from typing import Dict, Tuple, List
from careplus.core.logging import logger


# Patterns for PHI that should be de-identified
PHI_PATTERNS = {
    "abha_id": r"\b\d{4}-\d{4}-\d{4}-\d{4}\b",  # ABHA ID format
    "phone": r"\b\d{10}\b",  # 10-digit phone numbers
    "name": r"\b[A-Z][a-z]+ [A-Z][a-z]+\b",  # Simple name pattern (last, first)
}


def deidentify_text(text: str) -> Tuple[str, Dict[str, str]]:
    """
    De-identify protected health information (PHI) from text.

    Replaces ABHA IDs, phone numbers, and names with tokens.
    Returns the de-identified text and a mapping of tokens to original values.

    Args:
        text: Original text containing PHI

    Returns:
        Tuple of (deidentified_text, token_mapping)
    """
    token_mapping = {}
    deidentified = text
    token_counter = 0

    for phi_type, pattern in PHI_PATTERNS.items():
        matches = re.finditer(pattern, deidentified)
        for match in matches:
            original = match.group()
            token = f"[{phi_type.upper()}_TOKEN_{token_counter}]"
            token_mapping[token] = original
            deidentified = deidentified.replace(original, token, 1)
            token_counter += 1

    logger.info(
        "deidentification_complete",
        tokens_replaced=len(token_mapping),
        phi_types=list(token_mapping.keys())
    )

    return deidentified, token_mapping


def reidentify_text(text: str, token_mapping: Dict[str, str]) -> str:
    """
    Restore original PHI values from tokens.

    Args:
        text: De-identified text with tokens
        token_mapping: Mapping of tokens to original values

    Returns:
        Text with original PHI restored
    """
    reidentified = text
    for token, original in token_mapping.items():
        reidentified = reidentified.replace(token, original)

    return reidentified


def restore_quotes_with_original(
    items: List[Dict[str, str]],
    token_mapping: Dict[str, str]
) -> List[Dict[str, str]]:
    """
    Restore original PHI in extracted item quotes.

    Args:
        items: Extracted items with de-identified quotes
        token_mapping: Mapping of tokens to original values

    Returns:
        Items with quotes restored to original text
    """
    for item in items:
        if "quote" in item:
            item["quote"] = reidentify_text(item["quote"], token_mapping)
        if "content" in item:
            item["content"] = reidentify_text(item["content"], token_mapping)

    return items
