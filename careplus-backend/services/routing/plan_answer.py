from typing import Dict, Any, List
from uuid import UUID
from careplus.llm.openrouter import OpenRouterClient
from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


async def answer_plan_question(
    question: str,
    patient_id: UUID,
    llm_client: OpenRouterClient
) -> Dict[str, Any]:
    """
    Answer a PLAN question by selecting applicable approved_item(s).
    
    The LLM ONLY selects which approved_item applies. It returns:
    - cited_item_ids: list of approved_item UUIDs
    - selected_field: which field to use for the answer
    
    The answer is rendered from approved_item fields by a templating function —
    NEVER freehand LLM prose.
    
    If no suitable approved_item exists → escalate.
    Never answer from general medical knowledge.
    
    Args:
        question: The patient's question
        patient_id: Patient UUID
        llm_client: LLMClient instance
    
    Returns:
        Dict with:
        - answer: The rendered answer
        - cited_item_ids: List of approved_item UUIDs
        - escalate: boolean
        - confidence: float
    """
    # Step 1: Fetch all approved items for the patient
    supabase = get_supabase_client(use_service_role=True)
    
    try:
        items_result = supabase.table("approved_item").select("*").eq("patient_id", str(patient_id)).execute()
        approved_items = items_result.data
        
        if not approved_items:
            logger.info(
                "plan_answer_no_items",
                patient_id=str(patient_id),
                question=question[:100]
            )
            return {
                "answer": None,
                "cited_item_ids": [],
                "escalate": True,
                "confidence": 0.0,
                "reasoning": "No approved items found for this patient."
            }
        
        # Step 2: Ask LLM to select relevant items
        system_prompt = """You are a medical question answering assistant for hospital discharge follow-up.

Your task is to SELECT which approved_item(s) are relevant to answer the patient's question.
You MUST NOT generate freehand text. You only identify which items to use.

Available items will be provided as a JSON list with:
- id: UUID
- item_type: category (e.g., 'test', 'medication', 'appointment', 'referral')
- content: the item content

Respond in JSON format:
{
  "cited_item_ids": ["uuid1", "uuid2"],
  "selected_field": "content",
  "reasoning": "brief explanation of why these items match"
}

Rules:
- If the question asks about a test date, find items with item_type='test'
- If the question asks about an appointment, find items with item_type='appointment'
- If no relevant items exist, return empty cited_item_ids
- NEVER invent or assume information not in the items"""

        # Format items for LLM
        items_summary = []
        for item in approved_items:
            items_summary.append({
                "id": item["id"],
                "item_type": item["item_type"],
                "content": item["content"][:200]  # Truncate for context
            })
        
        prompt = f"""Patient question: "{question}"

Available approved items:
{items_summary}

Select which items are relevant to answer this question."""

        schema = {
            "cited_item_ids": "array",
            "selected_field": "string",
            "reasoning": "string"
        }
        
        result = await llm_client.generate_structured(
            prompt=prompt,
            schema=schema,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=500
        )
        
        cited_item_ids = result.get("cited_item_ids", [])
        selected_field = result.get("selected_field", "content")
        reasoning = result.get("reasoning", "")
        
        # Step 3: Validate that cited items exist
        valid_cited_ids = []
        for item_id in cited_item_ids:
            if any(item["id"] == item_id for item in approved_items):
                valid_cited_ids.append(item_id)
        
        if not valid_cited_ids:
            logger.info(
                "plan_answer_no_match",
                patient_id=str(patient_id),
                question=question[:100],
                reasoning=reasoning
            )
            return {
                "answer": None,
                "cited_item_ids": [],
                "escalate": True,
                "confidence": 0.0,
                "reasoning": "No relevant approved items found. " + reasoning
            }
        
        # Step 4: Render answer from approved items (templating, NOT freehand)
        answer = render_answer_from_items(valid_cited_ids, approved_items, question)
        
        logger.info(
            "plan_answer_success",
            patient_id=str(patient_id),
            question=question[:100],
            cited_count=len(valid_cited_ids),
            answer_length=len(answer)
        )
        
        return {
            "answer": answer,
            "cited_item_ids": valid_cited_ids,
            "escalate": False,
            "confidence": 0.8,  # High confidence when we have matching items
            "reasoning": reasoning
        }
    
    except Exception as e:
        logger.error(
            "plan_answer_error",
            error=str(e),
            patient_id=str(patient_id),
            question=question[:100]
        )
        # Fail-safe: escalate on error
        return {
            "answer": None,
            "cited_item_ids": [],
            "escalate": True,
            "confidence": 0.0,
            "reasoning": f"Error processing plan question: {str(e)}"
        }


def render_answer_from_items(
    cited_ids: List[str],
    approved_items: List[Dict[str, Any]],
    question: str
) -> str:
    """
    Render answer from approved_item fields using templating.
    NEVER generates freehand LLM prose.
    
    Simple templating based on item_type and content.
    In production, this would use more sophisticated templates.
    """
    # Get the cited items
    cited_items = [item for item in approved_items if item["id"] in cited_ids]
    
    if not cited_items:
        return "I could not find information to answer your question."
    
    # Simple rendering: use the content directly
    # In production, would extract specific fields (due_date, time, location, etc.)
    answers = []
    for item in cited_items:
        item_type = item.get("item_type", "")
        content = item.get("content", "")
        
        # Basic templating based on item type
        if item_type == "test":
            answers.append(f"{content}")
        elif item_type == "appointment":
            answers.append(f"{content}")
        elif item_type == "medication":
            answers.append(f"{content}")
        else:
            answers.append(f"{content}")
    
    if len(answers) == 1:
        return answers[0]
    else:
        return "\n\n".join(answers)
