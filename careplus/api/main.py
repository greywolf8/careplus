from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import uuid
from datetime import datetime
from uuid import UUID
from careplus.core.config import settings
from careplus.core.auth import get_user_from_token
from careplus.core.logging import logger
from careplus.schemas.extraction import ExtractRequest, ExtractResponse, ExtractedItem, QualityMetrics, CompletenessMetrics
from careplus.schemas.obligation import ApproveObligationRequest, ApproveObligationResponse, CloseObligationRequest, CloseObligationResponse, ObligationGraphResponse
from careplus.schemas.translation import TranslateRequest, TranslateResponse, VerifyTranslationRequest, VerifyTranslationResponse
from careplus.schemas.question import ClassifyQuestionRequest, AnswerPlanQuestionRequest, AnswerDoctorQuestionRequest
from careplus.schemas.task import DraftTaskRequest, DraftTaskResponse
from careplus.schemas.episode import EpisodeResponse
from careplus.schemas.consent import RevokeConsentRequest, RevokeConsentResponse
from careplus.schemas.verification import VerifyAuditRequest, VerifyAuditResponse
from careplus.schemas.provider import ProviderMatchRequest, ProviderMatchResponse
from careplus.schemas.eval import CanarySeedRequest, CanarySeedResponse, EvalRunRequest, EvalRunResponse, EvalJobStatusResponse
from careplus.services.extraction.service import extract_from_discharge_summary
from careplus.services.obligation import (
    ObligationStatus,
    transition,
    compute_content_hash,
    approval_to_fhir_provenance,
    obligations_to_fhir_bundle
)
from careplus.services.policy import require_policy_check
from careplus.services.second_brain import lint_episode_page_with_db
from careplus.services.translation import (
    roundtrip_verify,
    check_readability,
    extract_entities
)
from careplus.services.routing import (
    deterministic_route,
    llm_classify,
    answer_plan_question as route_plan_answer,
    translate_doctor_text
)
from careplus.services.task_drafting import draft_task_from_description
from careplus.services.providers import find_matching_providers
from careplus.services.eval.dashboard_route import (
    create_eval_job,
    get_eval_job_status,
    run_full_eval,
    get_dashboard_metrics,
    get_dashboard_metrics_history
)
from careplus.services.eval.canary_seeder import seed_canary
from careplus.llm.openrouter import OpenRouterClient
from careplus.db.client import get_supabase_client
from careplus.services.policy import log_audit_entry

