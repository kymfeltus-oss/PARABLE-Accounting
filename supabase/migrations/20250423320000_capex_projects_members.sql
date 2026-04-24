-- CapEx / building projects, AP linkage, congregation members, stewardship view

CREATE TABLE IF NOT EXISTS parable_ledger.capex_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    fund_id UUID NOT NULL REFERENCES parable_ledger.ministry_funds (id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
    retainage NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capex_tenant ON parable_ledger.capex_projects (tenant_id, status);

DROP TRIGGER IF EXISTS tr_capex_updated ON parable_ledger.capex_projects;
CREATE TRIGGER tr_capex_updated
BEFORE UPDATE ON parable_ledger.capex_projects
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.set_updated_at();

ALTER TABLE parable_ledger.accounts_payable
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES parable_ledger.capex_projects (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS milestone_label TEXT;

CREATE INDEX IF NOT EXISTS idx_ap_project ON parable_ledger.accounts_payable (tenant_id, project_id);

-- Membership pulse (separate from auth.users; CRM-style roster)
CREATE TABLE IF NOT EXISTS parable_ledger.congregation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    member_kind TEXT NOT NULL DEFAULT 'active' CHECK (member_kind IN ('active', 'inactive', 'digital')),
    joined_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_congregation_tenant ON parable_ledger.congregation_members (tenant_id, created_at DESC);

-- YTD giving per member (transactions.metadata.member_id = member id as text)
-- Brownfield roster tables may omit member_kind; synthesize for the view.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'congregation_members' AND column_name = 'member_kind'
  ) THEN
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          m.member_kind,
          COALESCE(SUM(ABS(t.amount::numeric)), 0)::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN parable_ledger.transactions t
          ON t.tenant_id = m.tenant_id
         AND t.tx_type = 'donation'
         AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
         AND (t.metadata->>'member_id') = m.id::text
      GROUP BY m.tenant_id, m.id, m.full_name, m.member_kind
    $vk$;
  ELSE
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          'active'::text AS member_kind,
          COALESCE(SUM(ABS(t.amount::numeric)), 0)::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN parable_ledger.transactions t
          ON t.tenant_id = m.tenant_id
         AND t.tx_type = 'donation'
         AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
         AND (t.metadata->>'member_id') = m.id::text
      GROUP BY m.tenant_id, m.id, m.full_name
    $vk$;
  END IF;
END $$;

GRANT SELECT ON parable_ledger.capex_projects TO postgres, service_role, authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON parable_ledger.capex_projects TO postgres, service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.congregation_members TO postgres, service_role, authenticated, anon;
GRANT SELECT ON parable_ledger.v_member_stewardship_giving TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.capex_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE parable_ledger.congregation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capex_all ON parable_ledger.capex_projects;
CREATE POLICY capex_all ON parable_ledger.capex_projects FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS congregation_all ON parable_ledger.congregation_members;
CREATE POLICY congregation_all ON parable_ledger.congregation_members FOR ALL TO postgres, service_role, authenticated, anon
    USING (true) WITH CHECK (true);

COMMENT ON TABLE parable_ledger.capex_projects IS 'Building / restoration projects tied to a restricted fund; AP lines may attach.';
