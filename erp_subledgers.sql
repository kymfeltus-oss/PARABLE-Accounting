-- =============================================================================
-- PARABLE: AP & AR sub-ledgers (month-end / ERP hub)
-- Run in Supabase (or: supabase/migrations) — target schema: parable_ledger
-- =============================================================================
-- See migration `20250423280000_erp_subledgers.sql` for the deployable form.

-- Accounts Payable (vendor bills, approvals, invoice vault path)
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

-- Accounts Receivable (pledges, fees, camp balances — restricted + unrestricted)
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

CREATE INDEX IF NOT EXISTS idx_ap_tenant_status_due
    ON parable_ledger.accounts_payable (tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_ar_tenant_due
    ON parable_ledger.accounts_receivable (tenant_id, due_date);

COMMENT ON TABLE parable_ledger.accounts_payable IS 'Sub-ledger: open bills, approvals, paid linkage to ledger (future).';
COMMENT ON TABLE parable_ledger.accounts_receivable IS 'Sub-ledger: receivables / pledge schedules; reconcile to contributions.';
