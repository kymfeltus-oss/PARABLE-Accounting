-- Member portal: link congregants to Supabase Auth + member_statements view + RLS for authenticated (ERP stays on anon)

ALTER TABLE parable_ledger.congregation_members
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_congregation_auth_user
  ON parable_ledger.congregation_members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_congregation_tenant_email
  ON parable_ledger.congregation_members (tenant_id, email)
  WHERE email IS NOT NULL;

COMMENT ON COLUMN parable_ledger.congregation_members.auth_user_id IS
  'Supabase Auth user; when set, RLS on member_contributions can scope SELECT to this member.';

-- Member-safe statement view (invoker RLS on underlying table)
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
  'YTD / history for members. Uses RLS on member_contributions for authenticated; anon ERP unchanged.';

GRANT SELECT ON parable_ledger.member_statements TO postgres, service_role, authenticated, anon;

-- Tighten member_contributions: ERP browser uses anon key; member portal uses authenticated JWT
DROP POLICY IF EXISTS member_contributions_all ON parable_ledger.member_contributions;
DROP POLICY IF EXISTS member_contrib_auth_select_own ON parable_ledger.member_contributions;
DROP POLICY IF EXISTS member_contrib_auth_ins_self ON parable_ledger.member_contributions;
DROP POLICY IF EXISTS member_contrib_auth_upd_self ON parable_ledger.member_contributions;
DROP POLICY IF EXISTS member_contrib_anon_all ON parable_ledger.member_contributions;
DROP POLICY IF EXISTS member_contrib_service_all ON parable_ledger.member_contributions;

CREATE POLICY member_contrib_anon_all ON parable_ledger.member_contributions
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY member_contrib_service_all ON parable_ledger.member_contributions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated: only their congregation row
CREATE POLICY member_contrib_auth_select_own ON parable_ledger.member_contributions
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT c.id
      FROM parable_ledger.congregation_members c
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY member_contrib_auth_ins_self ON parable_ledger.member_contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT c.id
      FROM parable_ledger.congregation_members c
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY member_contrib_auth_upd_self ON parable_ledger.member_contributions
  FOR UPDATE TO authenticated
  USING (
    member_id IN (
      SELECT c.id
      FROM parable_ledger.congregation_members c
      WHERE c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT c.id
      FROM parable_ledger.congregation_members c
      WHERE c.auth_user_id = auth.uid()
    )
  );
