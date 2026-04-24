-- Plaid item storage (server / service role only) + erp_ledger as the canonical read surface for `transactions`

CREATE TABLE IF NOT EXISTS parable_ledger.plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
  item_id text NOT NULL,
  access_token text NOT NULL,
  institution_name text,
  transactions_cursor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_plaid_items_tenant_item UNIQUE (tenant_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_tenant ON parable_ledger.plaid_items (tenant_id);

COMMENT ON TABLE parable_ledger.plaid_items IS
  'Plaid access tokens (service role / Edge only). Never expose to the browser.';

ALTER TABLE parable_ledger.plaid_items ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated/anon cannot read; service_role bypasses RLS for API routes.

CREATE OR REPLACE VIEW parable_ledger.erp_ledger AS
SELECT
  t.id,
  t.tenant_id,
  t.fund_id,
  t.amount,
  t.tx_type,
  t.source,
  t.metadata,
  t.created_at,
  COALESCE(t.metadata ->> 'parable_verification_state', '') AS parable_verification_state
FROM parable_ledger.transactions t;

COMMENT ON VIEW parable_ledger.erp_ledger IS
  'Sovereign ERP ledger: same rows as parable_ledger.transactions. Plaid/Stripe append to the underlying table; use metadata.parable_verification_state for close pipeline.';

GRANT SELECT ON parable_ledger.erp_ledger TO postgres, service_role, authenticated, anon;
GRANT ALL ON parable_ledger.plaid_items TO postgres, service_role;
