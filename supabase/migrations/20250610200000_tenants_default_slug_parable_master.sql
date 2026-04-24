-- Align seed tenant handle with `PARABLE_DEFAULT_TENANT_SLUG` in `supabaseClient.js` (parable-master).
-- Fresh installs that still have the legacy `parable-main` row are updated in place (id unchanged).

UPDATE parable_ledger.tenants
SET
  slug = 'parable-master',
  display_name = 'PARABLE Master Entity',
  legal_name = coalesce(nullif(btrim(legal_name), ''), 'PARABLE Master Entity')
WHERE slug = 'parable-main';