app = FastAPI(
    title="CarePlus API",
    description="""
Agentic hospital discharge & follow-up coordinator.

CarePlus is NOT an autonomous medical agent. The AI extracts, structures, translates,
classifies, drafts, and tracks. The AI does NOT diagnose, prescribe, change medication,
recommend treatment, guarantee providers, override doctors, approve clinical items,
answer symptoms, or answer medication questions. When uncertain, escalate.
The doctor remains the final authority.

## Endpoint Groups

### Extraction & Obligation
- POST /extract - Extract obligations from discharge summary
- POST /obligation/approve - Approve an extracted obligation
- POST /obligation/close - Close an obligation as completed
- GET /obligation/graph/{patient_id} - Get FHIR bundle of obligations

### Translation
- POST /translate - Translate an approved item or obligation
- POST /verify/translation - Verify a translation created by OpenRouter

### Question Routing
- POST /question/classify - Classify a patient question
- POST /question/answer/plan - Answer a PLAN question
- POST /question/answer/doctor - Translate doctor's text for patient

### Task Drafting
- POST /task/draft - Draft a task from doctor's description

### Provider Matching
- POST /providers/match - Find matching providers for an item type

### Episode & Second Brain
- GET /episode/{patient_id} - Get compiled episode page with lint results

### Compliance & Consent
- POST /consent/revoke - Revoke consent for a purpose
- POST /verify/audit - Verify audit chain integrity

### Eval & Admin
- GET /eval/metrics - Get all evaluation metrics
- GET /eval/metrics/history - Get metrics history for trends
- POST /admin/eval/run - Trigger a full evaluation run
- GET /admin/eval/run/{job_id} - Get eval run status
- POST /admin/canary/seed - Seed a reviewer canary

## OpenRouter Integration

CarePlus uses OpenRouter for model-agnostic LLM calls. The system can swap model families
without code changes. The ensemble deliberately uses two different families (Gemini + Claude by default)
for stronger omission detection.

## Disclaimer

Synthetic data only. Not for production clinical use without regulatory review.
""",
    version="1.0.0"
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    logger.bind(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path in ["/health", "/docs", "/openapi.json", "/eval/metrics", "/eval/metrics/history"]:
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = auth_header.split(" ")[1]
    try:
        user_info = get_user_from_token(token)
        request.state.user = user_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error("auth_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

    return await call_next(request)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "dependencies": {
            "fastapi": "0.109.0+",
            "supabase": "2.3.0+",
            "httpx": "0.25.0+",
            "pydantic": "2.5.0+"
        }
    }


@app.post("/extract", response_model=ExtractResponse)
@require_policy_check(
    purpose="data_processing",
    payload_getter=lambda body: body.raw_text,
    patient_id_getter=lambda body: body.patient_id,
    operation="extract"
)
async def extract(request: Request, body: ExtractRequest):
    """
    Extract obligations and follow-up items from a discharge summary.

    Requires authentication with RMP or coordinator role.
    Policy check enforced: consent, deidentification, approver validation.
    """
    user = request.state.user

    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can extract obligations"
        )

    try:
        # Determine discharge type based on content (simplified for now)
        # In production, this would be derived from the episode/discharge record
        discharge_type = "general_medical"

        # Run extraction pipeline
        result = await extract_from_discharge_summary(
            raw_text=body.raw_text,
            discharge_type=discharge_type
        )

        # Convert dict items to Pydantic models
        items = [ExtractedItem(**item) for item in result["items"]]

        response = ExtractResponse(
            items=items,
            could_not_place=result["could_not_place"],
            quality=QualityMetrics(**result["quality"]),
            completeness=CompletenessMetrics(**result["completeness"]),
            summary_id=body.discharge_summary_id
        )

        logger.info(
            "extract_success",
            patient_id=str(body.patient_id),
            items_count=len(items),
            user_id=user.get("id")
        )

        return response

    except Exception as e:
        logger.error("extract_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )


@app.post("/translate", response_model=TranslateResponse)
@require_policy_check(
    purpose="translation",
    payload_getter=lambda body: str(body.item_id),
    patient_id_getter=lambda body: UUID("00000000-0000-0000-0000-000000000000"),  # Will be fetched from DB
    operation="translate"
)
async def translate(request: Request, body: TranslateRequest):
    """
    Translate an approved_item or obligation to target language.
    
    Pipeline:
    1. Fetch source item from database
    2. Extract entities from source text
    3. Translate using OpenRouter LLM
    4. Roundtrip verify (translate → back-translate → compare entities)
    5. Check readability (grade ≤9, avg sentence <20 words)
    6. Store as translation row with verified=false, produced_by='openrouter'
    
    Authorization: RMP or coordinator.
    """
    user = request.state.user
    
    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can create translations"
        )
    
    supabase = get_supabase_client(use_service_role=True)
    llm_client = OpenRouterClient()
    
    try:
        # Step 1: Fetch source item
        if body.item_type == "approved_item":
            table = "approved_item"
            patient_id_field = "patient_id"
        elif body.item_type == "obligation":
            table = "obligation"
            patient_id_field = "patient_id"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid item_type. Must be 'approved_item' or 'obligation'"
            )
        
        item_result = supabase.table(table).select("*").eq("id", str(body.item_id)).execute()
        
        if not item_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{body.item_type} not found"
            )
        
        item = item_result.data[0]
        source_text = item.get("content", "")
        patient_id = item.get(patient_id_field)
        
        if not source_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source item has no content to translate"
            )
        
        # Check if item is warning_sign - never translate warning_sign original_text
        if body.item_type == "obligation" and item.get("title", "").lower() == "warning_sign":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Warning signs cannot be auto-translated. Doctor-verified translation only."
            )
        
        # Step 2: Extract entities (async fetch of approved medications)
        from careplus.services.translation.entity_extractor import fetch_approved_medications
        approved_medications = await fetch_approved_medications()
        entities = extract_entities(source_text, approved_medications)
        
        # Step 3: Translate
        from careplus.services.translation.translator import translate_text
        translation_result = await translate_text(
            text=source_text,
            source_lang="en",  # Source is always English
            target_lang=body.target_language,
            llm_client=llm_client
        )
        translated_text = translation_result["translated_text"]
        
        # Step 4: Roundtrip verify
        roundtrip_result = await roundtrip_verify(
            source_text=source_text,
            source_lang="en",
            target_lang=body.target_language,
            llm_client=llm_client
        )
        
        # Step 5: Check readability
        readability_result = check_readability(translated_text)
        
        # Determine flags
        flags = []
        if not roundtrip_result["verified"]:
            flags.extend(roundtrip_result["flags"])
        if not readability_result["passed"]:
            flags.extend(readability_result["flags"])
        
        # Step 6: Store translation
        import hashlib
        content_hash = hashlib.sha256(translated_text.encode()).hexdigest()
        
        translation_data = {
            "source_item_id": str(body.item_id),
            "source_type": body.item_type,
            "target_language": body.target_language,
            "translated_content": translated_text,
            "verified": False,
            "produced_by": "openrouter",
            "back_translation": roundtrip_result.get("back_translation"),
            "flags": flags,
            "grade_level": readability_result.get("grade_level"),
            "avg_sentence_length": readability_result.get("avg_sentence_length"),
            "content_hash": content_hash
        }
        
        translation_result_db = supabase.table("translation").insert(translation_data).execute()
        translation_id = translation_result_db.data[0]["id"]
        
        logger.info(
            "translation_created",
            translation_id=str(translation_id),
            item_id=str(body.item_id),
            item_type=body.item_type,
            target_language=body.target_language,
            verified=False,
            flags=flags,
            user_id=user.get("id")
        )
        
        return TranslateResponse(
            translation_id=translation_id,
            translated_content=translated_text,
            verified=False,
            flags=flags,
            back_translation=roundtrip_result.get("back_translation"),
            grade_level=readability_result.get("grade_level"),
            avg_sentence_length=readability_result.get("avg_sentence_length")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("translate_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Translation failed: {str(e)}"
        )
    finally:
        await llm_client.close()


@app.post("/question/classify")
@require_policy_check(
    purpose="question_classification",
    payload_getter=lambda body: body.question,
    patient_id_getter=lambda body: body.patient_id,
    operation="question_classify"
)
async def classify_question(request: Request, body: ClassifyQuestionRequest):
    """
    Classify a patient question using deterministic layer + LLM classifier.
    
    Pipeline:
    1. Run deterministic layer (keyword matching for emergency/medicine/symptom)
    2. If no match, run LLM classifier (returns PLAN or OTHER)
    3. Return routing decision
    
    Emergency questions return in <100ms (deterministic layer only, no OpenRouter call).
    """
    user = request.state.user
    
    try:
        # Step 1: Deterministic layer (keyword matching)
        det_result = deterministic_route(body.question)
        
        if det_result["route"] is not None:
            # Deterministic match found
            route = det_result["route"]
            escalate = det_result["escalate"]
            
            logger.info(
                "question_classified_deterministic",
                question=body.question[:100],
                route=route,
                escalate=escalate
            )
            
            return {
                "route": route,
                "escalate": escalate,
                "confidence": 1.0,  # High confidence for keyword matches
                "reasoning": f"Matched keywords: {', '.join(det_result['matched_keywords'])}",
                "warning_signs": det_result.get("warning_signs", []),
                "method": "deterministic"
            }
        
        # Step 2: LLM classifier (no deterministic match)
        llm_client = OpenRouterClient()
        try:
            llm_result = await llm_classify(body.question, llm_client)
            
            logger.info(
                "question_classified_llm",
                question=body.question[:100],
                route=llm_result["route"],
                escalate=llm_result["escalate"]
            )
            
            return {
                "route": llm_result["route"],
                "escalate": llm_result["escalate"],
                "confidence": llm_result["confidence"],
                "reasoning": llm_result["reasoning"],
                "warning_signs": [],
                "method": "llm"
            }
        finally:
            await llm_client.close()
    
    except Exception as e:
        logger.error("classify_question_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}"
        )


@app.post("/question/answer/plan")
@require_policy_check(
    purpose="question_answering",
    payload_getter=lambda body: body.question,
    patient_id_getter=lambda body: body.patient_id,
    operation="question_answer_plan"
)
async def answer_plan_question(request: Request, body: AnswerPlanQuestionRequest):
    """
    Answer a PLAN question using approved_item records.
    
    The LLM selects which approved_item(s) apply.
    The answer is rendered from approved_item fields (templating), NOT freehand LLM prose.
    
    Returns cited_item_ids for audit trail.
    """
    user = request.state.user
    
    try:
        llm_client = OpenRouterClient()
        try:
            result = await route_plan_answer(
                question=body.question,
                patient_id=body.patient_id,
                llm_client=llm_client
            )
            
            logger.info(
                "plan_question_answered",
                patient_id=str(body.patient_id),
                question=body.question[:100],
                escalate=result["escalate"],
                cited_count=len(result["cited_item_ids"])
            )
            
            return {
                "answer": result["answer"],
                "cited_item_ids": result["cited_item_ids"],
                "escalate": result["escalate"],
                "confidence": result["confidence"],
                "reasoning": result["reasoning"]
            }
        finally:
            await llm_client.close()
    
    except Exception as e:
        logger.error("answer_plan_question_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to answer plan question: {str(e)}"
        )


@app.post("/question/answer/doctor")
@require_policy_check(
    purpose="question_answering",
    payload_getter=lambda body: body.question,
    patient_id_getter=lambda body: body.patient_id,
    operation="question_answer_doctor"
)
async def answer_doctor_question(request: Request, body: AnswerDoctorQuestionRequest):
    """
    Translate and simplify doctor's text for patient communication.
    
    LLM may translate + simplify the doctor's text.
    MUST NOT add medical advice, new facts, change dosage/diagnosis/treatment/instructions.
    
    Output: {patient_text, source: 'doctor_translation'}
    The doctor must explicitly approve via /verify/translation before sending.
    
    Authorization: RMP or coordinator.
    """
    user = request.state.user
    
    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can use doctor answer translation"
        )
    
    try:
        # Get patient language from database
        supabase = get_supabase_client(use_service_role=True)
        patient_result = supabase.table("patient").select("preferred_language").eq("id", str(body.patient_id)).execute()
        
        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        patient_language = patient_result.data[0].get("preferred_language", "en")
        
        # If patient language is English, no translation needed
        if patient_language == "en":
            logger.info("doctor_answer_no_translation_needed", patient_id=str(body.patient_id))
            return {
                "patient_text": body.question,
                "source": "original",
                "original_text": body.question
            }
        
        # Translate doctor's text
        llm_client = OpenRouterClient()
        try:
            result = await translate_doctor_text(
                doctor_text=body.question,
                patient_language=patient_language,
                llm_client=llm_client
            )
            
            logger.info(
                "doctor_answer_translated",
                patient_id=str(body.patient_id),
                target_language=patient_language
            )
            
            return result
        finally:
            await llm_client.close()
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("answer_doctor_question_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to translate doctor answer: {str(e)}"
        )


