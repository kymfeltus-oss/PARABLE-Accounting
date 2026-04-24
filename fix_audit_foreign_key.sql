-- =============================================================================
-- Re-link close_checklists.completed_by_id → parable_ledger.staff_onboarding (id)
-- (removes broken / irrelevant reference to auth.users for institutional sign-off)
-- App task key for Gate 1 is g1_tithes_offerings (not the human label string).
-- Run in Supabase SQL Editor, then NOTIFY.
-- =============================================================================

-- 0) Optional columns (older DBs; ignore if already present with FKs)
ALTER TABLE parable_ledger.close_checklists ADD COLUMN IF NOT EXISTS verifier_name TEXT;
ALTER TABLE parable_ledger.close_checklists ADD COLUMN IF NOT EXISTS attestation_sha256 TEXT;
-- verifier_staff_id may already exist with FK; only add if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'close_checklists' AND column_name = 'verifier_staff_id'
  ) THEN
    ALTER TABLE parable_ledger.close_checklists
      ADD COLUMN verifier_staff_id UUID REFERENCES parable_ledger.staff_onboarding (id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- 1) Drop FK to auth.users (name may vary; try common auto-name)
ALTER TABLE parable_ledger.close_checklists
  DROP CONSTRAINT IF EXISTS close_checklists_completed_by_id_fkey;

-- 2) Orphan values: auth UUIDs will not exist in staff_onboarding — clear before re-FK
UPDATE parable_ledger.close_checklists c
SET completed_by_id = NULL
WHERE c.completed_by_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM parable_ledger.staff_onboarding s WHERE s.id = c.completed_by_id);

-- 3) Point completed_by_id at staff roster
ALTER TABLE parable_ledger.close_checklists
  ADD CONSTRAINT close_checklists_completed_by_id_fkey
  FOREIGN KEY (completed_by_id) REFERENCES parable_ledger.staff_onboarding (id) ON DELETE SET NULL;

-- 4) Re-sign April 2026 (04/26) for Gate 1: canonical task_name = g1_tithes_offerings
INSERT INTO parable_ledger.close_checklists (
  tenant_id,
  reporting_period,
  gate_number,
  task_name,
  verifier_name,
  verifier_staff_id,
  completed_by_id,
  completed_at
)
SELECT
  t.id,
  '04/26',
  1,
  'g1_tithes_offerings',
  'Kym Feltus',
  s.id,
  s.id,
  now()
FROM parable_ledger.tenants t
CROSS JOIN LATERAL (
  SELECT s0.id
  FROM parable_ledger.staff_onboarding s0
  WHERE s0.tenant_id = t.id
    AND btrim(s0.full_name) = 'Kym Feltus'
  ORDER BY s0.id
  LIMIT 1
) s
WHERE t.slug = 'parable-master'
ON CONFLICT (tenant_id, reporting_period, task_name) DO UPDATE
SET
  gate_number = EXCLUDED.gate_number,
  verifier_name = EXCLUDED.verifier_name,
  verifier_staff_id = EXCLUDED.verifier_staff_id,
  completed_by_id = EXCLUDED.completed_by_id,
  completed_at = now();

-- 5) Optional: tenant id is all-zero (and slug may differ) — one row only
INSERT INTO parable_ledger.close_checklists (
  tenant_id, reporting_period, gate_number, task_name,
  verifier_name, verifier_staff_id, completed_by_id, completed_at
)
SELECT
  t.id, '04/26', 1, 'g1_tithes_offerings',
  'Kym Feltus', s.id, s.id, now()
FROM parable_ledger.tenants t
CROSS JOIN LATERAL (
  SELECT s0.id
  FROM parable_ledger.staff_onboarding s0
  WHERE s0.tenant_id = t.id
    AND btrim(s0.full_name) = 'Kym Feltus'
  ORDER BY s0.id
  LIMIT 1
) s
WHERE t.id = '00000000-0000-0000-0000-000000000000'
  AND t.slug IS DISTINCT FROM 'parable-master'
ON CONFLICT (tenant_id, reporting_period, task_name) DO UPDATE
SET
  gate_number = EXCLUDED.gate_number,
  verifier_name = EXCLUDED.verifier_name,
  verifier_staff_id = EXCLUDED.verifier_staff_id,
  completed_by_id = EXCLUDED.completed_by_id,
  completed_at = now();

-- 6) Verify + cache
SELECT * FROM parable_ledger.close_checklists ORDER BY completed_at DESC LIMIT 20;
NOTIFY pgrst, 'reload schema';
