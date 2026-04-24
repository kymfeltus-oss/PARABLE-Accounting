-- Ensure BrandProvider / member portal can resolve NEXT_PUBLIC_TENANT_SLUG default (parable-master).
INSERT INTO parable_ledger.tenants (slug, display_name, legal_name, primary_color, accent_color)
SELECT
  'parable-master',
  'PARABLE Master Entity',
  'PARABLE Ministry ERP (Demo)',
  '#22d3ee',
  '#050505'
WHERE NOT EXISTS (
  SELECT 1 FROM parable_ledger.tenants WHERE slug = 'parable-master'
);

NOTIFY pgrst, 'reload schema';
