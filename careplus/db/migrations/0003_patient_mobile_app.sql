-- Patient-side mobile app schema (CarePlus PWA contract)
-- Aligns with careplus-mobile types; clinical rows link via obligation_id / approved_item_id.

CREATE TYPE followup_item_status AS ENUM (
    'pending',
    'completed',
    'needs_review',
    'escalated',
    'overdue',
    'missed',
    'rejected',
    'cancelled'
);

CREATE TYPE followup_item_category AS ENUM (
    'appointment',
    'test',
    'care',
    'general'
);

CREATE TYPE followup_item_section AS ENUM (
    'OVERDUE',
    'DUE TODAY',
    'NEXT UP',
    'DAILY CARE'
);

CREATE TYPE followup_item_source AS ENUM (
    'discharge_summary',
    'doctor_added'
);

CREATE TYPE app_user_role AS ENUM ('patient', 'caregiver');

CREATE TYPE message_sender AS ENUM ('patient', 'system', 'care_team');

CREATE TYPE patient_message_type AS ENUM (
    'question',
    'plan_answer',
    'escalation',
    'doctor_answer',
    'emergency_warning'
);

CREATE TYPE coordination_card_type AS ENUM (
    'medication-delay',
    'appointment-question',
    'test-delay',
    'symptom-report',
    'unclear-instruction',
    'general-review'
);

CREATE TYPE coordination_card_status AS ENUM (
    'needs-review',
    'acknowledged',
    'resolved'
);

CREATE TYPE care_provider_kind AS ENUM (
    'clinic',
    'lab',
    'hospital',
    'pharmacy',
    'imaging'
);

CREATE TYPE warning_sign_severity AS ENUM ('critical', 'urgent');

CREATE TYPE reminder_channel AS ENUM ('whatsapp', 'sms');

CREATE TYPE access_request_status AS ENUM ('pending', 'approved', 'denied');

-- Optional episode metadata for mobile home / print views
ALTER TABLE patient ADD COLUMN IF NOT EXISTS discharge_date DATE;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS hospital TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS primary_doctor TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS discharge_diagnosis TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

