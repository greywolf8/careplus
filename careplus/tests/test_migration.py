import re


def test_migration_syntax():
    """Test that the migration SQL file has valid structure."""
    with open("db/migrations/0001_init.sql", "r") as f:
        content = f.read()
    
    # Check for required tables
    required_tables = [
        "patient",
        "discharge_summary",
        "extracted_item",
        "approved_item",
        "obligation",
        "rmp",
        "consent",
        "translation",
        "patient_question",
        "audit_log",
        "policy_decision",
        "canary",
        "eval_metric"
    ]
    
    for table in required_tables:
        assert f"CREATE TABLE {table}" in content, f"Table {table} not found in migration"
    
    # Check for RLS
    assert "ENABLE ROW LEVEL SECURITY" in content, "RLS not enabled"
    
    # Check for deny policy on extracted_item
    assert "Deny patients from extracted_item" in content, "Deny policy for extracted_item not found"
    
    # Check for required RPCs
    required_rpcs = [
        "approve_item",
        "mark_item_done",
        "reject_item",
        "resolve_flag",
        "decide_access_request",
        "nearby_providers",
        "item_provider_matches",
        "compile_episode_page",
        "lint_episode_page",
        "policy_check",
        "verify_audit_chain",
        "revoke_consent",
        "recompile_after_erasure",
        "seed_canary"
    ]
    
    for rpc in required_rpcs:
        assert f"CREATE OR REPLACE FUNCTION {rpc}" in content, f"RPC {rpc} not found"
    
    # Check for audit chain helpers
    assert "compute_audit_hash" in content, "compute_audit_hash function not found"
    assert "audit_chain_before_insert" in content, "audit_chain_before_insert function not found"
    assert "audit_block_mutation" in content, "audit_block_mutation function not found"
    assert "verify_audit_chain" in content, "verify_audit_chain function not found"


def test_rls_policies():
    """Test that RLS policies are correctly defined."""
    with open("db/migrations/0001_init.sql", "r") as f:
        content = f.read()
    
    # Check that patients can read approved_item
    assert "Patients can read own approved items" in content
    
    # Check that patients can read verified translations
    assert "Patients can read verified translations" in content
    
    # Check that patients can read obligations
    assert "Patients can read own obligations" in content
    
    # Check that patients CANNOT read extracted_item
    assert "Deny patients from extracted_item" in content
    assert "USING (false)" in content
    
    # Check that service role bypasses RLS
    assert "Service role bypass" in content
    assert "TO service_role" in content


def test_table_columns():
    """Test that tables have required columns."""
    with open("db/migrations/0001_init.sql", "r") as f:
        content = f.read()
    
    # Check patient table
    assert "patient (" in content
    assert "name TEXT NOT NULL" in content
    assert "preferred_language TEXT" in content
    
    # Check discharge_summary table
    assert "discharge_summary (" in content
    assert "content_hash TEXT NOT NULL" in content
    
    # Check extracted_item table
    assert "extracted_item (" in content
    assert "state TEXT DEFAULT 'drafted'" in content
    
    # Check approved_item table
    assert "approved_item (" in content
    assert "content_hash TEXT NOT NULL" in content
    assert "approver_rmp_id UUID NOT NULL" in content
    
    # Check obligation table
    assert "obligation (" in content
    assert "state obligation_state" in content
    assert "due_date DATE" in content
    
    # Check audit_log table
    assert "audit_log (" in content
    assert "prev_hash TEXT" in content
    assert "hash TEXT NOT NULL UNIQUE" in content
    assert "actor_type actor_type" in content
