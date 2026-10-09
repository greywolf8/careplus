from datetime import date

from careplus.services.patient.items import compute_section, refresh_effective_status


def test_compute_section_overdue():
    assert compute_section(date(2020, 1, 1), "pending", today=date(2026, 10, 8)) == "OVERDUE"


def test_compute_section_due_today():
    assert compute_section(date(2026, 10, 8), "pending", today=date(2026, 10, 8)) == "DUE TODAY"


def test_compute_section_next_up():
    assert compute_section(date(2026, 10, 15), "pending", today=date(2026, 10, 8)) == "NEXT UP"


def test_refresh_effective_status_marks_overdue():
    row = {"effective_status": "pending", "due_date": "2026-10-01"}
    assert refresh_effective_status(row, today=date(2026, 10, 8)) == "overdue"


def test_patient_mobile_openapi_paths():
    from careplus.api.main import app

    schema = app.openapi()
    paths = schema["paths"]
    assert "/patient/me/context" in paths
    assert "/patient/{patient_id}/items" in paths
    assert "/patient/question" in paths


def test_migration_0003_patient_tables():
    with open("db/migrations/0003_patient_mobile_app.sql", "r") as f:
        content = f.read()
    for table in [
        "patient_app_user",
        "followup_item",
        "patient_medication",
        "adherence_log",
        "warning_sign",
        "test_result",
        "care_provider",
        "patient_message",
        "reminder",
        "caregiver_access_request",
        "coordination_card",
    ]:
        assert f"CREATE TABLE {table}" in content
