-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE obligation_state AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');
CREATE TYPE question_route AS ENUM ('to_doctor', 'to_self', 'escalate');
CREATE TYPE actor_type AS ENUM ('patient', 'rmp', 'system');

-- Patient table
CREATE TABLE patient (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    preferred_language TEXT DEFAULT 'en',
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RMP (Registered Medical Practitioner) table
CREATE TABLE rmp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    mci_reg_number TEXT UNIQUE NOT NULL,
    specialization TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discharge summary table
CREATE TABLE discharge_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    admitting_rmp_id UUID REFERENCES rmp(id),
    raw_content TEXT NOT NULL,
    content_hash TEXT NOT NULL, -- sha256
    language TEXT DEFAULT 'en',
    discharge_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted item (draft items - patients CANNOT read)
CREATE TABLE extracted_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discharge_summary_id UUID NOT NULL REFERENCES discharge_summary(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    source_span JSONB,
    state TEXT DEFAULT 'drafted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approved item (approved by RMP - patients CAN read)
CREATE TABLE approved_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    discharge_summary_id UUID REFERENCES discharge_summary(id) ON DELETE SET NULL,
    approver_rmp_id UUID NOT NULL REFERENCES rmp(id),
    item_type TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Obligation table
CREATE TABLE obligation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    owner_practitioner_id UUID REFERENCES rmp(id),
    title TEXT NOT NULL,
    description TEXT,
    state obligation_state DEFAULT 'pending',
    due_date DATE,
    closure_evidence TEXT,
    provenance_ref TEXT, -- Reference to source item
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consent table
CREATE TABLE consent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Translation table
CREATE TABLE translation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_item_id UUID NOT NULL,
    source_type TEXT NOT NULL, -- 'approved_item' or 'obligation'
    target_language TEXT NOT NULL,
    translated_content TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verifier_rmp_id UUID REFERENCES rmp(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient question table
CREATE TABLE patient_question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    route question_route NOT NULL,
    answer TEXT,
    cited_item_ids JSONB, -- Array of item IDs referenced
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);

-- Audit log table (chain-based)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prev_hash TEXT,
    hash TEXT NOT NULL UNIQUE,
    actor_type actor_type NOT NULL,
    actor_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ts TIMESTAMPTZ DEFAULT NOW()
);

-- Policy decision table
CREATE TABLE policy_decision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_log_id UUID NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    check_name TEXT NOT NULL,
    cited_regulation TEXT,
    allowed BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canary table (for tamper detection)
CREATE TABLE canary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_id UUID NOT NULL REFERENCES obligation(id) ON DELETE CASCADE,
    original_value TEXT NOT NULL,
    corrupted_value TEXT,
    detected_by_rmp_id UUID REFERENCES rmp(id),
    detected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eval metric table
CREATE TABLE eval_metric (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name TEXT NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    dataset_ref TEXT,
    metadata JSONB
);

-- Enable RLS on all tables
ALTER TABLE patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmp ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_metric ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Service role bypasses RLS (enforced in code, not just convention)
-- Create individual policies for each table since ON ALL TABLES is not supported
CREATE POLICY "Service role bypass" ON patient FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON discharge_summary FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON extracted_item FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON approved_item FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON obligation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON rmp FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON consent FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON translation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON patient_question FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON policy_decision FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON canary FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON eval_metric FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Patient: can only SELECT their own rows on approved_item
CREATE POLICY "Patients can read own approved items" ON approved_item
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient
            WHERE patient.id = approved_item.patient_id
            AND patient.id = auth.uid()
        )
    );

-- Patient: can only SELECT verified translations
CREATE POLICY "Patients can read verified translations" ON translation
    FOR SELECT
    TO authenticated
    USING (verified = true);

-- Patient: can SELECT their own obligations
CREATE POLICY "Patients can read own obligations" ON obligation
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient
            WHERE patient.id = obligation.patient_id
            AND patient.id = auth.uid()
        )
    );

-- Patient: can SELECT their own questions
CREATE POLICY "Patients can read own questions" ON patient_question
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient
            WHERE patient.id = patient_question.patient_id
            AND patient.id = auth.uid()
        )
    );

-- Patient: can SELECT their own consent records
CREATE POLICY "Patients can read own consent" ON consent
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient
            WHERE patient.id = consent.patient_id
            AND patient.id = auth.uid()
        )
    );

