-- IRS Guardian: persisted alerts (email log + board resolution) per tenant.
-- Dedupe on (tenant_id, transaction_id, violation_code).

CREATE TABLE parable_ledger.compliance_violation_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES parable_ledger.transactions (id) ON DELETE SET NULL,
    violation_code TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    correction TEXT NOT NULL,
    irs_ref_key TEXT,
    risk_level TEXT NOT NULL DEFAULT 'CRITICAL',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    email_sent_at TIMESTAMPTZ,
    email_recipient TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_violation_tx_code ON parable_ledger.compliance_violation_alerts (tenant_id, transaction_id, violation_code);
CREATE INDEX idx_violation_tenant_status ON parable_ledger.compliance_violation_alerts (tenant_id, status, created_at DESC);

COMMENT ON TABLE parable_ledger.compliance_violation_alerts IS
    'Heuristic compliance flags (Pub 1828 / 990-T) — not a substitute for legal advice.';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.compliance_violation_alerts TO postgres, service_role, authenticated, anon;
ALTER TABLE parable_ledger.compliance_violation_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_violation_alerts_all
    ON parable_ledger.compliance_violation_alerts
    FOR ALL
    TO postgres, service_role, authenticated, anon
    USING (true)
    WITH CHECK (true);
