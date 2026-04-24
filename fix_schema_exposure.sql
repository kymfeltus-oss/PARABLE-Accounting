-- =============================================================================
-- Sovereign permissions: expose parable_ledger to PostgREST
-- Run in Supabase SQL Editor (or psql) after the schema and migrations exist.
-- =============================================================================
--
-- IMPORTANT — Supabase Cloud vs local:
-- • The PRIMARY fix for “schema not found” in hosted projects is
--   Dashboard → Settings → API → Exposed schemas:  public, parable_ledger
--   (exactly; save at the bottom of the page).
-- • The statements below can require elevated privileges. On some tiers,
--   ALTER ROLE authenticator … may be restricted; rely on the Dashboard
--   when ALTER is not allowed.
-- • NOTIFY pgrst, 'reload schema' tells PostgREST to reload (when supported).
--   If NOTIFY is not available, the API cache can take up to ~10 minutes
--   to see new objects unless the project is redeployed or the cache flushes.
-- =============================================================================

-- 1) Grant the API role families permission to use the schema
GRANT USAGE ON SCHEMA parable_ledger TO anon, authenticated, service_role;

-- 2) Authorize the API authenticator to see parable_ledger alongside public
--    (Must align with Dashboard → Exposed schemas, e.g.  public, parable_ledger )
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, parable_ledger';

-- 3) Force the API to refresh its OpenAPI / schema map immediately
NOTIFY pgrst, 'reload schema';

-- 4) Verify existing tables in the new schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'parable_ledger'
ORDER BY table_name;