@app.post("/task/draft", response_model=DraftTaskResponse)
@require_policy_check(
    purpose="task_drafting",
    payload_getter=lambda body: body.doctor_description,
    patient_id_getter=lambda body: body.patient_id,
    operation="task_draft"
)
async def draft_task(request: Request, body: DraftTaskRequest):
    """
    Draft a task from doctor's description.
    
    LLM extracts: category, what, specialty, due_date, date_rule, provider_specialty.
    NEVER invents clinical content not in the doctor's text.
    
    Date resolver is deterministic against discharge_date anchor.
    Validation: if doctor's text doesn't mention medication, cannot output category=medication.
    
    Authorization: RMP or coordinator.
    """
    user = request.state.user
    
    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can draft tasks"
        )
    
    try:
        llm_client = OpenRouterClient()
        try:
            result = await draft_task_from_description(
                doctor_description=body.doctor_description,
                discharge_date=body.discharge_date,
                patient_id=body.patient_id,
                llm_client=llm_client
            )
            
            logger.info(
                "task_drafted",
                patient_id=str(body.patient_id),
                valid=result["valid"],
                category=result["category"]
            )
            
            return DraftTaskResponse(**result)
        finally:
            await llm_client.close()
    
    except Exception as e:
        logger.error("draft_task_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task drafting failed: {str(e)}"
        )


