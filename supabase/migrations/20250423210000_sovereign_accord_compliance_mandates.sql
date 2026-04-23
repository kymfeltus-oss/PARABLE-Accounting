-- =============================================================================
-- Sovereign Accord — compliance mandates (housing, SECA, accountable plan, board)
-- Schema: parable_ledger (same API exposure as ledger tables)
-- =============================================================================

CREATE TABLE parable_ledger.compliance_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE))::integer,
    mandate_type TEXT NOT NULL
        CHECK (mandate_type IN ('HOUSING_ALLOWANCE', 'SECA_STATUS', 'ACCOUNTABLE_PLAN', 'BOARD_MINUTES')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'expired', 'archived')),
    document_url TEXT,
    approved_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    board_approval_timestamp TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_compliance_mandate_year_type UNIQUE (fiscal_year, mandate_type)
);

CREATE INDEX idx_compliance_mandates_year ON parable_ledger.compliance_mandates (fiscal_year DESC);
CREATE INDEX idx_compliance_mandates_type ON parable_ledger.compliance_mandates (mandate_type);

COMMENT ON TABLE parable_ledger.compliance_mandates IS 'Sovereign Accord: annual pastor/board compliance artifacts and lock timestamps.';
COMMENT ON COLUMN parable_ledger.compliance_mandates.board_approval_timestamp IS 'Set when the board "Lock" action records approval in-app.';
COMMENT ON COLUMN parable_ledger.compliance_mandates.metadata IS 'e.g. {"housing_amount_usd":30000,"reported_salary_usd":60000} for Tax Shield UI.';

CREATE OR REPLACE FUNCTION parable_ledger.set_compliance_mandates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_compliance_mandates_updated_at
BEFORE UPDATE ON parable_ledger.compliance_mandates
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.set_compliance_mandates_updated_at();

GRANT ALL PRIVILEGES ON TABLE parable_ledger.compliance_mandates TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parable_ledger.compliance_mandates TO authenticated;
GRANT SELECT ON TABLE parable_ledger.compliance_mandates TO anon;

ALTER TABLE parable_ledger.compliance_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_mandates_select_authenticated
    ON parable_ledger.compliance_mandates FOR SELECT TO authenticated USING (true);

CREATE POLICY compliance_mandates_insert_authenticated
    ON parable_ledger.compliance_mandates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY compliance_mandates_update_authenticated
    ON parable_ledger.compliance_mandates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY compliance_mandates_delete_authenticated
    ON parable_ledger.compliance_mandates FOR DELETE TO authenticated USING (true);

-- Storage: create bucket "mandate-documents" in Dashboard (private) and add policies as needed.
