-- Idempotent: greenfield or hand-built tenants without brand columns
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#22d3ee';
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#050505';

NOTIFY pgrst, 'reload schema';
