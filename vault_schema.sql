-- PARABLE: Sovereign Vault (reference copy — apply via supabase/migrations/20250423300000_sovereign_vault.sql in projects using migrations)
-- See supabase/migrations/20250423300000_sovereign_vault.sql for the versioned source.

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

CREATE INDEX idx_sovereign_vault_tenant_cat ON parable_ledger.sovereign_vault (tenant_id, category);
CREATE INDEX idx_sovereign_vault_exp ON parable_ledger.sovereign_vault (tenant_id, expiration_date);
