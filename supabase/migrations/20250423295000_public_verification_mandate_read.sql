-- Public verification page: allow read-only access to non-payroll compliance mandate status for anon (donor-facing /verify).
-- Application should still select a minimal column set; 941 line detail remains staff-only.

CREATE POLICY compliance_mandates_select_anon
    ON parable_ledger.compliance_mandates
    FOR SELECT
    TO anon
    USING (true);

COMMENT ON POLICY compliance_mandates_select_anon ON parable_ledger.compliance_mandates IS
    'Donor verification: mandate type/year/status only in UI; do not SELECT metadata in public client.';
