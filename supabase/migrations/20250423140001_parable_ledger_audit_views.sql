-- =============================================================================
-- PARABLE Ledger — UBI fund seed + reporting views
-- =============================================================================

INSERT INTO parable_ledger.ministry_funds (fund_code, fund_name, is_restricted, metadata)
VALUES (
    'UBI',
    'Unrelated business income (990-T lane)',
    false,
    '{"lane":"990-T","note":"Classify with counsel; router maps ad/sponsor/pay-to-play here."}'::jsonb
)
ON CONFLICT (fund_code) DO NOTHING;

CREATE OR REPLACE VIEW parable_ledger.v_transactions_compliance AS
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
    (
        t.contribution_nature = 'ubit_candidate'
        OR (t.metadata ->> 'tax_lane') IN ('990-T_UBI', '990-T')
    ) AS is_ubi,
    COALESCE(
        t.metadata ->> 'tax_lane',
        CASE
            WHEN t.contribution_nature = 'ubit_candidate' THEN '990-T_UBI'
            ELSE 'mission_exempt'
        END
    ) AS tax_category
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

CREATE OR REPLACE VIEW parable_ledger.rpt_high_value_donor_candidates AS
SELECT
    COALESCE(metadata ->> 'donor_user_id', metadata ->> 'parable_user_id', '') AS donor_ref,
    EXTRACT(YEAR FROM created_at)::integer AS tax_year,
    SUM(amount) AS annual_contribution,
    COUNT(*)::bigint AS gift_count
FROM parable_ledger.transactions
WHERE
    tx_type = 'donation'
    AND contribution_nature IN ('charitable_gift', 'mixed')
    AND COALESCE(metadata ->> 'donor_user_id', metadata ->> 'parable_user_id', '') <> ''
GROUP BY
    1,
    2
HAVING
    SUM(amount) >= 250;

GRANT SELECT ON parable_ledger.v_transactions_compliance TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_irs_990t_summary TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_high_value_donor_candidates TO postgres, anon, authenticated, service_role;
