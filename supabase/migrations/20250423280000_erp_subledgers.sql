-- ERP sub-ledgers: AP (bills) + AR (pledges / receivables), tenant-scoped

CREATE TABLE parable_ledger.accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    approval_path JSONB NOT NULL DEFAULT '[]'::jsonb,
    invoice_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parable_ledger.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    payer_name TEXT NOT NULL,
    amount_due NUMERIC(14, 2) NOT NULL,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    due_date DATE,
    category TEXT,
    is_restricted BOOLEAN NOT NULL DEFAULT true,
    fund_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ap_tenant_status_due ON parable_ledger.accounts_payable (tenant_id, status, due_date);
CREATE INDEX idx_ar_tenant_due ON parable_ledger.accounts_receivable (tenant_id, due_date);

COMMENT ON TABLE parable_ledger.accounts_payable IS 'AP sub-ledger: bills, approval chain, optional invoice link.';
COMMENT ON TABLE parable_ledger.accounts_receivable IS 'AR sub-ledger: receivables / pledge schedules.';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.accounts_payable TO postgres, service_role, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.accounts_receivable TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE parable_ledger.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_payable_all ON parable_ledger.accounts_payable FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);

CREATE POLICY accounts_receivable_all ON parable_ledger.accounts_receivable FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);
