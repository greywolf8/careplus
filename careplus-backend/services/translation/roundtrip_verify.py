from typing import Dict, Any, List, Tuple
from careplus.services.translation.entity_extractor import extract_entities
from careplus.services.translation.translator import translate_text
from careplus.llm.openrouter import OpenRouterClient
from careplus.core.logging import logger


async def roundtrip_verify(
    source_text: str,
    source_lang: str,
    target_lang: str,
    llm_client: OpenRouterClient
) -> Dict[str, Any]:
    """
    Perform roundtrip verification: translate source → target → back to source.
    Extract entities from back-translation and compare to original entities.
    
    If any entity mismatch → return {verified: false, flags: ['translation_failed']}.
    
    Args:
        source_text: Original source text
        source_lang: Source language code (e.g., 'en')
        target_lang: Target language code (e.g., 'hi', 'ta')
        llm_client: LLMClient instance for translation
    
    Returns:
        Dict with:
        - translation: The target language translation
        - back_translation: The back-translated text
        - verified: Boolean indicating if roundtrip passed
        - flags: List of flags (e.g., ['translation_failed'])
        - original_entities: Entities extracted from original text
        - back_translated_entities: Entities extracted from back-translation
        - entity_mismatches: List of mismatched entities
    """
    flags = []
    
    # Step 1: Translate source → target
    translation_result = await translate_text(
        text=source_text,
        source_lang=source_lang,
        target_lang=target_lang,
        llm_client=llm_client
    )
    target_text = translation_result["translated_text"]
    
    # Step 2: Translate target → back to source
    back_translation_result = await translate_text(
        text=target_text,
        source_lang=target_lang,
        target_lang=source_lang,
        llm_client=llm_client
    )
    back_translated_text = back_translation_result["translated_text"]
    
    # Step 3: Extract entities from original and back-translated text
    original_entities = extract_entities(source_text)
    back_translated_entities = extract_entities(back_translated_text)
    
    # Step 4: Compare entities
    entity_mismatches = compare_entities(original_entities, back_translated_entities)
    
    # Step 5: Determine verification status
    verified = len(entity_mismatches) == 0
    
    if not verified:
        flags.append("translation_failed")
        logger.warning(
            "roundtrip_verification_failed",
            mismatches_count=len(entity_mismatches),
            mismatches=entity_mismatches
        )
    else:
        logger.info("roundtrip_verification_passed")
    
    return {
        "translation": target_text,
        "back_translation": back_translated_text,
        "verified": verified,
        "flags": flags,
        "original_entities": original_entities,
        "back_translated_entities": back_translated_entities,
        "entity_mismatches": entity_mismatches
    }


def compare_entities(
    original: List[Tuple[str, str, Tuple[int, int]]],
    back_translated: List[Tuple[str, str, Tuple[int, int]]]
) -> List[Dict[str, Any]]:
    """
    Compare entity lists and return mismatches.
    
    For each entity type, check if values match.
    Focus on critical entities: drug, dose, frequency, date.
    
    Args:
        original: List of (type, value, span) from original text
        back_translated: List of (type, value, span) from back-translation
    
    Returns:
        List of mismatch dicts with entity_type, original_value, back_translated_value
    """
    mismatches = []
    
    # Convert to lists for easier comparison
    original_by_type = {}
    back_translated_by_type = {}
    
    for entity_type, value, span in original:
        if entity_type not in original_by_type:
            original_by_type[entity_type] = []
        original_by_type[entity_type].append(value.lower())
    
    for entity_type, value, span in back_translated:
        if entity_type not in back_translated_by_type:
            back_translated_by_type[entity_type] = []
        back_translated_by_type[entity_type].append(value.lower())
    
    # Check critical entity types
    critical_types = ["drug", "dose", "frequency", "date"]
    
    for entity_type in critical_types:
        original_values = set(original_by_type.get(entity_type, []))
        back_values = set(back_translated_by_type.get(entity_type, []))
        
        # Find mismatches
        missing_in_back = original_values - back_values
        extra_in_back = back_values - original_values
        
        for value in missing_in_back:
            mismatches.append({
                "entity_type": entity_type,
                "original_value": value,
                "back_translated_value": None,
                "issue": "missing_in_back_translation"
            })
        
        for value in extra_in_back:
            mismatches.append({
                "entity_type": entity_type,
                "original_value": None,
                "back_translated_value": value,
                "issue": "extra_in_back_translation"
            })
    
    return mismatches
