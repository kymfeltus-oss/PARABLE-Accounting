-- Tie close checklist attestation to `staff_onboarding` (e.g. Gate 1 "Kym Feltus" UUID) while keeping `completed_by_id` for auth user.
ALTER TABLE parable_ledger.close_checklists
    ADD COLUMN IF NOT EXISTS verifier_staff_id UUID REFERENCES parable_ledger.staff_onboarding (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_close_checklist_verifier_staff
    ON parable_ledger.close_checklists (tenant_id, verifier_staff_id)
    WHERE verifier_staff_id IS NOT NULL;

COMMENT ON COLUMN parable_ledger.close_checklists.verifier_staff_id IS
    'Row in staff_onboarding selected as verifier; complements verifier_name.';

NOTIFY pgrst, 'reload schema';
