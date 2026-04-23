-- Canonical for CLI: supabase/migrations/20250423140002_parable_ledger_irs_columns.sql
-- =============================================================================
-- PARABLE Ledger — IRS 990 / 990-T column enhancements
-- Run AFTER db/parable_ledger_schema.sql (and ideally after db/audit_ready_views.sql).
-- Targets schema-qualified table: parable_ledger.transactions (NOT public.transactions).
-- =============================================================================
-- Append-only note: tr_transactions_append_only blocks UPDATE/DELETE on ledger rows.
--   is_ubi / irs_category should be set correctly at INSERT (stream router does this).
--   audit_flag cannot be toggled post-insert while append-only is enforced — use
--   metadata.reconciled / bank_match_id or a separate reconciliation_event table
--   if you need mutable review state without dropping the trigger.
-- =============================================================================

ALTER TABLE parable_ledger.transactions
    ADD COLUMN IF NOT EXISTS is_ubi BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS irs_category TEXT NOT NULL DEFAULT 'Program Service Revenue',
    ADD COLUMN IF NOT EXISTS audit_flag BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_compliance ON parable_ledger.transactions (is_ubi, irs_category);

COMMENT ON COLUMN parable_ledger.transactions.is_ubi IS 'True when revenue is gaming/ads/commerce lane (UBI / 990-T prep); also align contribution_nature + metadata.tax_lane.';
COMMENT ON COLUMN parable_ledger.transactions.irs_category IS '990-oriented bucket label for exports (not a substitute for professional return prep).';
COMMENT ON COLUMN parable_ledger.transactions.audit_flag IS 'Set at insert if automated rules flag for review; mutable only if append-only policy is relaxed.';

-- -----------------------------------------------------------------------------
-- Refresh compliance view to honor stored is_ubi while preserving legacy signals
-- -----------------------------------------------------------------------------
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

COMMENT ON VIEW parable_ledger.v_transactions_compliance IS 'Effective is_ubi merges stored flag + legacy contribution_nature/metadata; exposes irs_category for 990 exports.';

GRANT SELECT ON parable_ledger.v_transactions_compliance TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_irs_990t_summary TO postgres, anon, authenticated, service_role;
GRANT SELECT ON parable_ledger.rpt_high_value_donor_candidates TO postgres, anon, authenticated, service_role;
