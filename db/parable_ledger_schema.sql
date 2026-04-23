-- Canonical for CLI: supabase/migrations/20250423140000_parable_ledger_core.sql
-- Apply remote: `npx supabase link --project-ref <ref>` then `npm run db:push`
-- (Or paste this file in Supabase Dashboard → SQL Editor.)
-- =============================================================================
-- PARABLE Ledger — initial schema (PostgreSQL / Supabase)
-- Fund segregation, append-only ledger posture, audit fingerprints.
-- Apply via Supabase SQL Editor, or: supabase db push after moving to migrations/.
--
-- Audit trigger uses auth.uid() (Supabase). On plain Postgres, replace that
-- expression in log_transaction_insert() with NULL or your session helper.
-- =============================================================================
-- Strategic notes (501(c)(3) / IRS):
--   • Restricted vs unrestricted = ministry_funds.is_restricted + separate fund rows.
--   • Do not rely on stored ministry_funds.balance for compliance close; derive from
--     posted lines or materialize via nightly job once double-entry journals exist.
--   • $250+ written acknowledgments: add acknowledgment_queue + PDF/hash columns later.
--   • UBIT: flag streams via contribution_nature / ubit_risk on revenue-like rows.
--   • 990/941/1099-NEC: export pipelines read from these tables; do not embed tax logic
--     in CHECK constraints — thresholds change with law and facts.
-- =============================================================================
-- Suggested apply order: (1) this file → (2) db/audit_ready_views.sql → (3) db/update_ledger_schema.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS parable_ledger;

-- -----------------------------------------------------------------------------
-- Funds (Building, Missions, General, …)
-- -----------------------------------------------------------------------------
CREATE TABLE parable_ledger.ministry_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code TEXT UNIQUE, -- short stable key, e.g. GEN, BLDG01
    fund_name TEXT NOT NULL, -- e.g. General, Missions, Youth
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00, -- optional cache; reconcile to lines
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE parable_ledger.ministry_funds IS 'Per-fund segregation for restricted/unrestricted net assets.';

CREATE OR REPLACE FUNCTION parable_ledger.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_ministry_funds_updated_at
BEFORE UPDATE ON parable_ledger.ministry_funds
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.set_updated_at();

-- -----------------------------------------------------------------------------
-- Ledger transactions (single-table starting point; evolve to journal + lines)
-- -----------------------------------------------------------------------------
-- contribution_nature:
--   charitable_gift     → typically tax-deductible to donor if 501(c)(3) rules met
--   exchange_transaction → payment for goods/services; generally NOT a donation
--   mixed                → split receipts (document outside this row or child lines)
--   ubit_candidate       → potential unrelated business income; review with counsel
CREATE TABLE parable_ledger.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES parable_ledger.ministry_funds (id),
    amount NUMERIC(14, 2) NOT NULL,
    tx_type TEXT NOT NULL CHECK (tx_type IN ('donation', 'revenue', 'expense', 'transfer', 'reversal')),
    source TEXT, -- e.g. 'Parable Stream', 'In-Person', 'Gaming Hub', 'Stripe'
    is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
    contribution_nature TEXT NOT NULL DEFAULT 'charitable_gift'
        CHECK (contribution_nature IN ('charitable_gift', 'exchange_transaction', 'mixed', 'ubit_candidate')),
    reverses_transaction_id UUID REFERENCES parable_ledger.transactions (id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- gateway ids, donor refs, audit notes
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reversal_amount CHECK (
        (tx_type <> 'reversal') OR (reverses_transaction_id IS NOT NULL)
    )
);

COMMENT ON TABLE parable_ledger.transactions IS 'Append-only economic events; correct via reversal row, not UPDATE/DELETE.';
COMMENT ON COLUMN parable_ledger.transactions.is_tax_deductible IS 'Donor-facing hint; final determination is facts + policy.';
COMMENT ON COLUMN parable_ledger.transactions.reverses_transaction_id IS 'When tx_type=reversal, points to the row being negated.';

-- Append-only: no updates or deletes on ledger rows (service-role migrations can drop trigger temporarily).
CREATE OR REPLACE FUNCTION parable_ledger.enforce_transactions_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'parable_ledger.transactions is append-only: insert a reversal row instead of UPDATE.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'parable_ledger.transactions is append-only: insert a reversal row instead of DELETE.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_transactions_append_only
BEFORE UPDATE OR DELETE ON parable_ledger.transactions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.enforce_transactions_append_only();

CREATE INDEX idx_transactions_fund_created ON parable_ledger.transactions (fund_id, created_at DESC);
CREATE INDEX idx_transactions_source ON parable_ledger.transactions (source);
CREATE INDEX idx_transactions_reverses ON parable_ledger.transactions (reverses_transaction_id)
    WHERE reverses_transaction_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Immutable audit log (who / when / why + payload snapshot)
-- -----------------------------------------------------------------------------
CREATE TABLE parable_ledger.ledger_audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_schema TEXT NOT NULL DEFAULT 'parable_ledger',
    entity_table TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('insert', 'void_request', 'policy_note', 'export', 'login_context')),
    actor_user_id UUID, -- Supabase auth.users.id when available
    reason TEXT,
    payload JSONB NOT NULL,
    request_id TEXT, -- correlate API / Edge Function request
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE parable_ledger.ledger_audit_log IS 'Write-mostly audit trail; never UPDATE/DELETE from app roles.';

CREATE OR REPLACE FUNCTION parable_ledger.enforce_audit_log_insert_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'parable_ledger.ledger_audit_log is insert-only.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_ledger_audit_log_insert_only
BEFORE UPDATE OR DELETE ON parable_ledger.ledger_audit_log
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.enforce_audit_log_insert_only();

CREATE INDEX idx_ledger_audit_entity ON parable_ledger.ledger_audit_log (entity_table, entity_id, created_at DESC);

-- Log every new transaction (fingerprint at rest).
CREATE OR REPLACE FUNCTION parable_ledger.log_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO parable_ledger.ledger_audit_log (
    entity_table,
    entity_id,
    action,
    actor_user_id,
    reason,
    payload
  )
  VALUES (
    'transactions',
    NEW.id,
    'insert',
    auth.uid(),
    COALESCE(NEW.metadata ->> 'audit_reason', NULL),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_transactions_audit_insert
AFTER INSERT ON parable_ledger.transactions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.log_transaction_insert();

-- -----------------------------------------------------------------------------
-- RLS (Supabase): enable only after org-scoped policies exist. Leaving RLS off
-- avoids locking tables on first import. Typical pattern:
--   ALTER TABLE parable_ledger.transactions ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "tenant_select" ON parable_ledger.transactions FOR SELECT
--     USING (ministry_id IN (SELECT ministry_id FROM parable_ledger.user_ministries WHERE user_id = auth.uid()));
-- Audit log: SELECT for finance roles only; INSERT via trigger or SECURITY DEFINER RPC.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Optional seed for local dev
-- -----------------------------------------------------------------------------
INSERT INTO parable_ledger.ministry_funds (fund_code, fund_name, is_restricted)
VALUES
  ('GEN', 'General / Unrestricted', false),
  ('MSN', 'Missions (Restricted)', true),
  ('BLD', 'Building (Restricted)', true)
ON CONFLICT (fund_code) DO NOTHING;

-- PostgREST / JS client (tighten with RLS later)
GRANT USAGE ON SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA parable_ledger
    GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA parable_ledger
    GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
