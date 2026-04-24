-- =============================================================================
-- PARABLE: White Label & schema bootstrap (parable_ledger)
-- 1) Run Supabase core migrations (parable_ledger core, COA, ERP) first, OR ensure
--    this file’s IF NOT EXISTS objects match what you need.
-- 2) In Dashboard → Settings → API → "Exposed schemas" add: parable_ledger
-- =============================================================================
-- Part A — Minimal white-label / API grants (as requested; safe to re-run)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS parable_ledger;

-- Chart of accounts: canonical shape is in migrations (tenant-scoped, UCOA). This
-- `IF NOT EXISTS` is for empty greenfield; skip if 20250423292000* already created the table.
CREATE TABLE IF NOT EXISTS parable_ledger.chart_of_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code integer UNIQUE NOT NULL,
    account_name text NOT NULL,
    category text NOT NULL,
    is_restricted boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Payroll stub: full columns come from 20250423350000_erp_payroll.sql
CREATE TABLE IF NOT EXISTS parable_ledger.erp_payroll (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000000',
    staff_name text NOT NULL,
    role_type text NOT NULL DEFAULT 'Secular Staff',
    gross_pay numeric(12, 2) NOT NULL,
    pay_period_end date NOT NULL
);

GRANT USAGE ON SCHEMA parable_ledger TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA parable_ledger TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA parable_ledger TO anon, authenticated, service_role;

-- =============================================================================
-- Part B — Tenants + RLS (previous white_label_schema; requires core `transactions` etc. from migrations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS parable_ledger.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    display_name text NOT NULL,
    legal_name text,
    primary_color text NOT NULL DEFAULT '#22d3ee',
    accent_color text NOT NULL DEFAULT '#050505',
    logo_url text,
    custom_domain text,
    tax_id_ein text,
    fiscal_year_start date NOT NULL DEFAULT '2026-01-01',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy installs: CREATE TABLE IF NOT EXISTS skipped; table may lack columns the app selects.
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS tax_id_ein TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS fiscal_year_start DATE NOT NULL DEFAULT '2026-01-01';

COMMENT ON TABLE parable_ledger.tenants IS 'White-label ministry tenants: branding + compliance identity.';
COMMENT ON COLUMN parable_ledger.tenants.legal_name IS 'Legal entity for board resolutions; defaults to display_name in app when null.';
COMMENT ON COLUMN parable_ledger.tenants.primary_color IS 'Neon / glow accent (hex).';
COMMENT ON COLUMN parable_ledger.tenants.accent_color IS 'Deep panel / cinematic background accent (hex).';

INSERT INTO parable_ledger.tenants (slug, display_name, legal_name, primary_color, accent_color, tax_id_ein)
VALUES (
    'parable-main',
    'PARABLE',
    'PARABLE Ministry ERP (Demo)',
    '#22d3ee',
    '#050505',
    NULL
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE parable_ledger.transactions
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES parable_ledger.tenants (id);

ALTER TABLE parable_ledger.compliance_mandates
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES parable_ledger.tenants (id);

UPDATE parable_ledger.transactions t
SET tenant_id = v.id
FROM parable_ledger.tenants v
WHERE v.slug = 'parable-main'
  AND t.tenant_id IS NULL;

UPDATE parable_ledger.compliance_mandates c
SET tenant_id = v.id
FROM parable_ledger.tenants v
WHERE v.slug = 'parable-main'
  AND c.tenant_id IS NULL;

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
AS $fn$
DECLARE
  y int;
BEGIN
  IF new.irs_category IS DISTINCT FROM 'Housing Allowance' THEN
    return new;
  end if;

  y := coalesce(
    (extract(YEAR FROM new.created_at))::int,
    (extract(YEAR FROM current_date))::int
  );

  IF not exists (
    SELECT 1
    FROM parable_ledger.compliance_mandates cm
    WHERE cm.tenant_id = new.tenant_id
      AND cm.fiscal_year = y
      AND cm.mandate_type = 'HOUSING_ALLOWANCE'
      AND cm.status = 'active'
  ) then
    new.audit_flag := true;
    new.metadata := jsonb_set(
      coalesce(new.metadata, '{}'::jsonb),
      '{compliance_error}',
      '"Missing Board Resolution for Housing"'::jsonb
    );
  end if;

  return new;
END
$fn$;

GRANT SELECT ON parable_ledger.tenants TO postgres, anon, authenticated, service_role;
GRANT insert, update, delete ON parable_ledger.tenants TO postgres, service_role;

ALTER TABLE parable_ledger.tenants enable row level security;

DROP policy IF exists tenants_select_all on parable_ledger.tenants;
CREATE policy tenants_select_all
  ON parable_ledger.tenants FOR select TO anon, authenticated USING (true);
