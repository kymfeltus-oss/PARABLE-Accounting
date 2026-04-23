-- 1099-NEC / contractor payee watchlist (per tenant) — W-9 vault, entity type, YTD from transactions via metadata

CREATE TABLE parable_ledger.contractor_payees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    payee_type TEXT NOT NULL DEFAULT 'unclassified'
        CHECK (payee_type IN (
            'sole_proprietor',
            'single_member_llc',
            'multi_member_llc',
            'partnership',
            'c_corporation',
            's_corporation',
            'unclassified'
        )),
    service_category TEXT NOT NULL DEFAULT 'other'
        CHECK (service_category IN (
            'guest_speaker',
            'maintenance',
            'audio_engineer',
            'legal',
            'other'
        )),
    w9_on_file BOOLEAN NOT NULL DEFAULT false,
    w9_document_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_contractor_tenant_name UNIQUE (tenant_id, display_name)
);

CREATE INDEX idx_contractor_payees_tenant ON parable_ledger.contractor_payees (tenant_id);

COMMENT ON TABLE parable_ledger.contractor_payees IS
    'Service vendors for 1099-NEC watch; link ledger rows via metadata.contractor_payee_id';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.contractor_payees TO postgres, service_role, authenticated, anon;
ALTER TABLE parable_ledger.contractor_payees ENABLE ROW LEVEL SECURITY;
CREATE POLICY contractor_payees_all ON parable_ledger.contractor_payees FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);
