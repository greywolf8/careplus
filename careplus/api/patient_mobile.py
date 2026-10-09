from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from careplus.db.client import get_supabase_client
from careplus.llm.openrouter import OpenRouterClient
from careplus.schemas.patient_mobile import (
    AccessRequestCreate,
    AccessRequestDecision,
    AccessRequestResponse,
    AdherenceLogRequest,
    AdherenceLogResponse,
    CareProviderResponse,
    CaregiverMarkDoneSetting,
    CoordinationCardCreate,
    CoordinationCardResponse,
    CoordinationCardUpdate,
    FollowupItemResponse,
    GenericSuccessResponse,
    ItemTranslationResponse,
    MarkItemDoneRequest,
    MedicationResponse,
    PatientContextResponse,
    PatientMessageCreateRequest,
    PatientMessageResponse,
    PatientQuestionSubmitRequest,
    PatientQuestionSubmitResponse,
    ReleaseTestResultRequest,
    ReminderResponse,
    SyncPlanResponse,
    TabPermissionsResponse,
    TestResultResponse,
    UpdateLanguageRequest,
    UserProfileResponse,
    WarningSignResponse,
)
from careplus.services.patient import (
    PatientAccessService,
    PatientItemsService,
    PatientMessagesService,
    PatientPlanSyncService,
)
from careplus.services.routing import answer_plan_question as route_plan_answer

router = APIRouter(prefix="/patient", tags=["Patient Mobile"])


def _supabase():
    return get_supabase_client(use_service_role=True)


def _access() -> PatientAccessService:
    return PatientAccessService(_supabase())


def _items() -> PatientItemsService:
    return PatientItemsService(_supabase())


def _messages() -> PatientMessagesService:
    return PatientMessagesService(_supabase())


def _sync() -> PatientPlanSyncService:
    return PatientPlanSyncService(_supabase())


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(request: Request):
    user = request.state.user
    access = _access()
    ctx = access.resolve_context_from_token(user)
    app_user = access.get_app_user(ctx["user_id"])
    if app_user:
        return UserProfileResponse(
            id=UUID(app_user["id"]),
            name=app_user["name"],
            role=app_user["role"],
            preferred_language=app_user.get("preferred_language", "en"),
            email=app_user["email"],
        )
    patient = (
        _supabase()
        .table("patient")
        .select("id, name, email, preferred_language")
        .eq("id", str(ctx["patient_id"]))
        .limit(1)
        .execute()
    )
    if not patient.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    p = patient.data[0]
    return UserProfileResponse(
        id=ctx["user_id"],
        name=p["name"],
        role="patient",
        preferred_language=p.get("preferred_language", "en"),
        email=p.get("email") or "patient@careplus.local",
    )


@router.get("/me/context", response_model=PatientContextResponse)
async def get_my_context(request: Request):
    ctx = _access().resolve_context_from_token(request.state.user)
    return PatientContextResponse(**ctx)


@router.get("/me/tab-permissions", response_model=TabPermissionsResponse)
async def get_my_tab_permissions(request: Request):
    access = _access()
    ctx = access.resolve_context_from_token(request.state.user)
    perms = access.get_tab_permissions(ctx["user_id"])
    return TabPermissionsResponse(**perms)


@router.patch("/me/language", response_model=GenericSuccessResponse)
async def update_my_language(request: Request, body: UpdateLanguageRequest):
    access = _access()
    ctx = access.resolve_context_from_token(request.state.user)
    access.update_language(ctx["user_id"], body.preferred_language.value)
    return GenericSuccessResponse(message="Language updated")


@router.patch("/me/caregiver-mark-done", response_model=GenericSuccessResponse)
async def update_caregiver_mark_done(request: Request, body: CaregiverMarkDoneSetting):
    access = _access()
    ctx = access.resolve_context_from_token(request.state.user)
    if ctx["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can change caregiver mark-done setting")
    access.set_caregiver_mark_done(ctx["user_id"], body.allowed)
    return GenericSuccessResponse(message="Caregiver mark-done setting updated")


