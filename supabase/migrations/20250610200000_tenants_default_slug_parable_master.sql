-- Align seed tenant handle with `PARABLE_DEFAULT_TENANT_SLUG` in `supabaseClient.js` (parable-master).
-- Fresh installs that still have the legacy `parable-main` row are updated in place (id unchanged).

UPDATE parable_ledger.tenants t
SET
  slug = 'parable-master',
  display_name = 'PARABLE Master Entity',
  legal_name = coalesce(nullif(btrim(t.legal_name), ''), 'PARABLE Master Entity')
WHERE t.slug = 'parable-main'
  AND NOT EXISTS (
    SELECT 1 FROM parable_ledger.tenants x WHERE x.slug = 'parable-master' AND x.id IS DISTINCT FROM t.id
  );
