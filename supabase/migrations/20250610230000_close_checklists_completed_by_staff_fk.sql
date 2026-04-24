-- Institutional sign-off: completed_by_id = staff_onboarding.id (not auth.users)
ALTER TABLE parable_ledger.close_checklists
  DROP CONSTRAINT IF EXISTS close_checklists_completed_by_id_fkey;

UPDATE parable_ledger.close_checklists c
SET completed_by_id = NULL
WHERE c.completed_by_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM parable_ledger.staff_onboarding s WHERE s.id = c.completed_by_id);

ALTER TABLE parable_ledger.close_checklists
  ADD CONSTRAINT close_checklists_completed_by_id_fkey
  FOREIGN KEY (completed_by_id) REFERENCES parable_ledger.staff_onboarding (id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
