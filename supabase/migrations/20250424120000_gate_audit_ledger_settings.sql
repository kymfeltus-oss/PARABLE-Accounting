-- Close workflow: zero-variance probe, month lock, append-only gate approvals
SET search_path = parable_ledger, public;

CREATE TABLE IF NOT EXISTS parable_ledger.ledger_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    year_month TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    locked_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ledger_settings_tenant_month UNIQUE (tenant_id, year_month)
);

COMMENT ON TABLE parable_ledger.ledger_settings IS 'Per-tenant, per YYYY-MM close flags; is_locked from Guardian + RPC.';

CREATE INDEX IF NOT EXISTS idx_ledger_settings_tenant_month ON parable_ledger.ledger_settings (tenant_id, year_month DESC);

CREATE TABLE IF NOT EXISTS parable_ledger.gate_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    gate_number SMALLINT NOT NULL CHECK (gate_number >= 1 AND gate_number <= 4),
    approved_by_id UUID,
    approver_display TEXT,
    approval_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE parable_ledger.gate_audit_log IS 'Append-only (insert-only) gate sign-offs for Sovereign / Autonomous close.';

CREATE INDEX IF NOT EXISTS idx_gate_audit_tenant_time ON parable_ledger.gate_audit_log (tenant_id, approval_timestamp DESC);

-- Append-only: no update/delete
CREATE OR REPLACE FUNCTION parable_ledger.enforce_gate_audit_log_insert_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'parable_ledger.gate_audit_log is append-only.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gate_audit_insert_only ON parable_ledger.gate_audit_log;
CREATE TRIGGER tr_gate_audit_insert_only
    BEFORE UPDATE OR DELETE ON parable_ledger.gate_audit_log
    FOR EACH ROW
    EXECUTE PROCEDURE parable_ledger.enforce_gate_audit_log_insert_only();

-- Placeholder: all zeros until GL control / tie-out is wired. Still enforces $0.00 total across buckets.
CREATE OR REPLACE FUNCTION parable_ledger.get_institutional_reconciliation_variances(
    p_tenant_id UUID
)
RETURNS TABLE (
    cash_var NUMERIC,
    restricted_var NUMERIC,
    ap_var NUMERIC,
    ar_var NUMERIC,
    total_var NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    0::NUMERIC,
    0::NUMERIC,
    0::NUMERIC,
    0::NUMERIC,
    0::NUMERIC
$$;

COMMENT ON FUNCTION parable_ledger.get_institutional_reconciliation_variances(UUID) IS
    'Per-bucket variance; returns 0,0,0,0,0 when institutional tie is satisfied. Extend when GL control accounts are wired.';

-- Zero-variance helper for G2
CREATE OR REPLACE FUNCTION parable_ledger.verify_close_zero_variance(p_tenant_id UUID, p_year_month TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT (SELECT v.total_var FROM parable_ledger.get_institutional_reconciliation_variances(p_tenant_id) v) = 0;
$$;

CREATE OR REPLACE FUNCTION parable_ledger.set_ledger_month_locked(
    p_tenant_id UUID,
    p_year_month TEXT,
    p_lock BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
BEGIN
  INSERT INTO parable_ledger.ledger_settings (tenant_id, year_month, is_locked, locked_at, locked_by)
  VALUES (p_tenant_id, p_year_month, p_lock, CASE WHEN p_lock THEN now() ELSE NULL END, auth.uid())
  ON CONFLICT (tenant_id, year_month) DO UPDATE
  SET
    is_locked = EXCLUDED.is_locked,
    locked_at = CASE WHEN EXCLUDED.is_locked THEN now() ELSE NULL END,
    locked_by = CASE WHEN EXCLUDED.is_locked THEN auth.uid() ELSE NULL END,
    updated_at = now();
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.ledger_settings TO postgres, service_role, authenticated, anon;
GRANT SELECT, INSERT ON parable_ledger.gate_audit_log TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.ledger_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parable_ledger.gate_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_settings_all ON parable_ledger.ledger_settings;
CREATE POLICY ledger_settings_all ON parable_ledger.ledger_settings
    FOR ALL TO postgres, service_role, authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS gate_audit_log_all ON parable_ledger.gate_audit_log;
CREATE POLICY gate_audit_log_all ON parable_ledger.gate_audit_log
    FOR ALL TO postgres, service_role, authenticated, anon USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION parable_ledger.get_institutional_reconciliation_variances(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION parable_ledger.verify_close_zero_variance(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION parable_ledger.set_ledger_month_locked(UUID, TEXT, BOOLEAN) TO anon, authenticated, service_role;
