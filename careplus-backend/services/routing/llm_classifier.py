from typing import Dict, Any
from careplus.llm.openrouter import OpenRouterClient
from careplus.core.logging import logger


async def llm_classify(question: str, llm_client: OpenRouterClient) -> Dict[str, Any]:
    """
    LLM classifier for questions that pass the deterministic layer without match.
    
    Returns one of: PLAN, OTHER.
    - MEDICINE, SYMPTOM, EMERGENCY always escalate (handled by deterministic layer)
    - PLAN may be answered from approved items
    - OTHER escalates unless safely answerable
    
    Fail-safe: if LLM classifier fails (timeout, OpenRouter error) → escalate to care team.
    Never error out.
    
    Args:
        question: The patient's question
        llm_client: LLMClient instance
    
    Returns:
        Dict with:
        - route: 'plan' or 'other'
        - escalate: boolean
        - confidence: float
        - reasoning: str
    """
    system_prompt = """You are a medical question classifier for a hospital discharge follow-up system.

Classify the patient's question into one of these categories:
- PLAN: Questions about schedule, timing, appointments, test dates, follow-up visits, when something will happen
- OTHER: Any other question that doesn't fit PLAN

Respond in JSON format:
{
  "route": "plan" or "other",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}

Important:
- If the question is about medications, symptoms, or emergencies, it should have been caught by the deterministic layer already.
- PLAN questions can potentially be answered from approved_item records.
- OTHER questions should escalate to the care team."""

    try:
        prompt = f"""Classify this patient question:
"{question}"

Respond with the category, confidence, and reasoning."""
        
        schema = {
            "route": "string",
            "confidence": "number",
            "reasoning": "string"
        }
        
        result = await llm_client.generate_structured(
            prompt=prompt,
            schema=schema,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=200
        )
        
        route = result.get("route", "").lower()
        confidence = result.get("confidence", 0.0)
        reasoning = result.get("reasoning", "")
        
        # Validate route
        if route not in ["plan", "other"]:
            logger.warning(
                "llm_classifier_invalid_route",
                route=route,
                fallback="other"
            )
            route = "other"
        
        # Determine escalation
        # PLAN can be answered from approved items (may not escalate)
        # OTHER always escalates
        escalate = (route == "other")
        
        logger.info(
            "llm_classifier_success",
            question=question[:100],
            route=route,
            confidence=confidence,
            escalate=escalate
        )
        
        return {
            "route": route,
            "escalate": escalate,
            "confidence": confidence,
            "reasoning": reasoning
        }
    
    except Exception as e:
        # Fail-safe: escalate on any error
        logger.error(
            "llm_classifier_error",
            error=str(e),
            question=question[:100],
            fallback="escalate"
        )
        return {
            "route": "other",
            "escalate": True,
            "confidence": 0.0,
            "reasoning": f"LLM classifier failed: {str(e)}. Escalating to care team."
        }