ALTER TABLE approved_item ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE approved_item ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE approved_item ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- App users (patient or caregiver profiles bound to Supabase auth)
CREATE TABLE patient_app_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role app_user_role NOT NULL,
    preferred_language TEXT DEFAULT 'en',
    patient_id UUID REFERENCES patient(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_tab_permissions (
    user_id UUID PRIMARY KEY REFERENCES patient_app_user(id) ON DELETE CASCADE,
    can_see_today BOOLEAN DEFAULT TRUE,
    can_see_plan BOOLEAN DEFAULT TRUE,
    can_see_medicines BOOLEAN DEFAULT TRUE,
    can_see_ask BOOLEAN DEFAULT TRUE,
    can_see_more BOOLEAN DEFAULT TRUE,
    can_see_warning_signs BOOLEAN DEFAULT TRUE,
    can_see_tests BOOLEAN DEFAULT TRUE,
    can_see_find_care BOOLEAN DEFAULT TRUE,
    can_see_reminders BOOLEAN DEFAULT TRUE,
    can_mark_done BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_caregiver_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    caregiver_user_id UUID NOT NULL REFERENCES patient_app_user(id) ON DELETE CASCADE,
    caregiver_name TEXT NOT NULL,
    relationship TEXT,
    can_mark_done BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (patient_id, caregiver_user_id)
);

CREATE TABLE followup_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    obligation_id UUID REFERENCES obligation(id) ON DELETE SET NULL,
    approved_item_id UUID REFERENCES approved_item(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    section followup_item_section,
    category followup_item_category NOT NULL DEFAULT 'general',
    due_date DATE,
    due_time TEXT,
    effective_status followup_item_status NOT NULL DEFAULT 'pending',
    original_text TEXT NOT NULL,
    source followup_item_source NOT NULL DEFAULT 'discharge_summary',
    added_by TEXT,
    provider_suggestion JSONB,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE followup_item_translation (
    item_id UUID NOT NULL REFERENCES followup_item(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    translated_title TEXT NOT NULL,
    translated_instruction TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (item_id, language)
);

CREATE TABLE patient_medication (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    approved_item_id UUID REFERENCES approved_item(id) ON DELETE SET NULL,
    drug_name TEXT NOT NULL,
    dose TEXT,
    how_often TEXT,
    for_how_long TEXT,
    original_instruction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE adherence_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES patient_medication(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('taken', 'not_taken')),
    logged_by TEXT NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (medication_id, log_date)
);

CREATE TABLE warning_sign (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    approved_item_id UUID REFERENCES approved_item(id) ON DELETE SET NULL,
    original_text TEXT NOT NULL,
    severity warning_sign_severity NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE test_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    result_date DATE NOT NULL,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMPTZ,
    released_by TEXT,
    result_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE care_provider (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    kind care_provider_kind NOT NULL,
    distance_label TEXT,
    address TEXT NOT NULL,
    specialties TEXT[] DEFAULT '{}',
    phone TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    sender message_sender NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type patient_message_type NOT NULL DEFAULT 'question',
    cited_item_ids UUID[] DEFAULT '{}',
    escalation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    followup_item_id UUID REFERENCES followup_item(id) ON DELETE SET NULL,
    item_title TEXT NOT NULL,
    due_time_label TEXT NOT NULL,
    channel reminder_channel NOT NULL DEFAULT 'whatsapp',
    is_past BOOLEAN DEFAULT FALSE,
    preview_text TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE caregiver_access_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    caregiver_name TEXT NOT NULL,
    caregiver_email TEXT NOT NULL,
    relationship TEXT NOT NULL,
    status access_request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by_user_id UUID REFERENCES patient_app_user(id)
);

CREATE TABLE coordination_card (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    card_type coordination_card_type NOT NULL,
    raised_by app_user_role NOT NULL,
    raised_by_name TEXT NOT NULL,
    description TEXT NOT NULL,
    status coordination_card_status NOT NULL DEFAULT 'needs-review',
    care_team_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_followup_item_patient ON followup_item(patient_id);
CREATE INDEX idx_followup_item_due ON followup_item(patient_id, due_date);
CREATE INDEX idx_patient_medication_patient ON patient_medication(patient_id);
CREATE INDEX idx_adherence_medication_date ON adherence_log(medication_id, log_date);
CREATE INDEX idx_warning_sign_patient ON warning_sign(patient_id);
CREATE INDEX idx_test_result_patient ON test_result(patient_id);
CREATE INDEX idx_patient_message_patient ON patient_message(patient_id, created_at);
CREATE INDEX idx_reminder_patient ON reminder(patient_id);
CREATE INDEX idx_coordination_patient ON coordination_card(patient_id, status);
CREATE INDEX idx_caregiver_link_patient ON patient_caregiver_link(patient_id);
CREATE INDEX idx_caregiver_link_user ON patient_caregiver_link(caregiver_user_id);

CREATE UNIQUE INDEX idx_followup_item_approved_unique ON followup_item(approved_item_id)
    WHERE approved_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_patient_medication_approved_unique ON patient_medication(approved_item_id)
    WHERE approved_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_warning_sign_approved_unique ON warning_sign(approved_item_id)
    WHERE approved_item_id IS NOT NULL;

-- RLS
ALTER TABLE patient_app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_caregiver_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_item_translation ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medication ENABLE ROW LEVEL SECURITY;
ALTER TABLE adherence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_sign ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_provider ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_access_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON patient_app_user FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON patient_tab_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON patient_caregiver_link FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON followup_item FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON followup_item_translation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON patient_medication FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON adherence_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON warning_sign FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON test_result FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON care_provider FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON patient_message FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON reminder FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON caregiver_access_request FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON coordination_card FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Patient read own follow-up data (auth.uid matches patient.auth_user_id or caregiver link)
CREATE POLICY "Patient read own followup items" ON followup_item
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient p
            WHERE p.id = followup_item.patient_id AND p.auth_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM patient_caregiver_link l
            JOIN patient_app_user u ON u.id = l.caregiver_user_id
            WHERE l.patient_id = followup_item.patient_id
              AND u.auth_user_id = auth.uid()
              AND l.status = 'active'
        )
    );

CREATE POLICY "Patient read verified item translations" ON followup_item_translation
    FOR SELECT TO authenticated
    USING (is_verified = TRUE);

CREATE POLICY "Patient read own medications" ON patient_medication
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patient p
            WHERE p.id = patient_medication.patient_id AND p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Patient read released test results" ON test_result
    FOR SELECT TO authenticated
    USING (
        is_released = TRUE
        AND EXISTS (
            SELECT 1 FROM patient p
            WHERE p.id = test_result.patient_id AND p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Public read active care providers" ON care_provider
    FOR SELECT TO authenticated
    USING (is_active = TRUE);

-- Replace placeholder decide_access_request
CREATE OR REPLACE FUNCTION decide_access_request(
    p_request_id UUID,
    p_allowed BOOLEAN,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_req caregiver_access_request;
BEGIN
    SELECT * INTO v_req FROM caregiver_access_request WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE caregiver_access_request
    SET status = CASE WHEN p_allowed THEN 'approved'::access_request_status ELSE 'denied'::access_request_status END,
        decided_at = NOW()
    WHERE id = p_request_id;

    IF p_allowed THEN
        INSERT INTO patient_caregiver_link (
            patient_id,
            caregiver_user_id,
            caregiver_name,
            relationship,
            can_mark_done,
            status
        )
        SELECT
            v_req.patient_id,
            u.id,
            v_req.caregiver_name,
            v_req.relationship,
            TRUE,
            'active'
        FROM patient_app_user u
        WHERE lower(u.email) = lower(v_req.caregiver_email)
        ON CONFLICT (patient_id, caregiver_user_id) DO UPDATE
        SET status = 'active', relationship = EXCLUDED.relationship;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark follow-up item done (patient/caregiver via API layer authorization)
CREATE OR REPLACE FUNCTION patient_mark_followup_done(
    p_item_id UUID,
    p_completed_by TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE followup_item
    SET effective_status = 'completed',
        completed_at = NOW(),
        completed_by = p_completed_by,
        updated_at = NOW()
    WHERE id = p_item_id
      AND effective_status NOT IN ('needs_review', 'rejected', 'cancelled');

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert follow-up item from approved clinical row
CREATE OR REPLACE FUNCTION sync_followup_from_approved_item(
    p_approved_item_id UUID
) RETURNS UUID AS $$
DECLARE
    v_ai approved_item;
    v_id UUID;
    v_category followup_item_category;
BEGIN
    SELECT * INTO v_ai FROM approved_item WHERE id = p_approved_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'approved_item not found';
    END IF;

    v_category := CASE v_ai.item_type
        WHEN 'appointment' THEN 'appointment'::followup_item_category
        WHEN 'test' THEN 'test'::followup_item_category
        WHEN 'medication' THEN 'care'::followup_item_category
        WHEN 'warning_sign' THEN 'general'::followup_item_category
        ELSE 'care'::followup_item_category
    END;

    INSERT INTO followup_item (
        patient_id,
        approved_item_id,
        title,
        category,
        due_date,
        effective_status,
        original_text,
        source
    ) VALUES (
        v_ai.patient_id,
        v_ai.id,
        COALESCE(v_ai.title, left(v_ai.content, 120)),
        v_category,
        v_ai.due_date,
        'pending',
        v_ai.content,
        'discharge_summary'
    )
    ON CONFLICT (approved_item_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM followup_item WHERE approved_item_id = p_approved_item_id LIMIT 1;
    END IF;

    IF v_ai.item_type = 'medication' THEN
        INSERT INTO patient_medication (
            patient_id, approved_item_id, drug_name, original_instruction
        ) VALUES (
            v_ai.patient_id, v_ai.id,
            COALESCE(v_ai.title, 'Medication'),
            v_ai.content
        )
        ON CONFLICT (approved_item_id) DO UPDATE SET updated_at = NOW();
    END IF;

    IF v_ai.item_type = 'warning_sign' THEN
        INSERT INTO warning_sign (patient_id, approved_item_id, original_text, severity)
        VALUES (v_ai.patient_id, v_ai.id, v_ai.content, 'critical')
        ON CONFLICT (approved_item_id) DO NOTHING;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
