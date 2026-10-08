from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from uuid import UUID
from careplus.llm.openrouter import OpenRouterClient
from careplus.core.logging import logger


async def draft_task_from_description(
    doctor_description: str,
    discharge_date: datetime,
    patient_id: UUID,
    llm_client: OpenRouterClient
) -> Dict[str, Any]:
    """
    Draft a task from doctor's description.
    
    LLM extracts: category, what, specialty, due_date, date_rule, provider_specialty.
    NEVER invents clinical content not in the doctor's text.
    
    Date resolver is deterministic:
    - "after 10 days" → discharge_date + 10 days
    - "in two weeks" → + 14 days
    - "15 Oct" → that date
    - "soon", "as needed", "regularly" → due_date=null, date_rule=original, vague_timing flag
    
    Validation: if doctor's text doesn't mention medication, LLM cannot output category=medication.
    
    Args:
        doctor_description: Doctor's task description
        discharge_date: Patient's discharge date (anchor for date resolution)
        patient_id: Patient UUID
        llm_client: LLMClient instance
    
    Returns:
        Dict with:
        - category: task category
        - what: task description
        - specialty: medical specialty
        - due_date: resolved due date or null
        - date_rule: original date rule from doctor
        - provider_specialty: required provider specialty
        - vague_timing: boolean flag for vague timing
        - valid: boolean indicating if validation passed
    """
    system_prompt = """You are a medical task drafting assistant. Extract structured task information from a doctor's description.

CRITICAL RULES:
1. NEVER invent clinical content not in the doctor's text.
2. If the doctor doesn't mention a medication, do NOT set category='medication'.
3. If the doctor doesn't mention a specific date, do NOT invent one.
4. Extract the date rule exactly as stated (e.g., "after 10 days", "in two weeks", "15 Oct").
5. Categories: medication, test, appointment, referral, followup, other.
6. If timing is vague (soon, as needed, regularly), mark as vague_timing=true.

Respond in JSON format:
{
  "category": "medication|test|appointment|referral|followup|other",
  "what": "brief task description",
  "specialty": "medical specialty if mentioned",
  "date_rule": "exact date rule from doctor's text",
  "provider_specialty": "required provider specialty if mentioned",
  "reasoning": "brief explanation"
}

Examples:
- "Arrange cardiology review in 5 days" → category=referral, date_rule="in 5 days", specialty=cardiology
- "Take aspirin daily" → category=medication, date_rule="daily"
- "Follow up in 2 weeks" → category=followup, date_rule="in 2 weeks"
- "Schedule blood test soon" → category=test, date_rule="soon", vague_timing=true"""

    try:
        prompt = f"""Doctor's task description:
"{doctor_description}"

Extract the task details. Discharge date is: {discharge_date.strftime('%Y-%m-%d')}"""

        schema = {
            "category": "string",
            "what": "string",
            "specialty": "string",
            "date_rule": "string",
            "provider_specialty": "string",
            "reasoning": "string"
        }
        
        result = await llm_client.generate_structured(
            prompt=prompt,
            schema=schema,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=500
        )
        
        category = result.get("category", "other")
        what = result.get("what", doctor_description)
        specialty = result.get("specialty")
        date_rule = result.get("date_rule", "")
        provider_specialty = result.get("provider_specialty")
        reasoning = result.get("reasoning", "")
        
        # Validation: check if category=medication but no medication mentioned
        if category == "medication" and "medication" not in doctor_description.lower() and "medicine" not in doctor_description.lower() and "pill" not in doctor_description.lower() and "tablet" not in doctor_description.lower() and "injection" not in doctor_description.lower():
            logger.warning(
                "task_draft_validation_failed",
                category=category,
                description=doctor_description,
                reason="Category is medication but no medication mentioned in description"
            )
            return {
                "category": category,
                "what": what,
                "specialty": specialty,
                "due_date": None,
                "date_rule": date_rule,
                "provider_specialty": provider_specialty,
                "vague_timing": False,
                "valid": False,
                "error": "INVALID_INPUT: Category is medication but no medication mentioned in description"
            }
        
        # Resolve date
        due_date, vague_timing = resolve_date(date_rule, discharge_date)
        
        logger.info(
            "task_draft_success",
            patient_id=str(patient_id),
            category=category,
            date_rule=date_rule,
            due_date=due_date.isoformat() if due_date else None,
            vague_timing=vague_timing
        )
        
        return {
            "category": category,
            "what": what,
            "specialty": specialty,
            "due_date": due_date.isoformat() if due_date else None,
            "date_rule": date_rule,
            "provider_specialty": provider_specialty,
            "vague_timing": vague_timing,
            "valid": True,
            "reasoning": reasoning
        }
    
    except Exception as e:
        logger.error(
            "task_draft_error",
            error=str(e),
            description=doctor_description
        )
        return {
            "category": None,
            "what": None,
            "specialty": None,
            "due_date": None,
            "date_rule": None,
            "provider_specialty": None,
            "vague_timing": False,
            "valid": False,
            "error": str(e)
        }


def resolve_date(date_rule: str, discharge_date: datetime) -> tuple[Optional[datetime], bool]:
    """
    Resolve date from date rule against discharge_date anchor.
    
    Rules:
    - "after X days" → discharge_date + X days
    - "in X days/weeks" → discharge_date + X days/weeks
    - Specific date (e.g., "15 Oct") → that date
    - "soon", "as needed", "regularly" → due_date=null, vague_timing=true
    
    Returns:
        Tuple of (due_date or None, vague_timing boolean)
    """
    if not date_rule:
        return None, False
    
    date_rule_lower = date_rule.lower()
    
    # Vague timing keywords
    vague_keywords = ["soon", "as needed", "regularly", "prn", "ongoing", "continuous"]
    for keyword in vague_keywords:
        if keyword in date_rule_lower:
            return None, True
    
    # "after X days" pattern
    import re
    after_days_match = re.search(r'after\s+(\d+)\s+days?', date_rule_lower)
    if after_days_match:
        days = int(after_days_match.group(1))
        return discharge_date + timedelta(days=days), False
    
    # "in X days" pattern
    in_days_match = re.search(r'in\s+(\d+)\s+days?', date_rule_lower)
    if in_days_match:
        days = int(in_days_match.group(1))
        return discharge_date + timedelta(days=days), False
    
    # "in X weeks" pattern
    in_weeks_match = re.search(r'in\s+(\d+)\s+weeks?', date_rule_lower)
    if in_weeks_match:
        weeks = int(in_weeks_match.group(1))
        return discharge_date + timedelta(weeks=weeks), False
    
    # Try to parse as specific date
    try:
        # If the rule contains a date-like string, try to parse it
        # This handles "15 Oct", "October 15", "2024-10-15", etc.
        parsed_date = date_parser.parse(date_rule, fuzzy=True)
        # If parsed date has no year, use current year
        if parsed_date.year == 1900:  # dateutil default for missing year
            parsed_date = parsed_date.replace(year=discharge_date.year)
        return parsed_date, False
    except:
        pass
    
    # If no pattern matches, return None
    return None, False
