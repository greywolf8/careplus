from typing import Dict, Any
from careplus.llm.openrouter import OpenRouterClient
from careplus.core.logging import logger


async def translate_doctor_text(
    doctor_text: str,
    patient_language: str,
    llm_client: OpenRouterClient
) -> Dict[str, Any]:
    """
    Translate and simplify doctor's text for patient communication.
    
    The LLM may translate + simplify the doctor's text.
    MUST NOT:
    - Add medical advice
    - Add new facts
    - Change dosage/diagnosis/treatment/instructions
    
    Output: {patient_text, source: 'doctor_translation'}
    
    The doctor must explicitly approve the patient-facing version via /verify/translation
    before sending.
    
    Args:
        doctor_text: The doctor's original text
        patient_language: Target language code (e.g., 'hi', 'ta')
        llm_client: LLMClient instance
    
    Returns:
        Dict with:
        - patient_text: The translated/simplified text
        - source: 'doctor_translation'
        - original_text: The original doctor text
    """
    lang_names = {
        "en": "English",
        "hi": "Hindi",
        "ta": "Tamil"
    }
    
    target_name = lang_names.get(patient_language, patient_language)
    
    system_prompt = f"""You are a medical communication expert. Your task is to translate and simplify a doctor's text for a patient who speaks {target_name}.

CRITICAL CONSTRAINTS:
1. You MUST NOT add any medical advice, new facts, or clinical information not in the original text.
2. You MUST NOT change dosages, diagnoses, treatment plans, or medical instructions.
3. You MUST NOT make assumptions about the patient's condition.
4. You MAY simplify language and explain medical terms in plain language.
5. You MAY translate to the patient's language while preserving clinical accuracy.
6. Preserve all numbers, dates, times, and specific instructions exactly as stated.

If the original text is already in {target_name}, only simplify the language without changing meaning.

Translate ONLY the text below. Do not add explanations or additional text."""

    try:
        prompt = f"""Doctor's text to translate and simplify:
"{doctor_text}"

Provide the patient-facing version in {target_name}."""

        patient_text = await llm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,  # Low temperature for accuracy
            max_tokens=1000
        )
        
        logger.info(
            "doctor_translation_success",
            original_length=len(doctor_text),
            translated_length=len(patient_text),
            target_language=patient_language
        )
        
        return {
            "patient_text": patient_text,
            "source": "doctor_translation",
            "original_text": doctor_text
        }
    
    except Exception as e:
        logger.error(
            "doctor_translation_error",
            error=str(e),
            target_language=patient_language
        )
        raise