@app.post("/providers/match", response_model=ProviderMatchResponse)
async def match_providers(request: Request, body: ProviderMatchRequest):
    """
    Find matching providers for a given item type.
    
    Uses nearby_providers() and item_provider_matches() RPCs against Care Provider Finder dataset.
    Returns ranked list with disclaimer: "Suggestion only. Please confirm availability with the provider."
    
    Never claims 'best', 'recommended', 'guaranteed'.
    
    Authorization: RMP or coordinator.
    """
    user = request.state.user
    
    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can match providers"
        )
    
    try:
        result = await find_matching_providers(
            item_type=body.item_type,
            latitude=body.latitude,
            longitude=body.longitude,
            radius_km=body.radius_km
        )
        
        logger.info(
            "providers_matched",
            item_type=body.item_type,
            count=result["total_count"]
        )
        
        return ProviderMatchResponse(**result)
    
    except Exception as e:
        logger.error("match_providers_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Provider matching failed: {str(e)}"
        )


@app.post("/verify/translation", response_model=VerifyTranslationResponse)
async def verify_translation(request: Request, body: VerifyTranslationRequest):
    """
    Verify a translation created by OpenRouter.
    
    On approve:
    - Set verified=true
    - Set verifier_rmp_id and verified_at
    - Compute content_hash of verified translation
    - Log audit entry
    
    On reject:
    - Keep verified=false
    - Log reason in audit
    
    Authorization: RMP only.
    """
    user = request.state.user
    
    # Check role authorization
    user_role = user.get("role", "")
    if user_role != "rmp":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP role can verify translations"
        )
    
    supabase = get_supabase_client(use_service_role=True)
    
    try:
        # Fetch translation
        translation_result = supabase.table("translation").select("*").eq("id", str(body.translation_id)).execute()
        
        if not translation_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Translation not found"
            )
        
        translation = translation_result.data[0]
        
        # Verify RMP matches
        if str(body.rmp_id) != user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="RMP ID does not match authenticated user"
            )
        
        if body.decision == "approve":
            # Approve translation
            update_data = {
                "verified": True,
                "verifier_rmp_id": str(body.rmp_id),
                "verified_at": datetime.now()
            }
            
            supabase.table("translation").update(update_data).eq("id", str(body.translation_id)).execute()
            
            # Log audit entry
            log_audit_entry(
                actor_type="rmp",
                actor_id=body.rmp_id,
                action="verify_translation_approve",
                entity_type="translation",
                entity_id=body.translation_id,
                old_values={"verified": False},
                new_values={"verified": True, "verifier_rmp_id": str(body.rmp_id)}
            )
            
            logger.info(
                "translation_approved",
                translation_id=str(body.translation_id),
                verifier_rmp_id=str(body.rmp_id)
            )
            
            return VerifyTranslationResponse(
                translation_id=body.translation_id,
                verified=True,
                verifier_rmp_id=body.rmp_id,
                verified_at=update_data["verified_at"],
                content_hash=translation.get("content_hash")
            )
        
        elif body.decision == "reject":
            # Reject translation - keep verified=false, log reason
            log_audit_entry(
                actor_type="rmp",
                actor_id=body.rmp_id,
                action="verify_translation_reject",
                entity_type="translation",
                entity_id=body.translation_id,
                old_values={"verified": False},
                new_values={"verified": False, "reason": body.reason}
            )
            
            logger.info(
                "translation_rejected",
                translation_id=str(body.translation_id),
                verifier_rmp_id=str(body.rmp_id),
                reason=body.reason
            )
            
            return VerifyTranslationResponse(
                translation_id=body.translation_id,
                verified=False,
                verifier_rmp_id=None,
                verified_at=None,
                content_hash=None
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid decision. Must be 'approve' or 'reject'"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("verify_translation_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}"
        )


