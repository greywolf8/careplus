import hashlib
import json
from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from careplus.core.logging import logger
from careplus.db.client import get_supabase_client
from careplus.llm.openrouter import OpenRouterClient
from careplus.services.extraction.service import extract_from_discharge_summary
from careplus.services.policy import log_audit_entry
from careplus.schemas.extraction import (
    ExtractRequest,
    ExtractResponse,
    ExtractedItem,
    SourceSpan,
    ItemCategory,
)

router = APIRouter(prefix="/web", tags=["Web Doctor Portal"])

_CARE_TEAM = {"doctor", "coordinator", "rmp", "auditor", "admin"}
_ALLOWED_ITEM_TYPES = {c.value for c in ItemCategory}


def to_extracted_item(raw: Dict[str, Any]) -> ExtractedItem:
    """
    Normalize a pipeline item dict (keyed by `category`, source_span without
    quote) into an ExtractedItem. Tolerates missing/unknown categories.
    """
    itype = raw.get("item_type") or raw.get("category") or "care_instruction"
    if itype not in _ALLOWED_ITEM_TYPES:
        itype = "care_instruction"
    ss = raw.get("source_span")
    span = None
    if isinstance(ss, dict):
        span = SourceSpan(
            quote=raw.get("quote", ""),
            start=int(ss.get("start", 0) or 0),
            end=int(ss.get("end", 0) or 0),
        )
    return ExtractedItem(
        item_type=itype,
        content=raw.get("content") or raw.get("text") or raw.get("quote") or "",
        quote=raw.get("quote", ""),
        due_date=raw.get("due_date"),
        priority=raw.get("priority", "low") or "low",
        source_span=span,
        state=raw.get("state", "drafted"),
        metadata=raw.get("metadata") or {},
    )


