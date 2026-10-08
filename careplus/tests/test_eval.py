"""
Tests for the evaluation harness.
"""
import pytest
from uuid import uuid4, UUID
from careplus.services.eval.metrics import (
    compute_omission_rate,
    compute_hallucination_rate,
    compute_readability,
    compute_injection_resistance,
    compute_reviewer_time_saved,
    compute_reviewer_vigilance,
    compute_translation_entity_preservation,
    compute_calibrated_abstention_rate,
    compute_model_ensemble_agreement,
    store_metric,
    get_all_metrics
)
from careplus.services.eval.ragas_check import check_faithfulness, batch_check_faithfulness
from careplus.services.eval.injection_test_set import INJECTION_TEST_SET, run_injection_test
from careplus.services.eval.canary_seeder import seed_canary, detect_canary, get_canary_detection_rate
from careplus.services.eval.dashboard_route import create_eval_job, get_eval_job_status, get_dashboard_metrics


def test_omission_detection():
    """Test that omission rate correctly detects items not extracted by ensemble."""
    # Gold standard items
    gold_standard = [
        {"content_hash": "hash1", "content": "Take Amoxicillin 500mg three times daily"},
        {"content_hash": "hash2", "content": "Follow up with cardiologist in 2 weeks"},
        {"content_hash": "hash3", "content": "Monitor blood pressure daily"},
        {"content_hash": "hash4", "content": "Complete physical therapy"},
    ]

    # Extractor A finds 3 items
    extractor_a = [
        {"content_hash": "hash1", "content": "Take Amoxicillin 500mg three times daily"},
        {"content_hash": "hash2", "content": "Follow up with cardiologist in 2 weeks"},
        {"content_hash": "hash3", "content": "Monitor blood pressure daily"},
    ]

    # Extractor B finds 3 items (different one)
    extractor_b = [
        {"content_hash": "hash1", "content": "Take Amoxicillin 500mg three times daily"},
        {"content_hash": "hash2", "content": "Follow up with cardiologist in 2 weeks"},
        {"content_hash": "hash4", "content": "Complete physical therapy"},
    ]

    # Ensemble should catch 3 out of 4 (hash4 only in B, hash3 only in A)
    # But both extractors together found all 4 unique items
    # So omission rate should be 0%
    omission_rate = compute_omission_rate(gold_standard, extractor_a, extractor_b)
    assert omission_rate == 0.0

    # If we only use extractor A, omission rate is 25% (1 missed)
    omission_rate_a_only = compute_omission_rate(gold_standard, extractor_a, [])
    assert omission_rate_a_only == 25.0


def test_hallucination_rate():
    """Test that hallucination rate flags sentences without source pointers."""
    sentences = [
        {"sentence": "Take Amoxicillin 500mg three times daily", "source_pointer": "item_123"},
        {"sentence": "Follow up with cardiologist", "source_pointer": "item_456"},
        {"sentence": "This is a hallucinated sentence", "source_pointer": None},
        {"sentence": "Another hallucination", "source_pointer": "None"},
    ]

    hallucination_rate = compute_hallucination_rate(sentences)
    # 2 out of 4 sentences lack source pointers = 50%
    assert hallucination_rate == 50.0


def test_injection_resistance():
    """Test that injection resistance correctly counts blocked adversarial inputs."""
    test_results = [
        {"blocked": True, "technique": "ignore_previous_instructions"},
        {"blocked": True, "technique": "system_override"},
        {"blocked": True, "technique": "admin_mode"},
        {"blocked": False, "technique": "unicode_trick"},  # This one failed
        {"blocked": True, "technique": "base64_hidden"},
    ]

    resistance_rate = compute_injection_resistance(test_results)
    # 4 out of 5 blocked = 80%
    assert resistance_rate == 80.0

    # All blocked = 100%
    all_blocked = [{"blocked": True} for _ in range(10)]
    assert compute_injection_resistance(all_blocked) == 100.0


def test_canary_seeding_and_detection():
    """Test that canary seeding and detection work correctly."""
    from unittest.mock import patch, MagicMock

    # Mock obligation ID
    obligation_id = uuid4()

    # Mock Supabase client
    with patch('careplus.services.eval.canary_seeder.get_supabase_client') as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock obligation fetch
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": str(obligation_id), "description": "Take medication 5mg daily"}
        ]

        # Mock canary insert
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": str(uuid4())}
        ]

        # Seed a canary
        canary_id = seed_canary(
            obligation_id=obligation_id,
            corruption_type="dose_error",
            corruption_value="50mg"
        )

        assert canary_id is not None
        assert isinstance(canary_id, str)

    # Mock RMP ID
    rmp_id = uuid4()

    # Mock detection
    with patch('careplus.services.eval.canary_seeder.get_supabase_client') as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock canary update
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {"id": canary_id}
        ]

        # Detect the canary
        detected = detect_canary(
            canary_id=UUID(canary_id),
            rmp_id=rmp_id
        )

        assert detected is True