@router.get("/{patient_id}/items", response_model=List[FollowupItemResponse])
async def list_items(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    rows = _items().list_followup_items(patient_id)
    return [FollowupItemResponse(**row) for row in rows]


@router.get("/{patient_id}/items/{item_id}", response_model=FollowupItemResponse)
async def get_item(patient_id: UUID, item_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return FollowupItemResponse(**_items().get_followup_item(patient_id, item_id))


@router.get("/{patient_id}/items/{item_id}/translation/{language}", response_model=ItemTranslationResponse)
async def get_item_translation(patient_id: UUID, item_id: UUID, language: str, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    _items().get_followup_item(patient_id, item_id)
    tr = _items().get_item_translation(item_id, language)
    if not tr:
        raise HTTPException(status_code=404, detail="Verified translation not available")
    return ItemTranslationResponse(**tr)


@router.post("/{patient_id}/items/{item_id}/mark-done", response_model=FollowupItemResponse)
async def mark_item_done(
    patient_id: UUID, item_id: UUID, request: Request, body: MarkItemDoneRequest
):
    ctx = _access().assert_can_access_patient(request.state.user, patient_id)
    actor = f"{ctx['patient_name']} ({'Caregiver' if ctx['role'] == 'caregiver' else 'Patient'})"
    row = _items().mark_item_done(
        patient_id,
        item_id,
        completed_by=actor,
        can_mark_done=ctx.get("can_mark_done", True),
        toggle=body.toggle,
    )
    return FollowupItemResponse(**row)


@router.get("/{patient_id}/medications", response_model=List[MedicationResponse])
async def list_medications(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [MedicationResponse(**m) for m in _items().list_medications(patient_id)]


@router.get("/{patient_id}/adherence", response_model=List[AdherenceLogResponse])
async def list_adherence(patient_id: UUID, request: Request, log_date: Optional[date] = None):
    _access().assert_can_access_patient(request.state.user, patient_id)
    d = log_date or date.today()
    return [AdherenceLogResponse(**r) for r in _items().list_adherence(patient_id, d)]


@router.post("/adherence", response_model=AdherenceLogResponse)
async def log_adherence(request: Request, body: AdherenceLogRequest):
    ctx = _access().assert_can_access_patient(request.state.user, body.patient_id)
    log_date = body.log_date or date.today()
    logged_by = body.logged_by_name or (
        f"{ctx['patient_name']} ({'Caregiver' if ctx['role'] == 'caregiver' else 'Patient'})"
    )
    row = _items().record_adherence(
        body.patient_id, body.medication_id, log_date, body.status.lower(), logged_by
    )
    return AdherenceLogResponse(**row)


@router.get("/{patient_id}/warning-signs", response_model=List[WarningSignResponse])
async def list_warning_signs(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [WarningSignResponse(**w) for w in _items().list_warning_signs(patient_id)]


@router.get("/{patient_id}/test-results", response_model=List[TestResultResponse])
async def list_test_results(patient_id: UUID, request: Request, include_unreleased: bool = False):
    user = request.state.user
    ctx = _access().assert_can_access_patient(user, patient_id)
    unreleased = include_unreleased and user.get("role") in ("rmp", "coordinator")
    rows = _items().list_test_results(patient_id, include_unreleased=unreleased)
    return [TestResultResponse(**r) for r in rows]


@router.get("/providers/nearby", response_model=List[CareProviderResponse])
async def nearby_providers(category: Optional[str] = None, q: Optional[str] = None):
    rows = _items().list_providers(category=category, query=q)
    return [CareProviderResponse(**r) for r in rows]


@router.get("/{patient_id}/messages", response_model=List[PatientMessageResponse])
async def list_messages(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [PatientMessageResponse(**m) for m in _messages().list_messages(patient_id)]


@router.post("/{patient_id}/messages", response_model=PatientMessageResponse)
async def create_message(patient_id: UUID, request: Request, body: PatientMessageCreateRequest):
    ctx = _access().assert_can_access_patient(request.state.user, patient_id)
    sender = body.sender_name or ctx["patient_name"]
    row = _messages().add_patient_message(patient_id, body.text, sender)
    return PatientMessageResponse(**row)


@router.post("/question", response_model=PatientQuestionSubmitResponse)
async def submit_question(request: Request, body: PatientQuestionSubmitRequest):
    ctx = _access().assert_can_access_patient(request.state.user, body.patient_id)
    sender = body.sender_name or ctx["patient_name"]

    async def plan_handler(question: str, patient_id: UUID):
        client = OpenRouterClient()
        try:
            return await route_plan_answer(question=question, patient_id=patient_id, llm_client=client)
        finally:
            await client.close()

    response, _ = await _messages().submit_question(
        body.patient_id,
        body.question,
        sender_name=sender,
        language=body.language.value,
        plan_answer_handler=plan_handler,
    )
    return PatientQuestionSubmitResponse(**response)


@router.get("/reminders/{patient_id}", response_model=List[ReminderResponse])
async def list_reminders(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [ReminderResponse(**r) for r in _items().list_reminders(patient_id)]


@router.get("/{patient_id}/access-requests", response_model=List[AccessRequestResponse])
async def list_access_requests(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [AccessRequestResponse(**r) for r in _items().list_access_requests(patient_id)]


@router.post("/access-request", response_model=AccessRequestResponse)
async def create_access_request(request: Request, body: AccessRequestCreate):
    _access().assert_can_access_patient(request.state.user, body.patient_id)
    row = _items().create_access_request(
        {
            "patient_id": str(body.patient_id),
            "caregiver_name": body.caregiver_name,
            "caregiver_email": body.caregiver_email,
            "relationship": body.relationship,
            "status": "pending",
        }
    )
    return AccessRequestResponse(**row)


@router.post("/{patient_id}/access-requests/{request_id}/decide", response_model=GenericSuccessResponse)
async def decide_access_request(
    patient_id: UUID, request_id: UUID, request: Request, body: AccessRequestDecision
):
    ctx = _access().assert_can_access_patient(request.state.user, patient_id)
    if ctx["role"] != "patient" and request.state.user.get("role") not in ("rmp", "coordinator"):
        raise HTTPException(status_code=403, detail="Not authorized to decide access requests")
    allowed = body.decision.lower() == "approved"
    _items().decide_access_request(request_id, allowed)
    return GenericSuccessResponse(message=f"Access request {body.decision}")


@router.get("/{patient_id}/coordination-cards", response_model=List[CoordinationCardResponse])
async def list_coordination_cards(patient_id: UUID, request: Request):
    _access().assert_can_access_patient(request.state.user, patient_id)
    return [CoordinationCardResponse(**c) for c in _items().list_coordination_cards(patient_id)]


@router.post("/{patient_id}/coordination-cards", response_model=CoordinationCardResponse)
async def create_coordination_card(
    patient_id: UUID, request: Request, body: CoordinationCardCreate
):
    ctx = _access().assert_can_access_patient(request.state.user, patient_id)
    raised_by_name = body.raised_by_name or ctx["patient_name"]
    row = _items().create_coordination_card(
        {
            "patient_id": str(patient_id),
            "card_type": body.type,
            "raised_by": ctx["role"],
            "raised_by_name": raised_by_name,
            "description": body.description,
            "status": "needs-review",
        }
    )
    return CoordinationCardResponse(**row)


@router.patch("/coordination-cards/{card_id}", response_model=CoordinationCardResponse)
async def update_coordination_card(card_id: UUID, request: Request, body: CoordinationCardUpdate):
    role = request.state.user.get("role")
    if role not in ("rmp", "coordinator"):
        raise HTTPException(status_code=403, detail="Only care team can update coordination cards")
    row = _items().update_coordination_card(card_id, body.status, body.care_team_notes)
    return CoordinationCardResponse(**row)


@router.post("/{patient_id}/sync-plan", response_model=SyncPlanResponse)
async def sync_patient_plan(patient_id: UUID, request: Request):
    role = request.state.user.get("role")
    if role not in ("rmp", "coordinator"):
        raise HTTPException(status_code=403, detail="Only care team can sync patient plan")
    counts = _sync().sync_patient_plan(patient_id)
    _sync().copy_verified_translations_for_patient(patient_id)
    return SyncPlanResponse(patient_id=patient_id, **counts)


@router.post("/{patient_id}/test-results/{test_id}/release", response_model=TestResultResponse)
async def release_test_result(
    patient_id: UUID, test_id: UUID, request: Request, body: ReleaseTestResultRequest
):
    role = request.state.user.get("role")
    if role not in ("rmp", "coordinator"):
        raise HTTPException(status_code=403, detail="Only care team can release test results")
    row = _items().release_test_result(patient_id, test_id, body.result_content, body.released_by)
    return TestResultResponse(**row)


@router.get("/approved-items/{patient_id}", response_model=dict)
async def legacy_approved_items(patient_id: UUID, request: Request):
    """Backward-compatible alias; prefer /{patient_id}/items."""
    _access().assert_can_access_patient(request.state.user, patient_id)
    rows = _items().list_followup_items(patient_id)
    return {"items": rows}