def _require_care_team(request: Request) -> Dict[str, Any]:
    user = request.state.user
    role = user.get("role")
    if role not in _CARE_TEAM:
        logger.warning(
            "web_action_forbidden",
            role=role,
            user_id=str(user.get("user_id")),
            email=user.get("email"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only care-team roles can run this action",
        )
    return user


def _ensure_consent(supabase, patient_id: UUID) -> None:
    """Guarantee a valid 'data_processing' consent exists for the patient."""
    now_iso = date.today().isoformat()
    existing = (
        supabase.table("consent")
        .select("id, granted_at, expires_at, revoked_at")
        .eq("patient_id", str(patient_id))
        .eq("purpose", "data_processing")
        .execute()
    )
    for c in existing.data or []:
        if c.get("revoked_at") is None and (not c.get("expires_at") or c["expires_at"] > now_iso):
            return  # valid consent present
    supabase.table("consent").insert(
        {"patient_id": str(patient_id), "purpose": "data_processing"}
    ).execute()


def _ensure_rmp(supabase, user: Dict[str, Any]) -> str:
    """Return an rmp.id for the acting doctor, provisioning one if needed."""
    email = (user.get("email") or f"{user.get('user_id')}@careplus.local").lower()
    name = user.get("full_name") or "Doctor"
    found = supabase.table("rmp").select("id").eq("email", email).limit(1).execute()
    if found.data:
        return found.data[0]["id"]
    mci = f"IN-WEB-{str(user.get('user_id'))[:8].upper()}"
    created = (
        supabase.table("rmp")
        .insert({"name": name, "email": email, "mci_reg_number": mci})
        .select("id")
        .execute()
    )
    return created.data[0]["id"]


_ITEM_CATEGORY = {
    "appointment": "appointment",
    "test": "test",
    "medication": "care",
    "warning_sign": "general",
}


def _sync_approved_to_mobile(
    supabase,
    approved_id: str,
    patient_id: str,
    item_type: str,
    content: str,
    title: Optional[str],
    due_date: Optional[str],
    med_details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Mirror an approved_item into the patient-mobile tables. Replicates the
    mapping of the 0003 sync_followup_from_approved_item RPC but avoids its
    broken ON CONFLICT against the partial unique index (select-then-insert).
    """
    existing = (
        supabase.table("followup_item")
        .select("id")
        .eq("approved_item_id", approved_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    category = _ITEM_CATEGORY.get(item_type, "care")
    supabase.table("followup_item").insert(
        {
            "patient_id": patient_id,
            "approved_item_id": approved_id,
            "title": title or content[:120],
            "category": category,
            "due_date": due_date,
            "effective_status": "pending",
            "original_text": content,
            "source": "discharge_summary",
        }
    ).execute()

    if item_type == "medication":
        md = med_details or {}
        drug_name = md.get("name") or title or "Medication"
        supabase.table("patient_medication").insert(
            {
                "patient_id": patient_id,
                "approved_item_id": approved_id,
                "drug_name": drug_name,
                "dose": md.get("dose") or None,
                "how_often": md.get("frequency") or None,
                "for_how_long": md.get("duration") or None,
                "original_instruction": content,
            }
        ).execute()
    elif item_type == "warning_sign":
        supabase.table("warning_sign").insert(
            {
                "patient_id": patient_id,
                "approved_item_id": approved_id,
                "original_text": content,
                "severity": "critical",
            }
        ).execute()


@router.post("/extract", response_model=ExtractResponse)
async def web_extract(request: Request, body: ExtractRequest):
    """
    Extract obligations/items from a discharge summary for the doctor portal.

    Service-role endpoint: validates the browser's Supabase token, ensures a
    data-processing consent row, then runs the exact same extraction pipeline
    as POST /extract (de-identify -> ensemble -> merge -> span -> lint).
    """
    user = _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    actor_id = user.get("user_id")

    patient = (
        supabase.table("patient").select("id").eq("id", str(body.patient_id)).limit(1).execute()
    )
    if not patient.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    _ensure_consent(supabase, body.patient_id)

    logger.info(
        "web_extract_request",
        patient_id=str(body.patient_id),
        discharge_type="general_medical",
        text_length=len(body.raw_text),
        text_preview=body.raw_text[:500] if body.raw_text else ""
    )

    try:
        result = await extract_from_discharge_summary(
            raw_text=body.raw_text,
            discharge_type="general_medical",
        )
    except Exception as e:
        logger.error("web_extract_error", error=str(e), user_id=str(actor_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}",
        )

    items = [to_extracted_item(item) for item in result["items"]]

    try:
        await log_audit_entry(
            supabase=supabase,
            actor_type="rmp",
            actor_id=UUID(str(actor_id)),
            action="web_extract",
            entity_type="patient",
            entity_id=UUID(str(body.patient_id)),
            old_values=None,
            new_values={"items_count": len(items), "purpose": "data_processing"},
        )
    except Exception as e:
        logger.warning("web_extract_audit_failed", error=str(e))

    return ExtractResponse(
        items=items,
        could_not_place=result.get("could_not_place", []),
        quality=result["quality"],
        completeness=result["completeness"],
        summary_id=None,
    )


class PublishItem(BaseModel):
    item_type: str
    content: str
    quote: Optional[str] = None
    due_date: Optional[str] = None
    title: Optional[str] = None
    priority: Optional[str] = None
    source_span: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    # Doctor-edited medication details (Review & Publish step)
    medication_details: Optional[Dict[str, Any]] = None


class WebPublishRequest(BaseModel):
    patient_id: UUID
    discharge_date: date
    raw_text: str
    language: str = "en"
    items: List[PublishItem] = Field(default_factory=list)


@router.post("/publish")
async def web_publish(request: Request, body: WebPublishRequest):
    """
    Publish reviewed items to the care plan: persist an approved_item per item
    and run sync_followup_from_approved_item so the patient mobile tables
    (followup_item / patient_medication / warning_sign) are populated.
    """
    user = _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    actor_id = user.get("user_id")

    patient = (
        supabase.table("patient").select("id").eq("id", str(body.patient_id)).limit(1).execute()
    )
    if not patient.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Keep the patient's discharge date current (drives the "Day" counter in
    # the Patients table / patient header). Latest publish wins.
    try:
        supabase.table("patient").update(
            {"discharge_date": body.discharge_date.isoformat(), "updated_at": "now()"}
        ).eq("id", str(body.patient_id)).execute()
    except Exception as e:
        logger.warning("web_publish_patient_date_update_failed", error=str(e))

    rmp_id = _ensure_rmp(supabase, user)

    # discharge_summary row for provenance
    content_hash = hashlib.sha256(body.raw_text.encode()).hexdigest()
    ds = (
        supabase.table("discharge_summary")
        .insert(
            {
                "patient_id": str(body.patient_id),
                "admitting_rmp_id": rmp_id,
                "raw_content": body.raw_text,
                "content_hash": content_hash,
                "language": body.language,
                "discharge_date": body.discharge_date.isoformat(),
            }
        )
        .select("id")
        .execute()
    )
    discharge_summary_id = ds.data[0]["id"]

    published_ids: List[str] = []
    med_count = warn_count = 0
    for it in body.items:
        item_hash = hashlib.sha256(it.content.encode()).hexdigest()
        meta = dict(it.metadata or {})
        if it.priority:
            meta.setdefault("priority", it.priority)
        if it.source_span:
            meta.setdefault("source_span", it.source_span)
        if it.medication_details:
            meta["medication_details"] = it.medication_details
        row = {
            "patient_id": str(body.patient_id),
            "discharge_summary_id": discharge_summary_id,
            "approver_rmp_id": rmp_id,
            "item_type": it.item_type,
            "content": it.content,
            "content_hash": item_hash,
            "title": it.title,
            "due_date": it.due_date,
            "metadata": meta or {},
        }
        approved = supabase.table("approved_item").insert(row).select("id").execute()
        approved_id = approved.data[0]["id"]
        published_ids.append(approved_id)

        # Sync into the patient-mobile tables directly. (The 0003 RPC uses
        # ON CONFLICT (approved_item_id) which can't bind the partial unique
        # index; we replicate its mapping without upsert.)
        try:
            _sync_approved_to_mobile(
                supabase=supabase,
                approved_id=approved_id,
                patient_id=str(body.patient_id),
                item_type=it.item_type,
                content=it.content,
                title=it.title,
                due_date=it.due_date,
                med_details=it.medication_details,
            )
        except Exception as e:
            logger.warning("web_publish_sync_failed", approved_id=approved_id, error=str(e))

        if it.item_type == "medication":
            med_count += 1
        elif it.item_type == "warning_sign":
            warn_count += 1

    try:
        await log_audit_entry(
            supabase=supabase,
            actor_type="rmp",
            actor_id=UUID(str(actor_id)),
            action="web_publish",
            entity_type="patient",
            entity_id=UUID(str(body.patient_id)),
            old_values=None,
            new_values={
                "approved_items": len(published_ids),
                "discharge_summary_id": discharge_summary_id,
            },
        )
    except Exception as e:
        logger.warning("web_publish_audit_failed", error=str(e))

    return {
        "patient_id": str(body.patient_id),
        "discharge_summary_id": discharge_summary_id,
        "approved_item_ids": published_ids,
        "items_published": len(published_ids),
        "medications_synced": med_count,
        "warning_signs_synced": warn_count,
    }


# ---------------------------------------------------------------------
# Discharge summary + Add task (patient directory)
# ---------------------------------------------------------------------
@router.get("/patients/{patient_id}/discharge-summary")
async def get_patient_discharge_summary(patient_id: UUID, request: Request):
    """Return all discharge summaries for a patient, newest first (care team)."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    res = (
        supabase.table("discharge_summary")
        .select("id, raw_content, language, discharge_date, created_at")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .execute()
    )
    return {"count": len(res.data or []), "summaries": res.data or []}


class WebAddTaskRequest(BaseModel):
    patient_id: UUID
    description: str
    item_type: str = "care_instruction"
    due_date: Optional[str] = None
    title: Optional[str] = None


@router.post("/add-task")
async def web_add_task(request: Request, body: WebAddTaskRequest):
    """
    Add a doctor-authored task to the patient's care plan. Persists an
    approved_item and syncs a followup_item so it appears in the web Plan tab
    (v_items_effective) and in the patient mobile app.
    """
    user = _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    actor_id = user.get("user_id")

    content = (body.description or "").strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task description is required")

    patient = (
        supabase.table("patient").select("id").eq("id", str(body.patient_id)).limit(1).execute()
    )
    if not patient.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    itype = body.item_type if body.item_type in _ALLOWED_ITEM_TYPES else "care_instruction"
    rmp_id = _ensure_rmp(supabase, user)
    title = body.title or (content if len(content) <= 80 else content[:77] + "...")
    item_hash = hashlib.sha256(content.encode()).hexdigest()

    row = {
        "patient_id": str(body.patient_id),
        "approver_rmp_id": rmp_id,
        "item_type": itype,
        "content": content,
        "content_hash": item_hash,
        "title": title,
        "due_date": body.due_date,
        "metadata": {"source": "doctor_added", "added_by": user.get("full_name") or "Doctor"},
    }
    approved = supabase.table("approved_item").insert(row).select("id").execute()
    approved_id = approved.data[0]["id"]

    try:
        _sync_approved_to_mobile(
            supabase=supabase,
            approved_id=approved_id,
            patient_id=str(body.patient_id),
            item_type=itype,
            content=content,
            title=title,
            due_date=body.due_date,
        )
    except Exception as e:
        logger.warning("web_add_task_sync_failed", approved_id=approved_id, error=str(e))

    try:
        await log_audit_entry(
            supabase=supabase,
            actor_type="rmp",
            actor_id=UUID(str(actor_id)),
            action="web_add_task",
            entity_type="patient",
            entity_id=UUID(str(body.patient_id)),
            old_values=None,
            new_values={"approved_item_id": approved_id, "item_type": itype, "title": title},
        )
    except Exception as e:
        logger.warning("web_add_task_audit_failed", error=str(e))

    return {
        "approved_item_id": approved_id,
        "patient_id": str(body.patient_id),
        "item_type": itype,
        "category": _ITEM_CATEGORY.get(itype, "care"),
        "title": title,
        "due_date": body.due_date,
    }


# ---------------------------------------------------------------------
# Doctor dashboard (scoped to the logged-in doctor's assigned patients)
# ---------------------------------------------------------------------
def _doctor_patient_ids(supabase, user: Dict[str, Any]) -> List[str]:
    links = (
        supabase.table("doctor_patients")
        .select("patient_id")
        .eq("doctor_id", str(user.get("user_id")))
        .eq("active", True)
        .execute()
    ).data or []
    return [l["patient_id"] for l in links]


@router.get("/my-attention")
async def web_my_attention(request: Request):
    """Attention list for patients assigned to THIS doctor only."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    pids = _doctor_patient_ids(supabase, request.state.user)
    if not pids:
        return {"patients": []}
    rows = (
        supabase.table("v_patient_attention")
        .select("*")
        .in_("patient_id", pids)
        .order("urgency_score", desc=True)
        .execute()
    ).data or []
    return {"patients": rows}


@router.get("/my-flags")
async def web_my_flags(request: Request):
    """Unresolved review flags for patients assigned to THIS doctor only."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    pids = _doctor_patient_ids(supabase, request.state.user)
    if not pids:
        return {"flags": []}
    rows = (
        supabase.table("review_flags")
        .select("*, patient ( id, full_name, mrn )")
        .in_("patient_id", pids)
        .eq("resolved", False)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return {"flags": rows}


# ---------------------------------------------------------------------
# AI Agent (doctor-facing) — grounded in a selected patient's real data
# ---------------------------------------------------------------------
_AGENT_SYSTEM = """You are CarePlus AI, an assistant for a physician using the CarePlus discharge follow-up workflow.

You can BOTH read AND act. The doctor's message is an instruction to YOU.

READING:
- Answer questions using ONLY the PATIENT CONTEXT provided. If something isn't in the context, say you don't have that info; do not invent facts.

ACTING (write tools):
- When the doctor asks you to ADD, MARK, UPDATE, CHANGE, RESOLVE, RELEASE, FLAG, SEND, or schedule something, call the matching tool. Use tools ONLY for actions the doctor explicitly requests. Do not act on assumptions.
- You may update administrative/plan details on the doctor's instruction: personal details (phone/email/city/care circle/language/DOB), care-plan items (add / mark done / change due date), medications (add / update dose-frequency-duration as documented), medication adherence (taken/not taken), warning signs, test results (add / release), alerts/flags (add / resolve), Ask-thread messages (send), and coordination cards (acknowledge/resolve).
- Pick identifiers by id OR by matching name/title/drug from the context when the doctor refers to them loosely. If ambiguous, ask the doctor which one instead of guessing.
- Every write is audit-logged.

SAFETY LIMITS (never violate):
- Do NOT make autonomous clinical decisions (diagnose, prescribe, change treatment) on your own; you only carry out the doctor's explicit instructions and record them.
- Emergency content in the request → still tell the doctor to direct the patient to emergency care immediately.
- Never change something the doctor didn't ask you to change.

RESPONSE:
- After tool(s) run, briefly confirm exactly what you changed (fields/values), citing the patient. If you did not act, answer the question. Be concise and precise.
"""


def _build_patient_context(supabase, patient_id: UUID):
    """Gather a compact, real context block for a patient + provenance sources."""
    lines: List[str] = []
    sources: List[str] = []
    patient_name = None

    p = supabase.table("patient").select("*").eq("id", str(patient_id)).limit(1).execute().data
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    pt = p[0]
    patient_name = pt.get("full_name") or pt.get("name")
    lines.append(
        f"Patient: {patient_name} | MRN: {pt.get('mrn') or 'N/A'} | DoB: {pt.get('date_of_birth') or 'N/A'} | "
        f"Sex: {pt.get('sex') or 'N/A'} | Phone: {pt.get('phone') or 'N/A'} | Email: {pt.get('email') or 'N/A'} | "
        f"Language: {pt.get('language') or pt.get('preferred_language') or 'en'} | "
        f"Discharged: {pt.get('discharge_date') or 'N/A'} | City: {pt.get('city') or 'N/A'} | "
        f"Care circle: {pt.get('care_circle') or 'Self'}"
    )
    sources.append("patient")

    ds = (
        supabase.table("discharge_summary")
        .select("raw_content, language, discharge_date")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    if ds:
        raw = (ds[0].get("raw_content") or "")[:4000]
        lines.append(f"\n[Discharge summary]\n{raw}")
        sources.append("discharge_summary")

    items = (
        supabase.table("followup_item")
        .select("title, category, due_date, effective_status, original_text")
        .eq("patient_id", str(patient_id))
        .limit(60)
        .execute()
    ).data or []
    if items:
        lines.append("\n[Care plan / follow-up items]")
        for it in items:
            lines.append(
                f"- ({it.get('category')}) {it.get('title')} | status={it.get('effective_status')} | due={it.get('due_date') or 'N/A'}"
            )
        sources.append("care_plan")
    meds = (
        supabase.table("patient_medication")
        .select("id, drug_name, dose, how_often, for_how_long, original_instruction")
        .eq("patient_id", str(patient_id))
        .limit(60)
        .execute()
    ).data or []
    if meds:
        lines.append("\n[Medications]")
        for m in meds:
            lines.append(
                f"- {m.get('drug_name')} | dose={m.get('dose') or 'N/A'} | frequency={m.get('how_often') or 'N/A'} | duration={m.get('for_how_long') or 'N/A'} | {m.get('original_instruction') or ''}"
            )
        sources.append("medications")

    warns = (
        supabase.table("warning_sign")
        .select("original_text, severity")
        .eq("patient_id", str(patient_id))
        .limit(40)
        .execute()
    ).data or []
    if warns:
        lines.append("\n[Warning signs]")
        for w in warns:
            lines.append(f"- ({w.get('severity')}) {w.get('original_text')}")
        sources.append("warning_signs")

    tests = (
        supabase.table("test_result")
        .select("test_name, result_date, is_released")
        .eq("patient_id", str(patient_id))
        .order("result_date", desc=True)
        .limit(30)
        .execute()
    ).data or []
    if tests:
        lines.append("\n[Test results]")
        for t in tests:
            lines.append(
                f"- {t.get('test_name')} | date={t.get('result_date')} | {'released' if t.get('is_released') else 'not released'}"
            )
        sources.append("test_results")

    # Progress: completed care-plan items (and when)
    done = [it for it in items if (it.get("effective_status") or "").lower() == "completed"]
    if done:
        lines.append("\n[Progress — completed care-plan items]")
        for it in done:
            lines.append(f"- ({it.get('category')}) {it.get('title')} — completed")
        sources.append("progress")

    # Medication adherence (recent)
    adherence = (
        supabase.table("adherence_log")
        .select("log_date, status, logged_by, medication_id")
        .limit(80)
        .order("log_date", desc=True)
        .execute()
    ).data or []
    # Scope adherence to this patient's medications
    med_ids = {str(m.get("id")) for m in meds} if meds else set()
    if med_ids:
        adherence = [a for a in adherence if str(a.get("medication_id")) in med_ids]
    if adherence:
        lines.append("\n[Medication adherence (recent)]")
        for a in adherence[:40]:
            lines.append(f"- {a.get('log_date')}: {a.get('status')} (by {a.get('logged_by')})")
        sources.append("adherence")

    # Alerts / review flags
    alert_rows = (
        supabase.table("review_flags")
        .select("reason, severity, resolved, created_at")
        .eq("patient_id", str(patient_id))
        .eq("resolved", False)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    ).data or []
    if alert_rows:
        lines.append("\n[Alerts / review flags (open)]")
        for f in alert_rows:
            lines.append(f"- ({f.get('severity')}) {f.get('reason')} | raised {f.get('created_at')}")
        sources.append("alerts")

    # Patient messages / Ask thread (recent)
    msg_rows = (
        supabase.table("patient_message")
        .select("sender, sender_name, body, message_type, created_at")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    ).data or []
    if msg_rows:
        lines.append("\n[Messages / Ask thread (recent)]")
        for m in reversed(msg_rows):
            who = m.get("sender_name") or m.get("sender")
            lines.append(f"- [{m.get('message_type')}] {who}: {m.get('body')} ({m.get('created_at')})")
        sources.append("messages")

    # Coordination cards (patient -> care team review)
    coord = (
        supabase.table("coordination_card")
        .select("card_type, description, status, raised_by_name, created_at")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    ).data or []
    if coord:
        lines.append("\n[Coordination cards / reviews]")
        for c in coord:
            lines.append(f"- ({c.get('status')}) [{c.get('card_type')}] {c.get('description')} — by {c.get('raised_by_name')}")
        sources.append("coordination")

    # Audit / activity trail (patient-scoped entries)
    audit = (
        supabase.table("audit_log")
        .select("actor_type, action, ts")
        .eq("entity_type", "patient")
        .eq("entity_id", str(patient_id))
        .order("ts", desc=True)
        .limit(15)
        .execute()
    ).data or []
    if audit:
        lines.append("\n[Audit / activity (recent, patient-scoped)]")
        for a in audit:
            lines.append(f"- {a.get('ts')} {a.get('actor_type')}: {a.get('action')}")
        sources.append("audit")

    return "\n".join(lines), sources, patient_name


# --- Actionable tools the AI can invoke on the doctor's instruction ---
_PATIENT_FIELDS = [
    "name", "full_name", "mrn", "date_of_birth", "sex",
    "language", "preferred_language", "city", "care_circle",
    "phone", "email", "discharge_date",
]


def _tool(name, desc, props, required):
    return {
        "type": "function",
        "function": {"name": name, "description": desc,
                     "parameters": {"type": "object", "properties": props, "required": required}},
    }


AGENT_TOOLS = [
    _tool("update_patient_field", "Update a personal detail on the current patient's record.",
          {"field": {"type": "string", "enum": _PATIENT_FIELDS}, "value": {"type": "string"}}, ["field", "value"]),
    _tool("add_care_plan_item", "Add a care-plan/follow-up item for the patient.",
          {"title": {"type": "string"}, "item_type": {"type": "string", "enum": sorted(_ALLOWED_ITEM_TYPES)}, "due_date": {"type": "string"}}, ["title"]),
    _tool("mark_item_done", "Mark a care-plan item completed.",
          {"item_id": {"type": "string"}, "title": {"type": "string"}}, []),
    _tool("update_item_due_date", "Change a care-plan item's due date.",
          {"item_id": {"type": "string"}, "title": {"type": "string"}, "due_date": {"type": "string"}}, ["due_date"]),
    _tool("add_medication", "Add a medication for the patient.",
          {"drug_name": {"type": "string"}, "dose": {"type": "string"}, "how_often": {"type": "string"}, "for_how_long": {"type": "string"}}, ["drug_name"]),
    _tool("update_medication", "Update a medication's dose/frequency/duration.",
          {"medication_id": {"type": "string"}, "drug_name": {"type": "string"}, "dose": {"type": "string"}, "how_often": {"type": "string"}, "for_how_long": {"type": "string"}}, []),
    _tool("log_adherence", "Record medication adherence (taken/not_taken).",
          {"medication_id": {"type": "string"}, "drug_name": {"type": "string"}, "status": {"type": "string", "enum": ["taken", "not_taken"]}, "log_date": {"type": "string"}}, ["status"]),
    _tool("add_warning_sign", "Add a warning sign for the patient.",
          {"text": {"type": "string"}, "severity": {"type": "string", "enum": ["critical", "urgent"]}}, ["text"]),
    _tool("add_test_result", "Add a test result record.",
          {"test_name": {"type": "string"}, "result_date": {"type": "string"}, "result_content": {"type": "string"}, "is_released": {"type": "boolean"}}, ["test_name"]),
    _tool("release_test_result", "Release a test result to the patient.",
          {"test_id": {"type": "string"}, "test_name": {"type": "string"}, "result_content": {"type": "string"}}, []),
    _tool("add_alert", "Raise a review alert/flag for the patient.",
          {"reason": {"type": "string"}, "severity": {"type": "string", "enum": ["low", "medium", "high"]}}, ["reason"]),
    _tool("resolve_alert", "Resolve an open review alert/flag.",
          {"flag_id": {"type": "string"}, "reason": {"type": "string"}}, []),
    _tool("post_message", "Post a note/message to the patient's Ask thread.",
          {"body": {"type": "string"}, "message_type": {"type": "string", "enum": ["question", "plan_answer", "escalation", "doctor_answer", "emergency_warning"]}}, ["body"]),
    _tool("update_coordination_card", "Update a coordination card's status.",
          {"card_id": {"type": "string"}, "card_type": {"type": "string"}, "status": {"type": "string", "enum": ["needs-review", "acknowledged", "resolved"]}, "care_team_notes": {"type": "string"}}, []),
]


def _resolve_followup_item(supabase, patient_id, item_id, title):
    q = supabase.table("followup_item").select("id, title").eq("patient_id", str(patient_id))
    if item_id:
        q = q.eq("id", str(item_id))
    elif title:
        q = q.ilike("title", f"%{title}%")
    else:
        return None
    rows = q.limit(1).execute().data
    return rows[0] if rows else None


def _resolve_medication(supabase, patient_id, medication_id, drug_name):
    q = supabase.table("patient_medication").select("id, drug_name").eq("patient_id", str(patient_id))
    if medication_id:
        q = q.eq("id", str(medication_id))
    elif drug_name:
        q = q.ilike("drug_name", f"%{drug_name}%")
    else:
        return None
    rows = q.limit(1).execute().data
    return rows[0] if rows else None


async def _execute_agent_tool(supabase, user, patient_id, name, args):
    """Execute one write action (service role) on the doctor's instruction. Returns a short human string."""
    actor_id = user.get("user_id")
    actor_name = user.get("full_name") or user.get("email") or "Doctor"
    now_iso = datetime.now(timezone.utc).isoformat()

    async def _log():
        try:
            await log_audit_entry(
                supabase=supabase, actor_type="rmp", actor_id=UUID(str(actor_id)),
                action=f"web_agent_action:{name}", entity_type="patient",
                entity_id=UUID(str(patient_id)) if patient_id else uuid4(),
                old_values=None, new_values={"args": args},
            )
        except Exception as e:
            logger.warning("web_agent_action_audit_failed", tool=name, error=str(e))

    if name == "update_patient_field":
        field = args.get("field"); value = args.get("value")
        if field not in _PATIENT_FIELDS:
            return f"Field '{field}' is not editable."
        update = {field: (value if value != "" else None), "updated_at": now_iso}
        supabase.table("patient").update(update).eq("id", str(patient_id)).execute()
        await _log()
        return f"Updated patient {field} to '{value}'."

    if name == "add_care_plan_item":
        itype = args.get("item_type") or "care_instruction"
        if itype not in _ALLOWED_ITEM_TYPES:
            itype = "care_instruction"
        content = (args.get("title") or "").strip()
        if not content:
            return "Item title is required."
        rmp_id = _ensure_rmp(supabase, user)
        row = {"patient_id": str(patient_id), "approver_rmp_id": rmp_id, "item_type": itype,
               "content": content, "content_hash": hashlib.sha256(content.encode()).hexdigest(),
               "title": content[:80], "due_date": args.get("due_date"),
               "metadata": {"source": "ai_agent", "added_by": actor_name}}
        appr = supabase.table("approved_item").insert(row).select("id").execute().data[0]["id"]
        _sync_approved_to_mobile(supabase, appr, str(patient_id), itype, content, content[:80], args.get("due_date"))
        await _log()
        return f"Added care-plan item: {content}" + (f" (due {args['due_date']})" if args.get("due_date") else "")

    if name == "mark_item_done":
        it = _resolve_followup_item(supabase, patient_id, args.get("item_id"), args.get("title"))
        if not it:
            return "Couldn't find that care-plan item."
        supabase.table("followup_item").update(
            {"effective_status": "completed", "completed_at": now_iso, "completed_by": actor_name, "updated_at": now_iso}
        ).eq("id", it["id"]).execute()
        await _log()
        return f"Marked '{it['title']}' as done."

    if name == "update_item_due_date":
        it = _resolve_followup_item(supabase, patient_id, args.get("item_id"), args.get("title"))
        if not it:
            return "Couldn't find that care-plan item."
        supabase.table("followup_item").update({"due_date": args["due_date"], "updated_at": now_iso}).eq("id", it["id"]).execute()
        await _log()
        return f"Updated '{it['title']}' due date to {args['due_date']}."

    if name == "add_medication":
        drug = (args.get("drug_name") or "").strip()
        if not drug:
            return "Medication name is required."
        supabase.table("patient_medication").insert({
            "patient_id": str(patient_id), "drug_name": drug,
            "dose": args.get("dose"), "how_often": args.get("how_often"), "for_how_long": args.get("for_how_long"),
            "original_instruction": " ".join(filter(None, [args.get("dose"), args.get("how_often"), args.get("for_how_long")])) or drug,
        }).execute()
        await _log()
        return f"Added medication {drug}."

    if name == "update_medication":
        med = _resolve_medication(supabase, patient_id, args.get("medication_id"), args.get("drug_name"))
        if not med:
            return "Couldn't find that medication."
        upd = {k: args[k] for k in ("dose", "how_often", "for_how_long") if args.get(k)}
        upd["updated_at"] = now_iso
        supabase.table("patient_medication").update(upd).eq("id", med["id"]).execute()
        await _log()
        detail = ", ".join(f"{k}={v}" for k, v in upd.items() if k != "updated_at") or "no changes"
        return f"Updated medication {med['drug_name']}: {detail}."

    if name == "log_adherence":
        med = _resolve_medication(supabase, patient_id, args.get("medication_id"), args.get("drug_name"))
        if not med:
            return "Couldn't find that medication."
        log_date = args.get("log_date") or date.today().isoformat()
        status = args["status"] if args.get("status") in ("taken", "not_taken") else "taken"
        existing = supabase.table("adherence_log").select("id").eq("medication_id", med["id"]).eq("log_date", log_date).execute().data
        payload = {"medication_id": med["id"], "log_date": log_date, "status": status, "logged_by": actor_name, "logged_at": now_iso}
        if existing:
            supabase.table("adherence_log").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("adherence_log").insert(payload).execute()
        await _log()
        return f"Recorded {med['drug_name']} as {status} on {log_date}."

    if name == "add_warning_sign":
        text = (args.get("text") or "").strip()
        if not text:
            return "Warning sign text is required."
        sev = args.get("severity") or "critical"
        supabase.table("warning_sign").insert({"patient_id": str(patient_id), "original_text": text, "severity": sev}).execute()
        await _log()
        return f"Added warning sign ({sev}): {text}"

    if name == "add_test_result":
        supabase.table("test_result").insert({
            "patient_id": str(patient_id), "test_name": (args.get("test_name") or "").strip(),
            "result_date": args.get("result_date") or date.today().isoformat(),
            "result_content": args.get("result_content"), "is_released": bool(args.get("is_released")),
        }).execute()
        await _log()
        return f"Added test result: {args.get('test_name')}."

    if name == "release_test_result":
        q = supabase.table("test_result").select("id, test_name").eq("patient_id", str(patient_id))
        if args.get("test_id"):
            q = q.eq("id", str(args["test_id"]))
        elif args.get("test_name"):
            q = q.ilike("test_name", f"%{args['test_name']}%")
        rows = q.order("result_date", desc=True).limit(1).execute().data
        if not rows:
            return "Couldn't find that test result."
        supabase.table("test_result").update({
            "is_released": True, "result_content": args.get("result_content"),
            "released_by": actor_name, "released_at": now_iso, "updated_at": now_iso,
        }).eq("id", rows[0]["id"]).execute()
        await _log()
        return f"Released test result: {rows[0]['test_name']}."

    if name == "add_alert":
        reason = (args.get("reason") or "").strip()
        if not reason:
            return "Alert reason is required."
        supabase.table("review_flags").insert({"patient_id": str(patient_id), "reason": reason, "severity": args.get("severity") or "medium", "resolved": False}).execute()
        await _log()
        return f"Raised alert: {reason}."

    if name == "resolve_alert":
        q = supabase.table("review_flags").select("id, reason").eq("patient_id", str(patient_id)).eq("resolved", False)
        if args.get("flag_id"):
            q = q.eq("id", str(args["flag_id"]))
        elif args.get("reason"):
            q = q.ilike("reason", f"%{args['reason']}%")
        rows = q.limit(1).execute().data
        if not rows:
            return "No matching open alert found."
        supabase.table("review_flags").update({"resolved": True, "resolved_at": now_iso, "resolved_by": UUID(str(actor_id))}).eq("id", rows[0]["id"]).execute()
        await _log()
        return f"Resolved alert: {rows[0]['reason']}."

    if name == "post_message":
        body = (args.get("body") or "").strip()
        if not body:
            return "Message body is required."
        supabase.table("patient_message").insert({
            "patient_id": str(patient_id), "sender": "care_team", "sender_name": actor_name,
            "body": body, "message_type": args.get("message_type") or "plan_answer",
        }).execute()
        await _log()
        return f"Sent message to patient: {body}"

    if name == "update_coordination_card":
        q = supabase.table("coordination_card").select("id, card_type").eq("patient_id", str(patient_id))
        if args.get("card_id"):
            q = q.eq("id", str(args["card_id"]))
        elif args.get("card_type"):
            q = q.eq("card_type", args["card_type"])
        rows = q.order("created_at", desc=True).limit(1).execute().data
        if not rows:
            return "No matching coordination card found."
        upd = {"status": args.get("status") or "acknowledged"}
        if args.get("care_team_notes"):
            upd["care_team_notes"] = args.get("care_team_notes")
        if upd["status"] == "resolved":
            upd["resolved_at"] = now_iso
        supabase.table("coordination_card").update(upd).eq("id", rows[0]["id"]).execute()
        await _log()
        return f"Updated coordination card ({rows[0]['card_type']}) to {upd['status']}."

    return f"Unknown action '{name}'."


class WebAgentRequest(BaseModel):
    patient_id: Optional[UUID] = None
    message: str
    history: Optional[List[Dict[str, str]]] = None


def _resolve_patient_from_message(supabase, user: Dict[str, Any], message: str) -> Optional[UUID]:
    """
    Detect which of THIS doctor's patients the message is about, by matching
    patient names (full name substring, else distinctive name tokens).
    Returns a patient UUID or None.
    """
    links = (
        supabase.table("doctor_patients")
        .select("patient_id")
        .eq("doctor_id", str(user.get("user_id")))
        .eq("active", True)
        .execute()
    ).data or []
    pids = [l["patient_id"] for l in links]
    if not pids:
        return None
    pats = supabase.table("patient").select("id, full_name, name").in_("id", pids).execute().data or []
    msg = (message or "").lower()

    # 1) Strong match: full patient name appears as a substring in the message
    for p in pats:
        for nm in (p.get("full_name"), p.get("name")):
            if nm and len(nm) >= 4 and nm.lower() in msg:
                return UUID(p["id"])

    # 2) Token-overlap match (>= half of the distinctive name tokens present)
    scored = []
    for p in pats:
        nm = (p.get("full_name") or p.get("name") or "").lower().replace(",", " ")
        toks = [t for t in nm.split() if len(t) >= 4]
        if not toks:
            continue
        hits = sum(1 for t in toks if t in msg)
        if hits:
            scored.append((hits / len(toks), hits, p["id"]))
    if scored:
        scored.sort(reverse=True)
        top = scored[0]
        if top[0] >= 0.5:
            return UUID(top[2])
    return None


@router.post("/agent")
async def web_agent(request: Request, body: WebAgentRequest):
    """Physician-facing assistant grounded in a patient's chart data.

    If no patient_id is provided but the message references one of the
    doctor's patients by name, that patient is resolved automatically so the
    answer is grounded in their full record.
    """
    user = _require_care_team(request)
    if not (body.message or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is required")

    supabase = get_supabase_client(use_service_role=True)

    target_pid = body.patient_id
    auto_resolved = False
    if not target_pid:
        resolved = _resolve_patient_from_message(supabase, user, body.message)
        if resolved:
            target_pid = resolved
            auto_resolved = True

    system = _AGENT_SYSTEM
    patient_name = None
    sources: List[str] = []
    if target_pid:
        context_text, sources, patient_name = _build_patient_context(supabase, target_pid)
        system += (
            f"\nPatient in context: {patient_name}\n\n=== PATIENT CONTEXT ===\n"
            f"{context_text}\n=== END PATIENT CONTEXT ==="
        )
    else:
        names = (
            supabase.table("doctor_patients")
            .select("patient_id")
            .eq("doctor_id", str(user.get("user_id")))
            .eq("active", True)
            .execute()
        ).data or []
        hint = (
            "Don't have chart data for the referenced patient. "
            "Ask the doctor to select the patient, or double-check the name; only your assigned patients are available."
            if names
            else "No patient is selected and you have no patients assigned yet. "
            "Answer generally about CarePlus and suggest adding patients."
        )
        system += f"\n{hint}"

    messages = [{"role": "system", "content": system}]
    for h in (body.history or [])[-8:]:
        role = h.get("role")
        content = h.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": body.message})

    client = OpenRouterClient()
    actions_taken: List[Dict[str, Any]] = []
    try:
        # Pass 1: allow the model to call write tools (only when a patient is in context).
        use_tools = bool(target_pid)
        first = await client.chat_with_tools(
            messages, tools=AGENT_TOOLS if use_tools else None,
            temperature=0.3, max_tokens=800,
        )
        tool_calls = first.get("tool_calls") or []
        if tool_calls:
            valid_names = {t["function"]["name"] for t in AGENT_TOOLS}
            follow = list(messages)
            follow.append({"role": "assistant", "content": first.get("content") or "", "tool_calls": tool_calls})
            for tc in tool_calls:
                fn = tc.get("function", {}) or {}
                tname = fn.get("name")
                try:
                    targs = json.loads(fn.get("arguments") or "{}")
                except Exception:
                    targs = {}
                if not tname or tname not in valid_names:
                    actions_taken.append({"tool": tname or "?", "ok": False, "result": "Unknown tool."})
                    follow.append({"role": "tool", "tool_call_id": tc.get("id"), "content": "Unknown tool."})
                    continue
                result = await _execute_agent_tool(supabase, user, target_pid, tname, targs)
                actions_taken.append({"tool": tname, "args": targs, "ok": True, "result": result})
                follow.append({"role": "tool", "tool_call_id": tc.get("id"), "content": result})
            # Pass 2: summarize what was done, grounded in the tool results.
            answer = await client.chat(follow, temperature=0.3, max_tokens=600)
            # Refresh sources after writes (best effort).
            try:
                _, sources, _ = _build_patient_context(supabase, target_pid)
            except Exception:
                pass
        else:
            answer = first.get("content") or ""
    except Exception as e:
        logger.error("web_agent_error", error=str(e), user_id=str(user.get("user_id")))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI agent failed: {str(e)}")
    finally:
        await client.close()

    try:
        await log_audit_entry(
            supabase=supabase,
            actor_type="rmp",
            actor_id=UUID(str(user.get("user_id"))),
            action="web_agent",
            entity_type="patient",
            entity_id=UUID(str(target_pid)) if target_pid else uuid4(),
            old_values=None,
            new_values={
                "question_len": len(body.message),
                "sources": sources,
                "auto_resolved": auto_resolved,
                "actions": [a.get("tool") for a in actions_taken],
            },
        )
    except Exception as e:
        logger.warning("web_agent_audit_failed", error=str(e))

    return {
        "answer": answer,
        "patient_id": str(target_pid) if target_pid else None,
        "patient_name": patient_name,
        "auto_resolved": auto_resolved,
        "sources": sources,
        "actions": actions_taken,
    }


# ---------------------------------------------------------------------
# Today's schedule (appointments = followup_item with category='appointment')
# ---------------------------------------------------------------------
@router.get("/schedule")
async def web_schedule(request: Request, days: int = 7):
    """Today's + upcoming appointments for THIS doctor's patients.

    There is no separate appointment table; appointments are care-plan items
    with category='appointment' (due_date + optional due_time + provider).
    """
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    user = request.state.user
    pids = _doctor_patient_ids(supabase, user)
    today = date.today()
    horizon = today + __import__("datetime").timedelta(days=max(0, min(30, days)))

    if not pids:
        return {"today": [], "upcoming": [], "today_date": today.isoformat()}

    rows = (
        supabase.table("followup_item")
        .select("id, title, due_date, due_time, effective_status, provider_suggestion, patient_id, completed_at")
        .in_("patient_id", pids)
        .eq("category", "appointment")
        .gte("due_date", today.isoformat())
        .lte("due_date", horizon.isoformat())
        .order("due_date")
        .order("due_time")
        .limit(200)
        .execute()
    ).data or []

    pats = supabase.table("patient").select("id, full_name, name").in_("id", pids).execute().data or []
    name_by_id = {p["id"]: (p.get("full_name") or p.get("name")) for p in pats}

    def _prov(p):
        if isinstance(p, dict):
            return p.get("name") or p.get("location") or p.get("type")
        return p or None

    def _map(it):
        return {
            "id": it["id"],
            "patient_id": it["patient_id"],
            "patient_name": name_by_id.get(it["patient_id"], "Patient"),
            "title": it.get("title"),
            "due_date": it.get("due_date"),
            "due_time": _prov(it.get("due_time")) or it.get("due_time"),
            "provider": _prov(it.get("provider_suggestion")),
            "status": it.get("effective_status"),
            "is_completed": (it.get("effective_status") == "completed"),
        }

    appts = [_map(it) for it in rows]
    today_list = [a for a in appts if a["due_date"] == today.isoformat()]
    upcoming = [a for a in appts if a["due_date"] != today.isoformat()]
    return {"today": today_list, "upcoming": upcoming, "today_date": today.isoformat()}


# ---------------------------------------------------------------------
# Reschedule appointment
# ---------------------------------------------------------------------
class RescheduleAppointmentRequest(BaseModel):
    item_id: UUID
    new_due_date: str
    new_due_time: Optional[str] = None
    new_provider: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


@router.post("/schedule/reschedule")
async def reschedule_appointment(request: Request, body: RescheduleAppointmentRequest):
    """Reschedule an existing appointment (followup_item with category='appointment')."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    user = request.state.user

    # Verify the item exists and is an appointment
    item = (
        supabase.table("followup_item")
        .select("*")
        .eq("id", str(body.item_id))
        .single()
        .execute()
    ).data

    if not item:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if item.get("category") != "appointment":
        raise HTTPException(status_code=400, detail="Item is not an appointment")

    # Verify doctor has access to this patient
    pids = _doctor_patient_ids(supabase, user)
    if item["patient_id"] not in pids:
        raise HTTPException(status_code=403, detail="You do not have access to this patient")

    # Update the appointment
    update_data = {
        "due_date": body.new_due_date,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if body.new_due_time:
        update_data["due_time"] = body.new_due_time

    if body.new_provider:
        update_data["provider_suggestion"] = body.new_provider

    updated = (
        supabase.table("followup_item")
        .update(update_data)
        .eq("id", str(body.item_id))
        .select("*")
        .single()
        .execute()
    ).data

    # Log audit entry
    log_audit_entry(
        supabase,
        action="reschedule_appointment",
        actor=user.get("user_id"),
        target_type="followup_item",
        target_id=str(body.item_id),
        details={
            "old_due_date": item.get("due_date"),
            "new_due_date": body.new_due_date,
            "reason": body.reason,
        },
    )

    return {
        "id": updated["id"],
        "patient_id": updated["patient_id"],
        "title": updated.get("title"),
        "due_date": updated.get("due_date"),
        "due_time": updated.get("due_time"),
        "provider": _prov(updated.get("provider_suggestion")),
        "status": updated.get("effective_status"),
    }


# ---------------------------------------------------------------------
# Messaging endpoints
# ---------------------------------------------------------------------
class SendMessageRequest(BaseModel):
    patient_id: UUID
    body: str
    message_type: str = "doctor_answer"
    cited_item_ids: Optional[List[UUID]] = None


@router.post("/messages/send")
async def send_message(request: Request, body: SendMessageRequest):
    """Send a message from doctor to patient."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    user = request.state.user

    # Verify doctor has access to this patient
    pids = _doctor_patient_ids(supabase, user)
    if str(body.patient_id) not in pids:
        raise HTTPException(status_code=403, detail="You do not have access to this patient")

    # Get doctor's name
    doctor = (
        supabase.table("profiles")
        .select("full_name, name")
        .eq("id", user.get("user_id"))
        .single()
        .execute()
    ).data or {}

    doctor_name = doctor.get("full_name") or doctor.get("name") or "Doctor"

    # Send message
    message = (
        supabase.table("patient_message")
        .insert({
            "patient_id": str(body.patient_id),
            "sender": "care_team",
            "sender_name": doctor_name,
            "body": body.body,
            "message_type": body.message_type,
            "cited_item_ids": [str(id) for id in (body.cited_item_ids or [])],
        })
        .select("*")
        .single()
        .execute()
    ).data

    return message


@router.get("/messages/{patient_id}")
async def get_messages(request: Request, patient_id: UUID):
    """Get all messages for a patient."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    user = request.state.user

    # Verify doctor has access to this patient
    pids = _doctor_patient_ids(supabase, user)
    if str(patient_id) not in pids:
        raise HTTPException(status_code=403, detail="You do not have access to this patient")

    messages = (
        supabase.table("patient_message")
        .select("*")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    ).data or []

    return {"messages": messages}


# ---------------------------------------------------------------------
# Answer patient question
# ---------------------------------------------------------------------
class AnswerQuestionRequest(BaseModel):
    question_id: UUID
    answer: str
    cited_item_ids: Optional[List[UUID]] = None


@router.post("/questions/answer")
async def answer_question(request: Request, body: AnswerQuestionRequest):
    """Answer a patient question."""
    _require_care_team(request)
    supabase = get_supabase_client(use_service_role=True)
    user = request.state.user

    # Get the question
    question = (
        supabase.table("patient_question")
        .select("*")
        .eq("id", str(body.question_id))
        .single()
        .execute()
    ).data

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Verify doctor has access to this patient
    pids = _doctor_patient_ids(supabase, user)
    if question["patient_id"] not in pids:
        raise HTTPException(status_code=403, detail="You do not have access to this patient")

    # Update the question with answer
    updated = (
        supabase.table("patient_question")
        .update({
            "answer": body.answer,
            "cited_item_ids": [str(id) for id in (body.cited_item_ids or [])],
            "answered_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", str(body.question_id))
        .select("*")
        .single()
        .execute()
    ).data

    # Also send as a message
    doctor = (
        supabase.table("profiles")
        .select("full_name, name")
        .eq("id", user.get("user_id"))
        .single()
        .execute()
    ).data or {}

    doctor_name = doctor.get("full_name") or doctor.get("name") or "Doctor"

    supabase.table("patient_message").insert({
        "patient_id": question["patient_id"],
        "sender": "care_team",
        "sender_name": doctor_name,
        "body": f"Answer to your question: {question['question']}\n\n{body.answer}",
        "message_type": "doctor_answer",
        "cited_item_ids": [str(id) for id in (body.cited_item_ids or [])],
    }).execute()

    return updated
