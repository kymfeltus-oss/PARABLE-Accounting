-- Member-facing secure surface (run after migrations, or use 20260423140000 in supabase/migrations)
-- parable_ledger.member_contributions.member_id points to congregation_members.id (NOT auth.users).
-- Link members with Supabase Auth via: congregation_members.auth_user_id = auth.users.id
-- and optional email/phone for magic-link matching.

-- 1) Link columns (idempotent; see migration 20260423140000 for canonical version)
-- ALTER TABLE parable_ledger.congregation_members
--   ADD COLUMN IF NOT EXISTS email TEXT,
--   ADD COLUMN IF NOT EXISTS phone TEXT,
--   ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_congregation_auth_user ON parable_ledger.congregation_members (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2) Read model: one row per contribution with fund label (no CFO-only columns)
-- RLS on member_contributions (see migration) limits authenticated users to their own rows;
-- anon/service_role keep full access for the ERP.
CREATE OR REPLACE VIEW parable_ledger.member_statements
WITH (security_invoker = true) AS
SELECT
  mc.id,
  mc.tenant_id,
  mc.amount,
  mf.fund_name,
  COALESCE(mc."timestamp", mc.created_at) AS created_at,
  mc.status
FROM parable_ledger.member_contributions mc
INNER JOIN parable_ledger.ministry_funds mf
  ON mf.tenant_id = mc.tenant_id
 AND mf.fund_code = mc.fund_id;

COMMENT ON VIEW parable_ledger.member_statements IS
  'Member-safe statement lines: own rows only when RLS on member_contributions restricts SELECT to linked auth user.';

-- GRANT SELECT ON parable_ledger.member_statements TO authenticated, anon, service_role;
-- (Grants are applied in the migration)
