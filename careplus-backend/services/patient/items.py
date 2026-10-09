from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client


def compute_section(due: Optional[date], item_status: str, today: Optional[date] = None) -> Optional[str]:
    if item_status in ("needs_review", "rejected", "cancelled"):
        return "NEXT UP"
    if not due:
        return "DAILY CARE"
    today = today or date.today()
    if item_status == "overdue" or (item_status == "pending" and due < today):
        return "OVERDUE"
    if due == today:
        return "DUE TODAY"
    if due > today:
        return "NEXT UP"
    return "DAILY CARE"


def refresh_effective_status(row: Dict[str, Any], today: Optional[date] = None) -> str:
    status_val = row.get("effective_status", "pending")
    if status_val in ("completed", "needs_review", "escalated", "missed", "rejected", "cancelled"):
        return status_val
    due = row.get("due_date")
    if due and status_val == "pending":
        today = today or date.today()
        due_date = date.fromisoformat(due) if isinstance(due, str) else due
        if due_date < today:
            return "overdue"
    return status_val


class PatientItemsService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def list_followup_items(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("followup_item")
            .select("*")
            .eq("patient_id", str(patient_id))
            .order("due_date")
            .execute()
        )
        items = result.data or []
        enriched: List[Dict[str, Any]] = []
        for row in items:
            eff = refresh_effective_status(row)
            if eff != row.get("effective_status"):
                self.supabase.table("followup_item").update(
                    {"effective_status": eff, "updated_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", row["id"]).execute()
                row["effective_status"] = eff
            row["section"] = compute_section(
                date.fromisoformat(row["due_date"]) if row.get("due_date") else None,
                row["effective_status"],
            )
            enriched.append(row)
        return enriched

    def get_followup_item(self, patient_id: UUID, item_id: UUID) -> Dict[str, Any]:
        result = (
            self.supabase.table("followup_item")
            .select("*")
            .eq("id", str(item_id))
            .eq("patient_id", str(patient_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        row = result.data[0]
        row["effective_status"] = refresh_effective_status(row)
        row["section"] = compute_section(
            date.fromisoformat(row["due_date"]) if row.get("due_date") else None,
            row["effective_status"],
        )
        return row

    def get_item_translation(self, item_id: UUID, language: str) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("followup_item_translation")
            .select("*")
            .eq("item_id", str(item_id))
            .eq("language", language)
            .eq("is_verified", True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        return {
            "item_id": row["item_id"],
            "language": row["language"],
            "translated_title": row["translated_title"],
            "translated_instruction": row["translated_instruction"],
            "is_verified": row["is_verified"],
        }

    def mark_item_done(
        self,
        patient_id: UUID,
        item_id: UUID,
        completed_by: str,
        can_mark_done: bool,
        toggle: bool = True,
    ) -> Dict[str, Any]:
        if not can_mark_done:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This profile cannot mark items done",
            )
        item = self.get_followup_item(patient_id, item_id)
        if item["effective_status"] in ("needs_review", "rejected", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item is under clinical review and cannot be marked done",
            )

        if toggle and item["effective_status"] == "completed":
            update = {
                "effective_status": "pending",
                "completed_at": None,
                "completed_by": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            update = {
                "effective_status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "completed_by": completed_by,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        self.supabase.table("followup_item").update(update).eq("id", str(item_id)).execute()
        return self.get_followup_item(patient_id, item_id)

    def list_medications(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("patient_medication")
            .select("*")
            .eq("patient_id", str(patient_id))
            .execute()
        )
        return result.data or []

    def list_adherence(self, patient_id: UUID, log_date: date) -> List[Dict[str, Any]]:
        meds = self.list_medications(patient_id)
        med_ids = [m["id"] for m in meds]
        if not med_ids:
            return []
        result = (
            self.supabase.table("adherence_log")
            .select("*")
            .in_("medication_id", med_ids)
            .eq("log_date", log_date.isoformat())
            .execute()
        )
        return result.data or []

    def record_adherence(
        self,
        patient_id: UUID,
        medication_id: UUID,
        log_date: date,
        status: str,
        logged_by: str,
    ) -> Dict[str, Any]:
        if status not in ("taken", "not_taken"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
        med = (
            self.supabase.table("patient_medication")
            .select("id, patient_id")
            .eq("id", str(medication_id))
            .limit(1)
            .execute()
        )
        if not med.data or med.data[0]["patient_id"] != str(patient_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

        payload = {
            "medication_id": str(medication_id),
            "log_date": log_date.isoformat(),
            "status": status,
            "logged_by": logged_by,
            "logged_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = (
            self.supabase.table("adherence_log")
            .select("id")
            .eq("medication_id", str(medication_id))
            .eq("log_date", log_date.isoformat())
            .execute()
        )
        if existing.data:
            self.supabase.table("adherence_log").update(payload).eq(
                "id", existing.data[0]["id"]
            ).execute()
            row_id = existing.data[0]["id"]
        else:
            inserted = self.supabase.table("adherence_log").insert(payload).execute()
            row_id = inserted.data[0]["id"]

        fetched = (
            self.supabase.table("adherence_log")
            .select("*")
            .eq("id", row_id)
            .limit(1)
            .execute()
        )
        return fetched.data[0]

    def list_warning_signs(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("warning_sign")
            .select("*")
            .eq("patient_id", str(patient_id))
            .execute()
        )
        return result.data or []

    def list_test_results(self, patient_id: UUID, include_unreleased: bool = False) -> List[Dict[str, Any]]:
        query = self.supabase.table("test_result").select("*").eq("patient_id", str(patient_id))
        if not include_unreleased:
            query = query.eq("is_released", True)
        result = query.order("result_date", desc=True).execute()
        return result.data or []

    def list_providers(self, category: Optional[str] = None, query: Optional[str] = None) -> List[Dict[str, Any]]:
        result = self.supabase.table("care_provider").select("*").eq("is_active", True).execute()
        rows = result.data or []
        filtered: List[Dict[str, Any]] = []
        for row in rows:
            if category and category != "all" and row.get("kind") != category:
                continue
            if query:
                q = query.lower()
                name_match = q in (row.get("name") or "").lower()
                spec_match = any(q in (s or "").lower() for s in (row.get("specialties") or []))
                if not name_match and not spec_match:
                    continue
            coords = None
            if row.get("latitude") is not None and row.get("longitude") is not None:
                coords = {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
            filtered.append(
                {
                    **row,
                    "coordinates": coords,
                }
            )
        return filtered

    def list_reminders(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("reminder")
            .select("*")
            .eq("patient_id", str(patient_id))
            .order("scheduled_at")
            .execute()
        )
        return result.data or []

    def list_access_requests(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("caregiver_access_request")
            .select("*")
            .eq("patient_id", str(patient_id))
            .order("requested_at", desc=True)
            .execute()
        )
        return result.data or []

    def create_access_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        inserted = self.supabase.table("caregiver_access_request").insert(payload).execute()
        return inserted.data[0]

    def decide_access_request(self, request_id: UUID, allowed: bool) -> bool:
        self.supabase.rpc(
            "decide_access_request",
            {"p_request_id": str(request_id), "p_allowed": allowed, "p_reason": None},
        ).execute()
        return True

    def list_coordination_cards(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("coordination_card")
            .select("*")
            .eq("patient_id", str(patient_id))
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def create_coordination_card(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        inserted = self.supabase.table("coordination_card").insert(payload).execute()
        return inserted.data[0]

    def update_coordination_card(
        self, card_id: UUID, status_val: str, care_team_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        update: Dict[str, Any] = {"status": status_val}
        if care_team_notes:
            update["care_team_notes"] = care_team_notes
        if status_val == "resolved":
            update["resolved_at"] = datetime.now(timezone.utc).isoformat()
        self.supabase.table("coordination_card").update(update).eq("id", str(card_id)).execute()
        result = (
            self.supabase.table("coordination_card")
            .select("*")
            .eq("id", str(card_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coordination card not found")
        return result.data[0]

    def release_test_result(
        self, patient_id: UUID, test_id: UUID, result_content: str, released_by: str
    ) -> Dict[str, Any]:
        update = {
            "is_released": True,
            "result_content": result_content,
            "released_by": released_by,
            "released_at": datetime.now(timezone.utc).isoformat(),
        }
        self.supabase.table("test_result").update(update).eq("id", str(test_id)).eq(
            "patient_id", str(patient_id)
        ).execute()
        result = (
            self.supabase.table("test_result")
            .select("*")
            .eq("id", str(test_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test result not found")
        return result.data[0]