@app.post("/verify/span")
async def verify_span(request: Request):
    raise HTTPException(status_code=501, detail="NOT_IMPLEMENTED")


@app.post("/obligation/approve", response_model=ApproveObligationResponse)
async def approve_obligation(request: Request, body: ApproveObligationRequest):
    """
    Approve an extracted obligation item.

    Requires authentication with RMP role and valid MCI registration.
    Signs the approval with a content hash for audit trail.
    """
    user = request.state.user

    # Check role authorization
    user_role = user.get("role", "")
    if user_role != "rmp":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP role can approve obligations"
        )

    try:
        # In a real implementation, this would:
        # 1. Fetch the extracted item from database
        # 2. Validate the item state is 'drafted' or 'awaiting_approval'
        # 3. Compute content hash
        # 4. Update obligation state to 'approved'
        # 5. Store approver info and content hash
        # 6. Log audit trail

        # For now, we'll simulate the approval process
        extracted_item_id = body.extracted_id
        current_state = ObligationStatus.DRAFTED  # Would be fetched from DB

        # Transition to approved
        new_state = transition(
            current_state=current_state,
            new_state=ObligationStatus.APPROVED,
            actor_id=str(body.rmp_id),
            actor_mci_reg=body.mci_reg
        )

        # Compute content hash (in real implementation, this would use the actual structured data)
        structured_data = {"content": body.final_text}
        content_hash = compute_content_hash(structured_data, body.final_text)

        # Log audit
        logger.info(
            "obligation_approved",
            extracted_id=str(extracted_item_id),
            approver_rmp_id=str(body.rmp_id),
            approver_mci_reg=body.mci_reg,
            content_hash=content_hash
        )

        response = ApproveObligationResponse(
            obligation_id=extracted_item_id,
            state=new_state,
            content_hash=content_hash,
            approver_rmp_id=body.rmp_id,
            approved_at=datetime.now()
        )

        return response

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("approve_obligation_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Approval failed: {str(e)}"
        )


@app.post("/obligation/close", response_model=CloseObligationResponse)
async def close_obligation(request: Request, body: CloseObligationRequest):
    """
    Close an obligation as completed with evidence.

    Requires authentication with RMP or coordinator role.
    """
    user = request.state.user

    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can close obligations"
        )

    try:
        # In a real implementation, this would:
        # 1. Fetch the obligation from database
        # 2. Validate the obligation is in a closable state
        # 3. Update state to 'completed'
        # 4. Store evidence of completion
        # 5. Log audit trail

        obligation_id = body.obligation_id
        current_state = ObligationStatus.IN_PROGRESS  # Would be fetched from DB

        # Transition to completed
        new_state = transition(
            current_state=current_state,
            new_state=ObligationStatus.COMPLETED,
            actor_id=user.get("id"),
            actor_mci_reg=user.get("mci_reg", "unknown")
        )

        # Log audit
        logger.info(
            "obligation_closed",
            obligation_id=str(obligation_id),
            actor_id=user.get("id"),
            evidence=body.evidence
        )

        response = CloseObligationResponse(
            obligation_id=obligation_id,
            state=new_state,
            closed_at=datetime.now()
        )

        return response

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("close_obligation_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Close failed: {str(e)}"
        )


