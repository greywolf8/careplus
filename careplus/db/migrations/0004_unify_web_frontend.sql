-- =====================================================================
-- 0004_unify_web_frontend.sql
-- Reconciles the web frontend (CarePlus-frontend) with the backend
-- schema that already exists in Supabase. The web app expects
-- plural-named tables (patients, doctor_patients, profiles, ...) and
-- doctor-authored patient rows; the backend already owns the canonical
-- `patient` table (source of truth for the mobile app too).
--
-- This migration is idempotent. It:
--   1. Grants service_role / authenticated on already-deployed tables
--      (the deployed DB is currently returning 42501 to service_role).
--   2. Adds web-facing columns to `patient` (mrn, full_name, sex, ...).
--   3. Creates the web-only tables that never existed: profiles,
--      doctor_patients, review_flags.
--   4. Creates dashboard / item views the web app reads.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fix privileges on tables created by 0001 / 0003
--    (service_role currently lacks table-level SELECT/INSERT/UPDATE)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'patient','rmp','discharge_summary','extracted_item','approved_item',
        'obligation','consent','translation','patient_question','audit_log',
        'policy_decision','canary','eval_metric',
        'patient_app_user','patient_tab_permissions','patient_caregiver_link',
        'followup_item','followup_item_translation','patient_medication',
        'adherence_log','warning_sign','test_result','care_provider',
        'patient_message','reminder','caregiver_access_request','coordination_card'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name=t) THEN
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
            EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Add web-facing columns to `patient` (kept in sync with mobile)
-- ---------------------------------------------------------------------
ALTER TABLE patient ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS mrn TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE patient ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS care_circle TEXT DEFAULT 'Self';
ALTER TABLE patient ADD COLUMN IF NOT EXISTS discharge_date DATE;

-- Backfill full_name from name where possible, and normalize language
UPDATE patient SET full_name = name WHERE full_name IS NULL;
UPDATE patient SET language = COALESCE(language, preferred_language, 'en');

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_mrn ON patient(mrn) WHERE mrn IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Doctor / staff profiles (web auth)
--    signUp() in AuthPage.tsx inserts into `profiles`.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'doctor' CHECK (role IN ('doctor','patient','caregiver','coordinator','auditor','admin')),
    preferred_language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. doctor_patients — assigns a doctor (profiles.id) to a patient
--    The Patients tab lists patients through this junction.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE,
    UNIQUE (doctor_id, patient_id)
);

-- ---------------------------------------------------------------------
-- 5. review_flags — care-team review queue rows raised for a patient
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    item_id UUID,
    reason TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    raised_by UUID REFERENCES profiles(id)
);

-- ---------------------------------------------------------------------
-- 6. Dashboard + item views
-- ---------------------------------------------------------------------
-- Care-plan items per patient from the backend followup_item table
CREATE OR REPLACE VIEW v_items_effective AS
SELECT
    fi.id,
    fi.patient_id,
    fi.category,
    fi.title AS what,
    NULL::text AS specialty,
    fi.due_date,
    fi.source,
    1.0 AS confidence,
    fi.effective_status,
    fi.effective_status::text AS status,
    fi.created_at,
    fi.updated_at
FROM followup_item fi;

-- Doctor workload / attention list
CREATE OR REPLACE VIEW v_patient_attention AS
SELECT
    p.id AS patient_id,
    COALESCE(p.full_name, p.name) AS patient_name,
    COALESCE(EXTRACT(YEAR FROM age(p.date_of_birth))::int, 0) AS age,
    COALESCE(p.sex, 'unknown') AS sex,
    COALESCE(p.mrn, '') AS mrn,
    COALESCE(p.language, 'en') AS language,
    COALESCE(p.city, '') AS city,
    p.discharge_date,
    CASE
        WHEN p.discharge_date IS NULL THEN 0
        ELSE GREATEST(0,(CURRENT_DATE - p.discharge_date))
    END AS day_number,
    COALESCE(p.care_circle, 'Self') AS care_circle,
    (
        (SELECT COUNT(*) FROM followup_item f WHERE f.patient_id = p.id AND f.effective_status = 'overdue')
        + (SELECT COUNT(*) FROM review_flags rf WHERE rf.patient_id = p.id AND rf.resolved = FALSE)
    ) AS urgency_score,
    (SELECT COUNT(*) FROM patient_question q WHERE q.patient_id = p.id AND q.route = 'escalate') AS escalated_questions,
    (SELECT COUNT(*) FROM review_flags rf WHERE rf.patient_id = p.id AND rf.resolved = FALSE) AS open_flags,
    (SELECT COUNT(*) FROM followup_item f WHERE f.patient_id = p.id AND f.effective_status = 'overdue') AS overdue_items,
    0 AS repeated_skips
FROM patient p;

