-- =============================================================================
-- Sovereign Vault — institutional document repository (bylaws, insurance, IRS, etc.)
-- =============================================================================

CREATE TABLE parable_ledger.sovereign_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    category TEXT NOT NULL
        CHECK (category IN (
            'GOVERNANCE', 'IRS_TAX', 'INSURANCE', 'FINANCIALS', 'CONTINUITY', 'RISK', 'OTHER'
        )),
    subcategory TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    expiration_date DATE,
    is_board_certified BOOLEAN NOT NULL DEFAULT false,
    key_person_role TEXT,
    document_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    uploaded_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE parable_ledger.sovereign_vault IS
    'Compliance repository: governance, tax, insurance, financials, succession; Gate 5 may require current GL coverage.';

COMMENT ON COLUMN parable_ledger.sovereign_vault.subcategory IS
    'e.g. GENERAL_LIABILITY, D_O, ARTICLES for governance; used for health checks.';

COMMENT ON COLUMN parable_ledger.sovereign_vault.key_person_role IS
    'Continuity pillar: e.g. Lead Pastor, Treasurer, for key-person documentation.';

CREATE INDEX idx_sovereign_vault_tenant_cat ON parable_ledger.sovereign_vault (tenant_id, category);
CREATE INDEX idx_sovereign_vault_exp ON parable_ledger.sovereign_vault (tenant_id, expiration_date);
CREATE INDEX idx_sovereign_vault_insurance_line ON parable_ledger.sovereign_vault (tenant_id, category, subcategory);

CREATE OR REPLACE FUNCTION parable_ledger.set_sovereign_vault_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_sovereign_vault_updated_at
BEFORE UPDATE ON parable_ledger.sovereign_vault
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.set_sovereign_vault_updated_at();

GRANT ALL PRIVILEGES ON TABLE parable_ledger.sovereign_vault TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parable_ledger.sovereign_vault TO authenticated;
GRANT SELECT ON TABLE parable_ledger.sovereign_vault TO anon;

ALTER TABLE parable_ledger.sovereign_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY sovereign_vault_select
    ON parable_ledger.sovereign_vault FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY sovereign_vault_insert
    ON parable_ledger.sovereign_vault FOR INSERT TO authenticated, service_role WITH CHECK (true);

CREATE POLICY sovereign_vault_update
    ON parable_ledger.sovereign_vault FOR UPDATE TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY sovereign_vault_delete
    ON parable_ledger.sovereign_vault FOR DELETE TO authenticated, service_role USING (true);
