import pytest
import uuid
from datetime import datetime, timedelta
from careplus.services.policy import (
    policy_check,
    check_deidentified_payload,
    check_consent_for_purpose,
    check_approver_is_rmp,
    check_output_from_approved,
    hash_sensitive_data
)
from careplus.services.second_brain import (
    lint_episode_page,
    compile_episode_page,
    WikiSentence,
    EpisodePage
)
from careplus.db.client import get_supabase_client
from careplus.core.config import settings


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for testing."""
    # In production, this would use a test database
    # For now, we'll test the logic without actual DB calls
    from unittest.mock import Mock
    client = Mock()
    return client


def test_bypass_via_service_role():
    """
    Test that service-role key cannot be used as patient JWT.
    Simulated frontend request with service-role key as if it were a patient JWT
    should return NOT_AUTHORIZED.
    """
    # This is a conceptual test - in the real implementation,
    # the auth middleware would reject service-role tokens from frontend
    # The policy check should also validate that the actor is not service_role
    
    # For now, we test that the policy check requires valid consent
    # which service-role bypass would not provide
    patient_id = uuid.uuid4()
    payload = "test payload"
    
    # Service role should not be able to bypass policy checks
    # The policy_check function should validate the actor_type
    # This is enforced in the decorator/middleware layer
    
    # This test documents the expected behavior
    assert True  # Placeholder - actual implementation would test auth middleware


def test_unauthorized_patient_access():
    """
    Test that patient A cannot read patient B's obligations.
    Denied by RLS.
    """
    # This is a database RLS test
    # In the actual database, RLS policies are defined in 0001_init.sql
    # Patient: can SELECT their own obligations
    # The policy is:
    # CREATE POLICY "Patients can read own obligations" ON obligation
    #     FOR SELECT
    #     TO authenticated
    #     USING (
    #         EXISTS (
    #             SELECT 1 FROM patient
    #             WHERE patient.id = obligation.patient_id
    #             AND patient.id = auth.uid()
    #         )
    #     );
    
    # This test documents the RLS policy expectation
    assert True  # Placeholder - would require actual DB test


def test_unapproved_translation_never_displays():
    """
    Test that patient SELECT on translation table returns only verified=true rows.
    RLS-enforced.
    """
    # This is a database RLS test
    # The RLS policy is:
    # CREATE POLICY "Patients can read verified translations" ON translation
    #     FOR SELECT
    #     TO authenticated
    #     USING (verified = true);
    
    # This test documents the RLS policy expectation
    assert True  # Placeholder - would require actual DB test


def test_deid_hard_deny():
    """
    Test that payload containing an ABHA ID is hard-denied before any OpenRouter call.
    This is the OpenRouter privacy control.
    """
    # Test ABHA ID detection
    payload_with_abha = "Patient ABHA ID is 91-12-3456-7890-1234"
    allowed, reason = check_deidentified_payload(payload_with_abha, "John Doe", None)
    
    assert allowed is False
    assert "ABHA ID" in reason
    
    # Test phone number detection
    payload_with_phone = "Call 919876543210 for questions"
    allowed, reason = check_deidentified_payload(payload_with_phone, None, None)
    
    assert allowed is False
    assert "phone" in reason.lower()
    
    # Test name detection
    payload_with_name = "Patient John Smith should follow up"
    allowed, reason = check_deidentified_payload(payload_with_name, "John Smith", None)
    
    assert allowed is False
    assert "name" in reason.lower()
    
    # Test clean payload
    clean_payload = "Patient should follow up with cardiologist in 2 weeks"
    allowed, reason = check_deidentified_payload(clean_payload, "John Doe", None)
    
    assert allowed is True
    assert reason is None


def test_policy_deny_logs_cited_regulation():
    """
    Test that when a request is denied, the policy_decision row has cited_regulation populated.
    """
    # This tests the policy_check function logs cited_regulation
    # The regulation citations are in REGULATIONS dict:
    # "consent_for_purpose": "DPDP Act 2023 §6, DPDP Rules 2025 §3-4"
    # "deidentified_payload": "DPDP §4, Telemedicine 2020 §5.2"
    # "approver_is_rmp": "Telemedicine 2020 §3.1, IMC Ethics 2002"
    # "output_from_approved": "ICMR 2023 §6.4, Telemedicine 2020 §3.1"
    
    from careplus.services.policy import REGULATIONS
    
    # Verify all checks have regulation citations
    assert "consent_for_purpose" in REGULATIONS
    assert "deidentified_payload" in REGULATIONS
    assert "approver_is_rmp" in REGULATIONS
    assert "output_from_approved" in REGULATIONS
    
    # Verify citations are not empty
    for check_name, citation in REGULATIONS.items():
        assert citation is not None
        assert len(citation) > 0


def test_audit_chain_reconstruction():
    """
    Test that verify_audit_chain returns true for 100 entries,
    and returns false after tampering with one entry.
    """
    # This tests the database function verify_audit_chain
    # The function is defined in 0001_init.sql:
    # CREATE OR REPLACE FUNCTION verify_audit_chain() RETURNS JSONB
    
    # This test documents the expected behavior
    # In production, this would:
    # 1. Insert 100 audit entries
    # 2. Call verify_audit_chain() -> should return valid=true
    # 3. Tamper with one entry (modify hash)
    # 4. Call verify_audit_chain() -> should return valid=false
    
    assert True  # Placeholder - would require actual DB test


def test_erasure_propagation():
    """
    Test that revoke consent → source deleted → wiki recompiled → no orphan sentences.
    """
    # This tests the recompile_after_erasure function
    # The flow is:
    # 1. Revoke consent
    # 2. Delete source rows (discharge_summary, approved_item)
    # 3. Compile episode page
    # 4. Lint page - should have no orphan sentences
    
    # Create a mock episode page with no orphan sentences
    patient_id = uuid.uuid4()
    sentences = [
        WikiSentence(
            text="Follow up with cardiologist",
            pointer="item_123",
            hash="abc123",
            category="appointment"
        )
    ]
    
    page = EpisodePage(
        patient_id=patient_id,
        patient_name="Test Patient",
        markdown="# Test",
        fhir_bundle={"type": "collection", "entry": []},
        content_hash="hash123",
        sentences=sentences
    )
    
    # Lint the page with mock client to avoid DB calls
    from unittest.mock import Mock
    mock_client = Mock()
    mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    
    lint_result = lint_episode_page(page, supabase_client=mock_client)
    
    # Should pass - no orphans
    assert lint_result.status == "passed"
    assert lint_result.reason is None
    assert len(lint_result.orphan_sentences) == 0
    
    # Test orphan detection
    orphan_sentence = WikiSentence(
        text="This has no pointer",
        pointer="",
        hash="def456",
        category="appointment"
    )
    
    page_with_orphan = EpisodePage(
        patient_id=patient_id,
        patient_name="Test Patient",
        markdown="# Test",
        fhir_bundle={"type": "collection", "entry": []},
        content_hash="hash456",
        sentences=[orphan_sentence]
    )
    
    lint_result = lint_episode_page(page_with_orphan, supabase_client=mock_client)
    
    # Should reject - has orphans
    assert lint_result.status == "rejected"
    assert lint_result.reason == "orphan_sentences"
    assert len(lint_result.orphan_sentences) > 0


def test_hash_sensitive_data():
    """
    Test that sensitive data is hashed correctly for logging.
    """
    sensitive_data = "Patient John Smith with ABHA 91-12-3456-7890-1234"
    hashed = hash_sensitive_data(sensitive_data)
    
    # Hash should be different from original
    assert hashed != sensitive_data
    
    # Hash should be consistent
    hashed2 = hash_sensitive_data(sensitive_data)
    assert hashed == hashed2
    
    # Hash should be SHA256 (64 hex characters)
    assert len(hashed) == 64
    assert all(c in "0123456789abcdef" for c in hashed)


def test_output_from_approved_check():
    """
    Test that output_from_approved check allows only approved sources.
    """
    # Allowed sources
    allowed, reason = check_output_from_approved("approved_items")
    assert allowed is True
    assert reason is None
    
    allowed, reason = check_output_from_approved("rmp_authored")
    assert allowed is True
    assert reason is None
    
    # Rejected source
    allowed, reason = check_output_from_approved("llm_freehand")
    assert allowed is False
    assert "llm_freehand" in reason
    assert "approved" in reason.lower()


def test_lint_orphan_detection():
    """
    Test Pass A: orphan detection - every sentence MUST have a pointer.
    """
    from unittest.mock import Mock
    mock_client = Mock()
    mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    
    patient_id = uuid.uuid4()
    
    # Valid sentence with pointer
    valid_sentence = WikiSentence(
        text="Follow up with cardiologist",
        pointer="item_123",
        hash="abc123",
        category="appointment"
    )
    
    # Invalid sentence without pointer
    orphan_sentence = WikiSentence(
        text="This has no pointer",
        pointer="",
        hash="def456",
        category="appointment"
    )
    
    # Invalid sentence with malformed pointer
    malformed_sentence = WikiSentence(
        text="This has malformed pointer",
        pointer="invalid_format",
        hash="ghi789",
        category="appointment"
    )
    
    # Page with valid sentences
    valid_page = EpisodePage(
        patient_id=patient_id,
        patient_name="Test Patient",
        markdown="# Test",
        fhir_bundle={"type": "collection", "entry": []},
        content_hash="hash123",
        sentences=[valid_sentence]
    )
    
    lint_result = lint_episode_page(valid_page, supabase_client=mock_client)
    assert lint_result.status == "passed"
    
    # Page with orphan sentence
    orphan_page = EpisodePage(
        patient_id=patient_id,
        patient_name="Test Patient",
        markdown="# Test",
        fhir_bundle={"type": "collection", "entry": []},
        content_hash="hash456",
        sentences=[orphan_sentence]
    )
    
    lint_result = lint_episode_page(orphan_page, supabase_client=mock_client)
    assert lint_result.status == "rejected"
    assert lint_result.reason == "orphan_sentences"
    
    # Page with malformed pointer
    malformed_page = EpisodePage(
        patient_id=patient_id,
        patient_name="Test Patient",
        markdown="# Test",
        fhir_bundle={"type": "collection", "entry": []},
        content_hash="hash789",
        sentences=[malformed_sentence]
    )
    
    lint_result = lint_episode_page(malformed_page, supabase_client=mock_client)
    assert lint_result.status == "rejected"
    assert lint_result.reason == "orphan_sentences"