-- Convenience view: patients a given doctor can see
CREATE OR REPLACE VIEW v_doctor_patients AS
SELECT
    dp.doctor_id,
    p.id,
    COALESCE(p.full_name, p.name) AS full_name,
    p.mrn,
    p.date_of_birth,
    p.sex,
    COALESCE(p.language, 'en') AS language,
    p.city,
    p.discharge_date,
    COALESCE(p.care_circle, 'Self') AS care_circle
FROM doctor_patients dp
JOIN patient p ON p.id = dp.patient_id
WHERE dp.active = TRUE;

-- Ask-tab questions (web expects plural + friendly columns; source of truth
-- is the backend `patient_question` table).
CREATE OR REPLACE VIEW patient_questions AS
SELECT
    q.id,
    q.patient_id,
    NULL::uuid         AS asked_by,
    NULL::text         AS relationship,
    q.question         AS question_text,
    'en'               AS original_language,
    NULL::text         AS translated_text,
    q.answer           AS answer_text,
    'en'               AS answer_language,
    CASE
        WHEN q.answered_at IS NOT NULL THEN 'answered'
        ELSE 'pending'
    END                 AS status,
    NULL::uuid         AS linked_flag_id,
    q.created_at,
    q.answered_at,
    NULL::uuid         AS answered_by
FROM patient_question q;

-- Medicines tab (web expects plural + drug/frequency/duration)
CREATE OR REPLACE VIEW medications AS
SELECT
    m.id,
    m.patient_id,
    m.drug_name      AS drug,
    m.dose,
    m.how_often      AS frequency,
    m.for_how_long   AS duration,
    m.original_instruction AS instructions_verbatim,
    FALSE            AS missing,
    'active'::text    AS status,
    m.created_at,
    m.updated_at
FROM patient_medication m;

-- ---------------------------------------------------------------------
-- 7. Table grants the web app (anon key + user JWT => role 'authenticated')
--    needs to actually read/write. The service_role bypass lives in RLS
--    policies; here we also open table-level privileges to authenticated.
-- ---------------------------------------------------------------------
GRANT ALL ON TABLE patient TO authenticated, anon;
GRANT ALL ON TABLE profiles TO authenticated, anon;
GRANT ALL ON TABLE doctor_patients TO authenticated, anon;
GRANT ALL ON TABLE review_flags TO authenticated, anon;

GRANT ALL ON TABLE profiles TO service_role;
GRANT ALL ON TABLE doctor_patients TO service_role;
GRANT ALL ON TABLE review_flags TO service_role;

GRANT SELECT ON TABLE v_items_effective TO anon, authenticated, service_role;
GRANT SELECT ON TABLE v_patient_attention TO anon, authenticated, service_role;
GRANT SELECT ON TABLE v_doctor_patients TO anon, authenticated, service_role;
GRANT SELECT ON TABLE patient_questions TO anon, authenticated, service_role;
GRANT SELECT ON TABLE medications TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7b. RLS policies so the web app can manage patients under RLS.
--     NOTE: synthetic/demo portal. Doctors are 'authenticated' users;
--     they may create patients and manage the ones assigned to them.
-- ---------------------------------------------------------------------
ALTER TABLE patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;

-- patient: doctors (authenticated) can create/read/update clinical rows.
CREATE POLICY "Doctors manage patients" ON patient
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

-- doctor_patients: a doctor manages their own assignment rows.
CREATE POLICY "Manage own doctor_patients" ON doctor_patients
    FOR ALL TO authenticated
    USING (doctor_id = auth.uid())
    WITH CHECK (doctor_id = auth.uid());

-- profiles: a user only sees/updates their own profile row.
CREATE POLICY "Self profile" ON profiles
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- review_flags: care team (authenticated) can manage the queue.
CREATE POLICY "Manage review flags" ON review_flags
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 7c. Patient login credentials (patient_app_user / patient_tab_permissions).
--     A doctor creates a patient's auth account (email+password in
--     auth.users) and links it via patient_app_user (role='patient').
--     The login credential structure is exactly the patient_app_user
--     row: auth_user_id + email + role + patient_id + preferred_language.
--     Doctors (authenticated) may insert/read these link rows.
-- ---------------------------------------------------------------------
ALTER TABLE patient_app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_tab_permissions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE patient_app_user TO authenticated, anon, service_role;
GRANT ALL ON TABLE patient_tab_permissions TO authenticated, anon, service_role;

CREATE POLICY "Doctors manage patient app users" ON patient_app_user
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Doctors manage patient tab permissions" ON patient_tab_permissions
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 8. Mark `patient.status`-style flags default safe; brief help text
-- ---------------------------------------------------------------------
COMMENT ON TABLE doctor_patients IS 'Web-frontend junction linking a doctor (profiles.id) to a canonical patient row. The mobile app shares the same patient row.';
COMMENT ON TABLE profiles IS 'Web auth users (doctors/staff). Created by AuthPage signUp.';
