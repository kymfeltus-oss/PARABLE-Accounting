-- see close_audit_system.sql in repo root (idempotent)
CREATE TABLE IF NOT EXISTS parable_ledger.close_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    reporting_period TEXT NOT NULL,
    gate_number INT NOT NULL CHECK (gate_number >= 1 AND gate_number <= 4),
    task_name TEXT NOT NULL,
    completed_by_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    verifier_name TEXT,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_close_checklist_period_task UNIQUE (tenant_id, reporting_period, task_name)
);

CREATE INDEX IF NOT EXISTS idx_close_checklist_tenant_period
    ON parable_ledger.close_checklists (tenant_id, reporting_period, gate_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.close_checklists TO postgres, service_role, authenticated, anon;
ALTER TABLE parable_ledger.close_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS close_checklists_all ON parable_ledger.close_checklists;
CREATE POLICY close_checklists_all ON parable_ledger.close_checklists
    FOR ALL TO postgres, service_role, authenticated, anon USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW parable_ledger.view_staff_directory AS
SELECT
    so.id AS id,
    so.full_name AS staff_name,
    so.tenant_id
FROM parable_ledger.staff_onboarding so
WHERE so.full_name IS NOT NULL AND btrim(so.full_name) <> '';

GRANT SELECT ON parable_ledger.view_staff_directory TO postgres, service_role, authenticated, anon;

CREATE OR REPLACE FUNCTION parable_ledger.close_checklists_set_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.completed_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_close_checklists_at ON parable_ledger.close_checklists;
CREATE TRIGGER tr_close_checklists_at
    BEFORE INSERT OR UPDATE ON parable_ledger.close_checklists
    FOR EACH ROW
    EXECUTE PROCEDURE parable_ledger.close_checklists_set_completed_at();
