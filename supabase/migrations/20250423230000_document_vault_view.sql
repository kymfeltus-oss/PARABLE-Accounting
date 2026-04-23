-- Document vault: optional hash column + v_compliance_status for UI glow / reporting

ALTER TABLE parable_ledger.compliance_mandates
ADD COLUMN IF NOT EXISTS document_hash TEXT;

COMMENT ON COLUMN parable_ledger.compliance_mandates.document_hash IS 'Optional integrity digest (e.g. SHA-256 hex) for vault verification.';

CREATE OR REPLACE VIEW parable_ledger.v_compliance_status AS
SELECT
    id,
    fiscal_year,
    mandate_type,
    status,
    document_url,
    board_approval_timestamp AS approved_at,
    CASE
        WHEN document_url IS NOT NULL THEN 'Verified'
        ELSE 'Missing Documentation'
    END AS verification_state
FROM parable_ledger.compliance_mandates;

GRANT SELECT ON parable_ledger.v_compliance_status TO postgres, anon, authenticated, service_role;
