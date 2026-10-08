import re
import hashlib
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import UUID, uuid4

from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


# Regulation citations
REGULATIONS = {
    "consent_for_purpose": "DPDP Act 2023 §6, DPDP Rules 2025 §3-4",
    "deidentified_payload": "DPDP §4, Telemedicine 2020 §5.2",
    "approver_is_rmp": "Telemedicine 2020 §3.1, IMC Ethics 2002",
    "output_from_approved": "ICMR 2023 §6.4, Telemedicine 2020 §3.1"
}


def hash_sensitive_data(data: str) -> str:
    """
    Hash sensitive data for logging purposes.
    Never log full patient questions, discharge summaries, or medication info.
    """
    return hashlib.sha256(data.encode()).hexdigest()


def check_consent_for_purpose(
    patient_id: UUID,
    purpose: str,
    supabase_client
) -> tuple[bool, Optional[str]]:
    """
    Check if patient has valid consent for the given purpose.
    
    Valid consent: granted_at <= now AND expires_at > now AND revoked_at IS NULL
    
    Cite: DPDP Act 2023 §6, DPDP Rules 2025 §3-4
    """
    now = datetime.now().isoformat()
    
    result = supabase_client.table("consent").select("*").eq("patient_id", str(patient_id)).eq("purpose", purpose).execute()
    
    if not result.data:
        return False, "No consent record found for this patient and purpose"
    
    for consent in result.data:
        granted_at = consent.get("granted_at")
        expires_at = consent.get("expires_at")
        revoked_at = consent.get("revoked_at")
        
        # Check if consent is valid
        if revoked_at is not None:
            continue  # Consent has been revoked
        
        if expires_at and expires_at < now:
            continue  # Consent has expired
        
        if granted_at > now:
            continue  # Invalid: granted in the future
        
        return True, None
    
    return False, "No valid, non-revoked consent found for this purpose"


def check_deidentified_payload(
    payload: str,
    patient_name: Optional[str],
    supabase_client
) -> tuple[bool, Optional[str]]:
    """
    Check if payload contains no PII:
    - No ABHA IDs (regex 91-XX-XXXX-XXXX-XXXX)
    - No names (compared to patient table)
    - No phone numbers (regex 91 followed by 10 digits)
    
    This is the PRIMARY privacy control for OpenRouter.
    Hard deny if check fails - do not silently proceed.
    
    Cite: DPDP §4, Telemedicine 2020 §5.2
    """
    # Check for ABHA ID pattern (91-XX-XXXX-XXXX-XXXX where XX are 2 digits)
    abha_pattern = r'91-\d{2}-\d{4}-\d{4}-\d{4}'
    if re.search(abha_pattern, payload):
        return False, "Payload contains ABHA ID"
    
    # Check for Indian phone numbers (91 followed by 10 digits)
    phone_pattern = r'91\d{10}'
    if re.search(phone_pattern, payload):
        return False, "Payload contains phone number"
    
    # Check for patient name if provided
    if patient_name:
        # Split name into parts and check each
        name_parts = patient_name.lower().split()
        payload_lower = payload.lower()
        for part in name_parts:
            if len(part) > 2 and part in payload_lower:
                return False, f"Payload contains patient name '{part}'"
    
    return True, None


def check_approver_is_rmp(
    rmp_id: UUID,
    mci_reg_number: str,
    supabase_client
) -> tuple[bool, Optional[str]]:
    """
    Verify that the approver is a valid RMP with matching MCI registration.
    
    Cite: Telemedicine 2020 §3.1, IMC Ethics 2002
    """
    result = supabase_client.table("rmp").select("*").eq("id", str(rmp_id)).execute()
    
    if not result.data:
        return False, "RMP not found in database"
    
    rmp = result.data[0]
    db_mci_reg = rmp.get("mci_reg_number")
    
    if db_mci_reg != mci_reg_number:
        return False, f"MCI registration number mismatch: provided {mci_reg_number}, expected {db_mci_reg}"
    
    return True, None


def check_output_from_approved(
    output_source: str
) -> tuple[bool, Optional[str]]:
    """
    Check that the operation output comes from an approved source.
    Allowed sources: approved_items, rmp_authored
    Rejected: llm_freehand
    
    Cite: ICMR 2023 §6.4, Telemedicine 2020 §3.1
    """
    allowed_sources = ["approved_items", "rmp_authored"]
    
    if output_source not in allowed_sources:
        return False, f"Output source '{output_source}' not in approved sources: {allowed_sources}"
    
    return True, None


