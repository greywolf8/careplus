from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client


class PatientAccessService:
    """Resolve patient-app identity, context, and tab permissions."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def get_app_user_by_auth(self, auth_user_id: str) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("patient_app_user")
            .select("*")
            .eq("auth_user_id", auth_user_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    def get_app_user(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("patient_app_user")
            .select("*")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    def resolve_context_from_token(self, user: Dict[str, Any]) -> Dict[str, Any]:
        role = user.get("role")
        auth_user_id = user.get("user_id")

        app_user = None
        if auth_user_id:
            app_user = self.get_app_user_by_auth(str(auth_user_id))

        if app_user:
            return self._context_from_app_user(app_user)

        patient_id = user.get("patient_id")
        if role == "patient" and patient_id:
            patient = self._get_patient(UUID(str(patient_id)))
            if not patient:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
            return {
                "user_id": UUID(str(auth_user_id)) if auth_user_id else UUID(str(patient_id)),
                "role": "patient",
                "patient_id": UUID(str(patient_id)),
                "patient_name": patient["name"],
                "can_mark_done": True,
            }

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient app profile not found for this account",
        )

    def _context_from_app_user(self, app_user: Dict[str, Any]) -> Dict[str, Any]:
        role = app_user["role"]
        if role == "patient":
            if not app_user.get("patient_id"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Patient profile is missing patient_id link",
                )
            patient = self._get_patient(UUID(app_user["patient_id"]))
            if not patient:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
            perms = self.get_tab_permissions(UUID(app_user["id"]))
            return {
                "user_id": UUID(app_user["id"]),
                "role": "patient",
                "patient_id": UUID(app_user["patient_id"]),
                "patient_name": patient["name"],
                "can_mark_done": perms.get("can_mark_done", True),
            }

        link_result = (
            self.supabase.table("patient_caregiver_link")
            .select("*")
            .eq("caregiver_user_id", app_user["id"])
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not link_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Caregiver is not linked to an active patient",
            )
        link = link_result.data[0]
        patient = self._get_patient(UUID(link["patient_id"]))
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        perms = self.get_tab_permissions(UUID(app_user["id"]))
        can_mark = perms.get("can_mark_done", link.get("can_mark_done", True))
        return {
            "user_id": UUID(app_user["id"]),
            "role": "caregiver",
            "patient_id": UUID(link["patient_id"]),
            "patient_name": patient["name"],
            "relationship": link.get("relationship"),
            "can_mark_done": can_mark,
        }

    def _get_patient(self, patient_id: UUID) -> Optional[Dict[str, Any]]:
        result = (
            self.supabase.table("patient")
            .select("id, name")
            .eq("id", str(patient_id))
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    def assert_can_access_patient(self, user: Dict[str, Any], patient_id: UUID) -> Dict[str, Any]:
        ctx = self.resolve_context_from_token(user)
        if UUID(str(ctx["patient_id"])) != patient_id:
            role = user.get("role")
            if role not in ("rmp", "coordinator", "auditor"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized for this patient",
                )
        return ctx

    def get_tab_permissions(self, app_user_id: UUID) -> Dict[str, bool]:
        result = (
            self.supabase.table("patient_tab_permissions")
            .select("*")
            .eq("user_id", str(app_user_id))
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return {k: row[k] for k in row if k.startswith("can_")}
        return {
            "can_see_today": True,
            "can_see_plan": True,
            "can_see_medicines": True,
            "can_see_ask": True,
            "can_see_more": True,
            "can_see_warning_signs": True,
            "can_see_tests": True,
            "can_see_find_care": True,
            "can_see_reminders": True,
            "can_mark_done": True,
        }

    def update_language(self, app_user_id: UUID, language: str) -> None:
        from datetime import datetime, timezone

        self.supabase.table("patient_app_user").update(
            {
                "preferred_language": language,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", str(app_user_id)).execute()

    def set_caregiver_mark_done(self, app_user_id: UUID, allowed: bool) -> None:
        existing = (
            self.supabase.table("patient_tab_permissions")
            .select("user_id")
            .eq("user_id", str(app_user_id))
            .execute()
        )
        if existing.data:
            self.supabase.table("patient_tab_permissions").update(
                {"can_mark_done": allowed}
            ).eq("user_id", str(app_user_id)).execute()
        else:
            self.supabase.table("patient_tab_permissions").insert(
                {"user_id": str(app_user_id), "can_mark_done": allowed}
            ).execute()
        self.supabase.table("patient_caregiver_link").update(
            {"can_mark_done": allowed}
        ).eq("caregiver_user_id", str(app_user_id)).execute()
