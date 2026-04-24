-- PARABLE: Full Institutional Schema Rebuild (dev / blank-slate)
-- This script can clear "relation already exists" in the target schema (default: public).
--
-- WARNING: The shipping app uses `parable_ledger.*` from Supabase migrations. This file
-- creates unschema-qualified objects (public). It does NOT replace parable_ledger. Run only
-- in a throwaway DB or a schema you own; it will DROP the named objects if they exist in public.
--
-- Requires: gen_random_uuid() (built-in in Supabase / PostgreSQL 13+)

-- 1. CLEAN SLATE: Remove old versions (public schema)
DROP VIEW IF EXISTS view_941_quarterly_summary CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS erp_payroll CASCADE;

-- 2. PILLAR A: The Institutional Ledger (UCOA)
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code INTEGER UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    category TEXT NOT NULL,
    is_restricted BOOLEAN DEFAULT false,
    parent_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PILLAR B: The Payroll Engine (941 & Housing Shield)
CREATE TABLE erp_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    staff_name TEXT NOT NULL,
    role_type TEXT NOT NULL DEFAULT 'Secular Staff', -- 'Minister' or 'Secular Staff'
    gross_pay DECIMAL(12, 2) NOT NULL,
    housing_allowance DECIMAL(12, 2) DEFAULT 0,
    tax_withholding DECIMAL(12, 2) DEFAULT 0,
    pay_period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PILLAR C: The 941 Compliance View (group by year + quarter so YTDs do not mix years)
CREATE VIEW view_941_quarterly_summary AS
SELECT
    tenant_id,
    (date_part('year', pay_period_end))::integer AS tax_year,
    (date_part('quarter', pay_period_end))::integer AS quarter,
    SUM(gross_pay) AS line_2_total_wages,
    SUM(CASE WHEN role_type = 'Secular Staff' THEN gross_pay ELSE 0 END) AS taxable_social_security_wages,
    SUM(tax_withholding) AS line_3_income_tax_withheld
FROM erp_payroll
GROUP BY
    tenant_id,
    (date_part('year', pay_period_end)),
    (date_part('quarter', pay_period_end));

-- 5. SEED DATA: Populate the Ledger DNA
INSERT INTO chart_of_accounts (code, account_name, category, is_restricted)
VALUES
(1010, 'Operating Cash', 'Asset', false),
(3100, 'Building Fund (Restricted)', 'Asset', true),
(4010, 'Tithes & Offerings', 'Income', false),
(5020, 'Minister Housing Allowance', 'Expense', false),
(7100, 'Guest Honorariums', 'Expense', false);
