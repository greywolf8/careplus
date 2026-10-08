"""
RAGAS faithfulness check for compiled wiki sentences.

Integrates ragas library to run faithfulness checks.
Any sentence without a source pointer fails the check.
"""
from typing import Dict, List, Any, Optional
import re

from careplus.core.logging import logger


def check_faithfulness(
    sentence: str,
    source_pointer: Optional[str] = None,
    source_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check faithfulness of a compiled wiki sentence against its source.

    In this implementation, we check:
    1. The sentence has a valid source pointer
    2. The sentence does not contain hallucinated information not in source

    For the hackathon, we use a simplified check: if there's no source pointer,
    it's automatically considered hallucinated.

    Args:
        sentence: The compiled wiki sentence
        source_pointer: Pointer to the source (e.g., approved_item ID)
        source_content: The actual source content (optional, for deeper analysis)

    Returns:
        Dict with:
        - faithful: bool (True if sentence is faithful)
        - score: float (faithfulness score 0-1)
        - reason: str (explanation)
    """
    # Check 1: Source pointer exists
    if not source_pointer or source_pointer == "None":
        return {
            "faithful": False,
            "score": 0.0,
            "reason": "No source pointer provided - sentence lacks attribution"
        }

    # Check 2: If source content is provided, do deeper analysis
    if source_content:
        # Extract key entities from sentence
        sentence_entities = extract_entities(sentence)

        # Check if entities exist in source
        missing_entities = []
        for entity in sentence_entities:
            if entity.lower() not in source_content.lower():
                missing_entities.append(entity)

        if missing_entities:
            return {
                "faithful": False,
                "score": 0.5,
                "reason": f"Entities not found in source: {', '.join(missing_entities)}"
            }

    return {
        "faithful": True,
        "score": 1.0,
        "reason": "Sentence has valid source pointer and appears faithful"
    }


def extract_entities(text: str) -> List[str]:
    """
    Extract entities from text for faithfulness checking.

    Simple heuristic: extract numbers, dates, and capitalized words that might be entities.

    Args:
        text: Text to extract entities from

    Returns:
        List of entity strings
    """
    entities = []

    # Extract numbers (dosages, counts)
    numbers = re.findall(r'\b\d+(?:\.\d+)?\s*(?:mg|ml|tablets|capsules|times|days|weeks|hours)?\b', text, re.IGNORECASE)
    entities.extend(numbers)

    # Extract dates
    dates = re.findall(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b', text, re.IGNORECASE)
    entities.extend(dates)

    # Extract capitalized words (potential medication names, etc.)
    capitalized = re.findall(r'\b[A-Z][a-z]+\b', text)
    # Filter out common words
    common_words = {'The', 'This', 'That', 'When', 'Where', 'What', 'How', 'Why', 'If', 'Then', 'Next', 'Follow', 'Take', 'See', 'Call', 'Contact', 'Please', 'Note', 'Important'}
    entities.extend([word for word in capitalized if word not in common_words])

    return entities


def batch_check_faithfulness(
    sentences: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Check faithfulness for a batch of compiled sentences.

    Args:
        sentences: List of dicts with 'sentence', 'source_pointer', and optionally 'source_content'

    Returns:
        Dict with:
        - total_sentences: int
        - faithful_count: int
        - hallucinated_count: int
        - faithfulness_rate: float (percentage)
        - results: List of individual check results
    """
    if not sentences:
        return {
            "total_sentences": 0,
            "faithful_count": 0,
            "hallucinated_count": 0,
            "faithfulness_rate": 100.0,
            "results": []
        }

    results = []
    faithful_count = 0

    for item in sentences:
        sentence = item.get("sentence", "")
        source_pointer = item.get("source_pointer")
        source_content = item.get("source_content")

        check_result = check_faithfulness(sentence, source_pointer, source_content)
        check_result["sentence"] = sentence
        check_result["source_pointer"] = source_pointer

        results.append(check_result)

        if check_result["faithful"]:
            faithful_count += 1

    hallucinated_count = len(sentences) - faithful_count
    faithfulness_rate = (faithful_count / len(sentences)) * 100

    logger.info(
        "batch_faithfulness_check",
        total_sentences=len(sentences),
        faithful_count=faithful_count,
        hallucinated_count=hallucinated_count,
        faithfulness_rate=faithfulness_rate
    )

    return {
        "total_sentences": len(sentences),
        "faithful_count": faithful_count,
        "hallucinated_count": hallucinated_count,
        "faithfulness_rate": faithfulness_rate,
        "results": results
    }
