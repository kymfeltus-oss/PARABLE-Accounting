-- Form 941 PDF / packet generation flag
ALTER TABLE parable_ledger.quarterly_tax_reports
    ADD COLUMN IF NOT EXISTS is_generated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN parable_ledger.quarterly_tax_reports.is_generated IS
    'Set true in-app when the user has generated a Form 941 (or equivalent) packet for this period.';
