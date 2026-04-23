-- =============================================================================
-- PARABLE: Genesis — default configuration when a new church (tenant) is created
-- Schema: parable_ledger. Requires: tenants, ministry_funds (tenant_id),
--         compliance_mandates (tenant_id), tenant_irs_coa_routes
--         (see supabase/migrations/20250423250000_genesis_funds_tenant_coa.sql)
-- =============================================================================

-- Run full migration for DDL (funds + COA table + trigger). This file is the
-- function + trigger only for SQL Editor re-apply, or for documentation.

CREATE OR REPLACE FUNCTION parable_ledger.provision_new_church(new_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
DECLARE
    y INT := (EXTRACT(YEAR FROM CURRENT_DATE))::INT;
BEGIN
    -- 1) Standard “Holy Trinity” + UBI (stream + 990-T router path)
    INSERT INTO parable_ledger.ministry_funds (tenant_id, fund_code, fund_name, is_restricted, metadata)
    VALUES
        (new_tenant_id, 'GEN', 'General / Unrestricted', false, '{"lane":"unrestricted","genesis":true}'::jsonb),
        (new_tenant_id, 'BLD', 'Building (Restricted)', true, '{"lane":"restricted_capex","genesis":true}'::jsonb),
        (new_tenant_id, 'MSN', 'Missions (Restricted)', true, '{"lane":"restricted_missions","genesis":true}'::jsonb),
        (new_tenant_id, 'UBI', 'Unrelated business income (990-T lane)', false, '{"lane":"990_t","genesis":true}'::jsonb)
    ON CONFLICT (tenant_id, fund_code) DO NOTHING;

    -- 2) Annual compliance mandates (pending, ready for board signatures / upload)
    INSERT INTO parable_ledger.compliance_mandates (tenant_id, fiscal_year, mandate_type, status, metadata)
    VALUES
        (new_tenant_id, y, 'HOUSING_ALLOWANCE', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb),
        (new_tenant_id, y, 'SECA_STATUS', 'pending', '{"genesis":true}'::jsonb),
        (new_tenant_id, y, 'ACCOUNTABLE_PLAN', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb),
        (new_tenant_id, y, 'BOARD_MINUTES', 'pending', '{"genesis":true,"board_packet":"pending_signatures"}'::jsonb)
    ON CONFLICT (tenant_id, fiscal_year, mandate_type) DO NOTHING;

    -- 3) Simplified IRS / 990 / 990-T class map
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

    -- 4) Default “Parable” cinematic look is already the tenant row defaults (#22d3ee / #050505).
END;
$$;

COMMENT ON FUNCTION parable_ledger.provision_new_church(uuid) IS
    'Genesis seed: funds, mandates, COA. Idempotent. Called automatically on INSERT into tenants.';

-- Optional: automatic run on new tenant
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

-- Manual: SELECT parable_ledger.provision_new_church('uuid-here');
