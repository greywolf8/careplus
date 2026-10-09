import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime
from careplus.core.logging import logger


def compute_content_hash(structured_data: Dict[str, Any], source_quote: str) -> str:
    """
    Compute SHA256 hash of structured data + source quote for approval signing.

    Args:
        structured_data: The structured obligation data
        source_quote: The exact quote from the discharge document

    Returns:
        SHA256 hash as hex string
    """
    content = json.dumps(structured_data, sort_keys=True) + source_quote
    return hashlib.sha256(content.encode()).hexdigest()


def obligation_to_fhir_task(obligation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map an obligation to a FHIR R4 Task resource.

    Maps fields:
    - status → Task.status
    - intent → Task.intent (order)
    - code → Task.code (category of obligation)
    - focus → Task.focus (reference to related resource if any)
    - for → Task.for (patient reference)
    - owner → Task.owner (practitioner reference)
    - requester → Task.requester (practitioner who created the task)
    - executionPeriod → Task.executionPeriod (due date)
    - businessStatus → Task.businessStatus (awaiting-approval/awaiting-closure/closed)
    - input → Task.input (discharge span pointer)

    Args:
        obligation: Obligation object with required fields

    Returns:
        FHIR R4 Task resource as dict
    """
    # Map obligation state to FHIR Task status
    status_map = {
        "drafted": "draft",
        "awaiting_approval": "draft",
        "approved": "ready",
        "pending": "ready",
        "in_progress": "in-progress",
        "completed": "completed",
        "failed": "failed",
        "on_hold": "on-hold",
        "cancelled": "cancelled"
    }

    fhir_status = status_map.get(obligation.get("state", "drafted"), "draft")

    # Map state to businessStatus
    business_status_map = {
        "drafted": "awaiting-approval",
        "awaiting_approval": "awaiting-approval",
        "approved": "awaiting-closure",
        "pending": "awaiting-closure",
        "in_progress": "awaiting-closure",
        "completed": "closed",
        "failed": "closed",
        "on_hold": "on-hold",
        "cancelled": "closed"
    }

    business_status = business_status_map.get(obligation.get("state", "drafted"), "awaiting-approval")

    task = {
        "resourceType": "Task",
        "status": fhir_status,
        "intent": "order",
        "code": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/obligation-category",
                "code": obligation.get("item_type", "unknown"),
                "display": obligation.get("item_type", "Unknown")
            }]
        },
        "description": obligation.get("content", ""),
        "businessStatus": {
            "text": business_status
        },
        "for": {
            "reference": f"Patient/{obligation.get('patient_id')}",
            "display": "Patient"
        }
    }

    # Add owner if present
    if obligation.get("owner_practitioner_id"):
        task["owner"] = {
            "reference": f"Practitioner/{obligation.get('owner_practitioner_id')}",
            "display": "Practitioner"
        }

    # Add requester if present
    if obligation.get("requester_id"):
        task["requester"] = {
            "reference": f"Practitioner/{obligation.get('requester_id')}",
            "display": "Practitioner"
        }

    # Add execution period (due date)
    if obligation.get("due_date"):
        try:
            due_date = datetime.fromisoformat(obligation["due_date"].replace("Z", "+00:00"))
            task["executionPeriod"] = {
                "start": datetime.now().isoformat(),
                "end": due_date.isoformat()
            }
        except (ValueError, AttributeError):
            pass

    # Add input with discharge span pointer
    if obligation.get("source_span"):
        task["input"] = [{
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/task-input-type",
                    "code": "source-span",
                    "display": "Source Document Span"
                }]
            },
            "valueString": json.dumps(obligation["source_span"])
        }]

    return task


def approval_to_fhir_provenance(
    target_id: str,
    approver_rmp_id: str,
    approver_mci_reg: str,
    content_hash: str,
    approved_at: datetime
) -> Dict[str, Any]:
    """
    Map an approval to a FHIR R4 Provenance resource.

    Args:
        target_id: ID of the approved obligation
        approver_rmp_id: ID of the approving practitioner
        approver_mci_reg: MCI registration number
        content_hash: SHA256 hash of approved content
        approved_at: Timestamp of approval

    Returns:
        FHIR R4 Provenance resource as dict
    """
    provenance = {
        "resourceType": "Provenance",
        "target": [{
            "reference": f"Task/{target_id}",
            "type": "Task"
        }],
        "recorded": approved_at.isoformat(),
        "agent": [{
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/provenance-agent-type",
                    "code": "author",
                    "display": "Author"
                }]
            },
            "who": {
                "reference": f"Practitioner/{approver_rmp_id}",
                "display": f"RMP (MCI: {approver_mci_reg})"
            }
        }],
        "signature": [{
            "type": [{
                "system": "urn:iso-astm:E1762-96:2013",
                "code": "1.2.840.10065.1.12.1.1",
                "display": "Author's Signature"
            }],
            "when": approved_at.isoformat(),
            "who": {
                "reference": f"Practitioner/{approver_rmp_id}"
            },
            "data": content_hash  # Store content hash as signature data
        }]
    }

    return provenance


def obligations_to_fhir_bundle(
    obligations: list,
    patient_id: str
) -> Dict[str, Any]:
    """
    Convert a list of obligations to a FHIR Bundle.

    Args:
        obligations: List of obligation objects
        patient_id: Patient ID for the bundle

    Returns:
        FHIR Bundle resource containing Task resources
    """
    entries = []

    for obligation in obligations:
        task = obligation_to_fhir_task(obligation)
        entries.append({
            "fullUrl": f"urn:uuid:{obligation.get('id')}",
            "resource": task,
            "request": {
                "method": "POST",
                "url": "Task"
            }
        })

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.now().isoformat(),
        "entry": entries
    }

    return bundle
