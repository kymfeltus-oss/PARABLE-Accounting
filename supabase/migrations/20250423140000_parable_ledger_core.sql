-- =============================================================================
-- PARABLE Ledger — core schema (funds, transactions, audit log)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS parable_ledger;

CREATE TABLE parable_ledger.ministry_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code TEXT UNIQUE,
    fund_name TEXT NOT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
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

CREATE TABLE parable_ledger.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES parable_ledger.ministry_funds (id),
    amount NUMERIC(14, 2) NOT NULL,
    tx_type TEXT NOT NULL CHECK (tx_type IN ('donation', 'revenue', 'expense', 'transfer', 'reversal')),
    source TEXT,
    is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
    contribution_nature TEXT NOT NULL DEFAULT 'charitable_gift'
        CHECK (contribution_nature IN ('charitable_gift', 'exchange_transaction', 'mixed', 'ubit_candidate')),
    reverses_transaction_id UUID REFERENCES parable_ledger.transactions (id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reversal_amount CHECK (
        (tx_type <> 'reversal') OR (reverses_transaction_id IS NOT NULL)
    )
);

COMMENT ON TABLE parable_ledger.transactions IS 'Append-only economic events; correct via reversal row, not UPDATE/DELETE.';

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

CREATE TABLE parable_ledger.ledger_audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_schema TEXT NOT NULL DEFAULT 'parable_ledger',
    entity_table TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('insert', 'void_request', 'policy_note', 'export', 'login_context')),
    actor_user_id UUID,
    reason TEXT,
    payload JSONB NOT NULL,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

INSERT INTO parable_ledger.ministry_funds (fund_code, fund_name, is_restricted)
VALUES
  ('GEN', 'General / Unrestricted', false),
  ('MSN', 'Missions (Restricted)', true),
  ('BLD', 'Building (Restricted)', true)
ON CONFLICT (fund_code) DO NOTHING;

-- PostgREST / Supabase client access (tighten with RLS later)
GRANT USAGE ON SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA parable_ledger TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA parable_ledger
    GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA parable_ledger
    GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
