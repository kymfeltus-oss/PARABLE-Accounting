-- AI / system communication log (batch emails, drafts, giving statements)

CREATE TABLE IF NOT EXISTS parable_ledger.member_communication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES parable_ledger.congregation_members (id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'ai_email' CHECK (channel IN ('ai_email', 'system', 'template', 'giving_statement')),
    subject TEXT,
    body_preview TEXT,
    template_key TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_comm_tenant_member_time
  ON parable_ledger.member_communication_log (tenant_id, member_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.member_communication_log
  TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.member_communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_comm_all ON parable_ledger.member_communication_log
  FOR ALL TO postgres, service_role, authenticated, anon
  USING (true) WITH CHECK (true);

COMMENT ON TABLE parable_ledger.member_communication_log IS
  'Dossier: AI and system comms; optional append from workers when sending.';
