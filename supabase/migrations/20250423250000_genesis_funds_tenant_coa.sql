-- Ministry funds scoped to tenant + IRS routing template + idempotent church provisioning

-- 1) Link funds to tenant (per-ministry fund segregation)
ALTER TABLE parable_ledger.ministry_funds
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES parable_ledger.tenants (id);

UPDATE parable_ledger.ministry_funds mf
SET tenant_id = t.id
FROM parable_ledger.tenants t
WHERE t.slug = 'parable-main'
  AND mf.tenant_id IS NULL;

ALTER TABLE parable_ledger.ministry_funds
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE parable_ledger.ministry_funds
    DROP CONSTRAINT IF EXISTS ministry_funds_fund_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ministry_funds_tenant_fundcode
    ON parable_ledger.ministry_funds (tenant_id, fund_code);

-- 2) Per-tenant “IRS / 990-T” routing map (simplified chart for exports & drill-down)
CREATE TABLE parable_ledger.tenant_irs_coa_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    line_code TEXT NOT NULL,
    line_label TEXT NOT NULL,
    form_990_t_hint TEXT,
    is_ubi_lane BOOLEAN NOT NULL DEFAULT false,
    default_irs_category TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_irs_coa_tenant_code UNIQUE (tenant_id, line_code)
);

COMMENT ON TABLE parable_ledger.tenant_irs_coa_routes IS
    'Starter “chart” lines pre-mapped for 990/990-T narrative lanes; extend per ministry.';

CREATE INDEX IF NOT EXISTS idx_tenant_irs_coa_tenant ON parable_ledger.tenant_irs_coa_routes (tenant_id, sort_order);

-- 3) Core provision routine (idempotent: safe to re-run)
CREATE OR REPLACE FUNCTION parable_ledger.provision_new_church(new_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
DECLARE
    y INT := (EXTRACT(YEAR FROM CURRENT_DATE))::INT;
BEGIN
    -- “Holy trinity” + UBI bucket for stream routing
    INSERT INTO parable_ledger.ministry_funds (tenant_id, fund_code, fund_name, is_restricted, metadata)
    VALUES
        (new_tenant_id, 'GEN', 'General / Unrestricted', false, '{"lane":"unrestricted","genesis":true}'::jsonb),
        (new_tenant_id, 'BLD', 'Building (Restricted)', true, '{"lane":"restricted_capex","genesis":true}'::jsonb),
        (new_tenant_id, 'MSN', 'Missions (Restricted)', true, '{"lane":"restricted_missions","genesis":true}'::jsonb),
        (new_tenant_id, 'UBI', 'Unrelated business income (990-T lane)', false, '{"lane":"990_t","genesis":true}'::jsonb)
    ON CONFLICT (tenant_id, fund_code) DO NOTHING;

    -- Sovereign Accord: four annual mandates, pending
    INSERT INTO parable_ledger.compliance_mandates (
        tenant_id, fiscal_year, mandate_type, status, metadata
    ) VALUES
        (new_tenant_id, y, 'HOUSING_ALLOWANCE', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb),
        (new_tenant_id, y, 'SECA_STATUS', 'pending', '{"genesis":true}'::jsonb),
        (new_tenant_id, y, 'ACCOUNTABLE_PLAN', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb),
        (new_tenant_id, y, 'BOARD_MINUTES', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb)
    ON CONFLICT (tenant_id, fiscal_year, mandate_type) DO NOTHING;

    -- Starter IRS / 990-T class map
    INSERT INTO parable_ledger.tenant_irs_coa_routes (
        tenant_id, line_code, line_label, form_990_t_hint, is_ubi_lane, default_irs_category, sort_order
    ) VALUES
        (new_tenant_id, 'CASH_GIFTS', 'Cash & pledged contributions', 'Form 990 Part VIII', false, 'Contributions', 10),
        (new_tenant_id, 'OTHER_GIFTS', 'Gifts in kind & noncash', 'Form 990 Part VIII', false, 'Contributions', 20),
        (new_tenant_id, 'PROGRAM', 'Program services & ministry operations', 'Part III / IX', false, 'Program Service Revenue', 30),
        (new_tenant_id, 'OCC', 'Occupancy, utilities, and facility', 'Form 990 Part IX', false, 'Program Service Expense', 40),
        (new_tenant_id, 'PAYROLL', 'Payroll and housing designations (subject to 941/ W-2)', 'Form 990 & payroll', false, 'Program Service Expense', 50),
        (new_tenant_id, 'UBI_STREAM', 'Gaming, ads, and sponsorships (classify to 990-T)', 'Form 990-T typically', true, 'Unrelated Business Income', 60)
    ON CONFLICT (tenant_id, line_code) DO NOTHING;

END;
$$;

-- 4) Run on every new tenant
CREATE OR REPLACE FUNCTION parable_ledger.tr_tenants_genesis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
BEGIN
    PERFORM parable_ledger.provision_new_church(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tenants_provision_genesis ON parable_ledger.tenants;
CREATE TRIGGER tr_tenants_provision_genesis
    AFTER INSERT ON parable_ledger.tenants
    FOR EACH ROW
    EXECUTE PROCEDURE parable_ledger.tr_tenants_genesis();

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.tenant_irs_coa_routes TO postgres, service_role, authenticated, anon;
ALTER TABLE parable_ledger.tenant_irs_coa_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_irs_coa_routes_all
    ON parable_ledger.tenant_irs_coa_routes FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);

GRANT INSERT ON parable_ledger.tenants TO authenticated;
DROP POLICY IF EXISTS tenants_insert_authenticated ON parable_ledger.tenants;
CREATE POLICY tenants_insert_authenticated
    ON parable_ledger.tenants FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON FUNCTION parable_ledger.provision_new_church(uuid) IS
    'Idempotent “genesis” seed: standard funds, compliance mandates, IRS/990-T coa map.';
