-- =============================================================================
-- Staff seed for Kym Feltus → `view_staff_directory` (Gate 1 / audit anchor)
--
-- If you see: column "role_type" does not exist, your `staff_onboarding` predates
-- supabase/migrations/20250423360000_staff_onboarding.sql. This file adds missing
-- columns (IF NOT EXISTS) before INSERT.
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- 0) Some DBs use `staff_name` instead of `full_name` (view expects `full_name`)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'staff_onboarding' AND column_name = 'staff_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'staff_onboarding' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE parable_ledger.staff_onboarding RENAME COLUMN staff_name TO full_name;
  END IF;
END;
$$;

-- 0b) `full_name` is required by the app + view; add if a legacy table had neither name column renamed
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 1) Align to app + migration shape (idempotent; nullable first where legacy rows may exist)
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS role_type TEXT;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS onboarding_status TEXT;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS tax_form_status TEXT;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS has_housing_resolution BOOLEAN;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS housing_vault_doc_id UUID;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS gates JSONB;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE parable_ledger.staff_onboarding ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2) View: ensure `full_name` + PostgREST can read roster (safe re-create)
CREATE OR REPLACE VIEW parable_ledger.view_staff_directory AS
SELECT
  so.id AS id,
  so.full_name AS staff_name,
  so.tenant_id
FROM parable_ledger.staff_onboarding so
WHERE so.full_name IS NOT NULL AND btrim(so.full_name) <> '';

GRANT SELECT ON parable_ledger.view_staff_directory TO postgres, service_role, authenticated, anon;

-- 3) Insert / refresh Kym for tenant with slug `parable-master`
INSERT INTO parable_ledger.staff_onboarding (tenant_id, full_name, role_type, email, department, onboarding_status, tax_form_status, has_housing_resolution, gates, metadata)
SELECT
  t.id,
  'Kym Feltus',
  'Secular Staff',
  'kym@parable.church',
  'CFO / Finance & Accounting',
  'Complete',
  'Complete',
  false,
  '{
    "1_legal_dna": "complete",
    "2_housing_shield": "n/a",
    "3_contractor_shield": "n/a",
    "4_vision_culture": "complete"
  }'::jsonb,
  '{}'::jsonb
FROM parable_ledger.tenants t
WHERE t.slug = 'parable-master'
  AND NOT EXISTS (
    SELECT 1
    FROM parable_ledger.staff_onboarding s
    WHERE s.tenant_id = t.id
      AND lower(btrim(COALESCE(s.email, ''))) = 'kym@parable.church'
  );

UPDATE parable_ledger.staff_onboarding s
SET
  full_name = 'Kym Feltus',
  role_type = 'Secular Staff',
  email = 'kym@parable.church',
  department = 'CFO / Finance & Accounting',
  updated_at = now()
FROM parable_ledger.tenants t
WHERE s.tenant_id = t.id
  AND t.slug = 'parable-master'
  AND lower(btrim(COALESCE(s.email, ''))) = 'kym@parable.church';

-- 4) Optional: all-zero tenant id (if present)
INSERT INTO parable_ledger.staff_onboarding (tenant_id, full_name, role_type, email, department, onboarding_status, tax_form_status, has_housing_resolution, gates, metadata)
SELECT
  t.id,
  'Kym Feltus',
  'Secular Staff',
  'kym@parable.church',
  'CFO / Finance & Accounting',
  'Complete',
  'Complete',
  false,
  '{
    "1_legal_dna": "complete",
    "2_housing_shield": "n/a",
    "3_contractor_shield": "n/a",
    "4_vision_culture": "complete"
  }'::jsonb,
  '{}'::jsonb
FROM parable_ledger.tenants t
WHERE t.id = '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (
    SELECT 1
    FROM parable_ledger.staff_onboarding s
    WHERE s.tenant_id = t.id
      AND lower(btrim(COALESCE(s.email, ''))) = 'kym@parable.church'
  );

-- 5) Verify
SELECT * FROM parable_ledger.view_staff_directory ORDER BY staff_name;

NOTIFY pgrst, 'reload schema';