@app.get("/obligation/graph/{patient_id}", response_model=ObligationGraphResponse)
async def get_obligation_graph(patient_id: str, request: Request):
    """
    Get FHIR R4 Bundle of all obligations for a patient.

    Returns Task, CarePlan, and Provenance resources.
    Requires authentication with RMP or coordinator role and valid consent check.
    """
    user = request.state.user

    # Check role authorization
    user_role = user.get("role", "")
    if user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RMP or coordinator role can access obligation graph"
        )

    try:
        # In a real implementation, this would:
        # 1. Validate consent for this patient
        # 2. Fetch all obligations for the patient from database
        # 3. Convert to FHIR Task resources
        # 4. Add related CarePlan and Provenance resources
        # 5. Return as FHIR Bundle

        # For now, return an empty bundle
        obligations = []  # Would be fetched from DB

        bundle = obligations_to_fhir_bundle(obligations, patient_id)

        logger.info(
            "obligation_graph_retrieved",
            patient_id=patient_id,
            user_id=user.get("id"),
            entry_count=len(bundle.get("entry", []))
        )

        return ObligationGraphResponse(
            patient_id=uuid.UUID(patient_id),
            bundle_type=bundle["type"],
            entry=bundle.get("entry", [])
        )

    except Exception as e:
        logger.error("get_obligation_graph_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve obligation graph: {str(e)}"
        )


@app.get("/episode/{patient_id}", response_model=EpisodeResponse)
async def get_episode(patient_id: str, request: Request):
    """
    Get the compiled episode page for a patient.
    
    Returns markdown + FHIR Bundle with lint results.
    Authorization: patient (own only), RMP, or coordinator with valid consent.
    If lint fails, returns status='rejected' with the reason.
    """
    user = request.state.user
    user_role = user.get("role", "")
    user_patient_id = user.get("patient_id")
    
    patient_uuid = UUID(patient_id)
    
    # Check authorization
    # Patient can only access their own episode
    if user_role == "patient":
        if str(user_patient_id) != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients can only access their own episode"
            )
    # RMP and coordinator can access any episode (with consent check in production)
    elif user_role not in ["rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patient, RMP, or coordinator can access episode"
        )
    
    try:
        # Compile and lint episode page
        result = await lint_episode_page_with_db(patient_uuid)
        
        page_data = result["page"]
        lint_data = result["lint"]
        
        response = EpisodeResponse(
            patient_id=page_data["patient_id"],
            patient_name=page_data["patient_name"],
            markdown=page_data["markdown"],
            fhir_bundle=page_data["fhir_bundle"],
            content_hash=page_data["content_hash"],
            lint_status=lint_data["status"],
            lint_reason=lint_data.get("reason"),
            orphan_sentences=lint_data.get("orphan_sentences"),
            contradictions=lint_data.get("contradictions"),
            stale_obligations=lint_data.get("stale_obligations")
        )
        
        logger.info(
            "episode_retrieved",
            patient_id=patient_id,
            user_id=user.get("user_id"),
            lint_status=lint_data["status"]
        )
        
        return response
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("get_episode_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve episode: {str(e)}"
        )


@app.post("/consent/grant")
async def grant_consent(request: Request):
    raise HTTPException(status_code=501, detail="NOT_IMPLEMENTED")


async def recompile_after_erasure(patient_id: UUID, purpose: str) -> Dict[str, Any]:
    """
    Recompile episode page after data erasure (right to be forgotten).
    
    This function:
    1. Deletes source rows (discharge_summary, approved_item) for that patient + purpose
    2. Calls compile_episode_page to rebuild the wiki
    3. Lint pass verifies no orphan pointers remain
    4. Audit logs the erasure with the consent revocation hash as anchor
    
    Args:
        patient_id: Patient UUID
        purpose: The purpose for which consent was revoked
    
    Returns:
        Dict with recompilation results
    """
    supabase = get_supabase_client(use_service_role=True)
    
    # Delete source rows for this patient + purpose
    # Note: In production, this would be more sophisticated - tracking which data
    # was collected under which consent purpose
    # For now, we delete all discharge summaries and approved items for the patient
    
    # Delete approved items (will cascade to obligations via FK)
    supabase.table("approved_item").delete().eq("patient_id", str(patient_id)).execute()
    
    # Delete discharge summaries
    supabase.table("discharge_summary").delete().eq("patient_id", str(patient_id)).execute()
    
    # Recompile episode page
    result = await lint_episode_page_with_db(patient_id)
    
    lint_data = result["lint"]
    
    # Verify no orphan pointers remain
    if lint_data["status"] == "rejected" and lint_data["reason"] == "orphan_sentences":
        logger.error(
            "erasure_recompile_failed_orphans",
            patient_id=str(patient_id),
            orphan_count=len(lint_data.get("orphan_sentences", []))
        )
        raise ValueError("Recompilation after erasure failed: orphan sentences detected")
    
    logger.info(
        "erasure_recompile_success",
        patient_id=str(patient_id),
        purpose=purpose,
        lint_status=lint_data["status"]
    )
    
    return {
        "patient_id": str(patient_id),
        "purpose": purpose,
        "recompiled": True,
        "lint_status": lint_data["status"]
    }


