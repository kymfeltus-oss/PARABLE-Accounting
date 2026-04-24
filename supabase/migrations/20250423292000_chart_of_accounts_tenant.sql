-- Per-tenant Chart of Accounts (UCOA) with optional parent/child for roll-ups in UI and reporting.
-- Depends on: parable_ledger.unified_coa_template (same data as chart_of_accounts_seed.csv).

CREATE TABLE IF NOT EXISTS parable_ledger.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    account_code INTEGER NOT NULL,
    account_name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('Asset', 'Liability', 'Net Asset', 'Income', 'Expense')),
    sub_category TEXT,
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    parent_account_id UUID REFERENCES parable_ledger.chart_of_accounts (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chart_of_accounts_tenant_code UNIQUE (tenant_id, account_code)
);

-- Brownfield: white_label / hand-built COA may use `code` and omit tenant_id, category, etc.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'chart_of_accounts' AND column_name = 'code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'chart_of_accounts' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE parable_ledger.chart_of_accounts RENAME COLUMN code TO account_code;
  END IF;
END $$;

ALTER TABLE parable_ledger.chart_of_accounts
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS account_code INTEGER,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS sub_category TEXT,
    ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES parable_ledger.chart_of_accounts (id) ON DELETE SET NULL;

UPDATE parable_ledger.chart_of_accounts coa
SET tenant_id = s.id
FROM (
  SELECT id FROM parable_ledger.tenants
  WHERE slug IN ('parable-master', 'parable-main')
  ORDER BY CASE WHEN slug = 'parable-master' THEN 0 ELSE 1 END
  LIMIT 1
) AS s
WHERE coa.tenant_id IS NULL;

UPDATE parable_ledger.chart_of_accounts
SET account_name = COALESCE(NULLIF(trim(account_name), ''), 'Account')
WHERE account_name IS NULL OR trim(account_name) = '';

UPDATE parable_ledger.chart_of_accounts
SET category = COALESCE(category, 'Income')
WHERE category IS NULL;

UPDATE parable_ledger.chart_of_accounts
SET is_restricted = COALESCE(is_restricted, false)
WHERE is_restricted IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parable_ledger.chart_of_accounts WHERE tenant_id IS NULL) THEN
    ALTER TABLE parable_ledger.chart_of_accounts ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parable_ledger.chart_of_accounts WHERE account_code IS NULL) THEN
    ALTER TABLE parable_ledger.chart_of_accounts ALTER COLUMN account_code SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parable_ledger.chart_of_accounts WHERE account_name IS NULL OR trim(account_name) = '') THEN
    ALTER TABLE parable_ledger.chart_of_accounts ALTER COLUMN account_name SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parable_ledger.chart_of_accounts WHERE category IS NULL) THEN
    ALTER TABLE parable_ledger.chart_of_accounts ALTER COLUMN category SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parable_ledger.chart_of_accounts WHERE is_restricted IS NULL) THEN
    ALTER TABLE parable_ledger.chart_of_accounts ALTER COLUMN is_restricted SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_coa_tenant_code ON parable_ledger.chart_of_accounts (tenant_id, account_code);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON parable_ledger.chart_of_accounts (tenant_id, parent_account_id);

COMMENT ON TABLE parable_ledger.chart_of_accounts IS
    'Per-tenant UCOA lines; use parent_account_id for sub-accounts.';

COMMENT ON COLUMN parable_ledger.chart_of_accounts.category IS
    'Net Asset (not “Equity”) for NFP statements; maps to SFP / SOA by group.';

-- Some deployments add a NOT NULL account_type column (not in canonical repo); backfill + satisfy INSERT.
ALTER TABLE parable_ledger.chart_of_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;

UPDATE parable_ledger.chart_of_accounts coa
SET account_type = CASE coa.category
    WHEN 'Asset' THEN 'ASSET'
    WHEN 'Liability' THEN 'LIABILITY'
    WHEN 'Net Asset' THEN 'NET_ASSET'
    WHEN 'Income' THEN 'INCOME'
    WHEN 'Expense' THEN 'EXPENSE'
    ELSE 'OPERATING'
END
WHERE coa.account_type IS NULL OR trim(coa.account_type) = '';

-- Idempotent: seed from unified template; preserve existing parent_account_id (sub-ledger links).
INSERT INTO parable_ledger.chart_of_accounts (
    tenant_id,
    account_code,
    account_name,
    category,
    sub_category,
    is_restricted,
    parent_account_id,
    account_type
)
SELECT
    t.id,
    u.account_code::INTEGER,
    u.account_name,
    u.category,
    u.sub_category,
    u.is_restricted,
    NULL,
    CASE u.category
        WHEN 'Asset' THEN 'ASSET'
        WHEN 'Liability' THEN 'LIABILITY'
        WHEN 'Net Asset' THEN 'NET_ASSET'
        WHEN 'Income' THEN 'INCOME'
        WHEN 'Expense' THEN 'EXPENSE'
        ELSE 'OPERATING'
    END
FROM parable_ledger.unified_coa_template u
CROSS JOIN parable_ledger.tenants t
WHERE t.slug IN ('parable-main', 'parable-master')
ON CONFLICT (tenant_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    is_restricted = EXCLUDED.is_restricted,
    parent_account_id = parable_ledger.chart_of_accounts.parent_account_id,
    account_type = EXCLUDED.account_type;

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.chart_of_accounts TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chart_of_accounts_all ON parable_ledger.chart_of_accounts;
CREATE POLICY chart_of_accounts_all
    ON parable_ledger.chart_of_accounts
    FOR ALL
    TO postgres, service_role, authenticated, anon
    USING (true)
    WITH CHECK (true);
