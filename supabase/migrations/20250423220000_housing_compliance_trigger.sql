-- =============================================================================
-- Sovereign Accord — housing row compliance flag (aligned with fix_ledger_and_trigger.sql)
-- =============================================================================

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
        WHERE cm.fiscal_year = y
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

DROP TRIGGER IF EXISTS trg_compliance_check ON parable_ledger.transactions;
DROP TRIGGER IF EXISTS trg_compliance_check_housing ON parable_ledger.transactions;

CREATE TRIGGER trg_compliance_check
BEFORE INSERT ON parable_ledger.transactions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.check_housing_compliance();

COMMENT ON FUNCTION parable_ledger.check_housing_compliance IS 'Flags Housing Allowance ledger rows missing an active HOUSING_ALLOWANCE mandate for the row fiscal year.';
