-- PARABLE: Human capital — staff onboarding, tax classification, sovereignty gates
-- FICA vs SECA routing is derived from role_type; ministers need housing resolution before first payroll in product logic.

CREATE TABLE IF NOT EXISTS parable_ledger.staff_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role_type TEXT NOT NULL
        CHECK (role_type IN ('Minister', 'Secular Staff', 'Contractor')),
    department TEXT,
    email TEXT,
    onboarding_status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (onboarding_status IN ('Pending', 'In_Progress', 'Complete', 'Blocked')),
    has_housing_resolution BOOLEAN NOT NULL DEFAULT false,
    tax_form_status TEXT NOT NULL DEFAULT 'Missing'
        CHECK (tax_form_status IN ('Missing', 'Partial', 'W4', 'W9', 'I9', 'I9_w4', 'Complete')),
    hire_date DATE,
    -- Optional link to a Sovereign Vault row once uploaded (metadata also used to find rows)
    housing_vault_doc_id UUID REFERENCES parable_ledger.sovereign_vault (id) ON DELETE SET NULL,
    -- Gate completion: legal DNA, housing shield, contractor/corp, culture vision
    gates JSONB NOT NULL DEFAULT '{
        "1_legal_dna": "pending",
        "2_housing_shield": "pending",
        "3_contractor_shield": "n/a",
        "4_vision_culture": "pending"
    }'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tenant ON parable_ledger.staff_onboarding (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_role ON parable_ledger.staff_onboarding (tenant_id, role_type);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_status ON parable_ledger.staff_onboarding (tenant_id, onboarding_status);

COMMENT ON TABLE parable_ledger.staff_onboarding IS
  'Employment onboarding + tax classification. Ministers: first payroll blocked until housing resolution in vault (app logic).';

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.staff_onboarding
  TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.staff_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_onboarding_all ON parable_ledger.staff_onboarding;
CREATE POLICY staff_onboarding_all ON parable_ledger.staff_onboarding
  FOR ALL TO postgres, service_role, authenticated, anon
  USING (true) WITH CHECK (true);

CREATE TRIGGER tr_staff_onboarding_updated
  BEFORE UPDATE ON parable_ledger.staff_onboarding
  FOR EACH ROW
  EXECUTE PROCEDURE parable_ledger.set_updated_at();
