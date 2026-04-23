-- =============================================================================
-- PARABLE Ledger: import tenant Chart of Accounts from CSV (staging + COPY)
-- Prerequisite: migrations applied (parable_ledger.chart_of_accounts exists).
-- Run with psql from a machine that can read the CSV path, e.g.:
--   psql "postgresql://..." -f import_coa.sql
-- Or in psql: \i import_coa.sql
-- Before \copy, set: \cd 'C:/Users/kymfe/Downloads/parable-ministry-erp'
-- or edit the \copy path to an absolute path.
-- =============================================================================

-- 1) Target tenant (slug; override with SELECT if you use a different church)
-- For a fixed UUID instead, replace the subquery in the INSERT below.

-- 2) Staging: mirrors chart_of_accounts_seed.csv columns (account_code is text in file)
CREATE TEMP TABLE _coa_import_stg (
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    is_restricted TEXT NOT NULL
);

-- 3) Load file (psql meta-command: not valid in Supabase SQL Editor — use section B there)
\copy _coa_import_stg FROM 'chart_of_accounts_seed.csv' WITH (FORMAT csv, HEADER true);

-- 4) Optional: clear existing template rows for this tenant so codes match the file 1:1
--    (removes sub-accounts you may have created under these codes; comment out to merge only)
-- DELETE FROM parable_ledger.chart_of_accounts
-- WHERE tenant_id = (SELECT id FROM parable_ledger.tenants WHERE slug = 'parable-main' LIMIT 1);

-- 5) Upsert from staging
INSERT INTO parable_ledger.chart_of_accounts (
    tenant_id,
    account_code,
    account_name,
    category,
    sub_category,
    is_restricted,
    parent_account_id
)
SELECT
    t.id,
    s.account_code::INTEGER,
    s.account_name,
    s.category,
    NULLIF(btrim(s.sub_category), ''),
    (lower(s.is_restricted) IN ('true', 't', '1', 'yes')),
    NULL
FROM _coa_import_stg s
CROSS JOIN LATERAL (
    SELECT id FROM parable_ledger.tenants WHERE slug = 'parable-main' LIMIT 1
) t
ON CONFLICT (tenant_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    is_restricted = EXCLUDED.is_restricted,
    parent_account_id = parable_ledger.chart_of_accounts.parent_account_id;

-- =============================================================================
-- B) Supabase SQL Editor (no \copy): run this instead of steps 2–3 above
--    Re-seeds from the read-only template (identical to the repo CSV)
-- =============================================================================
-- INSERT INTO parable_ledger.chart_of_accounts (tenant_id, account_code, account_name, category, sub_category, is_restricted, parent_account_id)
-- SELECT t.id, u.account_code::INTEGER, u.account_name, u.category, u.sub_category, u.is_restricted, NULL
-- FROM parable_ledger.unified_coa_template u
-- CROSS JOIN parable_ledger.tenants t
-- WHERE t.slug = 'parable-main'
-- ON CONFLICT (tenant_id, account_code) DO UPDATE SET
--   account_name = EXCLUDED.account_name,
--   category = EXCLUDED.category,
--   sub_category = EXCLUDED.sub_category,
--   is_restricted = EXCLUDED.is_restricted,
--   parent_account_id = parable_ledger.chart_of_accounts.parent_account_id;