async def policy_check(
    patient_id: UUID,
    purpose: str,
    payload: str,
    actor_id: UUID,
    actor_type: str,
    operation: str,
    output_source: Optional[str] = None,
    rmp_id: Optional[UUID] = None,
    mci_reg_number: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run mandatory policy checks before ANY AI operation.
    
    Four mandatory checks:
    1. consent_for_purpose: consent table has valid consent for patient + purpose
    2. deidentified_payload: payload contains no ABHA IDs, names, or phone numbers
    3. approver_is_rmp: rmp table verifies rmp_id + mci_reg_number (if rmp_id provided)
    4. output_from_approved: operation.output_source in (approved_items, rmp_authored)
    
    On deny: log to policy_decision + audit_log with cited_regulation. Return NOT_AUTHORIZED.
    On allow: log to audit_log. Proceed.
    
    IMPORTANT: deidentified_payload check is PRIMARY privacy control for OpenRouter.
    Hard deny if this check fails.
    
    Args:
        patient_id: Patient UUID
        purpose: Purpose of the operation (e.g., "data_processing", "translation")
        payload: The data payload to check for PII
        actor_id: UUID of the actor performing the operation
        actor_type: Type of actor (patient, rmp, system)
        operation: The operation being performed (e.g., "extract", "translate")
        output_source: Source of the output (if applicable)
        rmp_id: RMP UUID (if approver check needed)
        mci_reg_number: MCI registration number (if approver check needed)
    
    Returns:
        Dict with 'allowed' (bool) and 'reason' (str if denied)
    """
    supabase = get_supabase_client(use_service_role=True)
    
    # Get patient name for deidentification check
    patient_result = supabase.table("patient").select("name").eq("id", str(patient_id)).execute()
    patient_name = patient_result.data[0]["name"] if patient_result.data else None
    
    # Run all checks
    checks = []
    
    # Check 1: Consent for purpose
    consent_allowed, consent_reason = check_consent_for_purpose(patient_id, purpose, supabase)
    checks.append({
        "check_name": "consent_for_purpose",
        "allowed": consent_allowed,
        "reason": consent_reason,
        "cited_regulation": REGULATIONS["consent_for_purpose"]
    })
    
    # Check 2: Deidentified payload (PRIMARY privacy control)
    deid_allowed, deid_reason = check_deidentified_payload(payload, patient_name, supabase)
    checks.append({
        "check_name": "deidentified_payload",
        "allowed": deid_allowed,
        "reason": deid_reason,
        "cited_regulation": REGULATIONS["deidentified_payload"]
    })
    
    # Check 3: Approver is RMP (if rmp_id provided)
    if rmp_id and mci_reg_number:
        rmp_allowed, rmp_reason = check_approver_is_rmp(rmp_id, mci_reg_number, supabase)
        checks.append({
            "check_name": "approver_is_rmp",
            "allowed": rmp_allowed,
            "reason": rmp_reason,
            "cited_regulation": REGULATIONS["approver_is_rmp"]
        })
    
    # Check 4: Output from approved source (if output_source provided)
    if output_source:
        output_allowed, output_reason = check_output_from_approved(output_source)
        checks.append({
            "check_name": "output_from_approved",
            "allowed": output_allowed,
            "reason": output_reason,
            "cited_regulation": REGULATIONS["output_from_approved"]
        })
    
    # Determine overall result
    failed_checks = [c for c in checks if not c["allowed"]]
    overall_allowed = len(failed_checks) == 0
    
    # Log to audit_log
    audit_log_id = await log_audit_entry(
        supabase=supabase,
        actor_type=actor_type,
        actor_id=actor_id,
        action=f"policy_check:{operation}",
        entity_type="policy_check",
        entity_id=uuid4(),  # Use UUID for policy check event
        old_values=None,
        new_values={
            "patient_id": str(patient_id),
            "purpose": purpose,
            "payload_hash": hash_sensitive_data(payload),
            "operation": operation,
            "output_source": output_source,
            "checks_performed": len(checks),
            "checks_passed": len([c for c in checks if c["allowed"]])
        }
    )
    
    # Log to policy_decision for each check
    for check in checks:
        supabase.table("policy_decision").insert({
            "audit_log_id": str(audit_log_id),
            "check_name": check["check_name"],
            "cited_regulation": check["cited_regulation"],
            "allowed": check["allowed"],
            "reason": check["reason"]
        }).execute()
    
    # Hard deny on deidentification failure
    if not deid_allowed:
        logger.error(
            "policy_hard_deny",
            check="deidentified_payload",
            reason=deid_reason,
            patient_id=str(patient_id),
            operation=operation
        )
        return {
            "allowed": False,
            "reason": f"Deidentification check failed: {deid_reason}",
            "cited_regulation": REGULATIONS["deidentified_payload"],
            "hard_deny": True
        }
    
    # Return result
    if not overall_allowed:
        failed_reasons = [f"{c['check_name']}: {c['reason']}" for c in failed_checks]
        logger.warning(
            "policy_deny",
            patient_id=str(patient_id),
            operation=operation,
            reasons=failed_reasons
        )
        return {
            "allowed": False,
            "reason": "; ".join(failed_reasons),
            "cited_regulation": "; ".join([c["cited_regulation"] for c in failed_checks])
        }
    
    logger.info(
        "policy_allow",
        patient_id=str(patient_id),
        operation=operation,
        checks_passed=len([c for c in checks if c["allowed"]])
    )
    
    return {
        "allowed": True,
        "reason": None
    }


async def log_audit_entry(
    supabase,
    actor_type: str,
    actor_id: UUID,
    action: str,
    entity_type: str,
    entity_id: UUID,
    old_values: Optional[Dict[str, Any]],
    new_values: Optional[Dict[str, Any]]
) -> UUID:
    """
    Insert an audit log entry.
    The trigger will compute the hash and prev_hash automatically.
    
    Returns the audit_log_id of the inserted entry.
    """
    result = supabase.table("audit_log").insert({
        "actor_type": actor_type,
        "actor_id": str(actor_id),
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "old_values": json.dumps(old_values) if old_values else None,
        "new_values": json.dumps(new_values) if new_values else None
    }).execute()
    
    return UUID(result.data[0]["id"])
