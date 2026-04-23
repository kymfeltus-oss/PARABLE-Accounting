-- Per-tenant Chart of Accounts (UCOA) with optional parent/child for roll-ups in UI and reporting.
-- Depends on: parable_ledger.unified_coa_template (same data as chart_of_accounts_seed.csv).

CREATE TABLE parable_ledger.chart_of_accounts (
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

CREATE INDEX idx_coa_tenant_code ON parable_ledger.chart_of_accounts (tenant_id, account_code);
CREATE INDEX idx_coa_parent ON parable_ledger.chart_of_accounts (tenant_id, parent_account_id);

COMMENT ON TABLE parable_ledger.chart_of_accounts IS
    'Per-tenant UCOA lines; use parent_account_id for sub-accounts.';

COMMENT ON COLUMN parable_ledger.chart_of_accounts.category IS
    'Net Asset (not “Equity”) for NFP statements; maps to SFP / SOA by group.';

-- Idempotent: seed from unified template; preserve existing parent_account_id (sub-ledger links).
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
    u.account_code::INTEGER,
    u.account_name,
    u.category,
    u.sub_category,
    u.is_restricted,
    NULL
FROM parable_ledger.unified_coa_template u
CROSS JOIN parable_ledger.tenants t
WHERE t.slug = 'parable-main'
ON CONFLICT (tenant_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    is_restricted = EXCLUDED.is_restricted,
    parent_account_id = parable_ledger.chart_of_accounts.parent_account_id;

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.chart_of_accounts TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY chart_of_accounts_all
    ON parable_ledger.chart_of_accounts
    FOR ALL
    TO postgres, service_role, authenticated, anon
    USING (true)
    WITH CHECK (true);
