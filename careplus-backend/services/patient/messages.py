from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from careplus.services.routing import deterministic_route


class PatientMessagesService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def list_messages(self, patient_id: UUID) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("patient_message")
            .select("*")
            .eq("patient_id", str(patient_id))
            .order("created_at")
            .execute()
        )
        return result.data or []

    def insert_message(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        inserted = self.supabase.table("patient_message").insert(payload).execute()
        return inserted.data[0]

    async def submit_question(
        self,
        patient_id: UUID,
        question: str,
        sender_name: str,
        language: str = "en",
        plan_answer_handler=None,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Persist patient question, route via deterministic layer (+ optional plan answer),
        and persist system/care-team follow-up messages when applicable.
        """
        patient_msg = self.insert_message(
            {
                "patient_id": str(patient_id),
                "sender": "patient",
                "sender_name": sender_name,
                "body": question,
                "message_type": "question",
            }
        )

        det = deterministic_route(question)
        response: Dict[str, Any] = {
            "route": "plan",
            "cited_item_ids": [],
            "escalated": False,
            "patient_message_id": patient_msg["id"],
        }

        if det.get("route") == "emergency":
            response.update(
                {
                    "route": "emergency",
                    "emergency_phone": "112",
                    "warning_signs": det.get("warning_signs", []),
                    "message": (
                        "EMERGENCY: If you are experiencing warning symptoms, dial 112 immediately "
                        "or seek immediate emergency care."
                    ),
                    "escalated": True,
                }
            )
            system_msg = self.insert_message(
                {
                    "patient_id": str(patient_id),
                    "sender": "system",
                    "sender_name": "CarePlus Coordinator",
                    "body": response["message"],
                    "message_type": "emergency_warning",
                }
            )
            response["system_message_id"] = system_msg["id"]
            return response, system_msg

        if det.get("route") == "medicine":
            answer = (
                "Your medication question has been logged and escalated to your care team. "
                "A clinician will review and respond directly."
            )
            response.update(
                {
                    "route": "medicine",
                    "answer": answer,
                    "escalated": True,
                    "escalation_reason": (
                        "Clinical Medication Safety Rule: Medication instructions must never be automated."
                    ),
                }
            )
            system_msg = self.insert_message(
                {
                    "patient_id": str(patient_id),
                    "sender": "system",
                    "sender_name": "CarePlus Coordinator",
                    "body": answer,
                    "message_type": "escalation",
                    "escalation_reason": response["escalation_reason"],
                }
            )
            response["system_message_id"] = system_msg["id"]
            return response, system_msg

        if det.get("route") == "symptom":
            answer = (
                "Your symptom update has been logged and escalated to your care team for clinical review. "
                "If symptoms are severe or worsening, please consult Warning Signs or call 112."
            )
            response.update(
                {
                    "route": "symptom",
                    "answer": answer,
                    "escalated": True,
                    "escalation_reason": (
                        "Clinical Symptom Evaluation Rule: Symptoms require clinical evaluation."
                    ),
                }
            )
            system_msg = self.insert_message(
                {
                    "patient_id": str(patient_id),
                    "sender": "system",
                    "sender_name": "CarePlus Coordinator",
                    "body": answer,
                    "message_type": "escalation",
                    "escalation_reason": response["escalation_reason"],
                }
            )
            response["system_message_id"] = system_msg["id"]
            return response, system_msg

        # PLAN route — optional LLM-grounded answer from approved items
        if plan_answer_handler is not None:
            try:
                plan_result = await plan_answer_handler(question=question, patient_id=patient_id)
                answer = plan_result.get("answer") or ""
                cited = plan_result.get("cited_item_ids") or []
                if answer:
                    response.update(
                        {
                            "route": "plan",
                            "answer": answer,
                            "cited_item_ids": cited,
                            "escalated": bool(plan_result.get("escalate")),
                        }
                    )
                    system_msg = self.insert_message(
                        {
                            "patient_id": str(patient_id),
                            "sender": "system",
                            "sender_name": "CarePlus Coordinator",
                            "body": answer,
                            "message_type": "plan_answer",
                            "cited_item_ids": [str(c) for c in cited],
                        }
                    )
                    response["system_message_id"] = system_msg["id"]
                    return response, system_msg
            except Exception:
                pass

        fallback = (
            "Your question has been logged. Your care team will review and respond directly."
        )
        response.update({"route": "plan", "answer": fallback, "escalated": False})
        system_msg = self.insert_message(
            {
                "patient_id": str(patient_id),
                "sender": "system",
                "sender_name": "CarePlus Coordinator",
                "body": fallback,
                "message_type": "plan_answer",
            }
        )
        response["system_message_id"] = system_msg["id"]
        return response, system_msg

    def add_patient_message(
        self, patient_id: UUID, text: str, sender_name: str, message_type: str = "question"
    ) -> Dict[str, Any]:
        if not text.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text required")
        return self.insert_message(
            {
                "patient_id": str(patient_id),
                "sender": "patient",
                "sender_name": sender_name,
                "body": text.strip(),
                "message_type": message_type,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