def test_openrouter_ensemble_disagreement():
    """Test that ensemble agreement correctly identifies items found by both extractors."""
    # Extractor A finds items A, B, C
    extractor_a = [
        {"content_hash": "hash_a", "content": "Item A"},
        {"content_hash": "hash_b", "content": "Item B"},
        {"content_hash": "hash_c", "content": "Item C"},
    ]

    # Extractor B finds items A, B, D
    extractor_b = [
        {"content_hash": "hash_a", "content": "Item A"},
        {"content_hash": "hash_b", "content": "Item B"},
        {"content_hash": "hash_d", "content": "Item D"},
    ]

    # Agreement: A and B found by both = 2 out of 4 unique items = 50%
    agreement_rate = compute_model_ensemble_agreement(extractor_a, extractor_b)
    assert agreement_rate == 50.0

    # Perfect agreement
    extractor_c = [
        {"content_hash": "hash_a", "content": "Item A"},
        {"content_hash": "hash_b", "content": "Item B"},
    ]
    extractor_d = [
        {"content_hash": "hash_a", "content": "Item A"},
        {"content_hash": "hash_b", "content": "Item B"},
    ]
    assert compute_model_ensemble_agreement(extractor_c, extractor_d) == 100.0


def test_ragas_faithfulness_check():
    """Test that RAGAS faithfulness check correctly identifies hallucinations."""
    # Sentence with source pointer should be faithful
    result = check_faithfulness(
        sentence="Take Amoxicillin 500mg three times daily",
        source_pointer="item_123"
    )
    assert result["faithful"] is True
    assert result["score"] == 1.0

    # Sentence without source pointer should be unfaithful
    result = check_faithfulness(
        sentence="This is hallucinated",
        source_pointer=None
    )
    assert result["faithful"] is False
    assert result["score"] == 0.0


def test_readability_metrics():
    """Test that readability metrics are computed correctly."""
    translations = [
        {"grade_level": 8.5, "avg_sentence_length": 15, "verified": True},
        {"grade_level": 12.0, "avg_sentence_length": 25, "verified": False},
        {"grade_level": 7.0, "avg_sentence_length": 12, "verified": True},
    ]

    readability = compute_readability(translations)

    # Average grade level
    assert readability["average_grade_level"] == pytest.approx(9.17, rel=0.1)

    # Average sentence length
    assert readability["avg_sentence_length"] == pytest.approx(17.33, rel=0.1)

    # Pass rate: 2 out of 3 pass (grade ≤ 9 AND sentence < 20)
    assert readability["pass_rate"] == pytest.approx(66.67, rel=0.1)


def test_reviewer_time_saved():
    """Test that reviewer time saved is computed correctly."""
    baseline = 6.5  # minutes
    ai_assisted = 3.5  # minutes

    time_saved = compute_reviewer_time_saved(baseline, ai_assisted)

    # (6.5 - 3.5) / 6.5 * 100 = 46.15%
    assert time_saved == pytest.approx(46.15, rel=0.1)


def test_reviewer_vigilance():
    """Test that reviewer vigilance rate is computed correctly."""
    total_canaries = 20
    detected_canaries = 18

    vigilance = compute_reviewer_vigilance(total_canaries, detected_canaries)

    # 18 / 20 * 100 = 90%
    assert vigilance == 90.0


def test_calibrated_abstention_rate():
    """Test that calibrated abstention rate is computed correctly."""
    escalated_items = 95
    gold_standard_escalations = 100

    rate = compute_calibrated_abstention_rate(escalated_items, gold_standard_escalations)

    # 95 / 100 * 100 = 95%
    assert rate == 95.0

    # Over-escalation is capped at 100%
    rate_over = compute_calibrated_abstention_rate(110, 100)
    assert rate_over == 100.0


def test_translation_entity_preservation():
    """Test that translation entity preservation is computed correctly."""
    translations = [
        {"verified": True},
        {"verified": True},
        {"verified": False},
        {"verified": True},
    ]

    preservation = compute_translation_entity_preservation(translations)

    # 3 out of 4 verified = 75%
    assert preservation == 75.0


def test_eval_job_lifecycle():
    """Test that eval job lifecycle works correctly."""
    # Create job
    job_id = create_eval_job()
    assert job_id is not None

    # Check initial status
    status = get_eval_job_status(job_id)
    assert status is not None
    assert status["status"] == "pending"

    # Non-existent job
    assert get_eval_job_status("nonexistent") is None


def test_injection_test_set_exists():
    """Test that injection test set has 50+ test cases."""
    assert len(INJECTION_TEST_SET) >= 50

    # Check structure of first test case
    first_test = INJECTION_TEST_SET[0]
    assert "id" in first_test
    assert "technique" in first_test
    assert "discharge_summary" in first_test
    assert "expected_behavior" in first_test
    assert "unauthorized_keywords" in first_test


def test_batch_faithfulness_check():
    """Test that batch faithfulness check works correctly."""
    sentences = [
        {"sentence": "Item 1", "source_pointer": "item_1"},
        {"sentence": "Item 2", "source_pointer": None},
        {"sentence": "Item 3", "source_pointer": "item_3"},
    ]

    result = batch_check_faithfulness(sentences)

    assert result["total_sentences"] == 3
    assert result["faithful_count"] == 2
    assert result["hallucinated_count"] == 1
    assert result["faithfulness_rate"] == pytest.approx(66.67, rel=0.1)