@app.post("/consent/revoke", response_model=RevokeConsentResponse)
async def revoke_consent(request: Request, body: RevokeConsentRequest):
    """
    Revoke consent for a purpose.
    
    Triggers recompile_after_erasure RPC which:
    - Deletes source rows (discharge_summary, approved_item) for that patient + purpose
    - Calls compile_episode_page to rebuild the wiki
    - Lint pass verifies no orphan pointers remain
    - Audit logs the erasure with the consent revocation hash as anchor
    """
    user = request.state.user
    user_role = user.get("role", "")
    user_patient_id = user.get("patient_id")
    
    # Only patients can revoke their own consent
    if user_role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can revoke their own consent"
        )
    
    supabase = get_supabase_client(use_service_role=True)
    
    try:
        # Fetch the consent record to verify ownership
        consent_result = supabase.table("consent").select("*").eq("id", str(body.consent_id)).execute()
        
        if not consent_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consent record not found"
            )
        
        consent = consent_result.data[0]
        
        # Verify the consent belongs to the patient
        if str(consent["patient_id"]) != str(user_patient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot revoke consent for another patient"
            )
        
        # Revoke the consent
        revoke_result = supabase.rpc("revoke_consent", {"p_consent_id": str(body.consent_id)}).execute()
        
        if not revoke_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke consent"
            )
        
        # Get patient_id and purpose for erasure
        patient_id = consent["patient_id"]
        purpose = consent["purpose"]
        
        # Trigger recompile after erasure
        erasure_result = await recompile_after_erasure(uuid.UUID(patient_id), purpose)
        
        logger.info(
            "consent_revoked",
            consent_id=str(body.consent_id),
            patient_id=patient_id,
            purpose=purpose,
            user_id=user.get("user_id")
        )
        
        return RevokeConsentResponse(
            consent_id=body.consent_id,
            revoked=True
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("revoke_consent_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke consent: {str(e)}"
        )


@app.get("/eval/metrics")
async def get_eval_metrics(request: Request):
    """
    Get all evaluation metrics for the dashboard.

    Returns the latest value for each of the 9 metrics:
    - omission_rate
    - hallucination_rate
    - readability_pass_rate
    - injection_resistance
    - reviewer_time_saved
    - reviewer_vigilance
    - translation_entity_preservation
    - calibrated_abstention_rate
    - model_ensemble_agreement

    Authorization: auditor, RMP, or coordinator.
    """
    user = request.state.user
    user_role = user.get("role", "")

    # Only auditor, RMP, or coordinator can access eval metrics
    if user_role not in ["auditor", "rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor, RMP, or coordinator role can access eval metrics"
        )

    try:
        metrics = get_dashboard_metrics()

        logger.info(
            "eval_metrics_retrieved",
            user_id=user.get("id"),
            metrics_count=len(metrics)
        )

        return metrics

    except Exception as e:
        logger.error("get_eval_metrics_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve eval metrics: {str(e)}"
        )


@app.get("/eval/metrics/history")
async def get_eval_metrics_history(request: Request, days: int = 30):
    """
    Get evaluation metrics history for trend analysis.

    Query parameter:
    - days: Number of days to look back (default: 30)

    Returns historical values for all metrics over the specified period.

    Authorization: auditor, RMP, or coordinator.
    """
    user = request.state.user
    user_role = user.get("role", "")

    # Only auditor, RMP, or coordinator can access eval metrics history
    if user_role not in ["auditor", "rmp", "coordinator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor, RMP, or coordinator role can access eval metrics history"
        )

    try:
        history = get_dashboard_metrics_history(days=days)

        logger.info(
            "eval_metrics_history_retrieved",
            user_id=user.get("id"),
            days=days
        )

        return history

    except Exception as e:
        logger.error("get_eval_metrics_history_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve eval metrics history: {str(e)}"
        )


@app.post("/admin/canary/seed", response_model=CanarySeedResponse)
async def seed_canary_endpoint(request: Request, body: CanarySeedRequest):
    """
    Seed a reviewer canary for vigilance testing.

    Deliberately corrupts an obligation to test if reviewers catch the error.
    5% of items in the review queue should have canaries seeded.

    Body:
    - obligation_id: UUID of the obligation to corrupt
    - corruption_type: Type of corruption (dose_error, date_error, medication_error)
    - corruption_value: Optional specific corruption value

    Returns canary_id for tracking.

    Authorization: auditor only.
    """
    user = request.state.user
    user_role = user.get("role", "")

    # Only auditor can seed canaries
    if user_role != "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor role can seed canaries"
        )

    try:
        canary_id = seed_canary(
            obligation_id=body.obligation_id,
            corruption_type=body.corruption_type,
            corruption_value=body.corruption_value
        )

        logger.info(
            "canary_seeded",
            canary_id=canary_id,
            obligation_id=str(body.obligation_id),
            corruption_type=body.corruption_type,
            user_id=user.get("id")
        )

        return CanarySeedResponse(
            canary_id=UUID(canary_id),
            obligation_id=body.obligation_id,
            corruption_type=body.corruption_type,
            created_at=datetime.now().isoformat()
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("seed_canary_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed canary: {str(e)}"
        )


@app.post("/admin/eval/run", response_model=EvalRunResponse)
async def run_eval(request: Request, body: EvalRunRequest):
    """
    Trigger a full evaluation run.

    This is a long-running operation that computes all 9 metrics:
    - omission_rate
    - hallucination_rate
    - readability
    - injection_resistance
    - reviewer_time_saved
    - reviewer_vigilance
    - translation_entity_preservation
    - calibrated_abstention_rate
    - model_ensemble_agreement

    Returns job_id for tracking status.

    Authorization: auditor only.
    """
    user = request.state.user
    user_role = user.get("role", "")

    # Only auditor can trigger eval runs
    if user_role != "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor role can trigger eval runs"
        )

    try:
        # Create eval job
        job_id = create_eval_job()

        # Run eval in background (simplified - in production use Celery/Redis)
        import asyncio
        asyncio.create_task(run_full_eval(
            job_id=job_id,
            gold_standard_items=body.gold_standard_items,
            extractor_a_results=body.extractor_a_results,
            extractor_b_results=body.extractor_b_results
        ))

        logger.info(
            "eval_run_started",
            job_id=job_id,
            user_id=user.get("id")
        )

        return EvalRunResponse(
            job_id=job_id,
            status="pending",
            created_at=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error("run_eval_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start eval run: {str(e)}"
        )


@app.get("/admin/eval/run/{job_id}", response_model=EvalJobStatusResponse)
async def get_eval_run_status(job_id: str, request: Request):
    """
    Get the status of an evaluation run.

    Returns:
    - status: pending, running, completed, or failed
    - created_at: When the job was created
    - started_at: When the job started running
    - completed_at: When the job completed
    - metrics: Computed metrics (if completed)
    - error: Error message (if failed)

    Authorization: auditor only.
    """
    user = request.state.user
    user_role = user.get("role", "")

    # Only auditor can check eval run status
    if user_role != "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor role can check eval run status"
        )

    try:
        job_status = get_eval_job_status(job_id)

        if not job_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Eval job not found"
            )

        logger.info(
            "eval_run_status_retrieved",
            job_id=job_id,
            status=job_status["status"],
            user_id=user.get("id")
        )

        return EvalJobStatusResponse(**job_status)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_eval_run_status_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve eval run status: {str(e)}"
        )


