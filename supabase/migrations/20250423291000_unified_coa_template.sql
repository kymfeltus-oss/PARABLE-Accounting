-- UCOA-aligned reference Chart of Accounts (SFP + Statement of Activities).
-- Seeded in lockstep with chart_of_accounts_seed.csv in repo root.

CREATE TABLE parable_ledger.unified_coa_template (
    account_code TEXT NOT NULL
        CHECK (char_length(account_code) >= 4 AND char_length(account_code) <= 10),
    account_name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('Asset', 'Liability', 'Net Asset', 'Income', 'Expense')),
    sub_category TEXT NOT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (account_code)
);

COMMENT ON TABLE parable_ledger.unified_coa_template IS
    'Unified Chart of Accounts template: balance-sheet bands 1000–1999, 2000–2999, 3000–3999; activity 4000–4999, 5000–8999. Not tenant-scoped: copy/extend per tenant.';

CREATE OR REPLACE VIEW parable_ledger.v_unified_coa_default_statement AS
SELECT
    t.*,
    CASE
        WHEN t.category IN ('Asset', 'Liability', 'Net Asset') THEN 'Statement of Financial Position'
        ELSE 'Statement of Activities'
    END AS default_primary_statement
FROM parable_ledger.unified_coa_template t;

COMMENT ON VIEW parable_ledger.v_unified_coa_default_statement IS
    'Default mapping: SFP (balance sheet) vs SOA (income statement) by UCOA category.';

INSERT INTO parable_ledger.unified_coa_template (account_code, account_name, category, sub_category, is_restricted) VALUES
('1010', 'Operating Cash (Checking)', 'Asset', 'Cash', false),
('1020', 'Emergency Reserve (Savings)', 'Asset', 'Cash', false),
('1050', 'Restricted Funds Account (Building Missions)', 'Asset', 'Cash', true),
('1100', 'Accounts Receivable (Pledges Program Fees)', 'Asset', 'Receivables', false),
('1500', 'Land and Buildings', 'Asset', 'Fixed Asset', false),
('1550', 'Furniture and Equipment', 'Asset', 'Fixed Asset', false),
('1600', 'Accumulated Depreciation', 'Asset', 'Contra-Asset (credit balance)', false),
('2010', 'Accounts Payable (Unpaid Bills)', 'Liability', 'Current Liability', false),
('2100', 'Federal Payroll Tax Payable (941)', 'Liability', 'Payroll Tax Liability', false),
('2150', 'State/Local Tax Payable', 'Liability', 'Tax Liability', false),
('2200', 'Accrued Benefits/Retirement', 'Liability', 'Accrued Liability', false),
('2500', 'Mortgage Payable', 'Liability', 'Long-term Debt', false),
('2600', 'Notes Payable (Short-term)', 'Liability', 'Current / Notes', false),
('3010', 'Unrestricted Net Assets (General Equity)', 'Net Asset', 'Unrestricted', false),
('3100', 'Temporarily Restricted: Building Fund', 'Net Asset', 'Temporarily Restricted Building', true),
('3200', 'Temporarily Restricted: Missions', 'Net Asset', 'Temporarily Restricted Missions', true),
('3300', 'Temporarily Restricted: Benevolence', 'Net Asset', 'Temporarily Restricted Benevolence', true),
('4010', 'General Tithes and Offerings', 'Income', 'Contribution - Unrestricted', false),
('4020', 'Digital Streaming Revenue (Gifts)', 'Income', 'Contribution - Digital', false),
('4100', 'Restricted Contributions (Specific Giving)', 'Income', 'Contribution - Restricted', false),
('4200', 'Unrelated Business Income (UBI) Gaming/Commerce', 'Income', 'Business Income (990-T)', false),
('4500', 'Facility Rental Income', 'Income', 'Program / Rental', false),
('4600', 'Program Fees (Youth/Camps)', 'Income', 'Program / Fees', false),
('5010', 'Minister Salary', 'Expense', 'Personnel - Minister', false),
('5020', 'Minister Housing Allowance', 'Expense', 'Personnel - Minister Housing (Shield)', false),
('5050', 'Secular Staff Wages', 'Expense', 'Personnel - Non-Minister', false),
('5100', 'Employer Payroll Taxes (FICA Match)', 'Expense', 'Personnel - Payroll Tax', false),
('6010', 'Mortgage Interest', 'Expense', 'Facilities - Occupancy', false),
('6050', 'Utilities (Electric/Water/Gas)', 'Expense', 'Facilities - Occupancy', false),
('6100', 'Building Maintenance and Repairs', 'Expense', 'Facilities - Maintenance (1099)', false),
('6200', 'Janitorial Supplies', 'Expense', 'Facilities - Supplies', false),
('7010', 'Missions and Outreach', 'Expense', 'Ministry - Missions', false),
('7050', 'Streaming and Tech Subscriptions', 'Expense', 'Ministry - Technology', false),
('7100', 'Guest Speakers / Honorariums', 'Expense', 'Ministry - 1099 Tracking', false),
('7200', 'Benevolence Payments', 'Expense', 'Ministry - Benevolence', false),
('8010', 'Insurance (Property and Liability)', 'Expense', 'Admin - Insurance', false),
('8050', 'Professional Fees (Accounting/Legal)', 'Expense', 'Admin - Professional', false),
('8100', 'Office Supplies and Postage', 'Expense', 'Admin - General', false)
ON CONFLICT (account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    is_restricted = EXCLUDED.is_restricted;

GRANT SELECT ON parable_ledger.unified_coa_template TO postgres, service_role, authenticated, anon;
GRANT SELECT ON parable_ledger.v_unified_coa_default_statement TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.unified_coa_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY unified_coa_template_select
    ON parable_ledger.unified_coa_template
    FOR SELECT
    TO postgres, service_role, authenticated, anon
    USING (true);
