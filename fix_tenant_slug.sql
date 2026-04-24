-- =============================================================================
-- parable_ledger.tenants — slug column (institutional handle) + default master row
-- Run in Supabase SQL Editor. Then: NOTIFY pgrst, 'reload schema';
-- Match app default: slug = 'parable-master' (see supabaseClient.js + BrandProvider)
-- =============================================================================

-- 1) Add slug if missing
ALTER TABLE parable_ledger.tenants
    ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) Default slug for the hand-seeded all-zero id (if you use create_tenants_table.sql)
UPDATE parable_ledger.tenants
SET slug = 'parable-master'
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND (slug IS NULL OR btrim(slug) = '');

-- 3) If your DB came from older repo seeds (slug = parable-main), rename handle to parable-master
UPDATE parable_ledger.tenants
SET slug = 'parable-master'
WHERE slug = 'parable-main';

-- 4) Optional: organization_name from hand-built table (skip if you get "column does not exist")
-- UPDATE parable_ledger.tenants
-- SET slug = 'parable-master'
-- WHERE organization_name = 'PARABLE Master Entity' AND (slug IS NULL OR btrim(slug) = '');

-- 5) Any rows still without slug: deterministic, unique per row
UPDATE parable_ledger.tenants t
SET slug = 't' || replace(t.id::text, '-', '')
WHERE t.slug IS NULL OR btrim(t.slug) = '';

-- 5b) Header label: PARABLE Master Entity (only if display_name column exists; safe no-op in odd schemas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'tenants' AND column_name = 'display_name'
  ) THEN
    UPDATE parable_ledger.tenants
    SET display_name = 'PARABLE Master Entity'
    WHERE (
      id = '00000000-0000-0000-0000-000000000000'
      OR btrim(COALESCE(slug, '')) = 'parable-master'
    ) AND btrim(COALESCE(display_name, '')) IN ('', 'PARABLE');
  END IF;
END;
$$;

-- 6) Uniqueness (ignore error if a unique constraint on slug already exists)
DO $$
BEGIN
  ALTER TABLE parable_ledger.tenants ADD CONSTRAINT uq_parable_ledger_tenants_slug UNIQUE (slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- 7) Required for all rows
ALTER TABLE parable_ledger.tenants
    ALTER COLUMN slug SET NOT NULL;

-- 8) Refresh PostgREST
NOTIFY pgrst, 'reload schema';