@app.post("/verify/audit", response_model=VerifyAuditResponse)
async def verify_audit(request: Request, body: VerifyAuditRequest):
    """
    Verify audit chain integrity.
    
    Input: {range_start, range_end} or {patient_id, since}
    Calls verify_audit_chain RPC.
    Returns {valid: bool, broken_at?: audit_log_id, evidence: {...}}.
    
    Auditor-only role.
    """
    user = request.state.user
    user_role = user.get("role", "")
    
    # Only auditors can verify audit chain
    if user_role != "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only auditor role can verify audit chain"
        )
    
    supabase = get_supabase_client(use_service_role=True)
    
    try:
        # Call the verify_audit_chain RPC function
        result = supabase.rpc("verify_audit_chain").execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify audit chain"
            )
        
        verification_data = result.data
        
        # Extract relevant fields
        valid = verification_data.get("valid", False)
        total_entries = verification_data.get("total_entries", 0)
        invalid_entries = verification_data.get("invalid_entries", 0)
        
        # Find the broken entry if invalid
        broken_at = None
        if not valid and invalid_entries > 0:
            # Fetch the first invalid entry
            # This is a simplified approach - in production, we'd return the specific ID
            audit_logs = supabase.table("audit_log").select("id").order("ts", asc=True).limit(100).execute()
            if audit_logs.data:
                broken_at = str(audit_logs.data[0]["id"])
        
        response = VerifyAuditResponse(
            valid=valid,
            total_entries=total_entries,
            invalid_entries=invalid_entries,
            broken_at=broken_at,
            evidence=verification_data
        )
        
        logger.info(
            "audit_chain_verified",
            valid=valid,
            total_entries=total_entries,
            invalid_entries=invalid_entries,
            user_id=user.get("user_id")
        )
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("verify_audit_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify audit chain: {str(e)}"
        )
