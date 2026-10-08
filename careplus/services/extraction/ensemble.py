import asyncio
from typing import Dict, Any, List
from careplus.llm import OpenRouterClient
from careplus.core.config import settings
from careplus.core.logging import logger
from careplus.services.extraction.prompts import EXTRACTION_SYSTEM_PROMPT


async def extract_with_model(
    document: str,
    model: str,
    temperature: float
) -> Dict[str, Any]:
    """
    Extract items from a discharge document using a specific model.

    Args:
        document: The discharge summary text
        model: The OpenRouter model identifier
        temperature: Temperature for generation

    Returns:
        Structured extraction result with items list
    """
    client = OpenRouterClient()

    try:
        user_prompt = f"""<document>
{document}
</document>

Extract all obligations, follow-up items, and care instructions from the discharge summary above.
Return only the JSON output as specified in the system prompt."""

        result = await client.generate_structured(
            prompt=user_prompt,
            schema={"type": "object", "properties": {"items": {"type": "array"}}},
            temperature=temperature,
            system_prompt=EXTRACTION_SYSTEM_PROMPT
        )

        return result
    finally:
        await client.close()


async def run_ensemble_extraction(document: str) -> Dict[str, Any]:
    """
    Run ensemble extraction with two different models in parallel.

    Extractor A: Low temperature (0.0) for deterministic extraction
    Extractor B: Higher temperature (0.7) for creative coverage

    Args:
        document: The discharge summary text

    Returns:
        Dict with:
        - extractor_a_items: Items from extractor A
        - extractor_b_items: Items from extractor B
        - models_used: List of model identifiers used
    """
    model_a = settings.extractor_a_model
    model_b = settings.extractor_b_model

    logger.info(
        "starting_ensemble_extraction",
        model_a=model_a,
        model_b=model_b,
        document_length=len(document)
    )

    # Run both extractions in parallel
    results = await asyncio.gather(
        extract_with_model(document, model_a, temperature=0.0),
        extract_with_model(document, model_b, temperature=0.7),
        return_exceptions=True
    )

    # Handle exceptions
    if isinstance(results[0], Exception):
        logger.error("extractor_a_failed", error=str(results[0]))
        extractor_a_items = []
    else:
        extractor_a_items = results[0].get("items", [])

    if isinstance(results[1], Exception):
        logger.error("extractor_b_failed", error=str(results[1]))
        extractor_b_items = []
    else:
        extractor_b_items = results[1].get("items", [])

    logger.info(
        "ensemble_extraction_complete",
        extractor_a_count=len(extractor_a_items),
        extractor_b_count=len(extractor_b_items)
    )

    return {
        "extractor_a_items": extractor_a_items,
        "extractor_b_items": extractor_b_items,
        "models_used": [model_a, model_b]
    }


def merge_ensemble_results(
    extractor_a_items: List[Dict[str, Any]],
    extractor_b_items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Merge results from two extractors.

    Strategy:
    - Include items from both extractors
    - Deduplicate based on category + content
    - Prefer items from extractor A (deterministic) on conflicts

    Args:
        extractor_a_items: Items from extractor A
        extractor_b_items: Items from extractor B

    Returns:
        Merged list of unique items
    """
    merged = []
    seen_keys = set()

    # Add items from extractor A first (deterministic)
    for item in extractor_a_items:
        key = (item.get("category"), item.get("content"))
        if key not in seen_keys:
            seen_keys.add(key)
            merged.append(item)

    # Add items from extractor B that aren't duplicates
    for item in extractor_b_items:
        key = (item.get("category"), item.get("content"))
        if key not in seen_keys:
            seen_keys.add(key)
            merged.append(item)

    return merged
