-- Foundry synthetic tenant (ERP default scope) + read models for the accounting dashboard.

INSERT INTO parable_ledger.tenants (id, slug, display_name, legal_name, primary_color, accent_color)
SELECT
    '00000000-0000-0000-0000-000000000000'::UUID,
    'foundry',
    'Foundry',
    'Foundry',
    '#22d3ee',
    '#0f172a'
WHERE NOT EXISTS (SELECT 1 FROM parable_ledger.tenants t WHERE t.id = '00000000-0000-0000-0000-000000000000'::UUID);

-- Live join: general_ledger lines with chart of accounts (UCOA) metadata by tenant + code.
CREATE OR REPLACE VIEW parable_ledger.view_live_ledger_feed AS
SELECT
    gl.id,
    gl.tenant_id,
    gl.created_at,
    gl.account_code,
    COALESCE(coa.account_name, 'Code ' || gl.account_code::TEXT) AS account_name,
    gl.debit,
    gl.credit,
    gl.narrative,
    gl.journal_entry_id
FROM parable_ledger.general_ledger gl
LEFT JOIN parable_ledger.chart_of_accounts coa
    ON coa.tenant_id = gl.tenant_id
   AND coa.account_code = gl.account_code;

-- Placeholder: abnormal balance heuristics should be extended with full trial-balance / fund logic.
-- Returns no rows until you wire detection; UI reads only non-healthy rows in app layer when rows exist.
CREATE OR REPLACE VIEW parable_ledger.view_accounting_alerts AS
SELECT
    c.tenant_id,
    c.account_code,
    c.account_name,
    'PENDING_REVIEW'::TEXT AS health_status,
    CASE
        WHEN c.category IN ('Asset', 'Expense') THEN 'debit'
        ELSE 'credit'
    END AS normal_balance
FROM parable_ledger.chart_of_accounts c
WHERE FALSE;

GRANT SELECT ON parable_ledger.view_live_ledger_feed TO postgres, service_role, authenticated, anon;
GRANT SELECT ON parable_ledger.view_accounting_alerts TO postgres, service_role, authenticated, anon;
