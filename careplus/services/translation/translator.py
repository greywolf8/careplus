from typing import Optional
from careplus.llm.openrouter import OpenRouterClient
from careplus.core.logging import logger


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    llm_client: Optional[OpenRouterClient] = None
) -> dict:
    """
    Translate text from source language to target language using OpenRouter LLM.
    
    Language tiers:
    - English (en): source tier, no translation needed
    - Hindi (hi): standard prompt + default model
    - Tamil (ta): stricter prompt with explicit entity preservation + stronger model (claude-3.5-sonnet)
    
    Args:
        text: Source text to translate
        source_lang: Source language code (e.g., 'en', 'hi', 'ta')
        target_lang: Target language code (e.g., 'en', 'hi', 'ta')
        llm_client: Optional LLMClient instance (creates new one if not provided)
    
    Returns:
        Dict with:
        - translated_text: The translated text
        - model_used: The model used for translation
        - source_lang: Original source language
        - target_lang: Target language
    """
    if source_lang == target_lang:
        logger.info("translation_skipped_same_language", lang=source_lang)
        return {
            "translated_text": text,
            "model_used": "none",
            "source_lang": source_lang,
            "target_lang": target_lang
        }
    
    if llm_client is None:
        llm_client = OpenRouterClient()
    
    # Language-specific configuration
    lang_names = {
        "en": "English",
        "hi": "Hindi",
        "ta": "Tamil"
    }
    
    source_name = lang_names.get(source_lang, source_lang)
    target_name = lang_names.get(target_lang, target_lang)
    
    # Tamil gets stricter prompt and stronger model
    if target_lang == "ta":
        model = "anthropic/claude-3.5-sonnet"
        system_prompt = f"""You are a medical translation expert. Translate the following text from {source_name} to {target_name}.

CRITICAL INSTRUCTIONS:
1. Preserve ALL medical entities exactly as they appear: drug names, dosages, frequencies, durations, dates, phone numbers, ABHA IDs.
2. Do NOT translate medication names or clinical terminology unless there is a standard equivalent.
3. Maintain the exact meaning and clinical accuracy of the original text.
4. Keep numbers, dates, and contact information unchanged.
5. If uncertain about a term, keep it in the original language.
6. This translation is for a medical context - accuracy is critical.

Translate ONLY the text below. Do not add explanations or additional text."""
    else:
        # Hindi uses standard prompt and default model
        model = None  # Uses default model from client
        system_prompt = f"""You are a medical translation expert. Translate the following text from {source_name} to {target_name}.

Instructions:
1. Preserve medical entities (drug names, dosages, frequencies) when possible.
2. Maintain clinical accuracy.
3. Keep numbers, dates, and contact information unchanged.
4. Use natural, patient-friendly language.

Translate ONLY the text below. Do not add explanations or additional text."""
    
    try:
        translated_text = await llm_client.generate(
            prompt=text,
            system_prompt=system_prompt,
            temperature=0.3,  # Lower temperature for more deterministic translation
            max_tokens=1000
        )
        
        actual_model = model or llm_client.default_model
        
        logger.info(
            "translation_success",
            source_lang=source_lang,
            target_lang=target_lang,
            model=actual_model,
            text_length=len(text)
        )
        
        return {
            "translated_text": translated_text,
            "model_used": actual_model,
            "source_lang": source_lang,
            "target_lang": target_lang
        }
    
    except Exception as e:
        logger.error("translation_error", error=str(e), source_lang=source_lang, target_lang=target_lang)
        raise
