-- Multi-tenant white-label: tenants + tenant_id on transactions & compliance_mandates

CREATE TABLE IF NOT EXISTS parable_ledger.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    legal_name TEXT,
    primary_color TEXT NOT NULL DEFAULT '#22d3ee',
    accent_color TEXT NOT NULL DEFAULT '#050505',
    logo_url TEXT,
    custom_domain TEXT,
    tax_id_ein TEXT,
    fiscal_year_start DATE NOT NULL DEFAULT '2026-01-01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN parable_ledger.tenants.legal_name IS 'Legal entity for board resolutions; app falls back to display_name when null.';

-- Legacy bootstrap tables may require organization_name NOT NULL; multitenant-only rows omit it.
INSERT INTO parable_ledger.tenants (slug, display_name, legal_name, primary_color, accent_color, organization_name)
SELECT 'parable-main', 'PARABLE', 'PARABLE Ministry ERP (Demo)', '#22d3ee', '#050505', 'PARABLE Ministry ERP (Demo)'
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'tenants' AND column_name = 'organization_name'
  )
  AND NOT EXISTS (SELECT 1 FROM parable_ledger.tenants WHERE slug = 'parable-main');

INSERT INTO parable_ledger.tenants (slug, display_name, legal_name, primary_color, accent_color)
SELECT 'parable-main', 'PARABLE', 'PARABLE Ministry ERP (Demo)', '#22d3ee', '#050505'
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'tenants' AND column_name = 'organization_name'
  )
  AND NOT EXISTS (SELECT 1 FROM parable_ledger.tenants WHERE slug = 'parable-main');

ALTER TABLE parable_ledger.transactions
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES parable_ledger.tenants (id);

ALTER TABLE parable_ledger.compliance_mandates
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES parable_ledger.tenants (id);

UPDATE parable_ledger.transactions t
SET tenant_id = v.id
FROM parable_ledger.tenants v
WHERE v.slug = 'parable-main' AND t.tenant_id IS NULL;

UPDATE parable_ledger.compliance_mandates c
SET tenant_id = v.id
FROM parable_ledger.tenants v
WHERE v.slug = 'parable-main' AND c.tenant_id IS NULL;

ALTER TABLE parable_ledger.transactions
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE parable_ledger.compliance_mandates
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE parable_ledger.compliance_mandates
DROP CONSTRAINT IF EXISTS uq_compliance_mandate_year_type;

ALTER TABLE parable_ledger.compliance_mandates
ADD CONSTRAINT uq_compliance_mandate_tenant_year_type UNIQUE (tenant_id, fiscal_year, mandate_type);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created ON parable_ledger.transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_mandates_tenant_year ON parable_ledger.compliance_mandates (tenant_id, fiscal_year DESC);

CREATE OR REPLACE FUNCTION parable_ledger.check_housing_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    y INTEGER;
BEGIN
    IF NEW.irs_category IS DISTINCT FROM 'Housing Allowance' THEN
        RETURN NEW;
    END IF;

    y := COALESCE(EXTRACT(YEAR FROM NEW.created_at)::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

    IF NOT EXISTS (
        SELECT 1
        FROM parable_ledger.compliance_mandates cm
        WHERE cm.tenant_id = NEW.tenant_id
          AND cm.fiscal_year = y
          AND cm.mandate_type = 'HOUSING_ALLOWANCE'
          AND cm.status = 'active'
    ) THEN
        NEW.audit_flag := true;
        NEW.metadata := jsonb_set(
            COALESCE(NEW.metadata, '{}'::jsonb),
            '{compliance_error}',
            '"Missing Board Resolution for Housing"'::jsonb
        );
    END IF;

    RETURN NEW;
END;
$$;

GRANT SELECT ON parable_ledger.tenants TO postgres, anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON parable_ledger.tenants TO postgres, service_role;

ALTER TABLE parable_ledger.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_all ON parable_ledger.tenants;
CREATE POLICY tenants_select_all
    ON parable_ledger.tenants FOR SELECT TO anon, authenticated USING (true);
