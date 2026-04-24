-- =============================================================================
-- PARABLE Ledger — IRS columns + compliance view refresh
-- =============================================================================

ALTER TABLE parable_ledger.transactions
    ADD COLUMN IF NOT EXISTS is_ubi BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS irs_category TEXT NOT NULL DEFAULT 'Program Service Revenue',
    ADD COLUMN IF NOT EXISTS audit_flag BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_compliance ON parable_ledger.transactions (is_ubi, irs_category);

COMMENT ON COLUMN parable_ledger.transactions.is_ubi IS 'True when revenue is gaming/ads/commerce lane (UBI / 990-T prep); also align contribution_nature + metadata.tax_lane.';
COMMENT ON COLUMN parable_ledger.transactions.irs_category IS '990-oriented bucket label for exports (not a substitute for professional return prep).';
COMMENT ON COLUMN parable_ledger.transactions.audit_flag IS 'Set at insert if automated rules flag for review; mutable only if append-only policy is relaxed.';

-- PG cannot rename view columns via CREATE OR REPLACE VIEW; drop dependents first.
DROP VIEW IF EXISTS parable_ledger.rpt_irs_990t_summary CASCADE;
DROP VIEW IF EXISTS parable_ledger.v_transactions_compliance CASCADE;

CREATE VIEW parable_ledger.v_transactions_compliance AS
SELECT
    t.id,
    t.fund_id,
    t.amount,
    t.tx_type,
    t.source,
    t.is_tax_deductible,
    t.contribution_nature,
    t.metadata,
    t.created_at,
    t.is_ubi AS is_ubi_stored,
    t.irs_category,
    t.audit_flag,
    (
        COALESCE(t.is_ubi, false)
        OR t.contribution_nature = 'ubit_candidate'
        OR (t.metadata ->> 'tax_lane') IN ('990-T_UBI', '990-T')
    ) AS is_ubi,
    CASE
        WHEN COALESCE(t.is_ubi, false)
            OR t.contribution_nature = 'ubit_candidate'
            OR (t.metadata ->> 'tax_lane') IN ('990-T_UBI', '990-T') THEN '990-T_UBI'
        ELSE COALESCE(NULLIF(trim(t.metadata ->> 'tax_lane'), ''), 'mission_exempt')
    END AS tax_category
FROM parable_ledger.transactions t;

CREATE OR REPLACE VIEW parable_ledger.rpt_irs_990t_summary AS
SELECT
    EXTRACT(YEAR FROM created_at)::integer AS tax_year,
    SUM(amount) FILTER (
        WHERE
            is_ubi
            AND tx_type <> 'reversal'
    ) AS total_ubi_class_revenue,
    CASE
        WHEN COALESCE(
            SUM(amount) FILTER (
                WHERE
                    is_ubi
                    AND tx_type <> 'reversal'
            ),
            0
        ) >= 1000 THEN 'REVIEW_990_T_THRESHOLD_TYPICALLY_1K_GROSS'
        ELSE 'BELOW_COMMON_1K_INDICATOR'
    END AS filing_indicator
FROM parable_ledger.v_transactions_compliance
GROUP BY 1;

GRANT SELECT ON parable_ledger.v_transactions_compliance TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_irs_990t_summary TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_high_value_donor_candidates TO postgres, anon, authenticated, service_role;
