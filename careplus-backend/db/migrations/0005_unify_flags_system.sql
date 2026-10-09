-- =====================================================================
-- 0005_unify_flags_system.sql
-- Unifies the flags system so mobile app uses the same review_flags table
-- as the web frontend. This migration:
--   1. Enhances review_flags with mobile-specific columns
--   2. Creates a view mapping coordination_card to review_flags for backward compat
--   3. Updates RLS policies to allow mobile users to create flags
--   4. Adds indexes for mobile app queries
--
-- Note: review_flags uses 'resolved' boolean instead of 'status' string.
-- The view maps resolved boolean to status string for backward compatibility.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enhance review_flags table with mobile-specific columns
-- ---------------------------------------------------------------------
ALTER TABLE review_flags
  ADD COLUMN IF NOT EXISTS card_type TEXT,
  ADD COLUMN IF NOT EXISTS care_team_notes TEXT,
  ADD COLUMN IF NOT EXISTS raised_by_name TEXT,
  ADD COLUMN IF NOT EXISTS question_id UUID;

-- Add check constraint for card_type to match mobile coordination_card types
ALTER TABLE review_flags
  ADD CONSTRAINT check_card_type
  CHECK (card_type IS NULL OR card_type IN (
    'medication-delay',
    'medication-not-taken',
    'appointment-question',
    'test-delay',
    'symptom-report',
    'unclear-instruction',
    'general-review'
  ));

-- ---------------------------------------------------------------------
-- 2. Create a view mapping coordination_card to review_flags
--    This provides backward compatibility for any existing code
--    that reads from coordination_card
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_coordination_card_review_flags AS
SELECT
  rf.id,
  rf.patient_id,
  rf.card_type,
  rf.raised_by_name,
  rf.reason AS description,
  rf.severity,
  CASE
    WHEN rf.resolved = TRUE THEN 'resolved'
    ELSE 'needs-review'
  END AS status,
  rf.care_team_notes,
  rf.created_at,
  rf.resolved_at
FROM review_flags rf
WHERE rf.card_type IS NOT NULL;

-- Grant permissions on the view immediately after creation
GRANT SELECT ON v_coordination_card_review_flags TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- 3. Update RLS policies to allow mobile users (patient/caregiver)
--    to create review_flags
-- ---------------------------------------------------------------------

-- Drop existing policy to recreate with broader access
DROP POLICY IF EXISTS "Manage review flags" ON review_flags;

-- New policy: Care team (authenticated) can manage all flags
CREATE POLICY "Care team manages review flags" ON review_flags
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for patients/caregivers to create flags (but not resolve them)
CREATE POLICY "Patients create review flags" ON review_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow insert if user is creating a flag for their own patient
    EXISTS (
      SELECT 1 FROM patient_app_user pau
      WHERE pau.auth_user_id = auth.uid()
      AND pau.patient_id = patient_id
    )
  );

-- Policy for patients/caregivers to only update their own flags (status only)
CREATE POLICY "Patients update own review flags" ON review_flags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patient_app_user pau
      WHERE pau.auth_user_id = auth.uid()
      AND pau.patient_id = patient_id
    )
    AND resolved = FALSE
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_app_user pau
      WHERE pau.auth_user_id = auth.uid()
      AND pau.patient_id = patient_id
    )
    -- Patients can only update their own flags, not resolve them
    AND resolved = FALSE
  );

-- ---------------------------------------------------------------------
-- 4. Add indexes for mobile app queries
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_review_flags_patient_card_type
  ON review_flags(patient_id, card_type)
  WHERE card_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_flags_patient_status
  ON review_flags(patient_id, resolved);

CREATE INDEX IF NOT EXISTS idx_review_flags_question_id
  ON review_flags(question_id)
  WHERE question_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Grant necessary permissions
-- ---------------------------------------------------------------------
GRANT ALL ON TABLE review_flags TO service_role;
GRANT SELECT, INSERT ON TABLE review_flags TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 6. Migrate existing coordination_card data to review_flags
--    (if coordination_card table exists and has data)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  coord_count INTEGER;
BEGIN
  -- Check if coordination_card table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='coordination_card') THEN

    -- Count existing coordination cards
    SELECT COUNT(*) INTO coord_count FROM coordination_card;

    IF coord_count > 0 THEN
      -- Migrate coordination_card data to review_flags
      INSERT INTO review_flags (
        patient_id,
        card_type,
        raised_by_name,
        reason,
        severity,
        care_team_notes,
        created_at,
        resolved_at,
        resolved
      )
      SELECT
        cc.patient_id,
        cc.card_type,
        cc.raised_by_name,
        cc.description,
        CASE
          WHEN cc.status = 'needs-review' THEN 'medium'
          WHEN cc.status = 'acknowledged' THEN 'low'
          WHEN cc.status = 'resolved' THEN 'low'
          ELSE 'medium'
        END AS severity,
        cc.care_team_notes,
        cc.created_at,
        cc.resolved_at,
        CASE WHEN cc.status = 'resolved' THEN TRUE ELSE FALSE END
      FROM coordination_card cc
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'Migrated % coordination_card records to review_flags', coord_count;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. Add comments for documentation
-- ---------------------------------------------------------------------
COMMENT ON COLUMN review_flags.card_type IS 'Mobile app card type (medication-delay, appointment-question, etc.) - maps to coordination_card types';
COMMENT ON COLUMN review_flags.care_team_notes IS 'Notes from care team when responding to patient-raised flags';
COMMENT ON COLUMN review_flags.raised_by_name IS 'Name of the person who raised the flag (patient or caregiver name)';
COMMENT ON COLUMN review_flags.question_id IS 'Optional link to a patient_question if this flag was raised from a question';
COMMENT ON VIEW v_coordination_card_review_flags IS 'Backward compatibility view mapping coordination_card structure to review_flags';
