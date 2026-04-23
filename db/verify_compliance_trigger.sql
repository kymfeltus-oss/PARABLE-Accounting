-- Canonical migration: supabase/migrations/20250423220000_housing_compliance_trigger.sql
-- Run in Supabase SQL Editor after compliance_mandates + transactions (IRS columns) exist.

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
        NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
            || jsonb_build_object('compliance_error', 'Missing Board Resolution for Housing');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_check_housing ON parable_ledger.transactions;

CREATE TRIGGER trg_compliance_check_housing
BEFORE INSERT ON parable_ledger.transactions
FOR EACH ROW
WHEN (NEW.irs_category = 'Housing Allowance')
EXECUTE PROCEDURE parable_ledger.check_housing_compliance();
