-- =============================================================================
-- PARABLE Ledger — unified column guard + housing compliance trigger
-- Targets schema: parable_ledger (NOT public.transactions)
-- Run once in Supabase SQL Editor after core ledger migrations, or after any partial apply.
-- =============================================================================

-- 1. Ensure IRS / audit columns exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'parable_ledger'
          AND table_name = 'transactions'
          AND column_name = 'irs_category'
    ) THEN
        ALTER TABLE parable_ledger.transactions
            ADD COLUMN irs_category TEXT NOT NULL DEFAULT 'Program Service Revenue';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'parable_ledger'
          AND table_name = 'transactions'
          AND column_name = 'audit_flag'
    ) THEN
        ALTER TABLE parable_ledger.transactions
            ADD COLUMN audit_flag BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'parable_ledger'
          AND table_name = 'transactions'
          AND column_name = 'is_ubi'
    ) THEN
        ALTER TABLE parable_ledger.transactions
            ADD COLUMN is_ubi BOOLEAN NOT NULL DEFAULT false;
    END IF;
END;
$$;

-- 2. Drop legacy trigger names (avoid duplicates)
DROP TRIGGER IF EXISTS trg_compliance_check ON parable_ledger.transactions;
DROP TRIGGER IF EXISTS trg_compliance_check_housing ON parable_ledger.transactions;

-- 3. Function — NULL-safe category check; mandates live in parable_ledger.compliance_mandates
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

-- 4. Trigger (PostgreSQL: EXECUTE PROCEDURE for trigger functions)
CREATE TRIGGER trg_compliance_check
BEFORE INSERT ON parable_ledger.transactions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.check_housing_compliance();

COMMENT ON FUNCTION parable_ledger.check_housing_compliance IS 'Flags Housing Allowance ledger rows missing an active HOUSING_ALLOWANCE mandate for the row fiscal year.';