-- Patient: CANNOT read extracted_item rows at all (deny)
CREATE POLICY "Deny patients from extracted_item" ON extracted_item
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- Patient: CANNOT read discharge_summary
CREATE POLICY "Deny patients from discharge_summary" ON discharge_summary
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- Patient: CANNOT read audit_log
CREATE POLICY "Deny patients from audit_log" ON audit_log
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- Patient: CANNOT read policy_decision
CREATE POLICY "Deny patients from policy_decision" ON policy_decision
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- Patient: CANNOT read canary
CREATE POLICY "Deny patients from canary" ON canary
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- Patient: CANNOT read eval_metric
CREATE POLICY "Deny patients from eval_metric" ON eval_metric
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- RMP policies
CREATE POLICY "RMPs can read all discharge summaries" ON discharge_summary
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read all extracted items" ON extracted_item
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read all approved items" ON approved_item
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read all obligations" ON obligation
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read all translations" ON translation
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read all questions" ON patient_question
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read audit log" ON audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read policy decisions" ON policy_decision
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

CREATE POLICY "RMPs can read canary" ON canary
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rmp
            WHERE rmp.id = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX idx_discharge_summary_patient ON discharge_summary(patient_id);
CREATE INDEX idx_extracted_item_summary ON extracted_item(discharge_summary_id);
CREATE INDEX idx_approved_item_patient ON approved_item(patient_id);
CREATE INDEX idx_obligation_patient ON obligation(patient_id);
CREATE INDEX idx_obligation_state ON obligation(state);
CREATE INDEX idx_obligation_due_date ON obligation(due_date);
CREATE INDEX idx_translation_source ON translation(source_item_id, source_type);
CREATE INDEX idx_patient_question_patient ON patient_question(patient_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_hash ON audit_log(hash);
CREATE INDEX idx_canary_obligation ON canary(obligation_id);

-- Audit Chain Helper Functions

-- Compute hash for audit log entry
CREATE OR REPLACE FUNCTION compute_audit_hash(
    p_prev_hash TEXT,
    p_actor_type actor_type,
    p_actor_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_values JSONB,
    p_new_values JSONB,
    p_ts TIMESTAMPTZ
) RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        digest(
            COALESCE(p_prev_hash, '') || 
            p_actor_type::TEXT || 
            COALESCE(p_actor_id::TEXT, '') || 
            p_action || 
            p_entity_type || 
            p_entity_id::TEXT || 
            COALESCE(p_old_values::TEXT, '') || 
            COALESCE(p_new_values::TEXT, '') || 
            p_ts::TEXT,
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to compute hash before insert
CREATE OR REPLACE FUNCTION audit_chain_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash TEXT;
BEGIN
    -- Get the hash of the most recent audit log entry
    SELECT hash INTO v_prev_hash
    FROM audit_log
    ORDER BY ts DESC
    LIMIT 1;

    NEW.hash = compute_audit_hash(
        v_prev_hash,
        NEW.actor_type,
        NEW.actor_id,
        NEW.action,
        NEW.entity_type,
        NEW.entity_id,
        NEW.old_values,
        NEW.new_values,
        NEW.ts
    );

    NEW.prev_hash = v_prev_hash;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit log
CREATE TRIGGER audit_chain_trigger
    BEFORE INSERT ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_chain_before_insert();

-- Prevent mutation of audit log entries (block_mutation)
CREATE OR REPLACE FUNCTION audit_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_block_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_block_mutation();

CREATE TRIGGER audit_block_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_block_mutation();

-- RPC Functions

-- Approve an extracted item and move it to approved_item
CREATE OR REPLACE FUNCTION approve_item(
    p_extracted_item_id UUID,
    p_approver_rmp_id UUID,
    p_patient_id UUID
) RETURNS UUID AS $$
DECLARE
    v_extracted extracted_item;
    v_approved_id UUID;
    v_content_hash TEXT;
BEGIN
    -- Get the extracted item
    SELECT * INTO v_extracted
    FROM extracted_item
    WHERE id = p_extracted_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Extracted item not found';
    END IF;

    -- Compute content hash
    v_content_hash = encode(digest(v_extracted.content, 'sha256'), 'hex');

    -- Insert into approved_item
    INSERT INTO approved_item (
        patient_id,
        discharge_summary_id,
        approver_rmp_id,
        item_type,
        content,
        content_hash
    ) VALUES (
        p_patient_id,
        v_extracted.discharge_summary_id,
        p_approver_rmp_id,
        v_extracted.item_type,
        v_extracted.content,
        v_content_hash
    ) RETURNING id INTO v_approved_id;

    -- Delete the extracted item
    DELETE FROM extracted_item WHERE id = p_extracted_item_id;

    RETURN v_approved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark an obligation as done
CREATE OR REPLACE FUNCTION mark_item_done(
    p_obligation_id UUID,
    p_closure_evidence TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE obligation
    SET state = 'completed',
        closure_evidence = p_closure_evidence,
        updated_at = NOW()
    WHERE id = p_obligation_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject an extracted item
CREATE OR REPLACE FUNCTION reject_item(
    p_extracted_item_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE extracted_item
    SET state = 'rejected',
        updated_at = NOW()
    WHERE id = p_extracted_item_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve a flag (placeholder for future implementation)
CREATE OR REPLACE FUNCTION resolve_flag(
    p_flag_id UUID,
    p_resolution TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Placeholder for flag resolution logic
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decide on an access request
CREATE OR REPLACE FUNCTION decide_access_request(
    p_request_id UUID,
    p_allowed BOOLEAN,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Placeholder for access request decision logic
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find nearby providers (geographic search)
CREATE OR REPLACE FUNCTION nearby_providers(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_radius_km INTEGER DEFAULT 10
) RETURNS TABLE (
    provider_id UUID,
    name TEXT,
    distance_km DECIMAL
) AS $$
BEGIN
    -- Placeholder for geographic search
    -- In production, use PostGIS for actual distance calculations
    RETURN QUERY
    SELECT
        rmp.id,
        rmp.name,
        0.0::DECIMAL
    FROM rmp
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Match items to providers
CREATE OR REPLACE FUNCTION item_provider_matches(
    p_item_type TEXT
) RETURNS TABLE (
    provider_id UUID,
    provider_name TEXT,
    match_score DECIMAL
) AS $$
BEGIN
    -- Placeholder for provider matching logic
    RETURN QUERY
    SELECT
        rmp.id,
        rmp.name,
        0.5::DECIMAL
    FROM rmp
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compile episode page for a patient
CREATE OR REPLACE FUNCTION compile_episode_page(
    p_patient_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_episode JSONB;
BEGIN
    SELECT jsonb_build_object(
        'patient_id', p.id,
        'patient_name', p.name,
        'obligations', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', o.id,
                'title', o.title,
                'state', o.state,
                'due_date', o.due_date
            ))
            FROM obligation o
            WHERE o.patient_id = p.id
        ),
        'approved_items', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'item_type', a.item_type,
                'content', a.content
            ))
            FROM approved_item a
            WHERE a.patient_id = p.id
        )
    ) INTO v_episode
    FROM patient p
    WHERE p.id = p_patient_id;

    RETURN v_episode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lint episode page for consistency
CREATE OR REPLACE FUNCTION lint_episode_page(
    p_patient_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_lint_results JSONB;
BEGIN
    -- Placeholder for linting logic
    v_lint_results = jsonb_build_object(
        'patient_id', p_patient_id,
        'errors', jsonb_build_array(),
        'warnings', jsonb_build_array()
    );
    RETURN v_lint_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Perform policy check
CREATE OR REPLACE FUNCTION policy_check(
    p_check_name TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_actor_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Placeholder for policy checking logic
    v_result = jsonb_build_object(
        'check_name', p_check_name,
        'allowed', true,
        'reason', 'Policy check passed'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify audit chain integrity
CREATE OR REPLACE FUNCTION verify_audit_chain() RETURNS JSONB AS $$
DECLARE
    v_entry RECORD;
    v_prev_hash TEXT;
    v_computed_hash TEXT;
    v_valid BOOLEAN := true;
    v_invalid_count INTEGER := 0;
BEGIN
    FOR v_entry IN SELECT * FROM audit_log ORDER BY ts ASC LOOP
        v_computed_hash = compute_audit_hash(
            v_entry.prev_hash,
            v_entry.actor_type,
            v_entry.actor_id,
            v_entry.action,
            v_entry.entity_type,
            v_entry.entity_id,
            v_entry.old_values,
            v_entry.new_values,
            v_entry.ts
        );

        IF v_computed_hash != v_entry.hash THEN
            v_valid := false;
            v_invalid_count := v_invalid_count + 1;
        END IF;

        v_prev_hash = v_entry.hash;
    END LOOP;

    RETURN jsonb_build_object(
        'valid', v_valid,
        'total_entries', (SELECT COUNT(*) FROM audit_log),
        'invalid_entries', v_invalid_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke consent
CREATE OR REPLACE FUNCTION revoke_consent(
    p_consent_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE consent
    SET revoked_at = NOW()
    WHERE id = p_consent_id AND revoked_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recompile episode after data erasure (right to be forgotten)
CREATE OR REPLACE FUNCTION recompile_after_erasure(
    p_patient_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- Placeholder for recompilation after erasure
    -- This would trigger re-extraction and recompilation
    RETURN compile_episode_page(p_patient_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed canary for tamper detection
CREATE OR REPLACE FUNCTION seed_canary(
    p_obligation_id UUID,
    p_rmp_id UUID
) RETURNS UUID AS $$
DECLARE
    v_canary_id UUID;
    v_obligation obligation;
BEGIN
    -- Get the obligation
    SELECT * INTO v_obligation
    FROM obligation
    WHERE id = p_obligation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Obligation not found';
    END IF;

    -- Create canary entry
    INSERT INTO canary (
        obligation_id,
        original_value,
        detected_by_rmp_id
    ) VALUES (
        p_obligation_id,
        v_obligation.title || '||' || COALESCE(v_obligation.description, ''),
        p_rmp_id
    ) RETURNING id INTO v_canary_id;

    RETURN v_canary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
