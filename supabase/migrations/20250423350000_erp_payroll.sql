-- Canonical payroll sub-ledger for the Financial Hub: ministerial housing vs secular (UTC month rollups)

CREATE TABLE IF NOT EXISTS parable_ledger.erp_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    pay_date DATE NOT NULL,
    wage_type TEXT NOT NULL CHECK (wage_type IN ('ministerial_housing', 'secular_wage')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    source_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_payroll_tenant_date
  ON parable_ledger.erp_payroll (tenant_id, pay_date DESC);

CREATE INDEX IF NOT EXISTS idx_erp_payroll_tenant_wage
  ON parable_ledger.erp_payroll (tenant_id, wage_type);

COMMENT ON TABLE parable_ledger.erp_payroll IS
  'Per-line payroll amounts; hub sums ministerial_housing vs secular_wage for the UTC calendar month.';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.erp_payroll
  TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.erp_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_payroll_all ON parable_ledger.erp_payroll;
CREATE POLICY erp_payroll_all ON parable_ledger.erp_payroll
  FOR ALL TO postgres, service_role, authenticated, anon
  USING (true) WITH CHECK (true);
