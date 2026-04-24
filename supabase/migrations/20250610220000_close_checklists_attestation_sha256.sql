-- Fingerprint: SHA-256 of tenant_id|reporting_period|task_name (hex) — Gate 1 handshake / audit
ALTER TABLE parable_ledger.close_checklists
  ADD COLUMN IF NOT EXISTS attestation_sha256 TEXT;

COMMENT ON COLUMN parable_ledger.close_checklists.attestation_sha256 IS
  'Client-computed SHA-256 hex: tenant_id|reporting_period|task_name';

NOTIFY pgrst, 'reload schema';
