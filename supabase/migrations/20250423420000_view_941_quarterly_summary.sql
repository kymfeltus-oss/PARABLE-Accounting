-- Read model for Quarterly Review 941 — mirrors quarterly_tax_reports with explicit column names for the UI.
CREATE OR REPLACE VIEW parable_ledger.view_941_quarterly_summary AS
SELECT
  q.tenant_id,
  q.tax_year,
  q.quarter,
  q.line2_total_wages AS line2_wages_tips_other_compensation,
  q.line3_federal_income_tax_withheld AS line3_federal_income_tax_withheld,
  q.line5a_taxable_social_security_wages AS line5a_social_security_wages,
  q.employer_fica_match,
  q.subtotal_salary_minister AS subtotal_minister_wages_excluded_from_ss_medicare,
  q.subtotal_salary_non_minister AS subtotal_non_minister_gross,
  (q.line3_federal_income_tax_withheld + 2.0 * q.employer_fica_match) AS total_modeled_deposit_liability,
  q.is_generated,
  q.computed_at,
  q.detail_json
FROM parable_ledger.quarterly_tax_reports q;

COMMENT ON VIEW parable_ledger.view_941_quarterly_summary IS
  'Form 941 EOQ read model: minister wages excluded from line 5a; FICA modeled as 2× employer match on 5a base.';

GRANT SELECT ON parable_ledger.view_941_quarterly_summary TO postgres, service_role, authenticated, anon;
