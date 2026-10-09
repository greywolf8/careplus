from typing import Any, Dict, List
from uuid import UUID

from supabase import Client


class PatientPlanSyncService:
    """
    Bridge clinician-approved rows into patient-mobile followup_item / medication / warning_sign tables.
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def sync_patient_plan(self, patient_id: UUID) -> Dict[str, int]:
        approved = (
            self.supabase.table("approved_item")
            .select("*")
            .eq("patient_id", str(patient_id))
            .execute()
        ).data or []

        followup_count = 0
        med_count = 0
        warn_count = 0

        for row in approved:
            self.supabase.rpc(
                "sync_followup_from_approved_item", {"p_approved_item_id": row["id"]}
            ).execute()
            followup_count += 1
            if row.get("item_type") == "medication":
                med_count += 1
            if row.get("item_type") == "warning_sign":
                warn_count += 1

        obligations = (
            self.supabase.table("obligation")
            .select("*")
            .eq("patient_id", str(patient_id))
            .execute()
        ).data or []

        for ob in obligations:
            if ob.get("state") in ("cancelled",):
                continue
            existing = (
                self.supabase.table("followup_item")
                .select("id")
                .eq("obligation_id", ob["id"])
                .limit(1)
                .execute()
            )
            if existing.data:
                continue
            category = "care"
            title = ob.get("title") or "Follow-up task"
            self.supabase.table("followup_item").insert(
                {
                    "patient_id": str(patient_id),
                    "obligation_id": ob["id"],
                    "title": title,
                    "category": category,
                    "due_date": ob.get("due_date"),
                    "effective_status": "pending"
                    if ob.get("state") != "completed"
                    else "completed",
                    "original_text": ob.get("description") or title,
                    "source": "discharge_summary",
                }
            ).execute()
            followup_count += 1

        return {
            "followup_items_synced": followup_count,
            "medications_synced": med_count,
            "warning_signs_synced": warn_count,
        }

    def copy_verified_translations_for_patient(self, patient_id: UUID) -> int:
        items = (
            self.supabase.table("followup_item")
            .select("id, approved_item_id, title, original_text")
            .eq("patient_id", str(patient_id))
            .execute()
        ).data or []

        copied = 0
        for item in items:
            source_id = item.get("approved_item_id")
            if not source_id:
                continue
            translations = (
                self.supabase.table("translation")
                .select("*")
                .eq("source_item_id", source_id)
                .eq("source_type", "approved_item")
                .eq("verified", True)
                .execute()
            ).data or []
            for tr in translations:
                lang = tr["target_language"]
                payload = {
                    "item_id": item["id"],
                    "language": lang,
                    "translated_title": item.get("title") or "Care plan item",
                    "translated_instruction": tr["translated_content"],
                    "is_verified": True,
                }
                self.supabase.table("followup_item_translation").upsert(
                    payload, on_conflict="item_id,language"
                ).execute()
                copied += 1
        return copied
