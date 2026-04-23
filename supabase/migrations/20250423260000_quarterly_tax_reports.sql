-- Form 941 quarterly aggregates (PARABLE) — storage for getQuarterlyTotals / taxLogic.js

CREATE TABLE parable_ledger.quarterly_tax_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    tax_year INT NOT NULL CHECK (tax_year >= 2000 AND tax_year <= 2100),
    quarter INT NOT NULL CHECK (quarter IN (1, 2, 3, 4)),

    -- Form 941 Part 2 (simplified mapping — see taxLogic.js)
    line2_total_wages NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    line3_federal_income_tax_withheld NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    line5a_taxable_social_security_wages NUMERIC(18, 2) NOT NULL DEFAULT 0.00,

    -- Non-941 but required for accrual: employer FICA on FICA-subject wages (7.65% of line5a base in app logic)
    employer_fica_match NUMERIC(18, 2) NOT NULL DEFAULT 0.00,

    subtotal_salary_minister NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    subtotal_salary_non_minister NUMERIC(18, 2) NOT NULL DEFAULT 0.00,

    detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_quarterly_tax_reports_tenant_yq UNIQUE (tenant_id, tax_year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_quarterly_tax_reports_tenant ON parable_ledger.quarterly_tax_reports (tenant_id, tax_year DESC);

COMMENT ON TABLE parable_ledger.quarterly_tax_reports IS
    'Cached 941-style quarterly payroll aggregates; source rows: parable_ledger.transactions (expense + wage metadata).';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.quarterly_tax_reports TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.quarterly_tax_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY quarterly_tax_reports_all
    ON parable_ledger.quarterly_tax_reports FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);
